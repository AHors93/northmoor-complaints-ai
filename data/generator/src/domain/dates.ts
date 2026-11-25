const DAY_MS = 86_400_000;

/** The generator never reads the clock: all data is "as at" this date. */
export const AS_AT = '2026-10-31';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const toIso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  return toIso(Date.parse(date) + days * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

/** First-of-month date, `months` before the month of `date`. */
export function monthsBefore(date: string, months: number): string {
  const d = new Date(date);
  return toIso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - months, 1));
}

export type DateFormat = 'iso' | 'uk_slash' | 'long';

export function formatDate(date: string, format: DateFormat): string {
  const d = new Date(date);
  const day = d.getUTCDate();
  switch (format) {
    case 'iso':
      return date;
    case 'uk_slash':
      return date.split('-').reverse().join('/');
    case 'long':
      return `${day}${ordinal(day)} ${MONTHS[d.getUTCMonth()] ?? ''} ${d.getUTCFullYear()}`;
  }
}

function ordinal(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  return { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th';
}
