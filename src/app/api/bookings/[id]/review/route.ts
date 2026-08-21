import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking || booking.clientId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (booking.status !== "PAID") {
    return NextResponse.json(
      { error: "You can only review a booking after payment is complete." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const rating = Number(body?.rating);
  const comment = typeof body?.comment === "string" ? body.comment.trim() : "";

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be between 1 and 5." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.review.create({
      data: {
        bookingId: id,
        astrologerId: booking.astrologerId,
        rating,
        comment: comment || null,
      },
    });
    await tx.booking.update({ where: { id }, data: { status: "RATED" } });

    const aggregate = await tx.review.aggregate({
      where: { astrologerId: booking.astrologerId },
      _avg: { rating: true },
      _count: true,
    });
    await tx.astrologerProfile.update({
      where: { id: booking.astrologerId },
      data: {
        ratingAvg: aggregate._avg.rating ?? 0,
        ratingCount: aggregate._count,
      },
    });
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
