import crypto from "crypto";
import Razorpay from "razorpay";
import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/lib/notifications/NotificationService";

const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET as string;

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID as string,
  key_secret: KEY_SECRET,
});

export { Razorpay };

async function createRazorpayOrderRecord(booking: {
  id: string;
  clientId: string;
  serviceOffering: { pricePerSession: number; service: { name: string } };
}) {
  const amountRupees = booking.serviceOffering.pricePerSession;

  const order = await razorpay.orders.create({
    amount: amountRupees * 100,
    currency: "INR",
    receipt: booking.id,
    payment_capture: true,
    notes: { bookingId: booking.id },
  });

  await prisma.paymentLink.create({
    data: {
      bookingId: booking.id,
      razorpayOrderId: order.id,
      amount: amountRupees,
      status: "CREATED",
    },
  });

  return order;
}

/**
 * Creates a Razorpay Order for a COMPLETED booking, stores it, and moves the
 * booking to PAYMENT_LINK_SENT. The client pays via an embedded Razorpay
 * Checkout modal on the booking page (see RazorpayCheckoutButton), not a
 * redirect -- ServiceOffering.pricePerSession is stored in whole rupees;
 * Razorpay expects the smallest currency subunit (paise), hence the *100.
 * Used for the post-session (in-person) flow.
 */
export async function createPaymentLinkForBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { serviceOffering: { include: { service: true } }, client: true },
  });
  if (!booking) throw new Error("Booking not found");
  if (booking.status !== "COMPLETED") {
    throw new Error("Payment can only be set up for completed bookings");
  }

  const order = await createRazorpayOrderRecord(booking);

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "PAYMENT_LINK_SENT" },
  });

  await NotificationService.send(booking.clientId, "PAYMENT_LINK_SENT", {
    title: "Payment ready",
    message: `Please complete payment of ₹${booking.serviceOffering.pricePerSession} for your ${booking.serviceOffering.service.name} session.`,
    url: `/bookings/${booking.id}`,
  });

  return order;
}

/**
 * Creates a Razorpay Order immediately for a live-mode (chat/phone/video)
 * booking, before the session happens. Unlike the post-session flow, this
 * does NOT change booking.status -- the booking stays CONFIRMED/IN_PROGRESS
 * through the session, and only the PaymentLink tracks payment. Session
 * access (chat, video join, phone reveal) is gated on that PaymentLink's
 * status elsewhere.
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

  const order = await createRazorpayOrderRecord(booking);

  await NotificationService.send(booking.clientId, "PAYMENT_LINK_SENT", {
    title: "Payment required to start your session",
    message: `Please complete payment of ₹${booking.serviceOffering.pricePerSession} to start your ${booking.serviceOffering.service.name} session.`,
    url: `/bookings/${booking.id}`,
  });

  return order;
}

/**
 * Verifies the signature Razorpay Checkout returns to the browser after a
 * successful payment. This is what makes the embedded-Checkout flow safe
 * without needing a webhook: the client-side success callback alone is not
 * trustworthy (anyone could fabricate that call), but this HMAC can only be
 * produced by someone holding the account's key secret -- i.e. Razorpay.
 */
export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
) {
  const expected = crypto
    .createHmac("sha256", KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expected === signature;
}

/**
 * Applies the PAID transition: marks the PaymentLink and Booking paid, and
 * notifies both parties + prompts the client for a review. Idempotent --
 * safe to call from the Checkout verification endpoint and the
 * reconciliation cron alike. Accepts either a Razorpay Order ID (current
 * embedded-Checkout flow) or a legacy Payment Link ID (any pre-existing
 * rows from the old redirect flow).
 */
export async function markBookingPaidFromPaymentLink(razorpayIdentifier: string) {
  const paymentLink = await prisma.paymentLink.findFirst({
    where: {
      OR: [{ razorpayOrderId: razorpayIdentifier }, { razorpayLinkId: razorpayIdentifier }],
    },
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
