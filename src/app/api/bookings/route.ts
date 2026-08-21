import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { IntakeSchema } from "@/lib/services/intake-schema";
import { NotificationService } from "@/lib/notifications/NotificationService";
import { formatDateTimeLong } from "@/lib/dateFormat";
import { pushBookingEvent } from "@/lib/integrations/googleCalendar";

const VALID_MODES = ["IN_PERSON", "CHAT", "PHONE_CALL"] as const;

class SlotUnavailableError extends Error {}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user.role !== "CLIENT") {
    return NextResponse.json(
      { error: "Only clients can book consultations." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const serviceOfferingId =
    typeof body?.serviceOfferingId === "string" ? body.serviceOfferingId : "";
  const slotId = typeof body?.slotId === "string" ? body.slotId : "";
  const mode = body?.mode;
  const intakeData: Record<string, string> =
    body?.intakeData && typeof body.intakeData === "object" ? body.intakeData : {};
  const clientPhone = typeof body?.clientPhone === "string" ? body.clientPhone.trim() : "";

  if (
    !serviceOfferingId ||
    !slotId ||
    !VALID_MODES.includes(mode)
  ) {
    return NextResponse.json({ error: "Missing or invalid booking details." }, { status: 400 });
  }

  const offering = await prisma.serviceOffering.findUnique({
    where: { id: serviceOfferingId },
    include: { service: true, astrologer: true },
  });
  if (!offering || offering.astrologer.approvalStatus !== "APPROVED") {
    return NextResponse.json({ error: "Service offering not found." }, { status: 404 });
  }
  if (!offering.modes.includes(mode)) {
    return NextResponse.json(
      { error: "This astrologer doesn't offer that consultation mode for this service." },
      { status: 400 },
    );
  }

  const intakeSchema = offering.service.intakeSchema as unknown as IntakeSchema;
  for (const field of intakeSchema) {
    if (field.required && !String(intakeData[field.key] ?? "").trim()) {
      return NextResponse.json({ error: `${field.label} is required.` }, { status: 400 });
    }
  }

  const attachments = intakeSchema
    .filter((field) => field.type === "photo")
    .map((field) => intakeData[field.key])
    .filter((value): value is string => !!value);

  if (mode === "PHONE_CALL" && !clientPhone) {
    return NextResponse.json(
      { error: "A phone number is required for phone-call bookings." },
      { status: 400 },
    );
  }

  const slot = await prisma.slot.findUnique({ where: { id: slotId } });
  if (!slot || slot.astrologerId !== offering.astrologerId) {
    return NextResponse.json({ error: "Slot not found." }, { status: 404 });
  }

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const result = await tx.slot.updateMany({
        where: { id: slotId, status: "OPEN" },
        data: { status: "BOOKED" },
      });
      if (result.count !== 1) {
        throw new SlotUnavailableError();
      }

      const created = await tx.booking.create({
        data: {
          clientId: session.user.id,
          astrologerId: offering.astrologerId,
          serviceOfferingId: offering.id,
          slotId,
          mode,
          status: "CONFIRMED",
          confirmedAt: new Date(),
          clientPhone: mode === "PHONE_CALL" ? clientPhone : null,
          addressRevealedAt: mode === "IN_PERSON" ? new Date() : null,
        },
      });

      await tx.intakeSubmission.create({
        data: { bookingId: created.id, data: intakeData, attachments },
      });

      return created;
    });

    try {
      const googleEventId = await pushBookingEvent(offering.astrologer, {
        id: booking.id,
        startAt: slot.startAt,
        endAt: slot.endAt,
        serviceName: offering.service.name,
        clientName: session.user.name ?? "Client",
        mode,
      });
      if (googleEventId) {
        await prisma.booking.update({ where: { id: booking.id }, data: { googleEventId } });
      }
    } catch (error) {
      console.error("Failed to push booking to Google Calendar", error);
    }

    const bookingUrl = `/bookings/${booking.id}`;
    const scheduledFor = formatDateTimeLong(slot.startAt);

    await Promise.all([
      NotificationService.send(session.user.id, "BOOKING_CONFIRMED", {
        title: "Booking confirmed",
        message: `Your ${offering.service.name} session is confirmed for ${scheduledFor}.`,
        url: bookingUrl,
      }),
      NotificationService.send(offering.astrologer.userId, "BOOKING_CONFIRMED", {
        title: "New booking",
        message: `You have a new ${offering.service.name} session on ${scheduledFor}.`,
        url: bookingUrl,
      }),
    ]);

    return NextResponse.json(
      {
        ok: true,
        bookingId: booking.id,
        mode,
        address: mode === "IN_PERSON" ? offering.astrologer.address : null,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      return NextResponse.json(
        { error: "That slot was just booked by someone else. Please pick another." },
        { status: 409 },
      );
    }
    throw error;
  }
}
