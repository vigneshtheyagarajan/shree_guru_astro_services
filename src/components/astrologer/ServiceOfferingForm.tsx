"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Input } from "@/components/ui";

type Mode = "IN_PERSON" | "CHAT" | "PHONE_CALL";

const MODE_LABELS: Record<Mode, string> = {
  IN_PERSON: "In-person",
  CHAT: "Chat",
  PHONE_CALL: "Phone call",
};

export function ServiceOfferingForm({
  serviceId,
  supportedModes,
  existingOffering,
}: {
  serviceId: string;
  supportedModes: Mode[];
  existingOffering: {
    pricePerSession: number;
    durationMinutes: number;
    modes: Mode[];
  } | null;
}) {
  const router = useRouter();
  const [price, setPrice] = useState(String(existingOffering?.pricePerSession ?? ""));
  const [duration, setDuration] = useState(
    String(existingOffering?.durationMinutes ?? 30),
  );
  const [modes, setModes] = useState<Mode[]>(existingOffering?.modes ?? []);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleMode(mode: Mode) {
    setModes((current) =>
      current.includes(mode) ? current.filter((m) => m !== mode) : [...current, mode],
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/astrologer/service-offerings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId,
        pricePerSession: Number(price),
        durationMinutes: Number(duration),
        modes,
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Failed to save.");
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Price per session (₹)"
          type="number"
          min={1}
          required
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
        <Input
          label="Duration (minutes)"
          type="number"
          min={1}
          required
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Modes offered</span>
        <div className="flex flex-wrap gap-4">
          {supportedModes.map((mode) => (
            <Checkbox
              key={mode}
              label={MODE_LABELS[mode]}
              checked={modes.includes(mode)}
              onChange={() => toggleMode(mode)}
            />
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" size="sm" className="self-start" disabled={submitting}>
        {submitting ? "Saving…" : existingOffering ? "Update" : "Start offering"}
      </Button>
    </form>
  );
}
