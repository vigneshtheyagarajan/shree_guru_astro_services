import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { materializeSlotsForAstrologer } from "@/lib/booking/materializeSlots";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const VALID_TYPES = ["BLOCKED", "EXTRA_OPEN"] as const;

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user.role !== "ASTROLOGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const profile = await prisma.astrologerProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const date = typeof body?.date === "string" ? new Date(body.date) : null;
  const type = body?.type;
  const startTime = body?.startTime || null;
  const endTime = body?.endTime || null;

  if (!date || Number.isNaN(date.getTime()) || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid exception." }, { status: 400 });
  }
  if (type === "EXTRA_OPEN") {
    if (
      typeof startTime !== "string" ||
      typeof endTime !== "string" ||
      !TIME_RE.test(startTime) ||
      !TIME_RE.test(endTime) ||
      startTime >= endTime
    ) {
      return NextResponse.json(
        { error: "Extra-open exceptions need a valid start and end time." },
        { status: 400 },
      );
    }
  }

  const exception = await prisma.availabilityException.create({
    data: {
      astrologerId: profile.id,
      date,
      type,
      startTime: type === "EXTRA_OPEN" ? startTime : null,
      endTime: type === "EXTRA_OPEN" ? endTime : null,
    },
  });

  await materializeSlotsForAstrologer(profile.id);

  return NextResponse.json({ ok: true, exception }, { status: 201 });
}
