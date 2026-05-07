"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export type EditTimesheet = {
  id: number;
  employeeId: number;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  hoursWorked: string;
  standardHours: string;
  dailyBreakdown?: string | null;
  notes?: string | null;
  status: string;
};

export type EmployeeOpt = { id: number; firstName: string; lastName: string; position: string | null };

function isoDateOnly(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function TimesheetEditClient({ timesheet, employees }: { timesheet: EditTimesheet; employees: EmployeeOpt[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [employeeId, setEmployeeId] = useState<number>(timesheet.employeeId);
  const [weekNumber, setWeekNumber] = useState<number>(timesheet.weekNumber);
  const [year, setYear] = useState<number>(timesheet.year);
  const [startDate, setStartDate] = useState<string>(isoDateOnly(timesheet.startDate));
  const [endDate, setEndDate] = useState<string>(isoDateOnly(timesheet.endDate));
  const [hoursWorked, setHoursWorked] = useState<string>(String(timesheet.hoursWorked ?? ""));
  const [standardHours, setStandardHours] = useState<string>(String(timesheet.standardHours ?? "40"));
  const [dailyBreakdown, setDailyBreakdown] = useState<string>(String(timesheet.dailyBreakdown ?? ""));
  const [notes, setNotes] = useState<string>(String(timesheet.notes ?? ""));

  const empLabel = useMemo(() => {
    const e = employees.find((x) => x.id === employeeId);
    return e ? `${e.lastName} ${e.firstName}` : "—";
  }, [employees, employeeId]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/timesheets/${timesheet.id}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          weekNumber,
          year,
          startDate,
          endDate,
          hoursWorked: Number(hoursWorked),
          standardHours: Number(standardHours || "40"),
          dailyBreakdown: dailyBreakdown.trim() ? dailyBreakdown : undefined,
          notes: notes.trim() ? notes : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Nu am putut salva");

      toast.success("Pontaj actualizat");
      router.push("/pontaj");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit pontaj #{timesheet.id}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Status: <span className="font-medium text-gray-900">{timesheet.status}</span> • Angajat:{" "}
            <span className="font-medium text-gray-900">{empLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.back()} disabled={saving}>
            Înapoi
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Se salvează..." : "Salvează"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-600">Angajat</label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={String(employeeId)}
              onChange={(e) => setEmployeeId(Number(e.target.value))}
            >
              {employees.map((e) => (
                <option key={e.id} value={String(e.id)}>
                  {e.lastName} {e.firstName} {e.position ? `— ${e.position}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Săpt.</label>
            <input
              type="number"
              min={1}
              max={52}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={weekNumber}
              onChange={(e) => setWeekNumber(Number(e.target.value || "1"))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">An</label>
            <input
              type="number"
              min={2024}
              max={2030}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={year}
              onChange={(e) => setYear(Number(e.target.value || String(new Date().getFullYear())))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Start date</label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">End date</label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Ore lucrate</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={hoursWorked}
              onChange={(e) => setHoursWorked(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Ore standard</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={standardHours}
              onChange={(e) => setStandardHours(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-600">Zilnic (JSON opțional)</label>
            <textarea
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-mono"
              rows={4}
              value={dailyBreakdown}
              onChange={(e) => setDailyBreakdown(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-600">Observații (opțional)</label>
            <textarea
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

