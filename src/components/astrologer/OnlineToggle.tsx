"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

const HEARTBEAT_INTERVAL_MS = 30_000;

export function OnlineToggle({ initialOnline }: { initialOnline: boolean }) {
  const router = useRouter();
  const [online, setOnline] = useState(initialOnline);
  const [pending, setPending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (online) {
      intervalRef.current = setInterval(() => {
        fetch("/api/astrologer/presence/heartbeat", { method: "POST" }).catch(() => {});
      }, HEARTBEAT_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [online]);

  async function toggle() {
    setPending(true);
    const next = !online;
    const response = await fetch("/api/astrologer/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ online: next }),
    });
    setPending(false);
    if (response.ok) {
      setOnline(next);
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-1.5 text-sm text-foreground-muted">
        <span
          className={`h-2.5 w-2.5 rounded-full ${online ? "bg-success" : "bg-foreground-muted"}`}
          aria-hidden
        />
        {online ? "Online for instant chat" : "Offline"}
      </span>
      <Button size="sm" variant={online ? "secondary" : "primary"} disabled={pending} onClick={toggle}>
        {pending ? "Working…" : online ? "Go Offline" : "Go Online"}
      </Button>
    </div>
  );
}
