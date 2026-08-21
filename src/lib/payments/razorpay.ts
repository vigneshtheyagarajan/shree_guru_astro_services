import Razorpay from "razorpay";
import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/lib/notifications/NotificationService";

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID as string,
  key_secret: process.env.RAZORPAY_KEY_SECRET as string,
});

export { Razorpay };

/**
 * Creates a Razorpay Payment Link for a COMPLETED booking, stores it, and
 * moves the booking to PAYMENT_LINK_SENT. ServiceOffering.pricePerSession is
 * stored in whole rupees; Razorpay expects the smallest currency subunit
 * (paise), hence the *100.
 */
export async function createPaymentLinkForBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { serviceOffering: { include: { service: true } }, client: true },
  });
  if (!booking) throw new Error("Booking not found");
  if (booking.status !== "COMPLETED") {
    throw new Error("Payment links can only be created for completed bookings");
  }

  const amountRupees = booking.serviceOffering.pricePerSession;

  const link = await razorpay.paymentLink.create({
    amount: amountRupees * 100,
    currency: "INR",
    accept_partial: false,
    description: `${booking.serviceOffering.service.name} consultation`,
    customer: {
      name: booking.client.name,
      email: booking.client.email,
      contact: booking.client.phone ?? undefined,
    },
    notify: { sms: false, email: false },
    reference_id: booking.id,
  });

  await prisma.paymentLink.create({
    data: {
      bookingId: booking.id,
      razorpayLinkId: link.id,
      shortUrl: link.short_url,
      amount: amountRupees,
      status: "CREATED",
    },
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "PAYMENT_LINK_SENT" },
  });

  await NotificationService.send(booking.clientId, "PAYMENT_LINK_SENT", {
    title: "Payment link ready",
    message: `Please complete payment of ₹${amountRupees} for your ${booking.serviceOffering.service.name} session.`,
    url: link.short_url,
  });

  return link;
}

/**
 * Applies the PAID transition: marks the PaymentLink and Booking paid, and
 * notifies both parties + prompts the client for a review. Idempotent --
 * safe to call from both the webhook and the reconciliation cron.
 */
export async function markBookingPaidFromPaymentLink(razorpayLinkId: string) {
  const paymentLink = await prisma.paymentLink.findFirst({
    where: { razorpayLinkId },
    include: {
      booking: {
        include: {
          astrologer: { include: { user: true } },
          serviceOffering: { include: { service: true } },
        },
      },
    },
  });
  if (!paymentLink) return { updated: false, reason: "payment_link_not_found" as const };
  if (paymentLink.status === "PAID") return { updated: false, reason: "already_paid" as const };

  const now = new Date();
  await prisma.paymentLink.update({
    where: { id: paymentLink.id },
    data: { status: "PAID", paidAt: now },
  });
  const booking = await prisma.booking.update({
    where: { id: paymentLink.bookingId },
    data: { status: "PAID" },
  });

  const serviceName = paymentLink.booking.serviceOffering.service.name;
  await Promise.all([
    NotificationService.send(booking.clientId, "PAYMENT_RECEIVED", {
      title: "Payment received",
      message: `Thanks! Your payment for ${serviceName} was received.`,
      url: `/bookings/${booking.id}`,
    }),
    NotificationService.send(paymentLink.booking.astrologer.userId, "PAYMENT_RECEIVED", {
      title: "Payment received",
      message: `The client's payment for ${serviceName} was received.`,
      url: `/bookings/${booking.id}`,
    }),
    NotificationService.send(booking.clientId, "REVIEW_REQUEST", {
      title: "How was your session?",
      message: `Leave a rating for your ${serviceName} session with ${paymentLink.booking.astrologer.user.name}.`,
      url: `/bookings/${booking.id}`,
    }),
  ]);

  return { updated: true as const };
}
