/** Shared helpers/constants for user-defined categories and weekday handling. */

export const CATEGORY_ICON_EMOJI: Record<string, string> = {
  book: "📚",
  dumbbell: "🏋️",
  code: "💻",
  sparkles: "✨",
  heart: "❤️",
  music: "🎵",
  home: "🏠",
  briefcase: "💼",
  coffee: "☕",
  brain: "🧠",
  shield: "🛡️",
  palette: "🎨",
  utensils: "🍴",
  moon: "🌙",
  target: "🎯",
  sun: "☀️",
};

export const CATEGORY_ICON_IDS = Object.keys(CATEGORY_ICON_EMOJI);

export function iconEmoji(icon: string): string {
  return CATEGORY_ICON_EMOJI[icon] ?? "✨";
}

export const COLOR_SWATCHES = [
  "#801E0F",
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#64748b",
];

/** Monday-first pills. `index` follows JS/backend convention (0 = Sunday). */
export const WEEKDAY_PILLS = [
  { label: "M", short: "Mon", index: 1 },
  { label: "T", short: "Tue", index: 2 },
  { label: "W", short: "Wed", index: 3 },
  { label: "Th", short: "Thu", index: 4 },
  { label: "F", short: "Fri", index: 5 },
  { label: "Sa", short: "Sat", index: 6 },
  { label: "Su", short: "Sun", index: 0 },
];

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

export function dayIndexOf(dateStr: string): number {
  return parseDate(dateStr).getUTCDay();
}

export function formatMonthDay(dateStr: string): string {
  return parseDate(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Monday on/before the given YYYY-MM-DD date. */
export function mondayOf(dateStr: string): string {
  const d = parseDate(dateStr);
  const idx = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (idx === 0 ? 6 : idx - 1));
  return d.toISOString().slice(0, 10);
}

/** Adds `days` (positive or negative) to a YYYY-MM-DD string in UTC. */
export function addDaysToDate(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function describeDays(days: number[]): string {
  const ordered = WEEKDAY_PILLS.filter((p) => days.includes(p.index)).map(
    (p) => p.short
  );
  if (ordered.length === 7) return "Every day";
  return ordered.join(", ");
}

/** Pill-style background that works for #rrggbb colors (falls back to transparent). */
export function softBackground(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}26` : "transparent";
}

