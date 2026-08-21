import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createPaymentLinkForBooking } from "@/lib/payments/razorpay";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await createPaymentLinkForBooking(id);
  } catch (error) {
    console.error("Admin-triggered payment link creation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create payment link." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
