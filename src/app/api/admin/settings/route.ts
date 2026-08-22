import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { setDefaultCommissionPercent } from "@/lib/platformSettings";

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const percent = Number(body?.defaultCommissionPercent);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return NextResponse.json(
      { error: "Commission must be a number between 0 and 100." },
      { status: 400 },
    );
  }

  const settings = await setDefaultCommissionPercent(Math.round(percent));
  return NextResponse.json({ ok: true, settings });
}
