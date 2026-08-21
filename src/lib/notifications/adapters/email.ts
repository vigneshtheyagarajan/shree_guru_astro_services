import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { resend, EMAIL_FROM } from "@/lib/email/resend";
import type { NotificationAdapter } from "@/lib/notifications/NotificationService";

export const sendEmailNotification: NotificationAdapter = async (userId, event, payload) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: user.email,
      subject: payload.title,
      html: `<p>${payload.message}</p>${
        payload.url ? `<p><a href="${payload.url}">View details</a></p>` : ""
      }`,
    });
    if (result.error) {
      console.error("Resend returned an error", event, result.error);
    }
  } catch (error) {
    console.error("Failed to send email notification", event, error);
  }

  await prisma.notification.create({
    data: {
      userId,
      event,
      channel: "EMAIL",
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });
};
