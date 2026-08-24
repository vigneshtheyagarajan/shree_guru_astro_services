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
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { astrologer: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const isParticipant =
    booking.clientId === session.user.id || booking.astrologer.userId === session.user.id;
  if (!isParticipant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const cloudinaryUrl = typeof body?.cloudinaryUrl === "string" ? body.cloudinaryUrl : "";
  const durationSeconds =
    typeof body?.durationSeconds === "number" ? Math.round(body.durationSeconds) : null;

  if (!cloudinaryUrl) {
    return NextResponse.json({ error: "cloudinaryUrl is required." }, { status: 400 });
  }

  const recording = await prisma.callRecording.create({
    data: {
      bookingId: id,
      uploadedById: session.user.id,
      cloudinaryUrl,
      durationSeconds,
    },
  });

  return NextResponse.json({ ok: true, recording }, { status: 201 });
}
