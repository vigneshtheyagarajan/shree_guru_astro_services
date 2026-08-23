import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { razorpay, markBookingPaidFromPaymentLink } from "@/lib/payments/razorpay";
import { creditWalletFromTopUp } from "@/lib/wallet";

// Intended to run every few minutes (see .github/workflows/frequent-crons.yml)
// as a safety net for the embedded-Checkout flow: if a client's browser
// closes or a network drop happens right after paying -- before the
// client-side verification call reaches our server -- this cross-checks any
// still-CREATED orders against Razorpay's own status API and applies the
// PAID transition. Also the primary path for accounts where Razorpay
// webhooks aren't configured.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let checked = 0;
  let reconciled = 0;
  let failed = 0;

  const pendingBookingPayments = await prisma.paymentLink.findMany({
    where: { status: "CREATED", razorpayOrderId: { not: null } },
  });
  for (const payment of pendingBookingPayments) {
    checked += 1;
    try {
      const order = await razorpay.orders.fetch(payment.razorpayOrderId as string);
      if (order.status === "paid") {
        const result = await markBookingPaidFromPaymentLink(payment.razorpayOrderId as string);
        if (result.updated) reconciled += 1;
      }
    } catch (error) {
      failed += 1;
      console.error(`Failed to reconcile order ${payment.razorpayOrderId}`, error);
    }
  }

  const pendingTopUps = await prisma.walletTopUp.findMany({
    where: { status: "CREATED", razorpayOrderId: { not: null } },
  });
  for (const topUp of pendingTopUps) {
    checked += 1;
    try {
      const order = await razorpay.orders.fetch(topUp.razorpayOrderId as string);
      if (order.status === "paid") {
        const result = await creditWalletFromTopUp(topUp.razorpayOrderId as string);
        if (result.updated) reconciled += 1;
      }
    } catch (error) {
      failed += 1;
      console.error(`Failed to reconcile wallet top-up order ${topUp.razorpayOrderId}`, error);
    }
  }

  return NextResponse.json({ ok: true, checked, reconciled, failed });
}
