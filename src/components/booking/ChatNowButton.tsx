"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

type State =
  | { kind: "idle" }
  | { kind: "requesting" }
  | { kind: "queued"; queueEntryId: string; position: number }
  | { kind: "error"; message: string };

export function ChatNowButton({ serviceOfferingId }: { serviceOfferingId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling(queueEntryId: string) {
    pollRef.current = setInterval(async () => {
      const response = await fetch(`/api/chat-now/queue/${queueEntryId}`);
      if (!response.ok) return;
      const body = await response.json();
      if (body.status === "MATCHED" && body.bookingId) {
        if (pollRef.current) clearInterval(pollRef.current);
        router.push(`/bookings/${body.bookingId}`);
      } else if (body.status === "WAITING") {
        setState({ kind: "queued", queueEntryId, position: body.position ?? 1 });
      }
    }, 4000);
  }

  async function handleClick() {
    setState({ kind: "requesting" });
    const response = await fetch("/api/chat-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceOfferingId }),
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setState({ kind: "error", message: body?.error ?? "Failed to start chat." });
      return;
    }
    if (body.queued) {
      setState({ kind: "queued", queueEntryId: body.queueEntryId, position: body.position });
      startPolling(body.queueEntryId);
    } else {
      router.push(`/bookings/${body.bookingId}`);
    }
  }

  async function handleCancel(queueEntryId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    await fetch(`/api/chat-now/queue/${queueEntryId}/cancel`, { method: "POST" });
    setState({ kind: "idle" });
  }

  if (state.kind === "queued") {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-foreground-muted">
          You&apos;re #{state.position} in the queue — connecting you as soon as they&apos;re free…
        </span>
        <Button size="sm" variant="ghost" onClick={() => handleCancel(state.queueEntryId)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button size="sm" onClick={handleClick} loading={state.kind === "requesting"}>
        Chat Now
      </Button>
      {state.kind === "error" && <p className="text-xs text-danger">{state.message}</p>}
    </div>
  );
}
