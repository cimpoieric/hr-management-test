"use client";

import { broadcastTimesheetHoursForPayrollSync } from "@/lib/timesheetPayrollSync";
import { ChevronsUpDown, Plus, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import type { EmployeeOption } from "@/types";

function isoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * ISO week range (Mon..Sun) for (year, week).
 * Works for ISO-8601 week numbers (1-53). UI limits 1-52.
 */
function isoWeekRange(year: number, week: number): { start: Date; end: Date } {
  // ISO week 1 is the week with Jan 4.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7; // 1..7 (Mon..Sun)
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (day - 1));

  const start = new Date(mondayWeek1);
  start.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  // return as local dates (keeping same calendar day)
  return {
    start: new Date(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate(),
    ),
    end: new Date(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
  };
}

function currentIsoWeek(): { year: number; week: number } {
  const now = new Date();
  // ISO week algorithm
  const d = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+d - +yearStart) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

const formSchema = z
  .object({
    employeeId: z.number().int().positive(),
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
  .refine((v) => new Date(v.startDate) < new Date(v.endDate), {
    message: "startDate trebuie să fie înainte de endDate",
    path: ["endDate"],
  });

export function TimesheetForm({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { year: currentYear, week: currentWeek } = useMemo(
    () => currentIsoWeek(),
    [],
  );

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState<number | null>(null);

  const [weekNumber, setWeekNumber] = useState<number>(
    Math.min(52, Math.max(1, currentWeek)),
  );
  const [year, setYear] = useState<number>(currentYear);
  const [startDate, setStartDate] = useState<string>(() => {
    const r = isoWeekRange(currentYear, Math.min(52, Math.max(1, currentWeek)));
    return isoDate(r.start);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const r = isoWeekRange(currentYear, Math.min(52, Math.max(1, currentWeek)));
    return isoDate(r.end);
  });
  const [hoursWorked, setHoursWorked] = useState<string>("40");
  const [standardHours, setStandardHours] = useState<string>("40");
  const [travelAllowance, setTravelAllowance] = useState<string>("0.00");
  const [dailyBreakdown, setDailyBreakdown] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Auto-calc dates when year/week changes
  useEffect(() => {
    const r = isoWeekRange(year, weekNumber);
    setStartDate(isoDate(r.start));
    setEndDate(isoDate(r.end));
  }, [year, weekNumber]);

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

  function resetForm() {
    setEmployeeId(null);
    setEmployeeQuery("");
    setEmployeeDropdownOpen(false);
    setWeekNumber(Math.min(52, Math.max(1, currentWeek)));
    setYear(currentYear);
    const r = isoWeekRange(currentYear, Math.min(52, Math.max(1, currentWeek)));
    setStartDate(isoDate(r.start));
    setEndDate(isoDate(r.end));
    setHoursWorked("40");
    setStandardHours("40");
    setTravelAllowance("0.00");
    setDailyBreakdown("");
    setNotes("");
    setError(null);
  }

  async function onSubmit() {
    setError(null);
    const payload = {
      employeeId: employeeId ?? 0,
      weekNumber,
      year,
      startDate,
      endDate,
      hoursWorked: Number(hoursWorked),
      standardHours: Number(standardHours || "40"),
      travelAllowance:
        Number(String(travelAllowance).replace(",", ".") || "0") || 0,
      dailyBreakdown: dailyBreakdown.trim() ? dailyBreakdown.trim() : undefined,
      notes: notes.trim() ? notes.trim() : undefined,
    };

    const parsed = formSchema.safeParse(payload);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Date invalide";
      setError(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/attendance", {
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
      broadcastTimesheetHoursForPayrollSync(
        parsed.data.year,
        parsed.data.weekNumber,
      );
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
                  Completează pontajul săptămânal.
                </p>
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

                <div>
                  <label className="text-xs font-medium text-gray-600">
                    Săptămâna
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={weekNumber}
                    onChange={(e) =>
                      setWeekNumber(
                        Math.min(
                          52,
                          Math.max(1, Number(e.target.value || "1")),
                        ),
                      )
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">
                    An
                  </label>
                  <input
                    type="number"
                    min={2024}
                    max={2030}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={year}
                    onChange={(e) =>
                      setYear(Number(e.target.value || String(currentYear)))
                    }
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
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={standardHours}
                    onChange={(e) => setStandardHours(e.target.value)}
                    placeholder="40"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">
                    Diurnă (EUR)
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
