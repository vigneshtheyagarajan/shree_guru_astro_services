"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

export function PlatformSettingsForm({
  initialDefaultCommissionPercent,
}: {
  initialDefaultCommissionPercent: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(initialDefaultCommissionPercent));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultCommissionPercent: Number(value) }),
    });

    setSubmitting(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Failed to save.");
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        label="Default commission (%)"
        type="number"
        min={0}
        max={100}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-40"
      />
      <p className="text-xs text-foreground-muted">
        Applied to every astrologer&apos;s payouts unless they have an individual override, set
        from the Astrologers page.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-success">Saved.</p>}
      <Button type="submit" size="sm" className="self-start" loading={submitting}>
        Save
      </Button>
    </form>
  );
}
