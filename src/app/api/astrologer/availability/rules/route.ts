import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { materializeSlotsForAstrologer } from "@/lib/booking/materializeSlots";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

async function getAstrologerProfile() {
  const session = await auth();
  if (session?.user.role !== "ASTROLOGER") return null;
  return prisma.astrologerProfile.findUnique({ where: { userId: session.user.id } });
}

export async function POST(request: Request) {
  const profile = await getAstrologerProfile();
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const dayOfWeek = Number(body?.dayOfWeek);
  const startTime = body?.startTime;
  const endTime = body?.endTime;
  const slotDurationMinutes = Number(body?.slotDurationMinutes) || 30;

  if (
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 0 ||
    dayOfWeek > 6 ||
    typeof startTime !== "string" ||
    typeof endTime !== "string" ||
    !TIME_RE.test(startTime) ||
    !TIME_RE.test(endTime) ||
    startTime >= endTime ||
    slotDurationMinutes <= 0
  ) {
    return NextResponse.json({ error: "Invalid availability rule." }, { status: 400 });
  }

  const rule = await prisma.availabilityRule.create({
    data: { astrologerId: profile.id, dayOfWeek, startTime, endTime, slotDurationMinutes },
  });

  await materializeSlotsForAstrologer(profile.id);

  return NextResponse.json({ ok: true, rule }, { status: 201 });
}
