import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const hidden = !!body?.hidden;

  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.review.update({ where: { id }, data: { hidden } });

  const aggregate = await prisma.review.aggregate({
    where: { astrologerId: review.astrologerId, hidden: false },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.astrologerProfile.update({
    where: { id: review.astrologerId },
    data: {
      ratingAvg: aggregate._avg.rating ?? 0,
      ratingCount: aggregate._count,
    },
  });

  return NextResponse.json({ ok: true });
}
