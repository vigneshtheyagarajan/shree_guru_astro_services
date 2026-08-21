import { sendInAppNotification } from "@/lib/notifications/adapters/in-app";
import { sendEmailNotification } from "@/lib/notifications/adapters/email";

export type NotificationEvent =
  | "BOOKING_CONFIRMED"
  | "BOOKING_REMINDER"
  | "SESSION_STARTING"
  | "PAYMENT_LINK_SENT"
  | "PAYMENT_RECEIVED"
  | "REVIEW_REQUEST";

export interface NotificationPayload {
  title: string;
  message: string;
  url?: string;
  [key: string]: unknown;
}

export type NotificationAdapter = (
  userId: string,
  event: NotificationEvent,
  payload: NotificationPayload,
) => Promise<void>;

export const NotificationService = {
  async send(userId: string, event: NotificationEvent, payload: NotificationPayload) {
    const results = await Promise.allSettled([
      sendInAppNotification(userId, event, payload),
      sendEmailNotification(userId, event, payload),
    ]);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("Notification adapter failed", event, result.reason);
      }
    }
  },
};
