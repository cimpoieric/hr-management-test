"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Download,
  Mail,
  FileText,
  Eye,
  Send,
  X,
  Check,
  RefreshCw,
} from "lucide-react";

export type PayslipListItem = {
  id: number;
  employeeId: number;
  weekNumber: number;
  year: number;
  periodStart: string;
  periodEnd: string;
  currency: string;
  totalPaid: string;
  netTotal: string;
  emailSent: boolean;
  emailSentAt?: string | null;
  pdfPath?: string | null;
  pdfGeneratedAt?: string | null;
  employee: { firstName: string; lastName: string };
  timesheet: { hoursWorked: string; status: string };
  items?: Array<{ type: string; amount: string; sortOrder: number }>;
};

export type EmployeeOpt = { id: number; firstName: string; lastName: string };
export type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

function week2(week: number) {
  return String(week).padStart(2, "0");
}

function money(amount: unknown, currency: string): string {
  const v = typeof amount === "object" && amount !== null && "toString" in amount ? Number(String(amount)) : Number(amount);
  const n = Number.isFinite(v) ? v : 0;
  return `${n.toFixed(2)} ${currency}`;
}

function itemSum(items: PayslipListItem["items"] | undefined, type: string): number {
  return (items ?? [])
    .filter((i) => i.type === type)
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
}

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => d.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit" });
  return `${fmt(s)} - ${fmt(e)}`;
}

function PdfPreviewModal({ open, onClose, payslipId }: { open: boolean; onClose: () => void; payslipId: number | null }) {
  if (!open || payslipId == null) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="w-full max-w-5xl overflow-hidden rounded-xl border bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-semibold text-gray-900">Previzualizare PDF</div>
          <button className="rounded-lg border bg-white p-2 hover:bg-gray-50" onClick={onClose} aria-label="Închide">
            <X size={16} />
          </button>
        </div>
        <div className="h-[75vh] bg-gray-50">
          <iframe title="Payslip PDF" className="h-full w-full" src={`/api/payslips/${payslipId}/pdf`} />
        </div>
      </div>
    </div>
  );
}

