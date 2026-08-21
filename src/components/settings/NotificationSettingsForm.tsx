"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Input } from "@/components/ui";

export function NotificationSettingsForm({
  initialPhone,
  initialEmailEnabled,
  initialSmsEnabled,
}: {
  initialPhone: string;
  initialEmailEnabled: boolean;
  initialSmsEnabled: boolean;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone);
  const [emailEnabled, setEmailEnabled] = useState(initialEmailEnabled);
  const [smsEnabled, setSmsEnabled] = useState(initialSmsEnabled);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const response = await fetch("/api/settings/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        emailNotificationsEnabled: emailEnabled,
        smsNotificationsEnabled: smsEnabled,
      }),
    });

    setSubmitting(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Failed to save settings.");
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Phone number"
        type="tel"
        placeholder="+91XXXXXXXXXX"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
      />
      <Checkbox
        label="Email notifications"
        checked={emailEnabled}
        onChange={(event) => setEmailEnabled(event.target.checked)}
      />
      <Checkbox
        label="SMS notifications (requires a phone number)"
        checked={smsEnabled}
        onChange={(event) => setSmsEnabled(event.target.checked)}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-success">Settings saved.</p>}
      <Button type="submit" className="self-start" disabled={submitting}>
        {submitting ? "Saving…" : "Save Settings"}
      </Button>
    </form>
  );
}
