"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { formatDateTimeShort } from "@/lib/dateFormat";

export function VideoCallPanel({
  bookingId,
  windowStart,
  windowEnd,
}: {
  bookingId: string;
  windowStart: string;
  windowEnd: string;
}) {
  const [now, setNow] = useState(() => new Date());
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<{ token: string; roomUrl: string } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const isOpen = now >= new Date(windowStart) && now <= new Date(windowEnd);

  async function handleJoin() {
    setJoining(true);
    setError(null);

    const response = await fetch(`/api/bookings/${bookingId}/video-token`, { method: "POST" });
    const body = await response.json().catch(() => null);

    setJoining(false);
    if (!response.ok) {
      setError(body?.error ?? "Failed to start the video call.");
      return;
    }
    setSession({ token: body.token, roomUrl: body.roomUrl });
  }

  if (now < new Date(windowStart)) {
    return (
      <div className="rounded-lg border border-border bg-background-elevated p-3 text-sm text-foreground-muted">
        Video call opens at {formatDateTimeShort(windowStart)}.
      </div>
    );
  }

  if (!isOpen) {
    return (
      <p className="text-sm text-foreground-muted">This video session has ended.</p>
    );
  }

  if (session) {
    return (
      <iframe
        src={`${session.roomUrl}?t=${session.token}`}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="aspect-video w-full rounded-lg border border-border"
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleJoin} disabled={joining} className="self-start">
        {joining ? "Starting…" : "Join Video Call"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
