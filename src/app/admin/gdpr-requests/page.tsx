"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type GdprRow = {
  id: string;
  type: string;
  status: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string | null;
  firmId: string;
  firmName: string;
  details: string | null;
  adminNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "In asteptare",
  in_progress: "In lucru",
  completed: "Rezolvat",
  rejected: "Respins",
};

export default function AdminGdprRequestsPage() {
  const [rows, setRows] = useState<GdprRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/gdpr-requests");
    const data = res.ok ? await res.json() : { data: [], pendingCount: 0 };
    setRows(data.data ?? []);
    setPendingCount(data.pendingCount ?? 0);
    const initialNotes: Record<string, string> = {};
    for (const r of data.data ?? []) {
      initialNotes[r.id] = r.adminNotes ?? "";
    }
    setNotes(initialNotes);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/admin/gdpr-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        adminNotes: notes[id] ?? "",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(typeof data.error === "string" ? data.error : "Eroare");
      return;
    }
    toast.success("Solicitare actualizata");
    void load();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <Link href="/settings" className="text-sm text-blue-700 hover:underline">
          Inapoi la setari
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Solicitari GDPR
        </h1>
        <p className="text-sm text-slate-600">
          {pendingCount > 0
            ? `${pendingCount} solicitari in asteptare`
            : "Nicio solicitare in asteptare"}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Tip</th>
              <th className="px-3 py-2 text-left">Angajat</th>
              <th className="px-3 py-2 text-left">Firma</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Detalii</th>
              <th className="px-3 py-2 text-left">Note admin</th>
              <th className="px-3 py-2 text-left">Actiuni</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center">
                  Se incarca...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  Nici o solicitare
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b align-top">
                  <td className="whitespace-nowrap px-3 py-2">
                    {new Date(r.createdAt).toLocaleString("ro-RO")}
                  </td>
                  <td className="px-3 py-2">{r.type}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.employeeName}</div>
                    {r.employeeEmail ? (
                      <div className="text-xs text-slate-500">
                        {r.employeeEmail}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{r.firmName}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        r.status === "pending"
                          ? "rounded bg-amber-100 px-2 py-0.5 text-amber-900"
                          : "rounded bg-slate-100 px-2 py-0.5"
                      }
                    >
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="max-w-xs px-3 py-2 text-xs text-slate-600">
                    {r.details ?? "-"}
                  </td>
                  <td className="px-3 py-2">
                    <textarea
                      value={notes[r.id] ?? ""}
                      onChange={(e) =>
                        setNotes((n) => ({ ...n, [r.id]: e.target.value }))
                      }
                      rows={2}
                      className="w-full min-w-[140px] rounded border px-2 py-1 text-xs"
                      placeholder="Note interne..."
                    />
                  </td>
                  <td className="space-y-1 px-3 py-2">
                    <button
                      type="button"
                      className="block w-full rounded border px-2 py-1 text-xs hover:bg-slate-50"
                      onClick={() => void updateStatus(r.id, "in_progress")}
                    >
                      In lucru
                    </button>
                    <button
                      type="button"
                      className="block w-full rounded border border-green-200 px-2 py-1 text-xs text-green-800 hover:bg-green-50"
                      onClick={() => void updateStatus(r.id, "completed")}
                    >
                      Rezolvat
                    </button>
                    <button
                      type="button"
                      className="block w-full rounded border border-rose-200 px-2 py-1 text-xs text-rose-800 hover:bg-rose-50"
                      onClick={() => void updateStatus(r.id, "rejected")}
                    >
                      Respinge
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
