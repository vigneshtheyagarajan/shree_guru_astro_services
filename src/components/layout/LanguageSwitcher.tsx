"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/locales";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <select
      aria-label="Language"
      value={locale}
      onChange={(event) => setLocale(event.target.value as (typeof LOCALES)[number])}
      className="rounded-lg border border-border bg-background-elevated px-2 py-1 text-sm text-foreground-muted hover:text-foreground"
    >
      {LOCALES.map((code) => (
        <option key={code} value={code}>
          {LOCALE_LABELS[code]}
        </option>
      ))}
    </select>
  );
}
