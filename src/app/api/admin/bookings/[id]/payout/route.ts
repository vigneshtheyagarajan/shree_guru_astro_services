import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createPayoutForBooking } from "@/lib/payments/razorpayPayouts";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const payout = await createPayoutForBooking(id);
    return NextResponse.json({ ok: true, payout });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create payout." },
      { status: 400 },
    );
  }
}
