import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user.role !== "ASTROLOGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const photoUrl = typeof body?.photoUrl === "string" ? body.photoUrl : "";
  if (!photoUrl) {
    return NextResponse.json({ error: "photoUrl is required." }, { status: 400 });
  }

  const profile = await prisma.astrologerProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile) {
    return NextResponse.json({ error: "Astrologer profile not found." }, { status: 404 });
  }

  await prisma.astrologerProfile.update({
    where: { id: profile.id },
    data: { photoUrl },
  });

  return NextResponse.json({ ok: true });
}
