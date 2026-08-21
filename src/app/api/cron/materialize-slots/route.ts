import { NextResponse } from "next/server";
import { materializeSlotsForAllAstrologers } from "@/lib/booking/materializeSlots";

// Intended to be triggered nightly by a scheduler (e.g. Vercel Cron) once
// deployed. In dev, materialization also runs inline whenever an astrologer
// edits their availability, so slots stay fresh without waiting for this.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await materializeSlotsForAllAstrologers();
  return NextResponse.json({ ok: true, ...result });
}
