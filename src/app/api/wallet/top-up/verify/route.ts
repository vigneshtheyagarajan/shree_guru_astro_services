import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyRazorpayPaymentSignature } from "@/lib/payments/razorpay";
import { creditWalletFromTopUp, getOrCreateWallet } from "@/lib/wallet";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const razorpayOrderId = typeof body?.razorpayOrderId === "string" ? body.razorpayOrderId : "";
  const razorpayPaymentId = typeof body?.razorpayPaymentId === "string" ? body.razorpayPaymentId : "";
  const razorpaySignature = typeof body?.razorpaySignature === "string" ? body.razorpaySignature : "";

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return NextResponse.json({ error: "Missing payment verification details." }, { status: 400 });
  }

  const wallet = await getOrCreateWallet(session.user.id);
  const topUp = await prisma.walletTopUp.findFirst({
    where: { razorpayOrderId, walletId: wallet.id },
  });
  if (!topUp) {
    return NextResponse.json({ error: "This payment doesn't match your wallet." }, { status: 400 });
  }

  const isValid = verifyRazorpayPaymentSignature(
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  );
  if (!isValid) {
    return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
  }

  const result = await creditWalletFromTopUp(razorpayOrderId);
  if (!result.updated && result.reason !== "already_paid") {
    return NextResponse.json({ error: "Failed to confirm payment." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
