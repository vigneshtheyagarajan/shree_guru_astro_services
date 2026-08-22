import { prisma } from "@/lib/prisma";
import { razorpay } from "@/lib/payments/razorpay";
import { NotificationService } from "@/lib/notifications/NotificationService";

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
 * Creates a Razorpay Payment Link for a wallet top-up. On payment, the
 * webhook credits the wallet (amount + any loyalty bonus for top-ups of
 * ₹1000+) via creditWalletFromTopUp.
 */
export async function createWalletTopUp(userId: string, amount: number) {
  const wallet = await getOrCreateWallet(userId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const bonusAmount = bonusForAmount(amount);

  const link = await razorpay.paymentLink.create({
    amount: amount * 100,
    currency: "INR",
    accept_partial: false,
    description: `Wallet top-up${bonusAmount ? ` (+₹${bonusAmount} bonus)` : ""}`,
    customer: {
      name: user.name,
      email: user.email,
      contact: user.phone ?? undefined,
    },
    notify: { sms: false, email: false },
    reference_id: `wallet-${wallet.id}-${Date.now()}`,
  });

  await prisma.walletTopUp.create({
    data: {
      walletId: wallet.id,
      amount,
      bonusAmount,
      razorpayLinkId: link.id,
      shortUrl: link.short_url,
      status: "CREATED",
    },
  });

  return link;
}

/**
 * Applies a paid wallet top-up: credits the base amount + loyalty bonus and
 * records both as WalletTransaction rows. Idempotent -- safe to call twice
 * for the same webhook event.
 */
export async function creditWalletFromTopUp(razorpayLinkId: string) {
  const topUp = await prisma.walletTopUp.findFirst({
    where: { razorpayLinkId },
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

  // See markBookingPaidFromPaymentLink in razorpay.ts for why this only
  // advances booking.status for post-session (in-person) payments.
  const isPostSessionPayment = booking.status === "COMPLETED";

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
      data: { status: "PAID", paidAt: new Date() },
    }),
    ...(isPostSessionPayment
      ? [prisma.booking.update({ where: { id: bookingId }, data: { status: "PAID" } })]
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
  if (isPostSessionPayment) {
    notifications.push(
      NotificationService.send(booking.clientId, "REVIEW_REQUEST", {
        title: "How was your session?",
        message: `Leave a rating for your ${serviceName} session with ${booking.astrologer.user.name}.`,
        url: `/bookings/${booking.id}`,
      }),
    );
  }
  await Promise.all(notifications);
}

export { WalletError };
