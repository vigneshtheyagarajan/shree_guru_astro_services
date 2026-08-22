import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/lib/notifications/NotificationService";
import { getEffectiveCommissionPercent } from "@/lib/platformSettings";
import type { AstrologerProfile } from "@/generated/prisma/client";

const KEY_ID = process.env.RAZORPAY_KEY_ID as string;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET as string;
const ACCOUNT_NUMBER = process.env.RAZORPAYX_ACCOUNT_NUMBER as string;
const BASE_URL = "https://api.razorpay.com/v1";

function authHeader() {
  return `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64")}`;
}

async function razorpayFetch(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.description ?? `RazorpayX request to ${path} failed`;
    throw new Error(message);
  }
  return data;
}

export function hasPayoutDetails(profile: AstrologerProfile) {
  return !!(profile.payoutAccountHolderName && profile.payoutAccountNumber && profile.payoutIfscCode);
}

/**
 * Creates (and persists) a RazorpayX Contact + Fund Account for the
 * astrologer if one doesn't already exist. Reused across payouts so we only
 * register the bank details once.
 */
async function ensureFundAccount(profile: AstrologerProfile) {
  if (profile.razorpayContactId && profile.razorpayFundAccountId) {
    return {
      contactId: profile.razorpayContactId,
      fundAccountId: profile.razorpayFundAccountId,
    };
  }

  const contact = await razorpayFetch("/contacts", {
    name: profile.payoutAccountHolderName,
    type: "vendor",
    reference_id: profile.id,
  });

  const fundAccount = await razorpayFetch("/fund_accounts", {
    contact_id: contact.id,
    account_type: "bank_account",
    bank_account: {
      name: profile.payoutAccountHolderName,
      ifsc: profile.payoutIfscCode,
      account_number: profile.payoutAccountNumber,
    },
  });

  await prisma.astrologerProfile.update({
    where: { id: profile.id },
    data: { razorpayContactId: contact.id, razorpayFundAccountId: fundAccount.id },
  });

  return { contactId: contact.id, fundAccountId: fundAccount.id };
}

/**
 * Pays an astrologer out for one PAID/RATED booking via RazorpayX Payouts.
 * Always creates a Payout audit row, even if the RazorpayX call fails, so
 * admins can see and retry failures rather than the booking silently having
 * no payout record.
 */
export async function createPayoutForBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { serviceOffering: true, astrologer: true, payout: true },
  });
  if (!booking) throw new Error("Booking not found");
  if (booking.payout) throw new Error("A payout already exists for this booking");
  if (booking.status !== "PAID" && booking.status !== "RATED") {
    throw new Error("Payouts can only be created for paid bookings");
  }
  if (!hasPayoutDetails(booking.astrologer)) {
    throw new Error("Astrologer hasn't added payout bank details yet");
  }

  const grossAmount = booking.serviceOffering.pricePerSession;
  const commissionPercent = await getEffectiveCommissionPercent(
    booking.astrologer.commissionPercent,
  );
  const amount = Math.round(grossAmount * (1 - commissionPercent / 100));

  try {
    const { fundAccountId } = await ensureFundAccount(booking.astrologer);

    const payoutResponse = await razorpayFetch("/payouts", {
      account_number: ACCOUNT_NUMBER,
      fund_account_id: fundAccountId,
      amount: amount * 100,
      currency: "INR",
      mode: "IMPS",
      purpose: "payout",
      queue_if_low_balance: true,
      reference_id: booking.id,
    });

    const payout = await prisma.payout.create({
      data: {
        bookingId: booking.id,
        astrologerId: booking.astrologerId,
        amount,
        commissionPercent,
        status: mapRazorpayPayoutStatus(payoutResponse.status),
        razorpayPayoutId: payoutResponse.id,
      },
    });

    await NotificationService.send(booking.astrologer.userId, "PAYOUT_PROCESSED", {
      title: "Payout initiated",
      message: `A payout of ₹${amount} for your session has been initiated.`,
      url: `/astrologer/payouts`,
    });

    return payout;
  } catch (error) {
    console.error("Failed to create RazorpayX payout", error);
    return prisma.payout.create({
      data: {
        bookingId: booking.id,
        astrologerId: booking.astrologerId,
        amount,
        commissionPercent,
        status: "FAILED",
        failureReason: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

function mapRazorpayPayoutStatus(status: string) {
  switch (status) {
    case "processed":
      return "PROCESSED" as const;
    case "reversed":
      return "REVERSED" as const;
    case "rejected":
    case "cancelled":
      return "FAILED" as const;
    case "queued":
    case "pending":
      return "PENDING" as const;
    default:
      return "PROCESSING" as const;
  }
}

/**
 * Applies a status update from a RazorpayX payout.* webhook event. Idempotent.
 */
export async function updatePayoutFromWebhook(
  razorpayPayoutId: string,
  status: string,
  failureReason?: string,
) {
  const payout = await prisma.payout.findFirst({
    where: { razorpayPayoutId },
    include: { astrologer: true },
  });
  if (!payout) return { updated: false as const };

  const mapped = mapRazorpayPayoutStatus(status);
  await prisma.payout.update({
    where: { id: payout.id },
    data: {
      status: mapped,
      failureReason: mapped === "FAILED" ? failureReason ?? payout.failureReason : null,
      processedAt: mapped === "PROCESSED" ? new Date() : payout.processedAt,
    },
  });

  if (mapped === "PROCESSED") {
    await NotificationService.send(payout.astrologer.userId, "PAYOUT_PROCESSED", {
      title: "Payout completed",
      message: `Your payout of ₹${payout.amount} has been processed.`,
      url: `/astrologer/payouts`,
    });
  }

  return { updated: true as const };
}
