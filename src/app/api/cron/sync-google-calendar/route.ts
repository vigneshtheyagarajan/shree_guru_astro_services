import { NextResponse } from "next/server";
import { syncGoogleCalendarForAllAstrologers } from "@/lib/integrations/googleCalendarSync";

// Intended to run periodically (e.g. via Vercel Cron) once deployed, so
// astrologers' bookable slots stay in sync with their real Google Calendar
// without requiring a manual "Sync now" click.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncGoogleCalendarForAllAstrologers();
  return NextResponse.json({ ok: true, ...result });
}
