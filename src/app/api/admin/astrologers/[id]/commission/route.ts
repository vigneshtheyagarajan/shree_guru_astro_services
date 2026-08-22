import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  // null/empty clears the override so the astrologer falls back to the
  // platform default; otherwise it must be a valid percent.
  let commissionPercent: number | null = null;
  if (body?.commissionPercent !== null && body?.commissionPercent !== "") {
    const percent = Number(body?.commissionPercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return NextResponse.json(
        { error: "Commission must be a number between 0 and 100, or blank to use the default." },
        { status: 400 },
      );
    }
    commissionPercent = Math.round(percent);
  }

  const profile = await prisma.astrologerProfile.update({
    where: { id },
    data: { commissionPercent },
  });

  return NextResponse.json({ ok: true, profile });
}
