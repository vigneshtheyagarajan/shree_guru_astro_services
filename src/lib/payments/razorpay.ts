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
 * Creates a Razorpay Order immediately for a booking, before the session
 * happens -- every booking (chat or call) must be paid upfront. This does
 * NOT change booking.status -- the booking stays CONFIRMED/IN_PROGRESS
 * through the session, and only the PaymentLink tracks payment. Session
 * access (chat send, call join) is gated on that PaymentLink's status
 * elsewhere.
 */
export async function createUpfrontPaymentLinkForBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { serviceOffering: { include: { service: true } }, client: true },
  });
  if (!booking) throw new Error("Booking not found");

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

  // Payment always arrives before the session (booking stays CONFIRMED/
  // IN_PROGRESS) -- "Mark Complete" is what later moves the booking to PAID
  // and fires the review request, so this only needs to settle the
  // PaymentLink itself.
  const now = new Date();
  await prisma.paymentLink.update({
    where: { id: paymentLink.id },
    data: { status: "PAID", paidAt: now },
  });
  const booking = paymentLink.booking;

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
  ]);

  return { updated: true as const };
}
