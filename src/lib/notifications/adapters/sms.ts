import type { NotificationAdapter } from "@/lib/notifications/NotificationService";

// Phase 2 stub — not wired into NotificationService.send() yet. Swap in a
// real provider (Twilio/MSG91) behind this same NotificationAdapter shape
// when SMS is added; no call sites need to change.
export const sendSmsNotification: NotificationAdapter = async (userId, event) => {
  console.log(`[sms stub] Would notify user ${userId} for event ${event} (not implemented)`);
};
