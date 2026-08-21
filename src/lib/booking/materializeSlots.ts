import { prisma } from "@/lib/prisma";

const WINDOW_DAYS = 14;

function parseTimeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function dateAtMinutes(day: Date, minutes: number) {
  const result = new Date(day);
  result.setHours(0, minutes, 0, 0);
  return result;
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Regenerates OPEN Slot rows for one astrologer across a rolling window
 * (today .. today + WINDOW_DAYS - 1) from their AvailabilityRule/Exception
 * rows. Existing BOOKED/CANCELLED slots are left untouched; OPEN slots that
 * no longer correspond to a valid window are removed.
 */
export async function materializeSlotsForAstrologer(astrologerId: string) {
  const [rules, exceptions] = await Promise.all([
    prisma.availabilityRule.findMany({ where: { astrologerId } }),
    prisma.availabilityException.findMany({
      where: {
        astrologerId,
        date: { gte: startOfDay(new Date()) },
      },
    }),
  ]);

  const today = startOfDay(new Date());
  const validStarts: Date[] = [];
  const slotsToCreate: { astrologerId: string; startAt: Date; endAt: Date }[] = [];

  for (let dayOffset = 0; dayOffset < WINDOW_DAYS; dayOffset++) {
    const day = new Date(today);
    day.setDate(day.getDate() + dayOffset);

    const dayExceptions = exceptions.filter(
      (exception) => startOfDay(exception.date).getTime() === day.getTime(),
    );

    // A BLOCKED exception with no time range blocks the whole day (e.g. a
    // manual day off). One with a time range only blocks that sub-window
    // (e.g. a single Google Calendar event) -- other hours stay bookable.
    const fullDayBlocked = dayExceptions.some(
      (exception) => exception.type === "BLOCKED" && !exception.startTime,
    );
    if (fullDayBlocked) continue;

    const blockedRanges = dayExceptions
      .filter((exception) => exception.type === "BLOCKED" && exception.startTime && exception.endTime)
      .map((exception) => ({
        start: parseTimeToMinutes(exception.startTime as string),
        end: parseTimeToMinutes(exception.endTime as string),
      }));

    const windows: { startTime: string; endTime: string; slotDurationMinutes: number }[] = [];

    for (const exception of dayExceptions) {
      if (exception.type === "EXTRA_OPEN" && exception.startTime && exception.endTime) {
        windows.push({
          startTime: exception.startTime,
          endTime: exception.endTime,
          slotDurationMinutes: 30,
        });
      }
    }

    const dayRules = rules.filter((rule) => rule.dayOfWeek === day.getDay());
    for (const rule of dayRules) {
      windows.push({
        startTime: rule.startTime,
        endTime: rule.endTime,
        slotDurationMinutes: rule.slotDurationMinutes,
      });
    }

    for (const window of windows) {
      const startMinutes = parseTimeToMinutes(window.startTime);
      const endMinutes = parseTimeToMinutes(window.endTime);

      for (
        let minutes = startMinutes;
        minutes + window.slotDurationMinutes <= endMinutes;
        minutes += window.slotDurationMinutes
      ) {
        const slotEndMinutes = minutes + window.slotDurationMinutes;
        const overlapsBlockedRange = blockedRanges.some(
          (range) => minutes < range.end && slotEndMinutes > range.start,
        );
        if (overlapsBlockedRange) continue;

        const slotStart = dateAtMinutes(day, minutes);
        if (slotStart < new Date()) continue;

        const slotEnd = dateAtMinutes(day, slotEndMinutes);
        validStarts.push(slotStart);
        slotsToCreate.push({ astrologerId, startAt: slotStart, endAt: slotEnd });
      }
    }
  }

  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + WINDOW_DAYS);

  await prisma.$transaction([
    prisma.slot.deleteMany({
      where: {
        astrologerId,
        status: "OPEN",
        startAt: { gte: today, lt: windowEnd, notIn: validStarts },
      },
    }),
    prisma.slot.createMany({ data: slotsToCreate, skipDuplicates: true }),
  ]);

  return { generated: slotsToCreate.length };
}

export async function materializeSlotsForAllAstrologers() {
  const profiles = await prisma.astrologerProfile.findMany({ select: { id: true } });
  let total = 0;
  for (const profile of profiles) {
    const result = await materializeSlotsForAstrologer(profile.id);
    total += result.generated;
  }
  return { astrologers: profiles.length, slotsGenerated: total };
}
