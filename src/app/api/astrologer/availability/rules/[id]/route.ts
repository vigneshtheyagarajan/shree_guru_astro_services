import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { materializeSlotsForAstrologer } from "@/lib/booking/materializeSlots";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (session?.user.role !== "ASTROLOGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profile = await prisma.astrologerProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const rule = await prisma.availabilityRule.findUnique({ where: { id } });
  if (!rule || rule.astrologerId !== profile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.availabilityRule.delete({ where: { id } });
  await materializeSlotsForAstrologer(profile.id);

  return NextResponse.json({ ok: true });
}
