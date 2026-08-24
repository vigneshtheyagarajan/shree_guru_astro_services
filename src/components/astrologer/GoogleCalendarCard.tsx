"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatDateTimeShort } from "@/lib/dateFormat";

export function GoogleCalendarCard({
  connected,
  connectedAt,
}: {
  connected: boolean;
  connectedAt: string | null;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDisconnect() {
    setIsPending(true);
    setError(null);
    await fetch("/api/integrations/google-calendar/disconnect", { method: "POST" });
    setIsPending(false);
    router.refresh();
  }

  async function handleSync() {
    setIsPending(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/integrations/google-calendar/sync", { method: "POST" });
    const body = await response.json().catch(() => null);
    setIsPending(false);
    if (!response.ok) {
      setError(body?.error ?? "Sync failed.");
      return;
    }
    setMessage(`Synced. ${body.blocksCreated} busy block(s) found on your calendar.`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Calendar</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {connected ? (
          <>
            <p className="text-sm text-foreground-muted">
              Connected{connectedAt ? ` on ${formatDateTimeShort(connectedAt)}` : ""}. Busy times
              on your Google Calendar automatically block matching slots here, and your
              confirmed bookings are added to your calendar.
            </p>
            <div className="flex gap-2">
              <Button size="sm" loading={isPending} onClick={handleSync}>
                Sync now
              </Button>
              <Button size="sm" variant="secondary" disabled={isPending} onClick={handleDisconnect}>
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-foreground-muted">
              Connect your Google Calendar so busy times there automatically block bookings here,
              and confirmed bookings show up on your calendar.
            </p>
            <a href="/api/integrations/google-calendar/connect">
              <Button size="sm">Connect Google Calendar</Button>
            </a>
          </>
        )}
        {message && <p className="text-xs text-success">{message}</p>}
        {error && <p className="text-xs text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}
