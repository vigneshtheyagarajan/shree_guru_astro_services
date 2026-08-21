// The platform currently operates in a single timezone (India). Every date
// display must pin this explicitly -- otherwise server render (Node's TZ)
// and client hydration (the browser's local TZ) can disagree and React
// throws a hydration mismatch, and in production Node defaults to UTC
// regardless of where users actually are.
const TIME_ZONE = "Asia/Kolkata";
const LOCALE = "en-IN";

export function formatDateTimeLong(date: Date | string) {
  return new Date(date).toLocaleString(LOCALE, {
    timeZone: TIME_ZONE,
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateTimeShort(date: Date | string) {
  return new Date(date).toLocaleString(LOCALE, {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateShort(date: Date | string) {
  return new Date(date).toLocaleDateString(LOCALE, {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString(LOCALE, {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });
}
