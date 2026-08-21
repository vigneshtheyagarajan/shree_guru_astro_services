import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      { error: "Only confirmed or in-progress bookings can be marked no-show." },
      { status: 400 },
    );
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: "NO_SHOW" },
  });

  return NextResponse.json({ ok: true, booking: updated });
}
