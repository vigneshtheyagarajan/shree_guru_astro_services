import { prisma } from "@/lib/prisma";
import { isGoogleCalendarConnected, pullBusyTimes } from "@/lib/integrations/googleCalendar";
import { materializeSlotsForAstrologer } from "@/lib/booking/materializeSlots";

const WINDOW_DAYS = 14;

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function toHHMM(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * Pulls busy blocks from the astrologer's Google Calendar for the next
 * WINDOW_DAYS and replaces their previously-synced BLOCKED exceptions with
 * fresh ones (source=GOOGLE), then regenerates slots so bookable times
 * respect the astrologer's real calendar.
 */
export async function syncGoogleCalendarForAstrologer(astrologerId: string) {
  const profile = await prisma.astrologerProfile.findUnique({ where: { id: astrologerId } });
  if (!profile || !isGoogleCalendarConnected(profile)) {
    return { synced: false, blocksCreated: 0 };
  }

  const timeMin = startOfDay(new Date());
  const timeMax = new Date(timeMin);
  timeMax.setDate(timeMax.getDate() + WINDOW_DAYS);

  const busyBlocks = await pullBusyTimes(profile, timeMin, timeMax);

  await prisma.availabilityException.deleteMany({
    where: {
      astrologerId,
      source: "GOOGLE",
      date: { gte: timeMin, lt: timeMax },
    },
  });

  for (const block of busyBlocks) {
    const start = new Date(block.start);
    const end = new Date(block.end);
    // Split multi-day blocks at midnight so each exception stays within one
    // calendar day (matches how AvailabilityException.date is scoped).
    let cursor = start;
    while (cursor < end) {
      const dayEnd = startOfDay(cursor);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const segmentEnd = end < dayEnd ? end : dayEnd;

      await prisma.availabilityException.create({
        data: {
          astrologerId,
          date: startOfDay(cursor),
          type: "BLOCKED",
          startTime: toHHMM(cursor),
          endTime: segmentEnd.getTime() === dayEnd.getTime() ? "23:59" : toHHMM(segmentEnd),
          source: "GOOGLE",
        },
      });

      cursor = segmentEnd;
    }
  }

  await materializeSlotsForAstrologer(astrologerId);

  return { synced: true, blocksCreated: busyBlocks.length };
}

export async function syncGoogleCalendarForAllAstrologers() {
  const profiles = await prisma.astrologerProfile.findMany({
    where: { googleRefreshToken: { not: null } },
    select: { id: true },
  });

  let synced = 0;
  let failed = 0;
  for (const profile of profiles) {
    try {
      await syncGoogleCalendarForAstrologer(profile.id);
      synced += 1;
    } catch (error) {
      failed += 1;
      console.error(`Failed to sync Google Calendar for astrologer ${profile.id}`, error);
    }
  }
  return { checked: profiles.length, synced, failed };
}
