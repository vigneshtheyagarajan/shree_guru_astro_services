import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncGoogleCalendarForAstrologer } from "@/lib/integrations/googleCalendarSync";

export async function POST() {
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

  try {
    const result = await syncGoogleCalendarForAstrologer(profile.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Google Calendar sync failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed." },
      { status: 502 },
    );
  }
}
