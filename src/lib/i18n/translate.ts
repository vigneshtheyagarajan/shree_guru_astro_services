import { DEFAULT_LOCALE, type Locale } from "./locales";
import { dictionaries } from "./dictionaries";

export function translate(locale: Locale, key: string): string {
  return dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
}
