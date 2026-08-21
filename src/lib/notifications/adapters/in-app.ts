import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { NotificationAdapter } from "@/lib/notifications/NotificationService";

export const sendInAppNotification: NotificationAdapter = async (userId, event, payload) => {
  await prisma.notification.create({
    data: {
      userId,
      event,
      channel: "IN_APP",
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });
};
