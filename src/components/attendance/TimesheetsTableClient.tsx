"use client";

import {
  Check,
  FileText,
  Loader2,
  MoreVertical,
  Pencil,
  Send,
  Trash,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { TimesheetForm } from "@/components/forms/TimesheetForm";
import {
  fetchEmployerDetailsForPayslip,
  generateWeeklyPayslip,
  mapPayslipApiResponseToPayslipData,
} from "@/components/payroll/WeeklyPayslipPDF";
import { preventWheelOnFocusedNumberInput } from "@/lib/numericInput";
import { ROUTES } from "@/lib/routes";
import {
  ROLES_EMPLOYEES_RW,
  ROLES_PAYROLL,
  ROLES_SETTINGS_ADMIN,
  type UserRole,
} from "@/lib/roles";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import {
  formatPeriodRangeDisplay,
  parseToIsoDateInput,
} from "@/lib/paymentPeriod";
import { broadcastTimesheetHoursForPayrollSync } from "@/lib/timesheetPayrollSync";
import type { EmployeeOption, Pagination, TimesheetRow } from "@/types";

function statusBadgeClass(status: string): string {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") return "bg-green-50 text-green-700";
  if (s === "SUBMITTED") return "bg-blue-50 text-blue-700";
  if (s === "REJECTED") return "bg-red-50 text-red-700";
  return "bg-gray-100 text-gray-700";
}

function fmtDiurnaEur(
  amount: string | number | undefined,
  locale: string,
): string {
  const n = Number(amount ?? 0);
  const v = Number.isFinite(n) ? n : 0;
  return `${v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}

function fmtSalariuEstimate(
  row: TimesheetRow,
  locale: string,
  dash: string,
): string {
  const emp = row.employee;
  const st = emp?.salaryType;
  const amt = emp?.salaryAmount != null ? Number(emp.salaryAmount) : Number.NaN;
  const hrs = Number(row.hoursWorked);
  const cur = (emp?.salaryCurrency ?? "EUR").toUpperCase();
  if (st !== "ORA" || !Number.isFinite(amt) || !Number.isFinite(hrs))
    return dash;
  const net = hrs * amt;
  return `${net.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
}

export function TimesheetsTableClient({
  items,
  pagination,
  employees,
  filters,
  loadError,
}: {
  items: TimesheetRow[];
  pagination: Pagination;
  employees: EmployeeOption[];
  filters: {
    employeeId?: string;
    year?: string;
    weekNumber?: string;
    status?: string;
  };
  loadError?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role } = useAuth();
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("ro") ? "ro-RO" : "en-US";
  const dash = t("common.emDash");

  function labelForTimesheetStatus(status: string): string {
    const s = String(status || "").toUpperCase();
    if (s === "DRAFT") return t("pages.attendance.statusDraft");
    if (s === "SUBMITTED") return t("pages.attendance.statusSubmitted");
    if (s === "APPROVED") return t("pages.attendance.statusApproved");
    if (s === "REJECTED") return t("pages.attendance.statusRejected");
    return s || dash;
  }
  const isReadOnly = !role || !ROLES_EMPLOYEES_RW.includes(role as UserRole);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const allSelected = useMemo(
    () => items.length > 0 && items.every((t) => selected.has(t.id)),
    [items, selected],
  );

  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Inline edit "Ore" (hoursWorked) per row
  const [hoursDraft, setHoursDraft] = useState<Record<number, string>>({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [timesheetToDelete, setTimesheetToDelete] = useState<number | null>(
    null,
  );

  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [editEmployeeId, setEditEmployeeId] = useState<number | null>(null);
  const [editWeekNumber, setEditWeekNumber] = useState<number>(1);
  const [editYear, setEditYear] = useState<number>(new Date().getFullYear());
  const [editStartDate, setEditStartDate] = useState<string>("");
  const [editEndDate, setEditEndDate] = useState<string>("");
  const [editHoursWorked, setEditHoursWorked] = useState<string>("");
  const [editStandardHours, setEditStandardHours] = useState<string>("40");
  const [editDailyBreakdown, setEditDailyBreakdown] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [editTravelAllowance, setEditTravelAllowance] =
    useState<string>("0.00");

  function updateUrl(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v) sp.delete(k);
      else sp.set(k, v);
    }
    if (!("page" in next)) sp.set("page", "1");
    router.push(`${ROUTES.timesheets}?${sp.toString()}`);
  }

  async function postJson(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? t("components.toast.errorGeneric"));
    return data;
  }

  function setBusy(id: number, v: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (v) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function normalizeDecimalInput(raw: string): string {
    return raw.replace(",", ".").trim();
  }

  function isValidHoursValue(raw: string): boolean {
    const s = normalizeDecimalInput(raw);
    if (s === "") return false;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0;
  }

  useEffect(() => {
    // Keep drafts in sync when list changes (pagination/filter/refresh)
    setHoursDraft((prev) => {
      const next: Record<number, string> = { ...prev };
      for (const t of items) {
        if (next[t.id] === undefined) next[t.id] = String(t.hoursWorked ?? "");
      }
      // drop drafts that are no longer present (avoid stale growth)
      const present = new Set(items.map((i) => i.id));
      for (const k of Object.keys(next)) {
        const id = Number(k);
        if (!present.has(id)) delete next[id];
      }
      return next;
    });
  }, [items]);

  async function saveInlineHours(timesheetId: number) {
    const row = items.find((x) => x.id === timesheetId);
    if (!row) return;

    const raw = hoursDraft[timesheetId] ?? String(row.hoursWorked ?? "");
    if (!isValidHoursValue(raw)) {
      toast.error(t("components.toast.timesheetInvalidHours"));
      setHoursDraft((prev) => ({
        ...prev,
        [timesheetId]: String(row.hoursWorked ?? ""),
      }));
      return;
    }

    const hoursWorked = Number(normalizeDecimalInput(raw));
    // No-op if unchanged (avoid extra calls)
    if (Number(row.hoursWorked) === hoursWorked) return;

    setBusy(timesheetId, true);
    try {
      const res = await fetch(`/api/attendance/${timesheetId}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: row.employeeId,
          weekNumber: row.weekNumber,
          year: row.year,
          startDate: row.startDate,
          endDate: row.endDate,
          hoursWorked,
          standardHours: Number(row.standardHours ?? "40"),
          travelAllowance: Number(row.travelAllowance ?? 0),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok)
        throw new Error(data.error ?? t("components.toast.timesheetSaveHoursFailed"));

      toast.success(t("components.toast.timesheetHoursUpdated"));
      broadcastTimesheetHoursForPayrollSync(row.year, row.weekNumber);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
      setHoursDraft((prev) => ({
        ...prev,
        [timesheetId]: String(row.hoursWorked ?? ""),
      }));
    } finally {
      setBusy(timesheetId, false);
    }
  }

  async function deleteReq(url: string) {
    const res = await fetch(url, {
      method: "DELETE",
      credentials: "same-origin",
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? t("components.toast.errorGeneric"));
    return data;
  }

  async function doSubmit(id: number) {
    setBusy(id, true);
    try {
      await postJson(`/api/attendance/${id}/submit`);
      toast.success(t("components.toast.timesheetSubmitted"));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(id, false);
    }
  }

  async function doApprove(id: number) {
    setBusy(id, true);
    try {
      await postJson(`/api/attendance/${id}/approve`);
      toast.success(t("components.toast.timesheetApproved"));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(id, false);
    }
  }

  async function doReject(id: number) {
    const reason = window.prompt(t("pages.attendance.rejectReasonPrompt")) ?? "";
    setBusy(id, true);
    try {
      await postJson(
        `/api/attendance/${id}/reject`,
        reason.trim() ? { notes: reason.trim() } : {},
      );
      toast.success(t("components.toast.timesheetRejected"));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(id, false);
    }
  }

  async function doGeneratePayslip(id: number) {
    setBusy(id, true);
    try {
      const created = await postJson(`/api/payroll/generate`, { timesheetId: id });
      const payslipId =
        typeof created === "object" &&
        created !== null &&
        "id" in created &&
        typeof (created as { id: unknown }).id === "number"
          ? (created as { id: number }).id
          : null;
      const [detail, employer] = await Promise.all([
        payslipId != null
          ? fetch(`/api/payroll/${payslipId}`, {
              credentials: "same-origin",
              cache: "no-store",
            }).then((res) => res.json())
          : Promise.resolve(created),
        fetchEmployerDetailsForPayslip(),
      ]);
      generateWeeklyPayslip(
        mapPayslipApiResponseToPayslipData(detail, employer),
      );
      toast.success(t("components.toast.timesheetPayslipGenerated"));
      router.push(ROUTES.payslips);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(id, false);
    }
  }

  async function bulkGeneratePayslips() {
    const ids = Array.from(selected.values());
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const selectedRows = items.filter((t) => selected.has(t.id));
      const eligible = selectedRows.filter(
        (t) => String(t.status || "").toUpperCase() === "APPROVED",
      );

      if (eligible.length === 0) {
        toast.error(t("components.toast.timesheetSelectApproved"));
        return;
      }

      let ok = 0;
      let fail = 0;
      for (const t of eligible) {
        try {
          await postJson(`/api/payroll/generate`, { timesheetId: t.id });
          ok++;
        } catch {
          fail++;
        }
      }
      if (ok > 0)
        toast.success(t("components.toast.timesheetPayslipsOk", { n: String(ok) }));
      if (fail > 0)
        toast.error(t("components.toast.timesheetPayslipsFail", { n: String(fail) }));
      setSelected(new Set());
      router.refresh();
      router.push(ROUTES.payslips);
    } finally {
      setBulkBusy(false);
    }
  }

  function handleDeleteClick(id: number) {
    setTimesheetToDelete(id);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (timesheetToDelete == null) return;
    try {
      await deleteReq(`/api/attendance/${timesheetToDelete}`);
      toast.success(t("components.toast.timesheetDeleted"));
      const deleted = items.find((x) => x.id === timesheetToDelete);
      if (deleted)
        broadcastTimesheetHoursForPayrollSync(deleted.year, deleted.weekNumber);
      setDeleteDialogOpen(false);
      setTimesheetToDelete(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(timesheetToDelete);
        return next;
      });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  function openEdit(id: number) {
    setEditingId(id);
    setEditOpen(true);
  }

  useEffect(() => {
    if (!editOpen || editingId == null) return;
    let cancelled = false;
    setEditLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/attendance/${editingId}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const data: Record<string, unknown> = (await res
          .json()
          .catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok)
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : t("components.toast.timesheetLoadOneError"),
          );
        if (cancelled) return;

        setEditEmployeeId(Number(data.employeeId));
        setEditWeekNumber(Number(data.weekNumber));
        setEditYear(Number(data.year));
        // date inputs expect yyyy-mm-dd
        setEditStartDate(parseToIsoDateInput(data.startDate));
        setEditEndDate(parseToIsoDateInput(data.endDate));
        setEditHoursWorked(String(data.hoursWorked ?? ""));
        setEditStandardHours(String(data.standardHours ?? "40"));
        setEditDailyBreakdown(String(data.dailyBreakdown ?? ""));
        setEditNotes(String(data.notes ?? ""));
        const ta = Number(data.travelAllowance ?? 0);
        setEditTravelAllowance(Number.isFinite(ta) ? ta.toFixed(2) : "0.00");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("common.error"));
        setEditOpen(false);
        setEditingId(null);
      } finally {
        if (!cancelled) setEditLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editOpen, editingId, t]);

  async function saveEdit() {
    if (editingId == null) return;
    if (!editEmployeeId) {
      toast.error(t("components.toast.timesheetSelectEmployee"));
      return;
    }
    setEditLoading(true);
    try {
      const res = await fetch(`/api/attendance/${editingId}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: editEmployeeId,
          weekNumber: editWeekNumber,
          year: editYear,
          startDate: editStartDate,
          endDate: editEndDate,
          hoursWorked: Number(editHoursWorked),
          standardHours: Number(editStandardHours || "40"),
          travelAllowance:
            Number(normalizeDecimalInput(editTravelAllowance || "0")) || 0,
          dailyBreakdown: editDailyBreakdown.trim()
            ? editDailyBreakdown
            : undefined,
          notes: editNotes.trim() ? editNotes : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Nu am putut salva");
      toast.success("Pontaj actualizat");
      broadcastTimesheetHoursForPayrollSync(editYear, editWeekNumber);
      setEditOpen(false);
      setEditingId(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {loadError ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          {loadError}
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("pages.attendance.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("pages.attendance.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PermissionGuard allowedRoles={ROLES_EMPLOYEES_RW}>
            <TimesheetForm onSuccess={() => router.refresh()} />
          </PermissionGuard>
          <Button variant="outline" onClick={() => router.refresh()}>
            {t("pages.attendance.refresh")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-600">
              {t("pages.attendance.employee")}
            </label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={filters.employeeId ?? ""}
              onChange={(e) =>
                updateUrl({ employeeId: e.target.value || undefined })
              }
            >
              <option value="">{t("pages.attendance.allEmployees")}</option>
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
              {t("pages.attendance.year")}
            </label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              inputMode="numeric"
              placeholder={t("pages.attendance.placeholderYear")}
              value={filters.year ?? ""}
              onChange={(e) => updateUrl({ year: e.target.value || undefined })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">
              {t("pages.attendance.weekShort")}
            </label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              inputMode="numeric"
              placeholder={t("pages.attendance.placeholderWeek")}
              value={filters.weekNumber ?? ""}
              onChange={(e) =>
                updateUrl({ weekNumber: e.target.value || undefined })
              }
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">
              {t("pages.attendance.status")}
            </label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={filters.status ?? ""}
              onChange={(e) =>
                updateUrl({ status: e.target.value || undefined })
              }
            >
              <option value="">{t("pages.attendance.allStatuses")}</option>
              <option value="DRAFT">{t("pages.attendance.statusDraft")}</option>
              <option value="SUBMITTED">
                {t("pages.attendance.statusSubmitted")}
              </option>
              <option value="APPROVED">
                {t("pages.attendance.statusApproved")}
              </option>
              <option value="REJECTED">
                {t("pages.attendance.statusRejected")}
              </option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto bg-white">
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-gray-50 px-3 py-2">
            <div className="text-xs text-gray-600">
              {t("pages.attendance.selectedPrefix")}{" "}
              <span className="font-medium text-gray-900">{selected.size}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={bulkBusy}
                onClick={() => setSelected(new Set())}
              >
                {t("pages.attendance.resetSelection")}
              </Button>
              <PermissionGuard allowedRoles={ROLES_PAYROLL}>
                <Button
                  variant="default"
                  size="sm"
                  disabled={bulkBusy}
                  onClick={bulkGeneratePayslips}
                >
                  {t("pages.attendance.generatePayslipsBulk", {
                    count: String(selected.size),
                  })}
                </Button>
              </PermissionGuard>
            </div>
          </div>
        )}
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-10 p-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => {
                    if (allSelected) setSelected(new Set());
                    else setSelected(new Set(items.map((i) => i.id)));
                  }}
                />
              </TableHead>
              <TableHead className="min-w-[160px] p-2 truncate">
                {t("pages.attendance.colEmployee")}
              </TableHead>
              <TableHead className="w-[100px] p-2 text-center whitespace-nowrap">
                {t("pages.attendance.colWeek")}
              </TableHead>
              <TableHead className="w-[120px] p-2 text-center whitespace-nowrap">
                {t("pages.attendance.colPeriod")}
              </TableHead>
              <TableHead className="w-[80px] p-2 text-center whitespace-nowrap">
                {t("pages.attendance.colHours")}
              </TableHead>
              <TableHead className="w-[100px] p-2 text-center whitespace-nowrap">
                {t("pages.attendance.colTravelAllowance")}
              </TableHead>
              <TableHead className="w-[110px] p-2 text-center whitespace-nowrap">
                {t("pages.attendance.colSalary")}
              </TableHead>
              <TableHead className="w-[110px] p-2 text-center whitespace-nowrap">
                {t("pages.attendance.colStatus")}
              </TableHead>
              <TableHead className="w-[70px] p-2 text-center whitespace-nowrap">
                {t("pages.attendance.colActions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => {
              const fullName =
                `${row.employee.lastName} ${row.employee.firstName}`.trim();
              const s = String(row.status || "").toUpperCase();
              const canEdit = s === "DRAFT" || s === "REJECTED";
              const canSubmit = s === "DRAFT" || s === "REJECTED";
              const canApprove = s === "SUBMITTED";
              const canReject = s === "SUBMITTED";
              const canGenerate = s === "APPROVED";
              const busy = busyIds.has(row.id) || bulkBusy;
              const canRoleWrite = !isReadOnly;

              return (
                <TableRow key={row.id}>
                  <TableCell className="w-10 p-2">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(row.id)) next.delete(row.id);
                          else next.add(row.id);
                          return next;
                        })
                      }
                    />
                  </TableCell>
                  <TableCell
                    className="min-w-[160px] p-2 truncate"
                    title={fullName}
                  >
                    <Link
                      className="hover:underline"
                      href={`${ROUTES.timesheets}?employeeId=${row.employeeId}`}
                    >
                      {fullName}
                    </Link>
                  </TableCell>
                  <TableCell className="w-[100px] p-2 text-center whitespace-nowrap">
                    {row.type === "monthly" || (row.month != null && row.month > 0)
                      ? `Luna ${String(row.month ?? 1).padStart(2, "0")}/${row.monthYear ?? row.year}`
                      : `S${String(row.weekNumber).padStart(2, "0")}/${row.year}`}
                  </TableCell>
                  <TableCell className="w-[120px] p-2 text-center whitespace-nowrap">
                    {formatPeriodRangeDisplay(
                      row.startDate,
                      row.endDate,
                      locale,
                      dash,
                    )}
                  </TableCell>
                  <TableCell className="w-[80px] p-2 text-center whitespace-nowrap">
                    <ReadOnlyField
                      type="text"
                      inputMode="decimal"
                      min={0}
                      className="w-[72px] rounded-md text-center tabular-nums"
                      value={
                        hoursDraft[row.id] ?? String(row.hoursWorked ?? "")
                      }
                      readOnly={!canRoleWrite || !canEdit || busy}
                      readOnlyTooltip={t(
                        "pages.attendance.readOnlyHoursTooltip",
                      )}
                      onChange={(e) =>
                        setHoursDraft((prev) => ({
                          ...prev,
                          [row.id]: e.target.value,
                        }))
                      }
                      onBlur={() => {
                        if (!canRoleWrite) return;
                        void saveInlineHours(row.id);
                      }}
                      onKeyDown={(e) => {
                        if (!canRoleWrite) return;
                        if (e.key === "Enter") {
                          (e.currentTarget as HTMLInputElement).blur();
                        }
                        if (e.key === "Escape") {
                          setHoursDraft((prev) => ({
                            ...prev,
                            [row.id]: String(row.hoursWorked ?? ""),
                          }));
                          (e.currentTarget as HTMLInputElement).blur();
                        }
                      }}
                      aria-label={t("pages.attendance.hoursWorkedAria")}
                    />
                  </TableCell>
                  <TableCell className="w-[100px] p-2 text-center whitespace-nowrap text-xs tabular-nums">
                    {fmtDiurnaEur(row.travelAllowance, locale)}
                  </TableCell>
                  <TableCell className="w-[110px] p-2 text-center whitespace-nowrap text-xs tabular-nums">
                    {fmtSalariuEstimate(row, locale, dash)}
                  </TableCell>
                  <TableCell className="w-[110px] p-2 text-center whitespace-nowrap">
                    <Badge
                      variant="outline"
                      className={`${statusBadgeClass(row.status)} text-[10px] px-1.5 py-0`}
                    >
                      {labelForTimesheetStatus(row.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-[70px] p-2 text-center">
                    <PermissionGuard
                      allowedRoles={ROLES_EMPLOYEES_RW}
                      fallback={
                        <span className="text-muted-foreground text-xs">-</span>
                      }
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={busy}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {s === "DRAFT" ? (
                            <>
                              <PermissionGuard
                                allowedRoles={ROLES_EMPLOYEES_RW}
                              >
                                <DropdownMenuItem
                                  disabled={!canEdit || busy}
                                  onClick={() => openEdit(row.id)}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />{" "}
                                  {t("common.edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={!canSubmit || busy}
                                  onClick={() => doSubmit(row.id)}
                                >
                                  <Send className="mr-2 h-4 w-4" />{" "}
                                  {t("common.submit")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </PermissionGuard>
                              <PermissionGuard
                                allowedRoles={ROLES_SETTINGS_ADMIN}
                              >
                                <DropdownMenuItem
                                  disabled={busy}
                                  onClick={() => handleDeleteClick(row.id)}
                                  className="text-red-600"
                                >
                                  <Trash className="mr-2 h-4 w-4" />{" "}
                                  {t("common.delete")}
                                </DropdownMenuItem>
                              </PermissionGuard>
                            </>
                          ) : null}

                          {s === "SUBMITTED" ? (
                            <>
                              <PermissionGuard
                                allowedRoles={ROLES_EMPLOYEES_RW}
                              >
                                <DropdownMenuItem
                                  disabled={!canApprove || busy}
                                  onClick={() => doApprove(row.id)}
                                >
                                  <Check className="mr-2 h-4 w-4" />{" "}
                                  {t("pages.attendance.menuApprove")}
                                </DropdownMenuItem>
                              </PermissionGuard>
                              <PermissionGuard
                                allowedRoles={ROLES_EMPLOYEES_RW}
                              >
                                <DropdownMenuItem
                                  disabled={!canReject || busy}
                                  onClick={() => doReject(row.id)}
                                >
                                  <X className="mr-2 h-4 w-4" />{" "}
                                  {t("pages.attendance.menuReject")}
                                </DropdownMenuItem>
                              </PermissionGuard>
                            </>
                          ) : null}

                          {s === "APPROVED" ? (
                            <PermissionGuard allowedRoles={ROLES_PAYROLL}>
                              <DropdownMenuItem
                                disabled={!canGenerate || busy}
                                onClick={() => doGeneratePayslip(row.id)}
                              >
                                <FileText className="mr-2 h-4 w-4" />{" "}
                                {t("pages.attendance.menuGeneratePayslip")}
                              </DropdownMenuItem>
                            </PermissionGuard>
                          ) : null}

                          {s === "REJECTED" ? (
                            <>
                              <PermissionGuard
                                allowedRoles={ROLES_EMPLOYEES_RW}
                              >
                                <DropdownMenuItem
                                  disabled={!canEdit || busy}
                                  onClick={() => openEdit(row.id)}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />{" "}
                                  {t("common.edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={!canSubmit || busy}
                                  onClick={() => doSubmit(row.id)}
                                >
                                  <Send className="mr-2 h-4 w-4" />{" "}
                                  {t("common.submit")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </PermissionGuard>
                              <PermissionGuard
                                allowedRoles={ROLES_SETTINGS_ADMIN}
                              >
                                <DropdownMenuItem
                                  disabled={busy}
                                  onClick={() => handleDeleteClick(row.id)}
                                  className="text-red-600"
                                >
                                  <Trash className="mr-2 h-4 w-4" />{" "}
                                  {t("common.delete")}
                                </DropdownMenuItem>
                              </PermissionGuard>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </PermissionGuard>
                  </TableCell>
                </TableRow>
              );
            })}

            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="p-6 text-center text-sm text-gray-500"
                >
                  {t("pages.attendance.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pages.attendance.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pages.attendance.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel />
            <AlertDialogAction onClick={handleConfirmDelete} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit drawer (slide-out) */}
      {editOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-stretch justify-end bg-black/50"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (editLoading) return;
            setEditOpen(false);
            setEditingId(null);
          }}
        >
          <div
            className="ml-auto flex h-[100dvh] w-full max-w-md flex-col border bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 px-6 pt-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {t("pages.attendance.editTitle")}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {t("pages.attendance.editSubtitle")}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={editLoading}
                onClick={() => {
                  setEditOpen(false);
                  setEditingId(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-5 flex-1 overflow-y-auto px-6 pb-4">
              {editLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("pages.attendance.loading")}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-gray-600">
                      {t("pages.attendance.employee")}
                    </label>
                    <select
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={String(editEmployeeId ?? "")}
                      onChange={(e) =>
                        setEditEmployeeId(Number(e.target.value))
                      }
                    >
                      <option value="">{t("pages.attendance.selectEmployee")}</option>
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
                      {t("pages.attendance.weekField")}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={52}
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm tabular-nums"
                      onWheel={preventWheelOnFocusedNumberInput}
                      value={editWeekNumber}
                      onChange={(e) => {
                        const n = Number.parseInt(e.target.value, 10);
                        if (e.target.value !== "" && Number.isFinite(n)) {
                          setEditWeekNumber(n);
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">
                      {t("pages.attendance.yearField")}
                    </label>
                    <input
                      type="number"
                      min={2024}
                      max={2030}
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm tabular-nums"
                      onWheel={preventWheelOnFocusedNumberInput}
                      value={editYear}
                      onChange={(e) => {
                        const n = Number.parseInt(e.target.value, 10);
                        if (e.target.value !== "" && Number.isFinite(n)) {
                          setEditYear(n);
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">
                      {t("pages.attendance.startDate")}
                    </label>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">
                      {t("pages.attendance.endDate")}
                    </label>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">
                      {t("pages.attendance.hoursWorked")}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      min="0"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm tabular-nums"
                      value={editHoursWorked}
                      onChange={(e) => setEditHoursWorked(e.target.value)}
                      placeholder={t("pages.attendance.hoursWorkedPh")}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">
                      {t("pages.attendance.standardHours")}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      min="0"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm tabular-nums"
                      value={editStandardHours}
                      onChange={(e) => setEditStandardHours(e.target.value)}
                      placeholder={t("pages.attendance.standardHoursPh")}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">
                      {t("pages.attendance.travelAllowanceEur")}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      min="0"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm tabular-nums"
                      value={editTravelAllowance}
                      onChange={(e) => setEditTravelAllowance(e.target.value)}
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
                      value={editDailyBreakdown}
                      onChange={(e) => setEditDailyBreakdown(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-gray-600">
                      {t("pages.attendance.notesOptional")}
                    </label>
                    <textarea
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      rows={3}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t bg-white px-6 py-4">
              <Button
                variant="outline"
                disabled={editLoading}
                onClick={() => {
                  setEditOpen(false);
                  setEditingId(null);
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button disabled={editLoading} onClick={saveEdit}>
                {editLoading ? t("pages.attendance.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {t("pages.attendance.paginationPage")}{" "}
          <span className="font-medium text-gray-900">{pagination.page}</span>{" "}
          {t("pages.attendance.paginationOf")}{" "}
          <span className="font-medium text-gray-900">
            {pagination.totalPages}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => updateUrl({ page: String(pagination.page - 1) })}
          >
            {t("pages.attendance.prevPage")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => updateUrl({ page: String(pagination.page + 1) })}
          >
            {t("pages.attendance.nextPage")}
          </Button>
        </div>
      </div>
    </div>
  );
}
