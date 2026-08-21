"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, StarRating, Textarea } from "@/components/ui";

export function ReviewForm({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (rating === 0) {
      setError("Please select a rating.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/bookings/${bookingId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment }),
    });

    setSubmitting(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Failed to submit review.");
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-border bg-background-elevated p-3">
      <p className="text-sm font-medium text-foreground">How was your session?</p>
      <StarRating value={rating} onChange={setRating} />
      <Textarea
        placeholder="Optional comment"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" size="sm" className="self-start" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit Review"}
      </Button>
    </form>
  );
}
