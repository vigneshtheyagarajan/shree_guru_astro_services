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

    const exceptionForDay = exceptions.find(
      (exception) => startOfDay(exception.date).getTime() === day.getTime(),
    );

    if (exceptionForDay?.type === "BLOCKED") {
      continue;
    }

    const windows: { startTime: string; endTime: string; slotDurationMinutes: number }[] = [];

    if (exceptionForDay?.type === "EXTRA_OPEN" && exceptionForDay.startTime && exceptionForDay.endTime) {
      windows.push({
        startTime: exceptionForDay.startTime,
        endTime: exceptionForDay.endTime,
        slotDurationMinutes: 30,
      });
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
        const slotStart = dateAtMinutes(day, minutes);
        if (slotStart < new Date()) continue;

        const slotEnd = dateAtMinutes(day, minutes + window.slotDurationMinutes);
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
