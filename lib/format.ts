/**
 * Formatting helpers. Calendar dates (YYYY-MM-DD) and local datetimes
 * (YYYY-MM-DDTHH:mm:ss, no zone) are read as local time, never shifted.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Organisation display settings (Settings will own these later). */
export const LOCALE = "en-US";

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Local datetime string → Date (keeps hours and minutes). */
export function parseDateTime(iso: string): Date {
  const d = parseDate(iso);
  if (iso.length > 10) {
    const [h, mi, s] = iso.slice(11, 19).split(":").map(Number);
    d.setHours(h || 0, mi || 0, s || 0);
  }
  return d;
}

export function toIsoDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function toIsoDateTime(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${toIsoDate(date)}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function addMinutes(iso: string, minutes: number): string {
  const d = parseDateTime(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return toIsoDateTime(d);
}

/** Whole days from a to b (calendar dates). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);
}

/** "May 14, 2025" */
export function formatDate(iso: string): string {
  const d = parseDate(iso);
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()}`;
}

/** "May 14" */
export function formatShortDate(iso: string): string {
  const d = parseDate(iso);
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}`;
}

/** "MAY" */
export function formatMonth(iso: string): string {
  return MONTHS[parseDate(iso).getMonth()].toUpperCase();
}

/** "10:45 AM" */
export function formatTime(iso: string): string {
  const [h, m] = iso.slice(11, 16).split(":").map(Number);
  const hour = h % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "May 14, 2025, 10:45 AM" */
export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

/** "May 12 – May 18, 2025" */
export function formatRange(start: string, end: string): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const s = parseDate(start);
  const short = `${MONTHS[s.getMonth()]} ${s.getDate()}`;
  const e = parseDate(end);
  return `${sameYear ? short : formatDate(start)} – ${MONTHS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
}

/** "2m ago", "3h ago", "Yesterday", "May 12" — relative to `now`. */
export function formatRelative(iso: string, now: string): string {
  const diff = Math.max(0, (parseDateTime(now).getTime() - parseDateTime(iso).getTime()) / 60_000);
  if (diff < 1) return "Just now";
  if (diff < 60) return `${Math.floor(diff)}m ago`;
  if (diff < 24 * 60) return `${Math.floor(diff / 60)}h ago`;
  if (diff < 48 * 60) return "Yesterday";
  if (diff < 7 * 24 * 60) return `${Math.floor(diff / (24 * 60))}d ago`;
  return formatShortDate(iso);
}

const numberFmt = new Intl.NumberFormat(LOCALE);

/** "12,458" */
export function formatNumber(n: number): string {
  return numberFmt.format(Math.round(n));
}

/** "12.4K" for chart axes. */
export function formatCompact(n: number): string {
  if (Math.abs(n) >= 1000) return `${Number((n / 1000).toFixed(n % 1000 === 0 ? 0 : 1))}K`;
  return String(Math.round(n));
}

/** "28.6%" */
export function formatPercent(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

/** Share of a whole as a percentage (0 when the whole is 0). */
export function pct(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

/** "+120" / "−15" with a true minus sign. */
export function formatSigned(n: number): string {
  if (n > 0) return `+${formatNumber(n)}`;
  if (n < 0) return `−${formatNumber(Math.abs(n))}`;
  return "0";
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}
