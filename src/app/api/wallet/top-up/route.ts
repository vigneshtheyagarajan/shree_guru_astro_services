import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createWalletTopUp } from "@/lib/wallet";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount < 100) {
    return NextResponse.json({ error: "Enter an amount of at least ₹100." }, { status: 400 });
  }

  try {
    const order = await createWalletTopUp(session.user.id, Math.trunc(amount));
    return NextResponse.json({
      ok: true,
      orderId: order.id,
      amount: Math.trunc(amount),
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Failed to create wallet top-up order", error);
    return NextResponse.json({ error: "Failed to start the top-up. Please try again." }, { status: 502 });
  }
}
