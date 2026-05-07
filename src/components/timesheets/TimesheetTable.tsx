"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Check, X, FileText, Send } from "lucide-react";
import { TimesheetForm } from "@/app/components/TimesheetForm";

export type TimesheetRow = {
  id: number;
  employeeId: number;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  hoursWorked: string;
  standardHours: string;
  status: string;
  employee: { id: number; firstName: string; lastName: string; position: string | null };
  payslip?: { id: number } | null;
};

export type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

export type EmployeeOpt = { id: number; firstName: string; lastName: string; position: string | null };

export function TimesheetTable({
  items,
  pagination,
  employees,
  filters,
  serverError,
}: {
  items: TimesheetRow[];
  pagination: Pagination;
  employees: EmployeeOpt[];
  filters: {
    employeeId?: string;
    year?: string;
    weekNumber?: string;
    status?: string;
  };
  serverError?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const allSelected = useMemo(
    () => items.length > 0 && items.every((t) => selected.has(t.id)),
    [items, selected]
  );

  function setBusy(id: number, v: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (v) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function updateUrl(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v) sp.delete(k);
      else sp.set(k, v);
    }
    // reset page on filter changes unless explicitly set
    if (!("page" in next)) sp.set("page", "1");
    router.push(`/pontaj?${sp.toString()}`);
  }

  function formatPeriod(start: string, end: string): string {
    const s = new Date(start);
    const e = new Date(end);
    const fmt = (d: Date) =>
      d.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit" });
    return `${fmt(s)} - ${fmt(e)}`;
  }

  function statusPill(status: string) {
    const s = String(status || "").toUpperCase();
    const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border";
    if (s === "APPROVED") return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`;
    if (s === "SUBMITTED") return `${base} bg-amber-50 text-amber-800 border-amber-200`;
    if (s === "REJECTED") return `${base} bg-rose-50 text-rose-700 border-rose-200`;
    return `${base} bg-gray-50 text-gray-700 border-gray-200`; // DRAFT/other
  }

  async function postJson(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; [k: string]: unknown };
    if (!res.ok) throw new Error(data.error ?? "Operațiunea a eșuat");
    return data;
  }

  async function handleSubmit(id: number) {
    setBusy(id, true);
    try {
      await postJson(`/api/timesheets/${id}/submit`);
      toast.success("Pontaj trimis");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    } finally {
      setBusy(id, false);
    }
  }

  async function handleApprove(id: number) {
    setBusy(id, true);
    try {
      await postJson(`/api/timesheets/${id}/approve`);
      toast.success("Pontaj aprobat");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    } finally {
      setBusy(id, false);
    }
  }

  async function handleReject(id: number) {
    const reason = window.prompt("Motiv respingere (opțional):") ?? "";
    setBusy(id, true);
    try {
      await postJson(`/api/timesheets/${id}/reject`, reason.trim() ? { notes: reason.trim() } : {});
      toast.success("Pontaj respins");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    } finally {
      setBusy(id, false);
    }
  }

  async function handleGeneratePayslip(timesheetId: number) {
    setBusy(timesheetId, true);
    try {
      await postJson(`/api/payslips/generate`, { timesheetId });
      toast.success("Fluturaș generat");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    } finally {
      setBusy(timesheetId, false);
    }
  }

  async function bulkGenerate() {
    const ids = Array.from(selected.values());
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      let ok = 0;
      let fail = 0;
      for (const id of ids) {
        try {
          await postJson(`/api/payslips/generate`, { timesheetId: id });
          ok++;
        } catch {
          fail++;
        }
      }
      if (ok > 0) toast.success(`Fluturași generați: ${ok}`);
      if (fail > 0) toast.error(`Eșuați: ${fail}`);
      setSelected(new Set());
      router.refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="min-h-0 space-y-4">
      {serverError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {serverError}
        </div>
      ) : null}
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pontaj Ore</h1>
          <p className="text-sm text-gray-500 mt-1">Pontaje săptămânale — filtrare, aprobare, fluturași</p>
        </div>
        <TimesheetForm onSuccess={() => router.refresh()} />
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-600">Angajat</label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={filters.employeeId ?? ""}
              onChange={(e) => updateUrl({ employeeId: e.target.value || undefined })}
            >
              <option value="">Toți</option>
              {employees.map((e) => (
                <option key={e.id} value={String(e.id)}>
                  {e.lastName} {e.firstName} {e.position ? `— ${e.position}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">An</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              inputMode="numeric"
              placeholder="ex: 2026"
              value={filters.year ?? ""}
              onChange={(e) => updateUrl({ year: e.target.value || undefined })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Săptămâna</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              inputMode="numeric"
              placeholder="ex: 17"
              value={filters.weekNumber ?? ""}
              onChange={(e) => updateUrl({ weekNumber: e.target.value || undefined })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Status</label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={filters.status ?? ""}
              onChange={(e) => updateUrl({ status: e.target.value || undefined })}
            >
              <option value="">Toate</option>
              <option value="DRAFT">DRAFT</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            Total: <span className="font-medium text-gray-900">{pagination.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={selected.size === 0 || bulkBusy}
              onClick={bulkGenerate}
            >
              <span className="inline-flex items-center gap-2">
                <FileText size={16} />
                Generează Fluturași ({selected.size})
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white overflow-auto max-h-[calc(100dvh-320px)]">
        <table className="w-full caption-bottom text-sm min-w-[760px]">
          <thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left w-[44px]">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => {
                      if (allSelected) setSelected(new Set());
                      else setSelected(new Set(items.map((i) => i.id)));
                    }}
                  />
                </th>
                <th className="px-4 py-3 text-left">Angajat</th>
                <th className="px-4 py-3 text-left">Săptămâna</th>
                <th className="px-4 py-3 text-left">Perioada</th>
                <th className="px-4 py-3 text-left">Ore</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Acțiuni</th>
              </tr>
          </thead>
            <tbody className="divide-y">
              {items.map((t) => {
                const busy = busyIds.has(t.id);
                const canApprove = t.status === "SUBMITTED" || t.status === "DRAFT";
                const canSubmit = t.status === "DRAFT" || t.status === "REJECTED";
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(t.id)}
                        onChange={() => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(t.id)) next.delete(t.id);
                            else next.add(t.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {t.employee.lastName} {t.employee.firstName}
                      </div>
                      <div className="text-xs text-gray-500">{t.employee.position ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {String(t.weekNumber).padStart(2, "0")}/{t.year}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{formatPeriod(t.startDate, t.endDate)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {t.hoursWorked} / {t.standardHours}
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusPill(t.status)}>{t.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/pontaj/${t.id}`}
                          className="rounded-lg border bg-white px-2.5 py-1.5 text-xs hover:bg-gray-50"
                        >
                          Edit
                        </Link>
                        <button
                          className="rounded-lg border bg-white px-2.5 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                          disabled={!canSubmit || busy}
                          onClick={() => handleSubmit(t.id)}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Send size={14} /> Submit
                          </span>
                        </button>
                        <button
                          className="rounded-lg border bg-white px-2.5 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                          disabled={!canApprove || busy}
                          onClick={() => handleApprove(t.id)}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Check size={14} /> Aprobă
                          </span>
                        </button>
                        <button
                          className="rounded-lg border bg-white px-2.5 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                          disabled={busy}
                          onClick={() => handleReject(t.id)}
                        >
                          <span className="inline-flex items-center gap-1">
                            <X size={14} /> Respinge
                          </span>
                        </button>
                        <button
                          className="rounded-lg border bg-white px-2.5 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                          disabled={busy || t.status !== "APPROVED"}
                          onClick={() => handleGeneratePayslip(t.id)}
                        >
                          <span className="inline-flex items-center gap-1">
                            <FileText size={14} /> Generează Fluturaș
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    Nu există pontaje pentru filtrele selectate.
                  </td>
                </tr>
              )}
            </tbody>
        </table>
      </div>

      {/* Pagination (server-side via URL) */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          Pagina <span className="font-medium text-gray-900">{pagination.page}</span> din{" "}
          <span className="font-medium text-gray-900">{pagination.totalPages}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            disabled={pagination.page <= 1}
            onClick={() => updateUrl({ page: String(pagination.page - 1) })}
          >
            Înapoi
          </button>
          <button
            className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => updateUrl({ page: String(pagination.page + 1) })}
          >
            Înainte
          </button>
        </div>
      </div>
    </div>
  );
}

