"use client";

import { useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Stepper } from "@/components/ui";
import { IntakeFormRenderer, type IntakeValues } from "@/components/forms/IntakeFormRenderer";
import { SlotPicker, type SlotOption } from "@/components/booking/SlotPicker";
import type { IntakeSchema } from "@/lib/services/intake-schema";
import { formatDateTimeLong } from "@/lib/dateFormat";

type Mode = "IN_PERSON" | "CHAT" | "PHONE_CALL";

const MODE_LABELS: Record<Mode, string> = {
  IN_PERSON: "In-person",
  CHAT: "Chat",
  PHONE_CALL: "Phone call",
};

const STEPS = ["Service", "Astrologer", "Intake", "Slot", "Confirm"];

interface OfferingData {
  id: string;
  pricePerSession: number;
  durationMinutes: number;
  modes: Mode[];
  service: { name: string; intakeSchema: IntakeSchema };
  astrologer: { name: string };
}

export function BookingFlow({
  offering,
  slots,
}: {
  offering: OfferingData;
  slots: SlotOption[];
}) {
  const [step, setStep] = useState<"intake" | "slot" | "confirm" | "done">("intake");
  const [mode, setMode] = useState<Mode>(offering.modes[0]);
  const [clientPhone, setClientPhone] = useState("");
  const [intakeValues, setIntakeValues] = useState<IntakeValues>({});
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ address: string | null } | null>(null);

  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId) ?? null;
  const stepNumber = { intake: 3, slot: 4, confirm: 5, done: 5 }[step];

  function validateIntake() {
    for (const field of offering.service.intakeSchema) {
      if (field.required && !intakeValues[field.key]?.trim()) {
        return `${field.label} is required.`;
      }
    }
    if (mode === "PHONE_CALL" && !clientPhone.trim()) {
      return "A phone number is required for phone-call bookings.";
    }
    return null;
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceOfferingId: offering.id,
        slotId: selectedSlotId,
        mode,
        intakeData: intakeValues,
        clientPhone: mode === "PHONE_CALL" ? clientPhone : undefined,
      }),
    });

    setSubmitting(false);
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setError(body?.error ?? "Failed to create booking.");
      return;
    }

    setResult({ address: body.address ?? null });
    setStep("done");
  }

  return (
    <div className="flex flex-col gap-6">
      <Stepper steps={STEPS} currentStep={stepNumber} />

      <Card>
        <CardHeader>
          <CardTitle>
            {offering.service.name} with {offering.astrologer.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {step === "intake" && (
            <>
              {offering.modes.length > 1 ? (
                <Select
                  label="Consultation mode"
                  value={mode}
                  onChange={(event) => setMode(event.target.value as Mode)}
                  options={offering.modes.map((m) => ({ label: MODE_LABELS[m], value: m }))}
                />
              ) : (
                <p className="text-sm text-foreground-muted">
                  Mode: {MODE_LABELS[offering.modes[0]]}
                </p>
              )}
              {mode === "PHONE_CALL" && (
                <Input
                  label="Your phone number"
                  type="tel"
                  required
                  value={clientPhone}
                  onChange={(event) => setClientPhone(event.target.value)}
                />
              )}
              <IntakeFormRenderer
                schema={offering.service.intakeSchema}
                values={intakeValues}
                onChange={(key, value) =>
                  setIntakeValues((current) => ({ ...current, [key]: value }))
                }
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button
                className="self-start"
                onClick={() => {
                  const validationError = validateIntake();
                  if (validationError) {
                    setError(validationError);
                    return;
                  }
                  setError(null);
                  setStep("slot");
                }}
              >
                Continue
              </Button>
            </>
          )}

          {step === "slot" && (
            <>
              <SlotPicker
                slots={slots}
                selectedSlotId={selectedSlotId}
                onSelect={setSelectedSlotId}
              />
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep("intake")}>
                  Back
                </Button>
                <Button disabled={!selectedSlotId} onClick={() => setStep("confirm")}>
                  Continue
                </Button>
              </div>
            </>
          )}

          {step === "confirm" && selectedSlot && (
            <>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-foreground-muted">Mode</dt>
                  <dd className="text-foreground">{MODE_LABELS[mode]}</dd>
                </div>
                <div>
                  <dt className="text-foreground-muted">Price</dt>
                  <dd className="text-foreground">
                    ₹{offering.pricePerSession} ({offering.durationMinutes} min)
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-foreground-muted">Slot</dt>
                  <dd className="text-foreground">
                    {formatDateTimeLong(selectedSlot.startAt)}
                  </dd>
                </div>
              </dl>
              <Badge variant="warning" className="w-fit">
                Payment happens after your session, via a link we&apos;ll send you
              </Badge>
              {error && <p className="text-sm text-danger">{error}</p>}
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep("slot")}>
                  Back
                </Button>
                <Button disabled={submitting} onClick={handleConfirm}>
                  {submitting ? "Booking…" : "Confirm Booking"}
                </Button>
              </div>
            </>
          )}

          {step === "done" && (
            <div className="flex flex-col gap-3">
              <p className="text-foreground">
                Your booking is confirmed! You&apos;ll get a notification before your session.
              </p>
              {mode === "IN_PERSON" && result?.address && (
                <p className="text-sm text-foreground-muted">
                  Address: <span className="text-foreground">{result.address}</span>
                </p>
              )}
              {mode === "PHONE_CALL" && (
                <p className="text-sm text-foreground-muted">
                  The astrologer will call you at {clientPhone} at your scheduled time.
                </p>
              )}
              {mode === "CHAT" && (
                <p className="text-sm text-foreground-muted">
                  Your chat will open at your scheduled time.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
