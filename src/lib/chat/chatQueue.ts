import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/lib/notifications/NotificationService";
import type { ServiceOffering } from "@/generated/prisma/client";

class ChatNowError extends Error {}

async function createInstantBooking(clientId: string, offering: ServiceOffering) {
  const startAt = new Date();
  const endAt = new Date(startAt.getTime() + offering.durationMinutes * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    const slot = await tx.slot.create({
      data: { astrologerId: offering.astrologerId, startAt, endAt, status: "BOOKED" },
    });
    const booking = await tx.booking.create({
      data: {
        clientId,
        astrologerId: offering.astrologerId,
        serviceOfferingId: offering.id,
        slotId: slot.id,
        mode: "CHAT",
        status: "CONFIRMED",
        confirmedAt: startAt,
        isInstant: true,
      },
    });
    await tx.intakeSubmission.create({
      data: { bookingId: booking.id, data: {}, attachments: [] },
    });
    return booking;
  });
}

/**
 * Instantly books a CHAT session with an online astrologer, or -- if they're
 * already in an active instant session -- places the client in a queue that
 * gets drained as soon as their current session ends (see matchNextInQueue).
 */
export async function requestChatNow(clientId: string, serviceOfferingId: string) {
  const offering = await prisma.serviceOffering.findUnique({
    where: { id: serviceOfferingId },
    include: { astrologer: true, service: true },
  });
  if (!offering || offering.astrologer.approvalStatus !== "APPROVED") {
    throw new ChatNowError("Service offering not found.");
  }
  if (!offering.modes.includes("CHAT")) {
    throw new ChatNowError("This astrologer doesn't offer instant chat for this service.");
  }
  if (!offering.astrologer.isOnline) {
    throw new ChatNowError("This astrologer is offline right now.");
  }

  const activeInstantBooking = await prisma.booking.findFirst({
    where: {
      astrologerId: offering.astrologerId,
      isInstant: true,
      status: { in: ["CONFIRMED", "IN_PROGRESS"] },
    },
  });

  if (activeInstantBooking) {
    const entry = await prisma.chatQueueEntry.create({
      data: {
        clientId,
        astrologerId: offering.astrologerId,
        serviceOfferingId: offering.id,
      },
    });
    const position = await prisma.chatQueueEntry.count({
      where: {
        astrologerId: offering.astrologerId,
        status: "WAITING",
        createdAt: { lte: entry.createdAt },
      },
    });
    return { queued: true as const, queueEntryId: entry.id, position };
  }

  const booking = await createInstantBooking(clientId, offering);
  return { queued: false as const, bookingId: booking.id };
}

/**
 * Pops the oldest waiting queue entry for an astrologer and instantly books
 * it. Called whenever an instant chat booking stops being active (completed,
 * no-show, or cancelled) so the next person in line gets connected.
 */
export async function matchNextInQueue(astrologerId: string) {
  const entry = await prisma.chatQueueEntry.findFirst({
    where: { astrologerId, status: "WAITING" },
    orderBy: { createdAt: "asc" },
    include: { serviceOffering: true },
  });
  if (!entry) return null;

  const booking = await createInstantBooking(entry.clientId, entry.serviceOffering);
  await prisma.chatQueueEntry.update({
    where: { id: entry.id },
    data: { status: "MATCHED", bookingId: booking.id, matchedAt: new Date() },
  });

  await NotificationService.send(entry.clientId, "CHAT_MATCHED", {
    title: "You're connected!",
    message: "Your astrologer is ready to chat now.",
    url: `/bookings/${booking.id}`,
  });

  return booking;
}

export { ChatNowError };
