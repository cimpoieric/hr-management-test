"use client";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { ROUTES } from "@/lib/routes";
import { parseToIsoDateInput } from "@/lib/paymentPeriod";
import { broadcastTimesheetHoursForPayrollSync } from "@/lib/timesheetPayrollSync";
import type { EditTimesheet, EmployeeOption } from "@/types";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export function TimesheetEditClient({
  timesheet,
  employees,
}: {
  timesheet: EditTimesheet;
  employees: EmployeeOption[];
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const dash = t("common.emDash");
  const [saving, setSaving] = useState(false);

  const [employeeId, setEmployeeId] = useState<number>(timesheet.employeeId);
  const [weekNumber, setWeekNumber] = useState<number>(timesheet.weekNumber);
  const [year, setYear] = useState<number>(timesheet.year);
  const [startDate, setStartDate] = useState<string>(
    parseToIsoDateInput(timesheet.startDate),
  );
  const [endDate, setEndDate] = useState<string>(
    parseToIsoDateInput(timesheet.endDate),
  );
  const [hoursWorked, setHoursWorked] = useState<string>(
    String(timesheet.hoursWorked ?? ""),
  );
  const [standardHours, setStandardHours] = useState<string>(
    String(timesheet.standardHours ?? "40"),
  );
  const [travelAllowance, setTravelAllowance] = useState<string>(() =>
    Number(timesheet.travelAllowance ?? 0).toFixed(2),
  );
  const [dailyBreakdown, setDailyBreakdown] = useState<string>(
    String(timesheet.dailyBreakdown ?? ""),
  );
  const [notes, setNotes] = useState<string>(String(timesheet.notes ?? ""));

  const statusLabel = useMemo(() => {
    const s = String(timesheet.status || "").toUpperCase();
    if (s === "DRAFT") return t("pages.attendance.statusDraft");
    if (s === "SUBMITTED") return t("pages.attendance.statusSubmitted");
    if (s === "APPROVED") return t("pages.attendance.statusApproved");
    if (s === "REJECTED") return t("pages.attendance.statusRejected");
    return timesheet.status || dash;
  }, [dash, t, timesheet.status]);

  const empLabel = useMemo(() => {
    const e = employees.find((x) => x.id === employeeId);
    return e ? `${e.lastName} ${e.firstName}` : dash;
  }, [dash, employees, employeeId]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/attendance/${timesheet.id}`, {
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
          travelAllowance:
            Number(String(travelAllowance).replace(",", ".")) || 0,
          dailyBreakdown: dailyBreakdown.trim() ? dailyBreakdown : undefined,
          notes: notes.trim() ? notes : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok)
        throw new Error(data.error ?? t("components.toast.timesheetSaveFailed"));

      toast.success(t("components.toast.timesheetUpdated"));
      broadcastTimesheetHoursForPayrollSync(year, weekNumber);
      router.push(ROUTES.timesheets);
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("common.error"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("pages.attendance.editHeading", { id: String(timesheet.id) })}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("pages.attendance.statusLabel")}:{" "}
            <span className="font-medium text-gray-900">{statusLabel}</span>{" "}
            • {t("pages.attendance.employeeLabel")}:{" "}
            <span className="font-medium text-gray-900">{empLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.back()}
            disabled={saving}
          >
            {t("pages.attendance.back")}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? t("pages.attendance.saving") : t("common.save")}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-600">
              {t("pages.attendance.employee")}
            </label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={String(employeeId)}
              onChange={(e) => setEmployeeId(Number(e.target.value))}
            >
              {employees.map((e) => (
                <option key={e.id} value={String(e.id)}>
                  {e.lastName} {e.firstName}{" "}
                  {e.position ? `${dash} ${e.position}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">
              {t("pages.attendance.weekShort")}
            </label>
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
            <label className="text-xs font-medium text-gray-600">
              {t("pages.attendance.year")}
            </label>
            <input
              type="number"
              min={2024}
              max={2030}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={year}
              onChange={(e) =>
                setYear(
                  Number(e.target.value || String(new Date().getFullYear())),
                )
              }
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">
              {t("pages.attendance.startDate")}
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
              {t("pages.attendance.endDate")}
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
              {t("pages.attendance.hoursWorked")}
            </label>
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
            <label className="text-xs font-medium text-gray-600">
              {t("pages.attendance.standardHours")}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={standardHours}
              onChange={(e) => setStandardHours(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">
              {t("pages.attendance.travelAllowanceEur")}
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
          <div className="hidden md:block" aria-hidden="true" />
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-600">
              {t("pages.attendance.dailyBreakdownJson")}
            </label>
            <textarea
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-mono"
              rows={4}
              value={dailyBreakdown}
              onChange={(e) => setDailyBreakdown(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-600">
              {t("pages.attendance.notesOptional")}
            </label>
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
