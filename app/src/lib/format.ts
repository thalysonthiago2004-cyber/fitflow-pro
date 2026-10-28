// pt-BR formatting helpers. Dates render in the São Paulo time zone so server
// and client output match regardless of where the code runs.
const TIME_ZONE = "America/Sao_Paulo";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: TIME_ZONE });
const longDateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: TIME_ZONE });
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});

export function formatDate(value: string | Date): string {
  return dateFormat.format(toDate(value));
}

export function formatLongDate(value: string | Date): string {
  return longDateFormat.format(toDate(value));
}

export function formatDateTime(value: string | Date): string {
  return dateTimeFormat.format(toDate(value));
}

export function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits }).format(value);
}

// Date-only values (YYYY-MM-DD) are calendar dates, not instants: parse them at
// noon UTC so the São Paulo rendering never shifts to the previous day.
function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
}

/** Today's date in São Paulo as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

export function ageFromBirthDate(birthDate: string, today: string = todayISO()): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** Parses "72,5" or "72.5"; returns undefined for blank input and NaN for garbage. */
export function parseDecimal(value: unknown): number | undefined {
  if (typeof value !== "string") return typeof value === "number" ? value : undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^\d+([.,]\d+)?$/.test(trimmed)) return Number.NaN;
  return Number(trimmed.replace(",", "."));
}

/** Day of week (0 = Sunday) in São Paulo. */
export function weekdayToday(now: Date = new Date()): number {
  const short = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TIME_ZONE }).format(now);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
}

export function formatDuration(startIso: string, endIso: string): string {
  const minutes = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** 750 → "750 ml"; 1500 → "1,5 L". */
export function formatVolume(ml: number): string {
  return ml < 1000 ? `${formatNumber(ml, 0)} ml` : `${formatNumber(ml / 1000, 2)} L`;
}

/** Whole days from one calendar date to another (negative when `to` is earlier). */
export function daysBetweenDates(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** A real YYYY-MM-DD calendar date ("2026-02-31" is not: Date would roll it over to March). */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Calendar date (YYYY-MM-DD) `offset` days from `iso`. */
export function addDays(iso: string, offset: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
