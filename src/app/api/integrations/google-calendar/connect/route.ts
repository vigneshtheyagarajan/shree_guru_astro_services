import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGoogleAuthUrl } from "@/lib/integrations/googleCalendar";

export async function GET() {
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

  return NextResponse.redirect(getGoogleAuthUrl(profile.id));
}
