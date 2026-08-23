import { NextResponse } from "next/server";
import { Razorpay, markBookingPaidFromPaymentLink } from "@/lib/payments/razorpay";
import { updatePayoutFromWebhook } from "@/lib/payments/razorpayPayouts";
import { creditWalletFromTopUp } from "@/lib/wallet";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  const isValid = Razorpay.validateWebhookSignature(rawBody, signature, secret);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);

  // Current flow: embedded Checkout against a Razorpay Order. Payment is
  // primarily confirmed client-side (see /api/bookings/[id]/pay/verify and
  // /api/wallet/top-up/verify) with the reconciliation cron as a backstop,
  // so this webhook is a third, optional layer -- harmless if never
  // configured, useful the moment it is.
  if (event.event === "payment.captured") {
    const orderId = event.payload?.payment?.entity?.order_id;
    if (orderId) {
      const result = await markBookingPaidFromPaymentLink(orderId);
      if (!result.updated && result.reason === "payment_link_not_found") {
        await creditWalletFromTopUp(orderId);
      }
    }
  }

  // Legacy: Payment Links (redirect flow), kept for any pre-existing rows.
  if (event.event === "payment_link.paid") {
    const razorpayLinkId = event.payload?.payment_link?.entity?.id;
    if (razorpayLinkId) {
      const result = await markBookingPaidFromPaymentLink(razorpayLinkId);
      if (!result.updated && result.reason === "payment_link_not_found") {
        await creditWalletFromTopUp(razorpayLinkId);
      }
    }
  }

  if (event.event?.startsWith("payout.")) {
    const payoutEntity = event.payload?.payout?.entity;
    if (payoutEntity?.id) {
      await updatePayoutFromWebhook(
        payoutEntity.id,
        payoutEntity.status,
        payoutEntity.failure_reason,
      );
    }
  }

  return NextResponse.json({ ok: true });
}
