import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const HEARTBEAT_TIMEOUT_MINUTES = 2;

// Intended to run every minute or two via a scheduler once deployed. Marks
// astrologers offline if their browser stopped heartbeating (tab closed,
// lost connection) without an explicit "go offline" toggle.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MINUTES * 60 * 1000);
  const result = await prisma.astrologerProfile.updateMany({
    where: {
      isOnline: true,
      OR: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: cutoff } }],
    },
    data: { isOnline: false },
  });

  return NextResponse.json({ ok: true, expired: result.count });
}
