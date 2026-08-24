"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function BookingStatusActions({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function updateStatus(action: "complete" | "no-show") {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/bookings/${bookingId}/${action}`, { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Failed to update booking.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button size="sm" loading={isPending} onClick={() => updateStatus("complete")}>
          Mark Complete
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={isPending}
          onClick={() => updateStatus("no-show")}
        >
          Mark No-show
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
