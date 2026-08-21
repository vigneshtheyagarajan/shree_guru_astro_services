"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function AttachmentsHideToggle({
  submissionId,
  hidden,
}: {
  submissionId: string;
  hidden: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await fetch(`/api/admin/intake-submissions/${submissionId}/hide-attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentsHidden: !hidden }),
      });
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant={hidden ? "primary" : "secondary"} disabled={isPending} onClick={toggle}>
      {hidden ? "Unhide" : "Hide"}
    </Button>
  );
}
