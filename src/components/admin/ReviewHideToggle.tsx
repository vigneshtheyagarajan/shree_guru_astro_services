"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function ReviewHideToggle({ reviewId, hidden }: { reviewId: string; hidden: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await fetch(`/api/admin/reviews/${reviewId}/hide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: !hidden }),
      });
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant={hidden ? "primary" : "secondary"} loading={isPending} onClick={toggle}>
      {hidden ? "Unhide" : "Hide"}
    </Button>
  );
}
