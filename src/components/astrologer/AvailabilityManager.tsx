"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from "@/components/ui";
import { formatDateShort } from "@/lib/dateFormat";

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface Rule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
}

interface Exception {
  id: string;
  date: string;
  type: "BLOCKED" | "EXTRA_OPEN";
  startTime: string | null;
  endTime: string | null;
}

export function AvailabilityManager({
  initialRules,
  initialExceptions,
}: {
  initialRules: Rule[];
  initialExceptions: Exception[];
}) {
  const router = useRouter();

  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("13:00");
  const [slotDuration, setSlotDuration] = useState("30");
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [submittingRule, setSubmittingRule] = useState(false);

  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionType, setExceptionType] = useState<"BLOCKED" | "EXTRA_OPEN">("BLOCKED");
  const [exceptionStart, setExceptionStart] = useState("09:00");
  const [exceptionEnd, setExceptionEnd] = useState("13:00");
  const [exceptionError, setExceptionError] = useState<string | null>(null);
  const [submittingException, setSubmittingException] = useState(false);

  async function addRule(event: React.FormEvent) {
    event.preventDefault();
    setSubmittingRule(true);
    setRuleError(null);

    const response = await fetch("/api/astrologer/availability/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
        slotDurationMinutes: Number(slotDuration),
      }),
    });

    setSubmittingRule(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setRuleError(body?.error ?? "Failed to add availability.");
      return;
    }
    router.refresh();
  }

  async function deleteRule(id: string) {
    await fetch(`/api/astrologer/availability/rules/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function addException(event: React.FormEvent) {
    event.preventDefault();
    setSubmittingException(true);
    setExceptionError(null);

    const response = await fetch("/api/astrologer/availability/exceptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: exceptionDate,
        type: exceptionType,
        startTime: exceptionType === "EXTRA_OPEN" ? exceptionStart : undefined,
        endTime: exceptionType === "EXTRA_OPEN" ? exceptionEnd : undefined,
      }),
    });

    setSubmittingException(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setExceptionError(body?.error ?? "Failed to add exception.");
      return;
    }
    router.refresh();
  }

  async function deleteException(id: string) {
    await fetch(`/api/astrologer/availability/exceptions/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Weekly Availability</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={addRule} className="flex flex-wrap items-end gap-3">
            <Select
              label="Day"
              value={dayOfWeek}
              onChange={(event) => setDayOfWeek(event.target.value)}
              options={DAY_LABELS.map((label, index) => ({ label, value: String(index) }))}
              className="w-36"
            />
            <Input
              label="Start time"
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className="w-32"
            />
            <Input
              label="End time"
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              className="w-32"
            />
            <Input
              label="Slot length (min)"
              type="number"
              min={5}
              value={slotDuration}
              onChange={(event) => setSlotDuration(event.target.value)}
              className="w-32"
            />
            <Button type="submit" size="sm" disabled={submittingRule}>
              {submittingRule ? "Adding…" : "Add"}
            </Button>
          </form>
          {ruleError && <p className="text-sm text-danger">{ruleError}</p>}

          <div className="flex flex-col gap-2">
            {initialRules.length === 0 && (
              <p className="text-sm text-foreground-muted">No weekly availability set yet.</p>
            )}
            {initialRules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm"
              >
                <span>
                  {DAY_LABELS[rule.dayOfWeek]} · {rule.startTime}–{rule.endTime} ·{" "}
                  {rule.slotDurationMinutes} min slots
                </span>
                <Button variant="ghost" size="sm" onClick={() => deleteRule(rule.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Date Exceptions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={addException} className="flex flex-wrap items-end gap-3">
            <Input
              label="Date"
              type="date"
              required
              value={exceptionDate}
              onChange={(event) => setExceptionDate(event.target.value)}
              className="w-40"
            />
            <Select
              label="Type"
              value={exceptionType}
              onChange={(event) =>
                setExceptionType(event.target.value as "BLOCKED" | "EXTRA_OPEN")
              }
              options={[
                { label: "Blocked (unavailable)", value: "BLOCKED" },
                { label: "Extra open hours", value: "EXTRA_OPEN" },
              ]}
              className="w-48"
            />
            {exceptionType === "EXTRA_OPEN" && (
              <>
                <Input
                  label="Start time"
                  type="time"
                  value={exceptionStart}
                  onChange={(event) => setExceptionStart(event.target.value)}
                  className="w-32"
                />
                <Input
                  label="End time"
                  type="time"
                  value={exceptionEnd}
                  onChange={(event) => setExceptionEnd(event.target.value)}
                  className="w-32"
                />
              </>
            )}
            <Button type="submit" size="sm" disabled={submittingException}>
              {submittingException ? "Adding…" : "Add"}
            </Button>
          </form>
          {exceptionError && <p className="text-sm text-danger">{exceptionError}</p>}

          <div className="flex flex-col gap-2">
            {initialExceptions.length === 0 && (
              <p className="text-sm text-foreground-muted">No exceptions set.</p>
            )}
            {initialExceptions.map((exception) => (
              <div
                key={exception.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm"
              >
                <span>
                  {formatDateShort(exception.date)} ·{" "}
                  {exception.type === "BLOCKED"
                    ? "Blocked"
                    : `Extra open ${exception.startTime}–${exception.endTime}`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteException(exception.id)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
