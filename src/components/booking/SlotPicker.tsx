"use client";

export interface SlotOption {
  id: string;
  startAt: string;
  endAt: string;
}

export function SlotPicker({
  slots,
  selectedSlotId,
  onSelect,
}: {
  slots: SlotOption[];
  selectedSlotId: string | null;
  onSelect: (slotId: string) => void;
}) {
  if (slots.length === 0) {
    return (
      <p className="text-sm text-foreground-muted">
        No open slots in the next 14 days. Check back later.
      </p>
    );
  }

  const byDate = new Map<string, SlotOption[]>();
  for (const slot of slots) {
    const dateKey = new Date(slot.startAt).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const existing = byDate.get(dateKey) ?? [];
    existing.push(slot);
    byDate.set(dateKey, existing);
  }

  return (
    <div className="flex flex-col gap-4">
      {Array.from(byDate.entries()).map(([dateLabel, daySlots]) => (
        <div key={dateLabel}>
          <p className="mb-2 text-sm font-medium text-foreground">{dateLabel}</p>
          <div className="flex flex-wrap gap-2">
            {daySlots.map((slot) => {
              const isSelected = slot.id === selectedSlotId;
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => onSelect(slot.id)}
                  className={
                    isSelected
                      ? "rounded-lg border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-black"
                      : "rounded-lg border border-border bg-background-elevated px-3 py-1.5 text-sm text-foreground hover:border-primary"
                  }
                >
                  {new Date(slot.startAt).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
