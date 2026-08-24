"use client";

import { useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Select, Stepper } from "@/components/ui";
import { IntakeFormRenderer, type IntakeValues } from "@/components/forms/IntakeFormRenderer";
import { SlotPicker, type SlotOption } from "@/components/booking/SlotPicker";
import type { IntakeSchema } from "@/lib/services/intake-schema";
import { formatDateTimeLong } from "@/lib/dateFormat";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Mode = "CHAT" | "CALL";

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
  const { t } = useLocale();
  const MODE_LABELS: Record<Mode, string> = {
    CHAT: t("booking.modeChat"),
    CALL: t("booking.modeCall"),
  };
  const STEPS = [
    t("booking.stepService"),
    t("booking.stepAstrologer"),
    t("booking.stepIntake"),
    t("booking.stepSlot"),
    t("booking.stepConfirm"),
  ];
  const [step, setStep] = useState<"intake" | "slot" | "confirm" | "done">("intake");
  const [mode, setMode] = useState<Mode>(offering.modes[0]);
  const [intakeValues, setIntakeValues] = useState<IntakeValues>({});
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId) ?? null;
  const stepNumber = { intake: 3, slot: 4, confirm: 5, done: 5 }[step];

  function validateIntake() {
    for (const field of offering.service.intakeSchema) {
      if (field.required && !intakeValues[field.key]?.trim()) {
        return `${field.label} is required.`;
      }
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
      }),
    });

    setSubmitting(false);
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setError(body?.error ?? "Failed to create booking.");
      return;
    }

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
                  label={t("booking.consultationMode")}
                  value={mode}
                  onChange={(event) => setMode(event.target.value as Mode)}
                  options={offering.modes.map((m) => ({ label: MODE_LABELS[m], value: m }))}
                />
              ) : (
                <p className="text-sm text-foreground-muted">
                  {t("booking.mode")}: {MODE_LABELS[offering.modes[0]]}
                </p>
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
                {t("booking.continue")}
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
                  {t("booking.back")}
                </Button>
                <Button disabled={!selectedSlotId} onClick={() => setStep("confirm")}>
                  {t("booking.continue")}
                </Button>
              </div>
            </>
          )}

          {step === "confirm" && selectedSlot && (
            <>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-foreground-muted">{t("booking.mode")}</dt>
                  <dd className="text-foreground">{MODE_LABELS[mode]}</dd>
                </div>
                <div>
                  <dt className="text-foreground-muted">{t("booking.price")}</dt>
                  <dd className="text-foreground">
                    ₹{offering.pricePerSession} ({offering.durationMinutes} min)
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-foreground-muted">{t("booking.slot")}</dt>
                  <dd className="text-foreground">
                    {formatDateTimeLong(selectedSlot.startAt)}
                  </dd>
                </div>
              </dl>
              <Badge variant="warning" className="w-fit">
                {t("booking.paymentNoticeUpfront")}
              </Badge>
              {error && <p className="text-sm text-danger">{error}</p>}
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep("slot")}>
                  {t("booking.back")}
                </Button>
                <Button loading={submitting} onClick={handleConfirm}>
                  {t("booking.confirmBooking")}
                </Button>
              </div>
            </>
          )}

          {step === "done" && (
            <div className="flex flex-col gap-3">
              <p className="text-foreground">{t("booking.confirmedMessage")}</p>
              <p className="text-sm text-foreground-muted">
                Complete payment from your booking page to unlock the {MODE_LABELS[mode].toLowerCase()}{" "}
                at your scheduled time — the astrologer never leaves the app to reach you.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
