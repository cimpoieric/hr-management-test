import {
  clampCalendarYear,
  clampIsoWeek,
  isValidDate,
} from "@/lib/paymentPeriod";

/** ISO-like week (1-53) and calendar year for payroll defaults; aligns with pontaj weekNumber/year filters. */
export function getPayrollWeekDefaults(date: Date = new Date()): {
  year: number;
  week: number;
} {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return {
    year: d.getUTCFullYear(),
    week: Math.min(53, Math.max(1, week)),
  };
}

/** Monday–Sunday interval for an ISO week (UTC). */
export function getIsoWeekDateRange(
  year: number,
  week: number,
): { start: Date; end: Date } {
  const y = clampCalendarYear(year);
  const w = clampIsoWeek(week);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (w - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  if (!isValidDate(start) || !isValidDate(end)) {
    return getIsoWeekDateRange(new Date().getFullYear(), 1);
  }
  return { start, end };
}

export function formatIsoWeekPeriod(
  year: number,
  week: number,
): { start: string; end: string } {
  const { start, end } = getIsoWeekDateRange(year, week);
  const format = (date: Date) => {
    if (!isValidDate(date)) return "-";
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}.${date.getUTCFullYear()}`;
  };
  return { start: format(start), end: format(end) };
}