function GenerateDialog({
  open,
  onClose,
  employees,
  onGenerated,
}: {
  open: boolean;
  onClose: () => void;
  employees: EmployeeOpt[];
  onGenerated: () => void;
}) {
  const [weekNumber, setWeekNumber] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [selectedEmp, setSelectedEmp] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function postJson(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; [k: string]: unknown };
    if (!res.ok) throw new Error(data.error ?? "Operațiunea a eșuat");
    return data;
  }

  async function generate() {
    const y = Number(year);
    const w = Number(weekNumber);
    if (!Number.isFinite(y) || y < 2024 || y > 2030) {
      toast.error("An invalid");
      return;
    }
    if (!Number.isFinite(w) || w < 1 || w > 52) {
      toast.error("Săptămână invalidă");
      return;
    }
    if (selectedEmp.size === 0) {
      toast.error("Selectează cel puțin un angajat");
      return;
    }

    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("page", "1");
      qs.set("pageSize", "200");
      qs.set("status", "APPROVED");
      qs.set("year", String(y));
      qs.set("weekNumber", String(w));

      const res = await fetch(`/api/timesheets?${qs.toString()}`, { cache: "no-store", credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { items?: Array<{ id: number; employeeId: number }>; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Nu am putut încărca pontajele");

      const eligible = (data.items ?? []).filter((t) => selectedEmp.has(t.employeeId));
      if (eligible.length === 0) {
        toast.error("Nu există pontaje APPROVED pentru selecția aleasă");
        return;
      }

      let ok = 0;
      let fail = 0;
      for (const t of eligible) {
        try {
          await postJson("/api/payslips/generate", { timesheetId: t.id });
          ok++;
        } catch {
          fail++;
        }
      }

      if (ok > 0) toast.success(`Fluturași generați: ${ok}`);
      if (fail > 0) toast.error(`Eșuați: ${fail}`);
      onGenerated();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Generează fluturași din pontaje aprobate</h2>
            <p className="mt-1 text-sm text-gray-500">Selectează săptămâna și angajații.</p>
          </div>
          <button className="rounded-lg border bg-white p-2 hover:bg-gray-50" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-gray-600">An</label>
            <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Săptămâna</label>
            <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="ex: 17" value={weekNumber} onChange={(e) => setWeekNumber(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              disabled={loading}
              onClick={generate}
            >
              {loading ? "Generez..." : "Generează"}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-lg border bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-gray-700">Angajați</div>
            <button
              className="text-xs text-slate-700 underline"
              onClick={() => setSelectedEmp(new Set(employees.map((e) => e.id)))}
            >
              Selectează toți
            </button>
          </div>
          <div className="mt-2 max-h-56 overflow-auto divide-y rounded-md border bg-white">
            {employees.map((e) => {
              const checked = selectedEmp.has(e.id);
              return (
                <label key={e.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedEmp((prev) => {
                        const next = new Set(prev);
                        if (next.has(e.id)) next.delete(e.id);
                        else next.add(e.id);
                        return next;
                      })
                    }
                  />
                  <span className="text-gray-900">{e.lastName} {e.firstName}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PayslipTable({
  items,
  pagination,
  employees,
  filters,
}: {
  items: PayslipListItem[];
  pagination: Pagination;
  employees: EmployeeOpt[];
  filters: { employeeId?: string; year?: string; weekNumber?: string; emailSent?: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);

  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [sendingAll, setSendingAll] = useState(false);

  const [selected, setSelected] = useState<Set<number>>(new Set());

  const allSelected = useMemo(
    () => items.length > 0 && items.every((p) => selected.has(p.id)),
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
    if (!("page" in next)) sp.set("page", "1");
    router.push(`/fluturasi?${sp.toString()}`);
  }

  async function postJson(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; [k: string]: unknown };
    if (!res.ok) throw new Error(data.error ?? "Operațiunea a eșuat");
    return data;
  }

  async function sendOne(payslipId: number) {
    setBusy(payslipId, true);
    try {
      const r = (await postJson("/api/email/send", {
        type: "fluturas",
        data: { payslipId },
      })) as { result?: { emailLogId?: number } };
      const emailLogId = (r as any)?.result?.emailLogId;
      toast.success(`Email trimis${emailLogId ? ` (log #${emailLogId})` : ""}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    } finally {
      setBusy(payslipId, false);
    }
  }

  async function sendAll() {
    if (!window.confirm("Trimiți toate emailurile pentru fluturașii filtrați (emailSent=false)?")) return;
    setSendingAll(true);
    try {
      const qs = new URLSearchParams();
      qs.set("page", "1");
      qs.set("pageSize", "200");
      qs.set("emailSent", "false");
      if (filters.employeeId) qs.set("employeeId", filters.employeeId);
      if (filters.year) qs.set("year", filters.year);
      if (filters.weekNumber) qs.set("weekNumber", filters.weekNumber);

      const res = await fetch(`/api/payslips?${qs.toString()}`, { cache: "no-store", credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { items?: PayslipListItem[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Eroare la listare");

      const ids = (data.items ?? []).map((p) => p.id);
      if (ids.length === 0) {
        toast.success("Nu există emailuri de trimis pentru filtrele curente");
        return;
      }

      let ok = 0;
      let fail = 0;
      for (const payslipId of ids) {
        try {
          await postJson("/api/email/send", { type: "fluturas", data: { payslipId } });
          ok++;
        } catch {
          fail++;
        }
      }
      if (ok > 0) toast.success(`Trimise: ${ok}`);
      if (fail > 0) toast.error(`Eșuate: ${fail}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    } finally {
      setSendingAll(false);
    }
  }

  async function bulkSendSelected() {
    const ids = Array.from(selected.values());
    if (ids.length === 0) return;
    if (!window.confirm(`Trimiți email pentru ${ids.length} fluturași selectați?`)) return;
    setSendingAll(true);
    try {
      let ok = 0;
      let fail = 0;
      for (const payslipId of ids) {
        try {
          await postJson("/api/email/send", { type: "fluturas", data: { payslipId } });
          ok++;
        } catch {
          fail++;
        }
      }
      if (ok > 0) toast.success(`Trimise: ${ok}`);
      if (fail > 0) toast.error(`Eșuate: ${fail}`);
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    } finally {
      setSendingAll(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fluturași Salariu</h1>
          <p className="text-sm text-gray-500 mt-1">Listă fluturași — PDF, email, filtrare</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            onClick={() => router.refresh()}
            disabled={sendingAll}
          >
            <span className="inline-flex items-center gap-2"><RefreshCw size={16} /> Refresh</span>
          </button>
          <button
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            onClick={() => setGenOpen(true)}
            disabled={sendingAll}
          >
            Generează Fluturași din Pontaje Aprobate
          </button>
        </div>
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
                  {e.lastName} {e.firstName}
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
            <label className="text-xs font-medium text-gray-600">Email</label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={filters.emailSent ?? ""}
              onChange={(e) => updateUrl({ emailSent: e.target.value || undefined })}
            >
              <option value="">Toate</option>
              <option value="true">Trimis</option>
              <option value="false">Netrimis</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            Total: <span className="font-medium text-gray-900">{pagination.total}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              onClick={sendAll}
              disabled={sendingAll}
            >
              <span className="inline-flex items-center gap-2">
                <Send size={16} /> Trimite toate emailurile
              </span>
            </button>
            <button
              className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              onClick={bulkSendSelected}
              disabled={sendingAll || selected.size === 0}
            >
              <span className="inline-flex items-center gap-2">
                <Mail size={16} /> Trimite selectate ({selected.size})
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
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
                <th className="px-4 py-3 text-left">Ore lucrate</th>
                <th className="px-4 py-3 text-left">Salariu Net (EUR)</th>
                <th className="px-4 py-3 text-left">Travel Allowance</th>
                <th className="px-4 py-3 text-left">Total Plătit</th>
                <th className="px-4 py-3 text-left">PDF</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((p) => {
                const busy = busyIds.has(p.id) || sendingAll;
                const empName = `${p.employee.lastName} ${p.employee.firstName}`.trim();
                const netSalary = itemSum(p.items, "NET_SALARY");
                const travel = itemSum(p.items, "TRAVEL_ALLOWANCE");
                const totalRaw = Number(p.totalPaid) || 0;
                const computedTotal = (p.items ?? []).reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
                const total = totalRaw === 0 && computedTotal !== 0 ? computedTotal : totalRaw;
                const cur = String(p.currency || "EUR").toUpperCase();

                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(p.id)) next.delete(p.id);
                            else next.add(p.id);
                            return next;
                          })
                        }
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{empName}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {week2(p.weekNumber)}/{p.year}
                      <div className="text-xs text-gray-500">{formatPeriod(p.periodStart, p.periodEnd)}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{p.timesheet.hoursWorked}</td>
                    <td className="px-4 py-3 text-gray-700">{money(netSalary, cur)}</td>
                    <td className="px-4 py-3 text-gray-700">{money(travel, cur)}</td>
                    <td className="px-4 py-3 text-gray-700">{money(total, cur)}</td>
                    <td className="px-4 py-3">
                      {p.pdfPath ? (
                        <a
                          className="inline-flex items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5 text-xs hover:bg-gray-50"
                          href={`/api/payslips/${p.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Download size={14} />
                          Download
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.emailSent ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <Check size={14} /> Trimis
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700">
                          <Mail size={14} /> Netrimis
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-lg border bg-white px-2.5 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                          disabled={busy}
                          onClick={() => {
                            setPreviewId(p.id);
                            setPreviewOpen(true);
                          }}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Eye size={14} /> Previzualizează PDF
                          </span>
                        </button>
                        <button
                          className="rounded-lg border bg-white px-2.5 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                          disabled={busy}
                          onClick={() => sendOne(p.id)}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Send size={14} /> Trimite Email
                          </span>
                        </button>
                        <a
                          className="rounded-lg border bg-white px-2.5 py-1.5 text-xs hover:bg-gray-50 inline-flex items-center gap-1"
                          href={`/api/payslips/${p.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FileText size={14} /> Descarcă
                        </a>
                        <Link
                          className="rounded-lg border bg-white px-2.5 py-1.5 text-xs hover:bg-gray-50 inline-flex items-center gap-1"
                          href={`/fluturasi/${p.id}`}
                        >
                          <FileText size={14} /> Detalii
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {items.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-gray-500">
                    Nu există fluturași pentru filtrele selectate.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
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

      <PdfPreviewModal
        open={previewOpen}
        payslipId={previewId}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewId(null);
        }}
      />

      <GenerateDialog
        open={genOpen}
        employees={employees}
        onClose={() => setGenOpen(false)}
        onGenerated={() => router.refresh()}
      />
    </div>
  );
}

