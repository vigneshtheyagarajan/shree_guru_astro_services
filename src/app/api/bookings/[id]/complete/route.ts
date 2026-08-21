import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPaymentLinkForBooking } from "@/lib/payments/razorpay";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (session?.user.role !== "ASTROLOGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { astrologer: true },
  });
  if (!booking || booking.astrologer.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (booking.status !== "CONFIRMED" && booking.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Only confirmed or in-progress bookings can be marked complete." },
      { status: 400 },
    );
  }

  await prisma.booking.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  try {
    await createPaymentLinkForBooking(id);
  } catch (error) {
    console.error("Failed to create Razorpay payment link", error);
    // Booking stays COMPLETED without a link; admin can retry later.
  }

  const updated = await prisma.booking.findUnique({ where: { id } });
  return NextResponse.json({ ok: true, booking: updated });
}
