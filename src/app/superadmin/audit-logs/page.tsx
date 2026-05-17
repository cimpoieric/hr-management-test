"use client";

import { ro, tAuditAction, tAuditEntity } from "@/messages";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  action: string;
  entity: string;
  entityId: number | null;
  userName: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
};

type OrgOption = { id: string; name: string };

const AUDIT_ACTIONS = [
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
  "CREATE_EMPLOYEE",
  "UPDATE_EMPLOYEE",
  "DELETE_EMPLOYEE",
  "VIEW_EMPLOYEE",
  "GENERATE_PAYROLL",
  "GENERATE_REPORT",
  "DOWNLOAD_DOCUMENT",
  "UPLOAD_DOCUMENT",
  "IMPORT_DATA",
  "REGISTER_ORGANIZATION",
  "EXPORT_EXCEL",
  "EXPORT_PDF",
  "VIEW",
  "CREATE",
  "UPDATE",
  "DELETE",
] as const;

export default function SuperadminAuditLogsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [firmId, setFirmId] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const role = data?.user?.role as string | undefined;
        const superAdmin = role === "SUPER_ADMIN";
        setIsSuperAdmin(superAdmin);
        if (superAdmin) {
          void fetch("/api/admin/organizations?limit=200")
            .then((res) => (res.ok ? res.json() : { data: [] }))
            .then((payload) => {
              const list = (payload.data ?? payload.organizations ?? []) as {
                id: string;
                name: string;
              }[];
              setOrgs(list.map((o) => ({ id: o.id, name: o.name })));
            });
        }
      });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: "50" });
    if (action) q.set("action", action);
    if (dateFrom) q.set("dateFrom", dateFrom);
    if (dateTo) q.set("dateTo", dateTo);
    if (isSuperAdmin && firmId) q.set("firmId", firmId);
    const res = await fetch(`/api/audit-logs?${q}`);
    const data = res.ok ? await res.json() : { data: [], total: 0 };
    setRows(data.data ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, action, dateFrom, dateTo, firmId, isSuperAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  async function exportExcel() {
    const q = new URLSearchParams();
    if (action) q.set("action", action);
    if (dateFrom) q.set("dateFrom", dateFrom);
    if (dateTo) q.set("dateTo", dateTo);
    if (isSuperAdmin && firmId) q.set("firmId", firmId);
    const res = await fetch(`/api/audit-logs/export?${q}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const backHref = isSuperAdmin ? "/admin" : "/settings";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href={backHref} className="text-sm text-blue-700 hover:underline">
            {isSuperAdmin ? "Inapoi la admin" : "Inapoi la setari"}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Jurnal audit (GDPR)
          </h1>
          <p className="text-sm text-slate-600">
            Sortare: cele mai recente primele
          </p>
        </div>
        <button
          type="button"
          onClick={exportExcel}
          disabled={total === 0}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          Export Excel
        </button>
      </div>

      <div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Actiune
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="rounded border px-2 py-2 text-sm text-slate-900"
          >
            <option value="">{ro.audit.allActions}</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {tAuditAction(a)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          De la
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="rounded border px-2 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Pana la
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="rounded border px-2 py-2 text-sm"
          />
        </label>
        {isSuperAdmin ? (
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Firma
            <select
              value={firmId}
              onChange={(e) => {
                setFirmId(e.target.value);
                setPage(1);
              }}
              className="rounded border px-2 py-2 text-sm text-slate-900"
            >
              <option value="">Toate firmele</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <p className="text-sm text-slate-500">
        {loading ? "Se incarca..." : `${total} inregistrari`}
      </p>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Utilizator</th>
              <th className="px-3 py-2 text-left">Actiune</th>
              <th className="px-3 py-2 text-left">Resursa</th>
              <th className="px-3 py-2 text-left">Detalii</th>
              <th className="px-3 py-2 text-left">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center">
                  Se incarca...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center">
                  Niciun log
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="whitespace-nowrap px-3 py-2">
                    {new Date(r.createdAt).toLocaleString("ro-RO")}
                  </td>
                  <td className="px-3 py-2">{r.userName ?? "Sistem"}</td>
                  <td className="px-3 py-2">{tAuditAction(r.action)}</td>
                  <td className="px-3 py-2">
                    {tAuditEntity(r.entity)}
                    {r.entityId != null ? ` #${r.entityId}` : ""}
                  </td>
                  <td className="max-w-xs truncate px-3 py-2 text-xs text-slate-500">
                    {r.details ?? "-"}
                  </td>
                  <td className="px-3 py-2">{r.ipAddress ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 50 ? (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border px-3 py-1 text-sm disabled:opacity-30"
          >
            Inapoi
          </button>
          <span className="text-sm">Pagina {page}</span>
          <button
            type="button"
            disabled={page * 50 >= total}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border px-3 py-1 text-sm disabled:opacity-30"
          >
            Inainte
          </button>
        </div>
      ) : null}
    </div>
  );
}
