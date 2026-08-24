"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";

const STATUS_OPTIONS = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "PAID",
  "RATED",
  "CANCELLED",
  "NO_SHOW",
].map((status) => ({ label: status.replace(/_/g, " "), value: status }));

export function BookingStatusSelect({
  bookingId,
  currentStatus,
}: {
  bookingId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(status: string) {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/bookings/${bookingId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        setError("Failed to update.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Select
        options={STATUS_OPTIONS}
        value={currentStatus}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value)}
        className="w-44"
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
