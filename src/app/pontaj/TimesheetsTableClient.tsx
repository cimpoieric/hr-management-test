"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { MoreVertical, Trash, Check, X, Send, FileText, Pencil, Loader2 } from "lucide-react";

import { TimesheetForm } from "@/app/components/TimesheetForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

function statusRo(status: string): string {
  const s = String(status || "").toUpperCase();
  if (s === "DRAFT") return "Ciornă";
  if (s === "SUBMITTED") return "În așteptare";
  if (s === "APPROVED") return "Aprobat";
  if (s === "REJECTED") return "Respins";
  return s || "—";
}

function statusBadgeClass(status: string): string {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") return "bg-green-50 text-green-700";
  if (s === "SUBMITTED") return "bg-blue-50 text-blue-700";
  if (s === "REJECTED") return "bg-red-50 text-red-700";
  return "bg-gray-100 text-gray-700";
}

function fmtPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => d.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit" });
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "—";
  return `${fmt(s)}-${fmt(e)}`;
}

export function TimesheetsTableClient({
  items,
  pagination,
  employees,
  filters,
}: {
  items: TimesheetRow[];
  pagination: Pagination;
  employees: EmployeeOpt[];
  filters: { employeeId?: string; year?: string; weekNumber?: string; status?: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const allSelected = useMemo(
    () => items.length > 0 && items.every((t) => selected.has(t.id)),
    [items, selected]
  );

  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [timesheetToDelete, setTimesheetToDelete] = useState<number | null>(null);

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

  function updateUrl(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v) sp.delete(k);
      else sp.set(k, v);
    }
    if (!("page" in next)) sp.set("page", "1");
    router.push(`/pontaj?${sp.toString()}`);
  }

  async function postJson(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Operațiunea a eșuat");
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

  async function deleteReq(url: string) {
    const res = await fetch(url, { method: "DELETE", credentials: "same-origin" });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Operațiunea a eșuat");
    return data;
  }

  async function doSubmit(id: number) {
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

  async function doApprove(id: number) {
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

  async function doReject(id: number) {
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

  async function doGeneratePayslip(id: number) {
    setBusy(id, true);
    try {
      await postJson(`/api/payslips/generate`, { timesheetId: id });
      toast.success("Fluturaș generat");
      router.push("/fluturasi");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
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
      const eligible = selectedRows.filter((t) => String(t.status || "").toUpperCase() === "APPROVED");

      if (eligible.length === 0) {
        toast.error("Selectează pontaje APPROVED pentru generare fluturași");
        return;
      }

      let ok = 0;
      let fail = 0;
      for (const t of eligible) {
        try {
          await postJson(`/api/payslips/generate`, { timesheetId: t.id });
          ok++;
        } catch {
          fail++;
        }
      }
      if (ok > 0) toast.success(`Fluturași generați: ${ok}`);
      if (fail > 0) toast.error(`Eșuați: ${fail}`);
      setSelected(new Set());
      router.refresh();
      router.push("/fluturasi");
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
      await deleteReq(`/api/timesheets/${timesheetToDelete}`);
      toast.success("Pontaj șters");
      setDeleteDialogOpen(false);
      setTimesheetToDelete(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(timesheetToDelete);
        return next;
      });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
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
        const res = await fetch(`/api/timesheets/${editingId}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const data = (await res.json().catch(() => ({}))) as any;
        if (!res.ok) throw new Error(data.error ?? "Eroare la citirea pontajului");
        if (cancelled) return;

        setEditEmployeeId(Number(data.employeeId));
        setEditWeekNumber(Number(data.weekNumber));
        setEditYear(Number(data.year));
        // date inputs expect yyyy-mm-dd
        const toDate = (v: any) => {
          const d = new Date(v);
          if (Number.isNaN(d.getTime())) return "";
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          return `${yyyy}-${mm}-${dd}`;
        };
        setEditStartDate(toDate(data.startDate));
        setEditEndDate(toDate(data.endDate));
        setEditHoursWorked(String(data.hoursWorked ?? ""));
        setEditStandardHours(String(data.standardHours ?? "40"));
        setEditDailyBreakdown(String(data.dailyBreakdown ?? ""));
        setEditNotes(String(data.notes ?? ""));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Eroare");
        setEditOpen(false);
        setEditingId(null);
      } finally {
        if (!cancelled) setEditLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editOpen, editingId]);

  async function saveEdit() {
    if (editingId == null) return;
    if (!editEmployeeId) {
      toast.error("Selectează angajat");
      return;
    }
    setEditLoading(true);
    try {
      const res = await fetch(`/api/timesheets/${editingId}`, {
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
          dailyBreakdown: editDailyBreakdown.trim() ? editDailyBreakdown : undefined,
          notes: editNotes.trim() ? editNotes : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Nu am putut salva");
      toast.success("Pontaj actualizat");
      setEditOpen(false);
      setEditingId(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pontaj</h1>
          <p className="mt-1 text-sm text-gray-500">Pontaje săptămânale — status, aprobări, fluturași</p>
        </div>
        <div className="flex items-center gap-2">
          <TimesheetForm onSuccess={() => router.refresh()} />
          <Button variant="outline" onClick={() => router.refresh()}>
            Refresh
          </Button>
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
            <label className="text-xs font-medium text-gray-600">Săpt.</label>
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
              <option value="DRAFT">Ciornă</option>
              <option value="SUBMITTED">Trimis</option>
              <option value="APPROVED">Aprobat</option>
              <option value="REJECTED">Respins</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto bg-white">
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-gray-50 px-3 py-2">
            <div className="text-xs text-gray-600">
              Selectate: <span className="font-medium text-gray-900">{selected.size}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={bulkBusy}
                onClick={() => setSelected(new Set())}
              >
                Reset selecție
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={bulkBusy}
                onClick={bulkGeneratePayslips}
              >
                Generează Fluturași ({selected.size})
              </Button>
            </div>
          </div>
        )}
        <Table className="min-w-[800px]">
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
              <TableHead className="min-w-[160px] p-2 truncate">Angajat</TableHead>
              <TableHead className="w-[100px] p-2 text-center whitespace-nowrap">Săpt.</TableHead>
              <TableHead className="w-[120px] p-2 text-center whitespace-nowrap">Perioada</TableHead>
              <TableHead className="w-[80px] p-2 text-center whitespace-nowrap">Ore</TableHead>
              <TableHead className="w-[110px] p-2 text-center whitespace-nowrap">Status</TableHead>
              <TableHead className="w-[70px] p-2 text-center whitespace-nowrap">Acțiuni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((t) => {
              const fullName = `${t.employee.lastName} ${t.employee.firstName}`.trim();
              const s = String(t.status || "").toUpperCase();
              const canEdit = s === "DRAFT" || s === "REJECTED";
              const canSubmit = s === "DRAFT" || s === "REJECTED";
              const canApprove = s === "SUBMITTED";
              const canReject = s === "SUBMITTED";
              const canGenerate = s === "APPROVED";
              const busy = busyIds.has(t.id) || bulkBusy;

              return (
                <TableRow key={t.id}>
                  <TableCell className="w-10 p-2">
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(t.id)) next.delete(t.id);
                          else next.add(t.id);
                          return next;
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="min-w-[160px] p-2 truncate" title={fullName}>
                    <Link className="hover:underline" href={`/pontaj?employeeId=${t.employeeId}`}>
                      {fullName}
                    </Link>
                  </TableCell>
                  <TableCell className="w-[100px] p-2 text-center whitespace-nowrap">
                    {String(t.weekNumber).padStart(2, "0")}/{t.year}
                  </TableCell>
                  <TableCell className="w-[120px] p-2 text-center whitespace-nowrap">{fmtPeriod(t.startDate, t.endDate)}</TableCell>
                  <TableCell className="w-[80px] p-2 text-center whitespace-nowrap">{Number(t.hoursWorked || 0).toFixed(2)}</TableCell>
                  <TableCell className="w-[110px] p-2 text-center whitespace-nowrap">
                    <Badge variant="outline" className={`${statusBadgeClass(t.status)} text-[10px] px-1.5 py-0`}>
                      {statusRo(t.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-[70px] p-2 text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {/* Draft: Edit, Submit, Șterge */}
                        {s === "DRAFT" ? (
                          <>
                            <DropdownMenuItem disabled={!canEdit || busy} onClick={() => openEdit(t.id)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={!canSubmit || busy} onClick={() => doSubmit(t.id)}>
                              <Send className="mr-2 h-4 w-4" /> Submit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem disabled={busy} onClick={() => handleDeleteClick(t.id)} className="text-red-600">
                              <Trash className="mr-2 h-4 w-4" /> Șterge
                            </DropdownMenuItem>
                          </>
                        ) : null}

                        {/* Pending: Aprobă, Respinge */}
                        {s === "SUBMITTED" ? (
                          <>
                            <DropdownMenuItem disabled={!canApprove || busy} onClick={() => doApprove(t.id)}>
                              <Check className="mr-2 h-4 w-4" /> Aprobă
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={!canReject || busy} onClick={() => doReject(t.id)}>
                              <X className="mr-2 h-4 w-4" /> Respinge
                            </DropdownMenuItem>
                          </>
                        ) : null}

                        {/* Aprobat: Generează Fluturaș */}
                        {s === "APPROVED" ? (
                          <DropdownMenuItem disabled={!canGenerate || busy} onClick={() => doGeneratePayslip(t.id)}>
                            <FileText className="mr-2 h-4 w-4" /> Generează Fluturaș
                          </DropdownMenuItem>
                        ) : null}

                        {/* Respins: Edit + Submit + Șterge */}
                        {s === "REJECTED" ? (
                          <>
                            <DropdownMenuItem disabled={!canEdit || busy} onClick={() => openEdit(t.id)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={!canSubmit || busy} onClick={() => doSubmit(t.id)}>
                              <Send className="mr-2 h-4 w-4" /> Submit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem disabled={busy} onClick={() => handleDeleteClick(t.id)} className="text-red-600">
                              <Trash className="mr-2 h-4 w-4" /> Șterge
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}

            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="p-6 text-center text-sm text-gray-500">
                  Nu există pontaje pentru filtrele selectate.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmare ștergere</AlertDialogTitle>
            <AlertDialogDescription>Ești sigur că vrei să ștergi?</AlertDialogDescription>
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
                <h2 className="text-lg font-semibold text-gray-900">Edit Pontaj</h2>
                <p className="mt-1 text-sm text-gray-500">Actualizează datele pontajului.</p>
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
                  Se încarcă...
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-gray-600">Angajat</label>
                    <select
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={String(editEmployeeId ?? "")}
                      onChange={(e) => setEditEmployeeId(Number(e.target.value))}
                    >
                      <option value="">Selectează</option>
                      {employees.map((e) => (
                        <option key={e.id} value={String(e.id)}>
                          {e.lastName} {e.firstName} {e.position ? `— ${e.position}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-600">Săptămâna</label>
                    <input
                      type="number"
                      min={1}
                      max={52}
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={editWeekNumber}
                      onChange={(e) => setEditWeekNumber(Number(e.target.value || "1"))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">An</label>
                    <input
                      type="number"
                      min={2024}
                      max={2030}
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={editYear}
                      onChange={(e) => setEditYear(Number(e.target.value || String(new Date().getFullYear())))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Start date</label>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">End date</label>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Ore lucrate</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={editHoursWorked}
                      onChange={(e) => setEditHoursWorked(e.target.value)}
                      placeholder="ex: 38.50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Ore standard</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={editStandardHours}
                      onChange={(e) => setEditStandardHours(e.target.value)}
                      placeholder="40"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-gray-600">Zilnic (JSON opțional)</label>
                    <textarea
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-mono"
                      rows={4}
                      value={editDailyBreakdown}
                      onChange={(e) => setEditDailyBreakdown(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-gray-600">Observații (opțional)</label>
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
                Anulează
              </Button>
              <Button disabled={editLoading} onClick={saveEdit}>
                {editLoading ? "Se salvează..." : "Salvează"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          Pagina <span className="font-medium text-gray-900">{pagination.page}</span> din{" "}
          <span className="font-medium text-gray-900">{pagination.totalPages}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => updateUrl({ page: String(pagination.page - 1) })}>
            Înapoi
          </Button>
          <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => updateUrl({ page: String(pagination.page + 1) })}>
            Înainte
          </Button>
        </div>
      </div>
    </div>
  );
}

