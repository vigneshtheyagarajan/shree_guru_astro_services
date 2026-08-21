"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Textarea } from "@/components/ui";

export function ResolveDisputeForm({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [resolutionNote, setResolutionNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function resolve(status: "RESOLVED" | "REJECTED") {
    if (!resolutionNote.trim()) {
      setError("A resolution note is required.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/admin/disputes/${disputeId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolutionNote }),
    });

    setSubmitting(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Failed to update dispute.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        placeholder="Resolution note (sent to the person who raised it)"
        value={resolutionNote}
        onChange={(event) => setResolutionNote(event.target.value)}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={submitting} onClick={() => resolve("RESOLVED")}>
          Resolve
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={submitting}
          onClick={() => resolve("REJECTED")}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
