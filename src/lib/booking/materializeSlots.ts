import { prisma } from "@/lib/prisma";

const WINDOW_DAYS = 14;

// Astrologer-entered times (AvailabilityRule/Exception startTime/endTime,
// and the calendar date exceptions are picked against) are Asia/Kolkata
// wall-clock -- see dateFormat.ts's note that Node defaults to UTC in
// production regardless of where users actually are. Using JS Date's
// local-timezone-dependent methods (setHours/getDay/setDate) here would
// silently treat those wall-clock times as whatever timezone the server
// process happens to run in, shifting every slot by the IST offset. All
// date/time arithmetic below is therefore done with explicit UTC methods
// and a fixed IST offset (Asia/Kolkata has no DST) instead.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function parseTimeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Returns the UTC instant corresponding to 00:00 IST on the IST calendar
// date that `date` falls on.
function startOfIstDay(date: Date) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  const utcMidnightOfShiftedDate = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  return new Date(utcMidnightOfShiftedDate - IST_OFFSET_MS);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// day-of-week (0 = Sunday) of the IST calendar date `istMidnight` (itself a
// UTC instant, as returned by startOfIstDay) represents.
function istDayOfWeek(istMidnight: Date) {
  return new Date(istMidnight.getTime() + IST_OFFSET_MS).getUTCDay();
}

// `istMidnight` is 00:00 IST for a given day (as a UTC instant); `minutes`
// is minutes-since-midnight IST wall-clock time (e.g. from "14:00").
function dateAtMinutes(istMidnight: Date, minutes: number) {
  return new Date(istMidnight.getTime() + minutes * 60 * 1000);
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
        date: { gte: startOfIstDay(new Date()) },
      },
    }),
  ]);

  const today = startOfIstDay(new Date());
  const validStarts: Date[] = [];
  const slotsToCreate: { astrologerId: string; startAt: Date; endAt: Date }[] = [];

  for (let dayOffset = 0; dayOffset < WINDOW_DAYS; dayOffset++) {
    const day = addDays(today, dayOffset);

    const dayExceptions = exceptions.filter(
      (exception) => startOfIstDay(exception.date).getTime() === day.getTime(),
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

    const dayRules = rules.filter((rule) => rule.dayOfWeek === istDayOfWeek(day));
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
