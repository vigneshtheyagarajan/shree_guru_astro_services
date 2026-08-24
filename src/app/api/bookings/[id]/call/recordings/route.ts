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
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { astrologer: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const isParticipant =
    booking.clientId === session.user.id || booking.astrologer.userId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isParticipant && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const recordings = await prisma.callRecording.findMany({
    where: { bookingId: id },
    include: { uploadedBy: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ recordings });
}
