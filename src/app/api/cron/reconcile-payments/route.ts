import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { razorpay, markBookingPaidFromPaymentLink } from "@/lib/payments/razorpay";

// Intended to run nightly (e.g. via Vercel Cron) as a safety net for missed
// Razorpay webhooks: cross-checks any payment links still CREATED against
// Razorpay's own status API and applies the PAID transition if needed.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pendingLinks = await prisma.paymentLink.findMany({
    where: { status: "CREATED" },
  });

  let checked = 0;
  let reconciled = 0;
  let failed = 0;

  for (const link of pendingLinks) {
    checked += 1;
    try {
      const remote = await razorpay.paymentLink.fetch(link.razorpayLinkId);
      if (remote.status === "paid") {
        const result = await markBookingPaidFromPaymentLink(link.razorpayLinkId);
        if (result.updated) reconciled += 1;
      }
    } catch (error) {
      failed += 1;
      console.error(`Failed to reconcile payment link ${link.razorpayLinkId}`, error);
    }
  }

  return NextResponse.json({ ok: true, checked, reconciled, failed });
}
