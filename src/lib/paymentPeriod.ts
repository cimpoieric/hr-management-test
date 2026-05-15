export type PaymentFrequency = "weekly" | "monthly";
export type PeriodType = PaymentFrequency;

export const MIN_CALENDAR_YEAR = 2000;
export const MAX_CALENDAR_YEAR = 2100;

export function isValidDate(d: Date): boolean {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

export function clampCalendarYear(year: number): number {
  if (!Number.isFinite(year)) return new Date().getFullYear();
  return Math.min(
    MAX_CALENDAR_YEAR,
    Math.max(MIN_CALENDAR_YEAR, Math.round(year)),
  );
}

export function clampCalendarMonth(month: number): number {
  if (!Number.isFinite(month)) return new Date().getMonth() + 1;
  return Math.min(12, Math.max(1, Math.round(month)));
}

export function clampIsoWeek(week: number): number {
  if (!Number.isFinite(week)) return 1;
  return Math.min(53, Math.max(1, Math.round(week)));
}

/** Last calendar day of month (month is 1-12). */
export function getMonthEnd(year: number, month: number): Date {
  const y = clampCalendarYear(year);
  const m = clampCalendarMonth(month);
  return new Date(y, m, 0);
}

export function getMonthStart(year: number, month: number): Date {
  const y = clampCalendarYear(year);
  const m = clampCalendarMonth(month);
  return new Date(y, m - 1, 1);
}

/** yyyy-mm-dd for input type=date; empty string if invalid. */
export function toIsoDateInput(d: Date): string {
  if (!isValidDate(d)) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function parseToIsoDateInput(value: unknown): string {
  if (value == null || value === "") return "";
  const d =
    value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
  return toIsoDateInput(d);
}

function parseUnknownToDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const d =
    value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
  return isValidDate(d) ? d : null;
}

/** Display dd.mm-dd.mm without throwing on bad DB values. */
export function formatPeriodRangeDisplay(
  start: unknown,
  end: unknown,
  locale: string,
  fallback = "-",
): string {
  const s = parseUnknownToDate(start);
  const e = parseUnknownToDate(end);
  if (!s || !e) return fallback;
  const fmt = (d: Date) =>
    d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
  return `${fmt(s)}-${fmt(e)}`;
}

export function normalizePaymentFrequency(
  raw: unknown,
): PaymentFrequency {
  const s = String(raw ?? "weekly").toLowerCase().trim();
  return s === "monthly" ? "monthly" : "weekly";
}

/** Pontaj: paymentFrequency din profil; fallback LUNAR = lunar. */
export function resolveTimesheetFrequencyForEmployee(
  emp: {
    paymentFrequency?: string | null;
    salaryType?: string | null;
  } | null,
): PaymentFrequency {
  if (!emp) return "weekly";
  if (normalizePaymentFrequency(emp.paymentFrequency) === "monthly") {
    return "monthly";
  }
  if (String(emp.salaryType ?? "").toUpperCase() === "LUNAR") {
    return "monthly";
  }
  return "weekly";
}

export function buildWeeklyPeriodKey(year: number, weekNumber: number): string {
  const w = Math.min(52, Math.max(1, weekNumber));
  return `${year}-W${String(w).padStart(2, "0")}`;
}

export function buildMonthlyPeriodKey(monthYear: number, month: number): string {
  const m = Math.min(12, Math.max(1, month));
  return `${monthYear}-M${String(m).padStart(2, "0")}`;
}

export function buildPeriodKey(
  type: PeriodType,
  params: {
    year: number;
    weekNumber?: number;
    month?: number;
    monthYear?: number;
  },
): string {
  if (type === "monthly") {
    const y = params.monthYear ?? params.year;
    const m = params.month ?? 1;
    return buildMonthlyPeriodKey(y, m);
  }
  return buildWeeklyPeriodKey(params.year, params.weekNumber ?? 1);
}

/** Monday-Sunday for ISO week (local calendar days). */
export function isoWeekRangeLocal(
  year: number,
  week: number,
): { start: Date; end: Date } {
  const y = clampCalendarYear(year);
  const w = clampIsoWeek(week);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (day - 1));
  const start = new Date(mondayWeek1);
  start.setUTCDate(mondayWeek1.getUTCDate() + (w - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const range = {
    start: new Date(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate(),
    ),
    end: new Date(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
  };
  if (!isValidDate(range.start) || !isValidDate(range.end)) {
    return isoWeekRangeLocal(new Date().getFullYear(), 1);
  }
  return range;
}

/** First-last calendar day of month (local). */
export function monthRangeLocal(
  monthYear: number,
  month: number,
): { start: Date; end: Date } {
  const y = clampCalendarYear(monthYear);
  const m = clampCalendarMonth(month);
  const start = getMonthStart(y, m);
  const end = getMonthEnd(y, m);
  if (!isValidDate(start) || !isValidDate(end)) {
    const now = new Date();
    return monthRangeLocal(now.getFullYear(), now.getMonth() + 1);
  }
  return { start, end };
}

export function periodRange(
  type: PeriodType,
  params: {
    year: number;
    weekNumber?: number;
    month?: number;
    monthYear?: number;
  },
): { start: Date; end: Date } {
  if (type === "monthly") {
    const y = clampCalendarYear(params.monthYear ?? params.year);
    const m = clampCalendarMonth(
      params.month ?? new Date().getMonth() + 1,
    );
    return monthRangeLocal(y, m);
  }
  const y = clampCalendarYear(params.year);
  const w = clampIsoWeek(params.weekNumber ?? 1);
  return isoWeekRangeLocal(y, w);
}

export function currentPeriodDefaults(
  frequency: PaymentFrequency,
  ref: Date = new Date(),
): {
  type: PeriodType;
  year: number;
  weekNumber: number;
  month: number;
  monthYear: number;
  periodKey: string;
} {
  const year = ref.getFullYear();
  const month = ref.getMonth() + 1;
  if (frequency === "monthly") {
    return {
      type: "monthly",
      year,
      weekNumber: 0,
      month,
      monthYear: year,
      periodKey: buildMonthlyPeriodKey(year, month),
    };
  }
  const d = new Date(Date.UTC(year, ref.getMonth(), ref.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.min(
    52,
    Math.max(1, Math.ceil(((+d - +yearStart) / 86400000 + 1) / 7)),
  );
  const isoYear = d.getUTCFullYear();
  return {
    type: "weekly",
    year: isoYear,
    weekNumber: week,
    month: ref.getMonth() + 1,
    monthYear: year,
    periodKey: buildWeeklyPeriodKey(isoYear, week),
  };
}

export function formatPeriodLabel(
  type: PeriodType,
  params: {
    year: number;
    weekNumber?: number;
    month?: number;
    monthYear?: number;
  },
): string {
  if (type === "monthly") {
    const y = params.monthYear ?? params.year;
    const m = params.month ?? 1;
    return `${String(m).padStart(2, "0")}/${y}`;
  }
  return `S${params.weekNumber ?? 1}/${params.year}`;
}
