/**
 * Calendar-day helpers. Days are stored as local `YYYY-MM-DD` strings so an
 * activity never shifts day when the phone changes time zone. Weeks start on Monday.
 */

export type ISODate = string;

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
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
];
const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEKDAYS_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(date: Date): ISODate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses `YYYY-MM-DD` as local midnight. */
export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function addDays(iso: ISODate, days: number): ISODate {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(iso: ISODate): number {
  return (parseISODate(iso).getDay() + 6) % 7;
}

export function startOfWeek(iso: ISODate): ISODate {
  return addDays(iso, -weekdayIndex(iso));
}

export function weekDays(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function dayOfMonth(iso: ISODate): number {
  return Number(iso.slice(8, 10));
}

/** "Oct 19 - Oct 25" */
export function formatWeekRange(weekStart: ISODate): string {
  const start = parseISODate(weekStart);
  const end = parseISODate(addDays(weekStart, 6));
  return `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} - ${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}`;
}

/** "Tue 21 Oct" */
export function formatShortDate(iso: ISODate): string {
  const date = parseISODate(iso);
  const day = WEEKDAYS_LONG[weekdayIndex(iso)].slice(0, 3);
  return `${day} ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** "Sunday 18 October" */
export function formatLongDate(iso: ISODate): string {
  const date = parseISODate(iso);
  return `${WEEKDAYS_LONG[weekdayIndex(iso)]} ${date.getDate()} ${MONTHS_LONG[date.getMonth()]}`;
}

/** "Today", "Tomorrow", "Yesterday", or "Sunday 18 October". */
export function formatRelativeDate(iso: ISODate, today: ISODate = todayISO()): string {
  if (iso === today) return 'Today';
  if (iso === addDays(today, 1)) return 'Tomorrow';
  if (iso === addDays(today, -1)) return 'Yesterday';
  return formatLongDate(iso);
}

export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
