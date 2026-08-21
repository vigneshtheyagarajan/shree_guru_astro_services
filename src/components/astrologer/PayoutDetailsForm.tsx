"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

export function PayoutDetailsForm({
  initialAccountHolderName,
  initialAccountNumber,
  initialIfscCode,
}: {
  initialAccountHolderName: string;
  initialAccountNumber: string;
  initialIfscCode: string;
}) {
  const router = useRouter();
  const [accountHolderName, setAccountHolderName] = useState(initialAccountHolderName);
  const [accountNumber, setAccountNumber] = useState(initialAccountNumber);
  const [ifscCode, setIfscCode] = useState(initialIfscCode);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const response = await fetch("/api/astrologer/payout-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountHolderName, accountNumber, ifscCode }),
    });

    setSubmitting(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Failed to save payout details.");
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Account holder name"
        value={accountHolderName}
        onChange={(event) => setAccountHolderName(event.target.value)}
      />
      <Input
        label="Bank account number"
        value={accountNumber}
        onChange={(event) => setAccountNumber(event.target.value)}
      />
      <Input
        label="IFSC code"
        placeholder="e.g. HDFC0001234"
        value={ifscCode}
        onChange={(event) => setIfscCode(event.target.value.toUpperCase())}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-success">Payout details saved.</p>}
      <Button type="submit" className="self-start" disabled={submitting}>
        {submitting ? "Saving…" : "Save Payout Details"}
      </Button>
    </form>
  );
}
