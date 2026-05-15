"use client";

import {
  currentPeriodDefaults,
  isoWeekRangeLocal,
  monthRangeLocal,
  resolveTimesheetFrequencyForEmployee,
  toIsoDateInput,
  type PaymentFrequency,
} from "@/lib/paymentPeriod";
import { preventWheelOnFocusedNumberInput } from "@/lib/numericInput";
import { broadcastTimesheetHoursForPayrollSync } from "@/lib/timesheetPayrollSync";
import { ChevronsUpDown, Plus, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import type { EmployeeOption } from "@/types";

const weeklyFormSchema = z
  .object({
    employeeId: z.number().int().positive(),
    type: z.literal("weekly"),
    weekNumber: z.number().int().min(1).max(52),
    year: z.number().int().min(2024).max(2030),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    hoursWorked: z.number().min(0.5).max(80),
    standardHours: z.number().min(0).max(80).default(40),
    travelAllowance: z.number().min(0).max(1_000_000).default(0),
    dailyBreakdown: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((v) => {
    const s = new Date(v.startDate);
    const e = new Date(v.endDate);
    return (
      !Number.isNaN(s.getTime()) &&
      !Number.isNaN(e.getTime()) &&
      s < e
    );
  }, {
    message: "startDate trebuie să fie înainte de endDate",
    path: ["endDate"],
  });

const monthlyFormSchema = z
  .object({
    employeeId: z.number().int().positive(),
    type: z.literal("monthly"),
    month: z.number().int().min(1).max(12),
    monthYear: z.number().int().min(2024).max(2030),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    hoursWorked: z.number().min(0.5).max(250),
    standardHours: z.number().min(0).max(250).default(168),
    travelAllowance: z.number().min(0).max(1_000_000).default(0),
    dailyBreakdown: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((v) => {
    const s = new Date(v.startDate);
    const e = new Date(v.endDate);
    return (
      !Number.isNaN(s.getTime()) &&
      !Number.isNaN(e.getTime()) &&
      s < e
    );
  }, {
    message: "startDate trebuie să fie înainte de endDate",
    path: ["endDate"],
  });

export function TimesheetForm({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weeklyDefaults = useMemo(
    () => currentPeriodDefaults("weekly"),
    [],
  );
  const currentYear = weeklyDefaults.year;
  const currentWeek = weeklyDefaults.weekNumber;

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState<number | null>(null);

  const initialWeek = Math.min(52, Math.max(1, currentWeek));
  const [weekNumber, setWeekNumber] = useState<number>(initialWeek);
  const [weekInput, setWeekInput] = useState(String(initialWeek));
  const [year, setYear] = useState<number>(currentYear);
  const [yearInput, setYearInput] = useState(String(currentYear));
  const nowMonth = new Date().getMonth() + 1;
  const [month, setMonth] = useState<number>(nowMonth);
  const [monthInput, setMonthInput] = useState(String(nowMonth));
  const [startDate, setStartDate] = useState<string>(() => {
    const r = isoWeekRangeLocal(
      currentYear,
      Math.min(52, Math.max(1, currentWeek)),
    );
    return toIsoDateInput(r.start);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const r = isoWeekRangeLocal(
      currentYear,
      Math.min(52, Math.max(1, currentWeek)),
    );
    return toIsoDateInput(r.end);
  });
  const [hoursWorked, setHoursWorked] = useState<string>("40");
  const [standardHours, setStandardHours] = useState<string>("40");
  const [travelAllowance, setTravelAllowance] = useState<string>("0.00");
  const [dailyBreakdown, setDailyBreakdown] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  function clampWeek(n: number): number {
    return Math.min(52, Math.max(1, n));
  }

  function clampYear(n: number): number {
    return Math.min(2030, Math.max(2024, n));
  }

  /** Recalculeaza Start/End doar dupa commit (blur), nu la fiecare cifra. */
  function applyWeekYear(nextWeek: number, nextYear: number) {
    const w = clampWeek(nextWeek);
    const y = clampYear(nextYear);
    setWeekNumber(w);
    setYear(y);
    setWeekInput(String(w));
    setYearInput(String(y));
    const r = isoWeekRangeLocal(y, w);
    setStartDate(toIsoDateInput(r.start));
    setEndDate(toIsoDateInput(r.end));
  }

  function commitWeekInput() {
    const raw = weekInput.trim();
    if (raw === "") {
      setWeekInput(String(weekNumber));
      return;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
      setWeekInput(String(weekNumber));
      return;
    }
    applyWeekYear(parsed, year);
  }

  function commitYearInput() {
    const raw = yearInput.trim();
    if (raw === "") {
      setYearInput(String(year));
      return;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
      setYearInput(String(year));
      return;
    }
    if (isMonthly) {
      applyMonthYear(month, parsed);
    } else {
      applyWeekYear(weekNumber, parsed);
    }
  }

  function commitWeekYearDrafts() {
    let w = weekNumber;
    let y = year;
    const weekRaw = weekInput.trim();
    if (weekRaw !== "") {
      const parsedWeek = Number.parseInt(weekRaw, 10);
      if (Number.isFinite(parsedWeek)) w = parsedWeek;
    }
    const yearRaw = yearInput.trim();
    if (yearRaw !== "") {
      const parsedYear = Number.parseInt(yearRaw, 10);
      if (Number.isFinite(parsedYear)) y = parsedYear;
    }
    if (isMonthly) {
      applyMonthYear(month, y);
    } else {
      applyWeekYear(w, y);
    }
  }

  // Load employees when opening modal
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("limit", "200");
        params.set("sortBy", "lastName");
        params.set("sortOrder", "asc");
        const res = await fetch(`/api/employees?${params.toString()}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const data = (await res.json().catch(() => ({}))) as {
          data?: unknown;
          error?: string;
        };
        if (!res.ok)
          throw new Error(data.error ?? "Nu am putut încărca angajații");
        const list = Array.isArray(data.data) ? data.data : [];
        const mapped = list
          .map((e: unknown): EmployeeOption | null => {
            if (typeof e !== "object" || e === null) return null;
            const r = e as Record<string, unknown>;
            const id = Number(r.id);
            return {
              id,
              firstName: String(r.firstName ?? ""),
              lastName: String(r.lastName ?? ""),
              position:
                r.position === null || r.position === undefined
                  ? null
                  : String(r.position),
              paymentFrequency:
                r.paymentFrequency === null ||
                r.paymentFrequency === undefined
                  ? null
                  : String(r.paymentFrequency),
              salaryType:
                r.salaryType === null || r.salaryType === undefined
                  ? null
                  : String(r.salaryType),
            };
          })
          .filter(
            (e): e is EmployeeOption =>
              e !== null && Number.isFinite(e.id) && e.id > 0,
          );
        if (!cancelled) setEmployees(mapped);
      } catch (e) {
        if (!cancelled) {
          setEmployees([]);
          toast.error(
            e instanceof Error ? e.message : "Eroare la încărcarea angajaților",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filteredEmployees = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => {
      const name = `${e.lastName} ${e.firstName}`.toLowerCase();
      return (
        name.includes(q) ||
        String(e.id).includes(q) ||
        String(e.position ?? "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [employees, employeeQuery]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId) ?? null,
    [employees, employeeId],
  );

  const paymentFreq: PaymentFrequency = useMemo(
    () => resolveTimesheetFrequencyForEmployee(selectedEmployee),
    [selectedEmployee],
  );
  const isWeekly = paymentFreq === "weekly";
  const isMonthly = !isWeekly;

  function switchEmployeePeriodMode(emp: EmployeeOption) {
    const freq = resolveTimesheetFrequencyForEmployee(emp);
    if (freq === "monthly") {
      applyMonthYear(nowMonth, year);
    } else {
      const w = Math.min(52, Math.max(1, currentWeek));
      applyWeekYear(w, currentYear);
      setHoursWorked("40");
      setStandardHours("40");
    }
  }

  useEffect(() => {
    if (!employeeId || !selectedEmployee) return;
    switchEmployeePeriodMode(selectedEmployee);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doar la schimbarea angajatului
  }, [employeeId]);

  function applyMonthYear(m: number, y: number) {
    const mo = Math.min(12, Math.max(1, m));
    const yr = Math.min(2030, Math.max(2024, y));
    setMonth(mo);
    setMonthInput(String(mo));
    setYear(yr);
    setYearInput(String(yr));
    const r = monthRangeLocal(yr, mo);
    setStartDate(toIsoDateInput(r.start));
    setEndDate(toIsoDateInput(r.end));
    setHoursWorked("168");
    setStandardHours("168");
  }

  function commitMonthInput() {
    const parsed = Number(monthInput);
    if (!Number.isFinite(parsed)) {
      setMonthInput(String(month));
      return;
    }
    applyMonthYear(parsed, year);
  }

  function resetForm() {
    setEmployeeId(null);
    setEmployeeQuery("");
    setEmployeeDropdownOpen(false);
    const w = Math.min(52, Math.max(1, currentWeek));
    setWeekNumber(w);
    setWeekInput(String(w));
    setYear(currentYear);
    setYearInput(String(currentYear));
    const r = isoWeekRangeLocal(currentYear, w);
    setStartDate(toIsoDateInput(r.start));
    setEndDate(toIsoDateInput(r.end));
    setHoursWorked("40");
    setStandardHours("40");
    setTravelAllowance("0.00");
    setDailyBreakdown("");
    setNotes("");
    setError(null);
  }

  async function onSubmit() {
    setError(null);
    if (isMonthly) {
      commitMonthInput();
    } else {
      commitWeekYearDrafts();
    }

    const base = {
      employeeId: employeeId ?? 0,
      startDate,
      endDate,
      hoursWorked: Number(hoursWorked),
      travelAllowance:
        Number(String(travelAllowance).replace(",", ".") || "0") || 0,
      dailyBreakdown: dailyBreakdown.trim() ? dailyBreakdown.trim() : undefined,
      notes: notes.trim() ? notes.trim() : undefined,
    };

    const parsed = isMonthly
      ? monthlyFormSchema.safeParse({
          ...base,
          type: "monthly" as const,
          month,
          monthYear: year,
          standardHours: Number(standardHours || "168"),
        })
      : weeklyFormSchema.safeParse({
          ...base,
          type: "weekly" as const,
          weekNumber,
          year,
          standardHours: Number(standardHours || "40"),
        });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Date invalide";
      setError(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/timesheets", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const msg = data.error ?? "Operațiunea a eșuat";
        setError(msg);
        toast.error(msg);
        return;
      }

      toast.success("Pontaj creat");
      if (parsed.data.type === "weekly") {
        broadcastTimesheetHoursForPayrollSync(
          parsed.data.year,
          parsed.data.weekNumber,
        );
      }
      setOpen(false);
      resetForm();
      onSuccess?.();
      router.refresh();
    } catch {
      setError("Eroare de rețea");
      toast.error("Eroare de rețea");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
      >
        <Plus size={16} />
        <span>Pontaj Nou</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-stretch justify-end bg-black/50"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (loading) return;
            setOpen(false);
            resetForm();
          }}
        >
          <div
            className="ml-auto flex h-[100dvh] w-full max-w-md flex-col border bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 px-6 pt-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Pontaj Nou
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {isWeekly
                    ? "Completează pontajul săptămânal."
                    : "Completează pontajul lunar."}
                </p>
                {selectedEmployee && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    Tip plată:{" "}
                    <span className="font-medium text-slate-700">
                      {isWeekly ? "Săptămânal" : "Lunar"}
                    </span>
                  </p>
                )}
              </div>
              <button
                className="rounded-lg border bg-white p-2 hover:bg-gray-50 disabled:opacity-50"
                onClick={() => {
                  if (loading) return;
                  setOpen(false);
                  resetForm();
                }}
                disabled={loading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 flex-1 overflow-y-auto px-6 pb-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Employee combobox */}
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-gray-600">
                    Angajat
                  </label>
                  <button
                    type="button"
                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-left text-sm hover:bg-gray-50"
                    onClick={() => setEmployeeDropdownOpen((v) => !v)}
                  >
                    <span className="flex items-center justify-between">
                      <span className="truncate">
                        {selectedEmployee
                          ? `${selectedEmployee.lastName} ${selectedEmployee.firstName}${selectedEmployee.position ? ` — ${selectedEmployee.position}` : ""}`
                          : "Selectează angajat"}
                      </span>
                      <ChevronsUpDown size={16} className="text-gray-500" />
                    </span>
                  </button>

                  {employeeDropdownOpen && (
                    <div className="mt-2 rounded-xl border bg-white shadow-lg overflow-hidden">
                      <div className="flex items-center gap-2 border-b px-3 py-2">
                        <Search size={16} className="text-gray-500" />
                        <input
                          className="w-full text-sm outline-none"
                          placeholder="Caută nume / poziție / ID..."
                          value={employeeQuery}
                          onChange={(e) => setEmployeeQuery(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div className="max-h-56 overflow-auto">
                        {filteredEmployees.map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                            onClick={() => {
                              setEmployeeId(e.id);
                              setEmployeeDropdownOpen(false);
                              setEmployeeQuery("");
                              switchEmployeePeriodMode(e);
                            }}
                          >
                            <div className="font-medium text-gray-900">
                              {e.lastName} {e.firstName}
                            </div>
                            <div className="text-xs text-gray-500">
                              #{e.id} {e.position ? `· ${e.position}` : ""}
                            </div>
                          </button>
                        ))}
                        {filteredEmployees.length === 0 && (
                          <div className="px-3 py-4 text-sm text-gray-500">
                            Niciun rezultat
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {isWeekly ? (
                  <div>
                    <label className="text-xs font-medium text-gray-600">
                      Saptamana
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm tabular-nums"
                      value={weekInput}
                      onChange={(e) =>
                        setWeekInput(e.target.value.replace(/[^\d]/g, ""))
                      }
                      onBlur={commitWeekInput}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          (e.currentTarget as HTMLInputElement).blur();
                        }
                        if (e.key === "Escape") {
                          setWeekInput(String(weekNumber));
                          (e.currentTarget as HTMLInputElement).blur();
                        }
                      }}
                      onWheel={preventWheelOnFocusedNumberInput}
                      placeholder="1-52"
                      aria-label="Saptamana"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-medium text-gray-600">
                      Luna
                    </label>
                    <select
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                      value={month}
                      onChange={(e) =>
                        applyMonthYear(Number(e.target.value), year)
                      }
                      aria-label="Luna"
                    >
                      {Array.from({ length: 12 }, (_, i) => {
                        const m = i + 1;
                        return (
                          <option key={m} value={m}>
                            {String(m).padStart(2, "0")}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-gray-600">
                    An
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm tabular-nums"
                    value={yearInput}
                    onChange={(e) =>
                      setYearInput(e.target.value.replace(/[^\d]/g, ""))
                    }
                    onBlur={commitYearInput}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.currentTarget as HTMLInputElement).blur();
                      }
                      if (e.key === "Escape") {
                        setYearInput(String(year));
                        (e.currentTarget as HTMLInputElement).blur();
                      }
                    }}
                    onWheel={preventWheelOnFocusedNumberInput}
                    placeholder="2024–2030"
                    aria-label="An"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">
                    Start date
                  </label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">
                    End date
                  </label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">
                    Ore lucrate
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={hoursWorked}
                    onChange={(e) => setHoursWorked(e.target.value)}
                    placeholder="ex: 38.50"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">
                    Ore standard
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    readOnly
                    className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm tabular-nums"
                    value={isWeekly ? "40" : "168"}
                    aria-readonly
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">
                    Diurna (EUR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={travelAllowance}
                    onChange={(e) => setTravelAllowance(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div aria-hidden="true" className="hidden md:block" />

                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-gray-600">
                    Zilnic (opțional)
                  </label>
                  <textarea
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-mono"
                    rows={4}
                    value={dailyBreakdown}
                    onChange={(e) => setDailyBreakdown(e.target.value)}
                    placeholder='JSON (ex: {"mon":8,"tue":8,"wed":8,"thu":8,"fri":6.5})'
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-gray-600">
                    Observații
                  </label>
                  <textarea
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {error}
                </div>
              )}
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t bg-white px-6 py-4">
              <button
                className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                disabled={loading}
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
              >
                Anulează
              </button>
              <button
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                disabled={loading || !employeeId}
                onClick={onSubmit}
              >
                {loading ? "Se salvează..." : "Salvează Pontaj"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
