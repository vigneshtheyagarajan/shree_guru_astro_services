import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/lib/notifications/NotificationService";

const RESOLUTION_STATUSES = ["RESOLVED", "REJECTED"] as const;

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
  const status = body?.status;
  const resolutionNote = typeof body?.resolutionNote === "string" ? body.resolutionNote.trim() : "";

  if (!RESOLUTION_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (!resolutionNote) {
    return NextResponse.json({ error: "A resolution note is required." }, { status: 400 });
  }

  const dispute = await prisma.dispute.findUnique({ where: { id } });
  if (!dispute) {
    return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  }

  await prisma.dispute.update({
    where: { id },
    data: { status, resolutionNote, resolvedAt: new Date() },
  });

  await NotificationService.send(dispute.raisedById, "DISPUTE_RESOLVED", {
    title: status === "RESOLVED" ? "Your dispute was resolved" : "Your dispute was rejected",
    message: resolutionNote,
    url: `/bookings/${dispute.bookingId}`,
  });

  return NextResponse.json({ ok: true });
}
