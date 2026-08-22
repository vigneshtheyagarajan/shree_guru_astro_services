import Razorpay from "razorpay";
import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/lib/notifications/NotificationService";

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID as string,
  key_secret: process.env.RAZORPAY_KEY_SECRET as string,
});

export { Razorpay };

async function createRazorpayPaymentLinkRecord(booking: {
  id: string;
  clientId: string;
  serviceOffering: { pricePerSession: number; service: { name: string } };
  client: { name: string; email: string; phone: string | null };
}) {
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

  return link;
}

/**
 * Creates a Razorpay Payment Link for a COMPLETED booking, stores it, and
 * moves the booking to PAYMENT_LINK_SENT. ServiceOffering.pricePerSession is
 * stored in whole rupees; Razorpay expects the smallest currency subunit
 * (paise), hence the *100. Used for the post-session (in-person) flow.
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

  const link = await createRazorpayPaymentLinkRecord(booking);

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "PAYMENT_LINK_SENT" },
  });

  await NotificationService.send(booking.clientId, "PAYMENT_LINK_SENT", {
    title: "Payment link ready",
    message: `Please complete payment of ₹${booking.serviceOffering.pricePerSession} for your ${booking.serviceOffering.service.name} session.`,
    url: link.short_url,
  });

  return link;
}

/**
 * Creates a Razorpay Payment Link immediately for a live-mode (chat/phone/
 * video) booking, before the session happens. Unlike the post-session flow,
 * this does NOT change booking.status -- the booking stays CONFIRMED/
 * IN_PROGRESS through the session, and only the PaymentLink tracks payment.
 * Session access (chat, video join, phone reveal) is gated on that
 * PaymentLink's status elsewhere.
 */
export async function createUpfrontPaymentLinkForBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { serviceOffering: { include: { service: true } }, client: true },
  });
  if (!booking) throw new Error("Booking not found");
  if (booking.mode === "IN_PERSON") {
    throw new Error("In-person bookings are paid after the session, not upfront");
  }

  const link = await createRazorpayPaymentLinkRecord(booking);

  await NotificationService.send(booking.clientId, "PAYMENT_LINK_SENT", {
    title: "Payment required to start your session",
    message: `Please complete payment of ₹${booking.serviceOffering.pricePerSession} to start your ${booking.serviceOffering.service.name} session.`,
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

  // Post-session (in-person) payments arrive with the booking already
  // COMPLETED, so this transitions it straight to PAID. Upfront payments for
  // live-mode bookings arrive while the booking is still CONFIRMED/
  // IN_PROGRESS -- the session hasn't happened yet, so booking.status is
  // left alone; "Mark Complete" is what later moves it to PAID.
  const isPostSessionPayment = paymentLink.booking.status === "COMPLETED";

  const now = new Date();
  await prisma.paymentLink.update({
    where: { id: paymentLink.id },
    data: { status: "PAID", paidAt: now },
  });
  const booking = isPostSessionPayment
    ? await prisma.booking.update({
        where: { id: paymentLink.bookingId },
        data: { status: "PAID" },
      })
    : paymentLink.booking;

  const serviceName = paymentLink.booking.serviceOffering.service.name;
  const notifications = [
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
  ];
  if (isPostSessionPayment) {
    notifications.push(
      NotificationService.send(booking.clientId, "REVIEW_REQUEST", {
        title: "How was your session?",
        message: `Leave a rating for your ${serviceName} session with ${paymentLink.booking.astrologer.user.name}.`,
        url: `/bookings/${booking.id}`,
      }),
    );
  }
  await Promise.all(notifications);

  return { updated: true as const };
}
