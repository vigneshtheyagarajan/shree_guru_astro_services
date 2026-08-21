"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function CreatePaymentLinkButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/bookings/${bookingId}/create-payment-link`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Failed to create payment link.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" disabled={isPending} onClick={handleClick}>
        {isPending ? "Creating…" : "Create Payment Link"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
