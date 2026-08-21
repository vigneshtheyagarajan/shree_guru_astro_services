import { NextResponse } from "next/server";
import { runBookingNotificationSweep } from "@/lib/booking/notificationSweep";

// Intended to be triggered every few minutes by a scheduler (e.g. Vercel
// Cron) once deployed, to send BOOKING_REMINDER (~1hr and ~10min before) and
// SESSION_STARTING notifications for upcoming confirmed bookings.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runBookingNotificationSweep();
  return NextResponse.json({ ok: true, ...result });
}
