"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  event: string;
  payload: { title: string; message: string; url?: string };
  readAt: string | null;
  sentAt: string;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/notifications")
      .then((response) => (response.ok ? response.json() : { notifications: [] }))
      .then((body) => setNotifications(body.notifications))
      .finally(() => setLoaded(true));
  }, []);

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  async function handleClick(notification: NotificationItem) {
    if (!notification.readAt) {
      await fetch(`/api/notifications/${notification.id}/read`, { method: "POST" });
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
    }
    setOpen(false);
    if (notification.payload.url) {
      router.push(notification.payload.url);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative rounded-lg p-2 text-foreground-muted hover:text-foreground"
        aria-label="Notifications"
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-black">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-border bg-background-surface shadow-xl">
          <div className="max-h-96 overflow-y-auto p-2">
            {!loaded && <p className="p-3 text-sm text-foreground-muted">Loading…</p>}
            {loaded && notifications.length === 0 && (
              <p className="p-3 text-sm text-foreground-muted">No notifications yet.</p>
            )}
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleClick(notification)}
                className={cn(
                  "block w-full rounded-lg p-3 text-left text-sm hover:bg-background-elevated",
                  !notification.readAt && "bg-primary-muted/30",
                )}
              >
                <p className="font-medium text-foreground">{notification.payload.title}</p>
                <p className="text-foreground-muted">{notification.payload.message}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
