"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { RazorpayCheckoutButton } from "@/components/payments/RazorpayCheckoutButton";

const PRESET_AMOUNTS = [500, 1000, 2000];

export function WalletTopUpForm({
  clientName,
  clientEmail,
}: {
  clientName: string;
  clientEmail: string;
}) {
  const [amount, setAmount] = useState("1000");
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<{ orderId: string; amount: number; razorpayKeyId: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setOrder(null);

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
    setOrder({ orderId: body.orderId, amount: body.amount, razorpayKeyId: body.razorpayKeyId });
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
      {order ? (
        <RazorpayCheckoutButton
          razorpayKeyId={order.razorpayKeyId}
          orderId={order.orderId}
          amount={order.amount}
          description="Wallet top-up"
          prefillName={clientName}
          prefillEmail={clientEmail}
          verifyUrl="/api/wallet/top-up/verify"
          label={`Pay ₹${order.amount}`}
        />
      ) : (
        <Button type="submit" size="sm" className="self-start" loading={submitting}>
          Top Up
        </Button>
      )}
    </form>
  );
}
