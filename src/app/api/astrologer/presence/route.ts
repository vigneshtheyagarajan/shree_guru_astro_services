import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user.role !== "ASTROLOGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const online = body?.online === true;

  const profile = await prisma.astrologerProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile) {
    return NextResponse.json({ error: "Astrologer profile not found" }, { status: 404 });
  }

  await prisma.astrologerProfile.update({
    where: { id: profile.id },
    data: {
      isOnline: online,
      lastHeartbeatAt: online ? new Date() : profile.lastHeartbeatAt,
    },
  });

  return NextResponse.json({ ok: true, online });
}
