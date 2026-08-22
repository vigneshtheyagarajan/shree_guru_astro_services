"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

export function CommissionOverrideForm({
  astrologerId,
  initialCommissionPercent,
  defaultCommissionPercent,
}: {
  astrologerId: string;
  initialCommissionPercent: number | null;
  defaultCommissionPercent: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(
    initialCommissionPercent != null ? String(initialCommissionPercent) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function save(commissionPercent: number | null) {
    setSubmitting(true);
    setError(null);
    const response = await fetch(`/api/admin/astrologers/${astrologerId}/commission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commissionPercent }),
    });
    setSubmitting(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Failed to update commission.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-2">
        <Input
          label={`Commission % (default ${defaultCommissionPercent}%)`}
          type="number"
          min={0}
          max={100}
          placeholder={String(defaultCommissionPercent)}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-40"
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={submitting}
          onClick={() => save(value.trim() === "" ? null : Number(value))}
        >
          Save
        </Button>
        {initialCommissionPercent != null && (
          <Button
            size="sm"
            variant="ghost"
            disabled={submitting}
            onClick={() => {
              setValue("");
              save(null);
            }}
          >
            Reset to default
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
