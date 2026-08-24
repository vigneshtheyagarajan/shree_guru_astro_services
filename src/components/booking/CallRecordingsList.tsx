import { prisma } from "@/lib/prisma";
import { formatDateTimeShort } from "@/lib/dateFormat";

export async function CallRecordingsList({ bookingId }: { bookingId: string }) {
  const recordings = await prisma.callRecording.findMany({
    where: { bookingId },
    include: { uploadedBy: true },
    orderBy: { createdAt: "asc" },
  });

  if (recordings.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-background-elevated p-3 text-sm text-foreground-muted">
        No call recordings yet for this booking.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-foreground-muted">
        Admin view — recorded from each participant&apos;s side.
      </p>
      {recordings.map((recording) => (
        <div
          key={recording.id}
          className="flex flex-col gap-2 rounded-lg border border-border bg-background-elevated p-3"
        >
          <p className="text-xs text-foreground-muted">
            Recorded by {recording.uploadedBy.name} · {formatDateTimeShort(recording.createdAt)}
            {recording.durationSeconds ? ` · ${recording.durationSeconds}s` : ""}
          </p>
          <audio controls src={recording.cloudinaryUrl} className="w-full" />
        </div>
      ))}
    </div>
  );
}
