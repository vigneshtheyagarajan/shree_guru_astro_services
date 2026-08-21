import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const entry = await prisma.chatQueueEntry.findUnique({ where: { id } });
  if (!entry || entry.clientId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let position: number | null = null;
  if (entry.status === "WAITING") {
    position = await prisma.chatQueueEntry.count({
      where: {
        astrologerId: entry.astrologerId,
        status: "WAITING",
        createdAt: { lte: entry.createdAt },
      },
    });
  }

  return NextResponse.json({
    status: entry.status,
    position,
    bookingId: entry.bookingId,
  });
}
