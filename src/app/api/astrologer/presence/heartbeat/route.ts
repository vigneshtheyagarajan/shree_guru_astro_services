import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (session?.user.role !== "ASTROLOGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profile = await prisma.astrologerProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile || !profile.isOnline) {
    return NextResponse.json({ error: "Not online" }, { status: 400 });
  }

  await prisma.astrologerProfile.update({
    where: { id: profile.id },
    data: { lastHeartbeatAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
