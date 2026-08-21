"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";

const PRESET_AMOUNTS = [500, 1000, 2000];

export function WalletTopUpForm() {
  const [amount, setAmount] = useState("1000");
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setLink(null);

    const response = await fetch("/api/wallet/top-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(amount) }),
    });

    setSubmitting(false);
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error ?? "Failed to start the top-up.");
      return;
    }
    setLink(body.shortUrl);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PRESET_AMOUNTS.map((preset) => (
          <Button
            key={preset}
            type="button"
            size="sm"
            variant={amount === String(preset) ? "primary" : "secondary"}
            onClick={() => setAmount(String(preset))}
          >
            ₹{preset}
          </Button>
        ))}
      </div>
      <Input
        label="Amount (₹)"
        type="number"
        min={100}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        className="w-40"
      />
      {Number(amount) >= 1000 && (
        <p className="text-xs text-success">
          Get a ₹{Math.floor(Number(amount) * 0.1)} bonus credit on this top-up.
        </p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-black hover:bg-primary-hover"
        >
          Complete payment →
        </a>
      )}
      <Button type="submit" size="sm" className="self-start" disabled={submitting}>
        {submitting ? "Starting…" : "Top Up"}
      </Button>
    </form>
  );
}
