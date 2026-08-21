import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { twilioClient, TWILIO_PHONE_NUMBER } from "@/lib/sms/twilio";
import type { NotificationAdapter } from "@/lib/notifications/NotificationService";

export const sendSmsNotification: NotificationAdapter = async (userId, event, payload) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.phone || !user.smsNotificationsEnabled) return;

  try {
    const result = await twilioClient.messages.create({
      to: user.phone,
      from: TWILIO_PHONE_NUMBER,
      body: `${payload.title}: ${payload.message}`,
    });
    if (result.errorCode) {
      console.error("Twilio returned an error", event, result.errorCode, result.errorMessage);
    }
  } catch (error) {
    console.error("Failed to send SMS notification", event, error);
  }

  await prisma.notification.create({
    data: {
      userId,
      event,
      channel: "SMS",
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });
};
