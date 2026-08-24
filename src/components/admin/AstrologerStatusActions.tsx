"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export function AstrologerStatusActions({
  astrologerId,
  currentStatus,
}: {
  astrologerId: string;
  currentStatus: Status;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function updateStatus(status: Status) {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/astrologers/${astrologerId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        setError("Failed to update status.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {currentStatus !== "APPROVED" && (
          <Button
            size="sm"
            variant="primary"
            loading={isPending}
            onClick={() => updateStatus("APPROVED")}
          >
            Approve
          </Button>
        )}
        {currentStatus !== "REJECTED" && (
          <Button
            size="sm"
            variant="danger"
            loading={isPending}
            onClick={() => updateStatus("REJECTED")}
          >
            Reject
          </Button>
        )}
        {currentStatus === "APPROVED" && (
          <Button
            size="sm"
            variant="secondary"
            loading={isPending}
            onClick={() => updateStatus("SUSPENDED")}
          >
            Suspend
          </Button>
        )}
        {currentStatus === "SUSPENDED" && (
          <Button
            size="sm"
            variant="secondary"
            loading={isPending}
            onClick={() => updateStatus("PENDING")}
          >
            Reinstate to Pending
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
