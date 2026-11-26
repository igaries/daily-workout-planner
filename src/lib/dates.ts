import {
  format,
  parseISO,
  startOfWeek,
  addDays,
  differenceInCalendarDays,
  isToday,
  isYesterday,
  subWeeks,
} from "date-fns";

/** Local calendar date as yyyy-MM-dd */
export function todayKey(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function formatDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function parseDateKey(key: string): Date {
  return parseISO(key);
}

export function formatDisplayDate(key: string): string {
  try {
    return format(parseISO(key), "MMM d");
  } catch {
    return key;
  }
}

export function formatLongDate(key: string): string {
  try {
    return format(parseISO(key), "MMM d, yyyy");
  } catch {
    return key;
  }
}

/** Monday-first week containing `date` (local). */
export function weekDays(date = new Date()): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Last 12 weeks Monday-first grid (84 days), ending with current week. */
export function last12WeeksDays(date = new Date()): Date[] {
  const thisWeekStart = startOfWeek(date, { weekStartsOn: 1 });
  const start = subWeeks(thisWeekStart, 11);
  return Array.from({ length: 84 }, (_, i) => addDays(start, i));
}

export function relativeTrainedLabel(dateKey: string | null): string | null {
  if (!dateKey) return null;
  const d = parseISO(dateKey);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  const days = differenceInCalendarDays(new Date(), d);
  if (days < 1) return "Today";
  return `${days} days ago`;
}

export function dayLetter(date: Date): string {
  return format(date, "EEEEE");
}

export function dayNumber(date: Date): string {
  return format(date, "d");
}
