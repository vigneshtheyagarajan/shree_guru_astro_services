import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  verifyRazorpayPaymentSignature,
  markBookingPaidFromPaymentLink,
} from "@/lib/payments/razorpay";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const razorpayOrderId = typeof body?.razorpayOrderId === "string" ? body.razorpayOrderId : "";
  const razorpayPaymentId = typeof body?.razorpayPaymentId === "string" ? body.razorpayPaymentId : "";
  const razorpaySignature = typeof body?.razorpaySignature === "string" ? body.razorpaySignature : "";

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return NextResponse.json({ error: "Missing payment verification details." }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { paymentLink: true },
  });
  if (!booking || booking.clientId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!booking.paymentLink || booking.paymentLink.razorpayOrderId !== razorpayOrderId) {
    return NextResponse.json({ error: "This payment doesn't match this booking." }, { status: 400 });
  }

  const isValid = verifyRazorpayPaymentSignature(
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  );
  if (!isValid) {
    return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
  }

  const result = await markBookingPaidFromPaymentLink(razorpayOrderId);
  if (!result.updated && result.reason !== "already_paid") {
    return NextResponse.json({ error: "Failed to confirm payment." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
