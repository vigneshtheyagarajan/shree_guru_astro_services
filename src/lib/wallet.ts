import { prisma } from "@/lib/prisma";
import { razorpay } from "@/lib/payments/razorpay";
import { NotificationService } from "@/lib/notifications/NotificationService";
import { formatDateTimeLong } from "@/lib/dateFormat";

const LOYALTY_BONUS_THRESHOLD = 1000;
const LOYALTY_BONUS_RATE = 0.1;

class WalletError extends Error {}

export async function getOrCreateWallet(userId: string) {
  return prisma.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

function bonusForAmount(amount: number) {
  return amount >= LOYALTY_BONUS_THRESHOLD ? Math.floor(amount * LOYALTY_BONUS_RATE) : 0;
}

/**
 * Creates a Razorpay Order for a wallet top-up. The client pays via an
 * embedded Razorpay Checkout modal (see RazorpayCheckoutButton) and the
 * wallet is credited (amount + any loyalty bonus for top-ups of ₹1000+) as
 * soon as the client-side verification endpoint confirms the payment
 * signature -- see creditWalletFromTopUp.
 */
export async function createWalletTopUp(userId: string, amount: number) {
  const wallet = await getOrCreateWallet(userId);
  const bonusAmount = bonusForAmount(amount);

  const order = await razorpay.orders.create({
    amount: amount * 100,
    currency: "INR",
    receipt: `wallet-${wallet.id}-${Date.now()}`,
    payment_capture: true,
    notes: { walletId: wallet.id },
  });

  await prisma.walletTopUp.create({
    data: {
      walletId: wallet.id,
      amount,
      bonusAmount,
      razorpayOrderId: order.id,
      status: "CREATED",
    },
  });

  return order;
}

/**
 * Applies a paid wallet top-up: credits the base amount + loyalty bonus and
 * records both as WalletTransaction rows. Idempotent -- safe to call twice
 * for the same order (from the verification endpoint and the reconciliation
 * cron alike). Accepts either a Razorpay Order ID (current embedded-Checkout
 * flow) or a legacy Payment Link ID (any pre-existing rows from the old
 * redirect flow).
 */
export async function creditWalletFromTopUp(razorpayIdentifier: string) {
  const topUp = await prisma.walletTopUp.findFirst({
    where: {
      OR: [{ razorpayOrderId: razorpayIdentifier }, { razorpayLinkId: razorpayIdentifier }],
    },
    include: { wallet: true },
  });
  if (!topUp) return { updated: false as const, reason: "top_up_not_found" as const };
  if (topUp.status === "PAID") return { updated: false as const, reason: "already_paid" as const };

  const creditAmount = topUp.amount + topUp.bonusAmount;

  await prisma.$transaction([
    prisma.walletTopUp.update({
      where: { id: topUp.id },
      data: { status: "PAID", paidAt: new Date() },
    }),
    prisma.wallet.update({
      where: { id: topUp.walletId },
      data: { balance: { increment: creditAmount } },
    }),
    prisma.walletTransaction.create({
      data: { walletId: topUp.walletId, amount: topUp.amount, type: "TOP_UP" },
    }),
    ...(topUp.bonusAmount > 0
      ? [
          prisma.walletTransaction.create({
            data: { walletId: topUp.walletId, amount: topUp.bonusAmount, type: "LOYALTY_BONUS" },
          }),
        ]
      : []),
  ]);

  await NotificationService.send(topUp.wallet.userId, "WALLET_TOPPED_UP", {
    title: "Wallet topped up",
    message: `₹${creditAmount} was added to your wallet${
      topUp.bonusAmount ? ` (includes a ₹${topUp.bonusAmount} loyalty bonus)` : ""
    }.`,
    url: "/wallet",
  });

  return { updated: true as const };
}

/**
 * Pays a booking's outstanding payment link out of the client's wallet
 * balance instead of an external Razorpay payment -- an internal ledger
 * transfer against funds the client already topped up, not a new charge.
 */
export async function payBookingFromWallet(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      paymentLink: true,
      serviceOffering: { include: { service: true } },
      astrologer: { include: { user: true } },
      slot: true,
    },
  });
  if (!booking || booking.clientId !== userId) {
    throw new WalletError("Booking not found.");
  }
  if (!booking.paymentLink || booking.paymentLink.status !== "CREATED") {
    throw new WalletError("No payment is due for this booking.");
  }

  const wallet = await getOrCreateWallet(userId);
  if (wallet.balance < booking.paymentLink.amount) {
    throw new WalletError("Insufficient wallet balance.");
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: booking.paymentLink.amount } },
    }),
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: -booking.paymentLink.amount,
        type: "BOOKING_PAYMENT",
        bookingId,
      },
    }),
    prisma.paymentLink.update({
      where: { id: booking.paymentLink.id },
      data: { status: "PAID", paidAt: now },
    }),
    ...(booking.status === "PENDING"
      ? [prisma.booking.update({ where: { id: bookingId }, data: { status: "CONFIRMED", confirmedAt: now } })]
      : []),
  ]);

  const serviceName = booking.serviceOffering.service.name;
  const notifications = [
    NotificationService.send(booking.clientId, "PAYMENT_RECEIVED", {
      title: "Payment received",
      message: `Thanks! Your payment for ${serviceName} was received.`,
      url: `/bookings/${booking.id}`,
    }),
    NotificationService.send(booking.astrologer.userId, "PAYMENT_RECEIVED", {
      title: "Payment received",
      message: `The client's payment for ${serviceName} was received.`,
      url: `/bookings/${booking.id}`,
    }),
  ];

  // See markBookingPaidFromPaymentLink in razorpay.ts -- the booking only
  // becomes real (and the astrologer gets told) once payment lands.
  if (booking.status === "PENDING") {
    const scheduledFor = formatDateTimeLong(booking.slot.startAt);
    notifications.push(
      NotificationService.send(booking.clientId, "BOOKING_CONFIRMED", {
        title: "Booking confirmed",
        message: `Your ${serviceName} session is confirmed for ${scheduledFor}.`,
        url: `/bookings/${booking.id}`,
      }),
      NotificationService.send(booking.astrologer.userId, "BOOKING_CONFIRMED", {
        title: "New booking",
        message: `You have a new ${serviceName} session on ${scheduledFor}.`,
        url: `/bookings/${booking.id}`,
      }),
    );
  }

  await Promise.all(notifications);
}

export { WalletError };
