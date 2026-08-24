import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_MODES = ["CHAT", "CALL"] as const;
type Mode = (typeof VALID_MODES)[number];

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user.role !== "ASTROLOGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profile = await prisma.astrologerProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile) {
    return NextResponse.json({ error: "Astrologer profile not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const serviceId = typeof body?.serviceId === "string" ? body.serviceId : "";
  const pricePerSession = Number(body?.pricePerSession);
  const durationMinutes = Number(body?.durationMinutes);
  const modes: Mode[] = Array.isArray(body?.modes)
    ? body.modes.filter((mode: unknown): mode is Mode =>
        VALID_MODES.includes(mode as Mode),
      )
    : [];

  if (
    !serviceId ||
    !Number.isFinite(pricePerSession) ||
    pricePerSession <= 0 ||
    !Number.isFinite(durationMinutes) ||
    durationMinutes <= 0 ||
    modes.length === 0
  ) {
    return NextResponse.json({ error: "Invalid service offering details." }, { status: 400 });
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.isActive) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const invalidMode = modes.find((mode) => !service.supportedModes.includes(mode));
  if (invalidMode) {
    return NextResponse.json(
      { error: `${service.name} does not support ${invalidMode}.` },
      { status: 400 },
    );
  }

  const offering = await prisma.serviceOffering.upsert({
    where: { astrologerId_serviceId: { astrologerId: profile.id, serviceId } },
    update: {
      pricePerSession: Math.trunc(pricePerSession),
      durationMinutes: Math.trunc(durationMinutes),
      modes,
    },
    create: {
      astrologerId: profile.id,
      serviceId,
      pricePerSession: Math.trunc(pricePerSession),
      durationMinutes: Math.trunc(durationMinutes),
      modes,
    },
  });

  return NextResponse.json({ ok: true, offering }, { status: 200 });
}
