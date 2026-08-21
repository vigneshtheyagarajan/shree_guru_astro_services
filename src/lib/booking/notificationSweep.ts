import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/lib/notifications/NotificationService";
import { formatDateTimeLong } from "@/lib/dateFormat";

const bookingInclude = {
  slot: true,
  astrologer: true,
  serviceOffering: { include: { service: true } },
} as const;

interface ReminderBooking {
  id: string;
  clientId: string;
  astrologer: { userId: string };
  serviceOffering: { service: { name: string } };
  slot: { startAt: Date };
}

const formatSchedule = formatDateTimeLong;

async function notifyBoth(
  booking: ReminderBooking,
  event: "BOOKING_REMINDER" | "SESSION_STARTING",
  message: string,
) {
  const url = `/bookings/${booking.id}`;
  const title = event === "BOOKING_REMINDER" ? "Upcoming session reminder" : "Your session is starting";
  await Promise.all([
    NotificationService.send(booking.clientId, event, { title, message, url }),
    NotificationService.send(booking.astrologer.userId, event, { title, message, url }),
  ]);
}

export async function runBookingNotificationSweep() {
  const now = new Date();

  const oneHourCandidates = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      reminder1hrSentAt: null,
      slot: { startAt: { gte: now, lte: new Date(now.getTime() + 65 * 60 * 1000) } },
    },
    include: bookingInclude,
  });
  for (const booking of oneHourCandidates) {
    await notifyBoth(
      booking,
      "BOOKING_REMINDER",
      `Your ${booking.serviceOffering.service.name} session is coming up in about 1 hour, at ${formatSchedule(booking.slot.startAt)}.`,
    );
    await prisma.booking.update({
      where: { id: booking.id },
      data: { reminder1hrSentAt: now },
    });
  }

  const tenMinCandidates = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      reminder10minSentAt: null,
      slot: { startAt: { gte: now, lte: new Date(now.getTime() + 15 * 60 * 1000) } },
    },
    include: bookingInclude,
  });
  for (const booking of tenMinCandidates) {
    await notifyBoth(
      booking,
      "BOOKING_REMINDER",
      `Your ${booking.serviceOffering.service.name} session is coming up in about 10 minutes, at ${formatSchedule(booking.slot.startAt)}.`,
    );
    await prisma.booking.update({
      where: { id: booking.id },
      data: { reminder10minSentAt: now },
    });
  }

  const startingCandidates = await prisma.booking.findMany({
    where: {
      status: { in: ["CONFIRMED", "IN_PROGRESS"] },
      sessionStartingSentAt: null,
      slot: { startAt: { gte: new Date(now.getTime() - 15 * 60 * 1000), lte: now } },
    },
    include: bookingInclude,
  });
  for (const booking of startingCandidates) {
    await notifyBoth(
      booking,
      "SESSION_STARTING",
      `Your ${booking.serviceOffering.service.name} session is starting now.`,
    );
    await prisma.booking.update({
      where: { id: booking.id },
      data: { sessionStartingSentAt: now },
    });
  }

  return {
    reminder1hr: oneHourCandidates.length,
    reminder10min: tenMinCandidates.length,
    sessionStarting: startingCandidates.length,
  };
}
