"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Download, Eye, Mail, MoreVertical, Trash, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { useAuth } from "@/hooks/useAuth";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  employee: { firstName: string; lastName: string; email?: string | null };
  timesheet: { hoursWorked: string; status: string };
  items?: Array<{ type: string; amount: string; sortOrder: number }>;
};

export type EmployeeOpt = { id: number; firstName: string; lastName: string };
export type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

function money(n: number, currency: string) {
  return `${(Number.isFinite(n) ? n : 0).toFixed(2)} ${currency}`;
}

function sumByType(items: PayslipListItem["items"] | undefined, type: string): number {
  return (items ?? [])
    .filter((i) => i.type === type)
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
}

function computedTotal(items: PayslipListItem["items"] | undefined): number {
  return (items ?? []).reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
}

export function PayslipsTableClient({
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
  const { role } = useAuth();
  const isReadOnly = role === "doar_vizualizare";

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const allSelected = useMemo(
    () => items.length > 0 && items.every((p) => selected.has(p.id)),
    [items, selected]
  );

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [payslipToDelete, setPayslipToDelete] = useState<number | null>(null);

  const [sendOpen, setSendOpen] = useState(false);

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
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Operațiunea a eșuat");
    return data;
  }

  async function deleteReq(url: string) {
    const res = await fetch(url, { method: "DELETE", credentials: "same-origin" });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Operațiunea a eșuat");
    return data;
  }

  function handlePreviewPDF(payslipId: number) {
    // Prev. rapid: open iframe in a new tab (fără modal aici ca să păstrăm pagina compactă)
    window.open(`/api/payslips/${payslipId}/pdf`, "_blank", "noopener,noreferrer");
  }

  function handleDownloadPDF(payslipId: number) {
    window.open(`/api/payslips/${payslipId}/pdf`, "_blank", "noopener,noreferrer");
  }

  async function handleSendEmail(payslipId: number) {
    try {
      await postJson("/api/email/send", {
        type: "fluturas",
        data: { payslipId },
      });
      toast.success("Email trimis cu succes!");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    }
  }

  function handleDeleteClick(payslipId: number) {
    setPayslipToDelete(payslipId);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (payslipToDelete == null) return;
    try {
      await deleteReq(`/api/payslips/${payslipToDelete}`);
      toast.success("Fluturaș șters");
      setDeleteDialogOpen(false);
      setPayslipToDelete(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    }
  }

  function defaultSubjectFromSelection(): string {
    const any = items.find((p) => selected.has(p.id)) ?? items[0];
    if (!any) return "Fluturas salariu";
    // month/year from period end
    const d = new Date(any.periodEnd);
    if (Number.isNaN(d.getTime())) return `Fluturas salariu - ${any.year}`;
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `Fluturas salariu - ${mm} ${d.getFullYear()}`;
  }

  const selectedEmployees = useMemo(() => {
    const selectedItems = items.filter((p) => selected.has(p.id));
    return selectedItems.map((p) => ({
      id: p.id,
      nume: `${p.employee.lastName} ${p.employee.firstName}`.trim(),
      email: (p.employee.email ?? "").trim(),
      saptamana: p.weekNumber,
      an: p.year,
    }));
  }, [items, selected]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fluturași</h1>
          <p className="mt-1 text-sm text-gray-500">Listă fluturași — PDF, email, filtrare</p>
        </div>
        <div className="flex items-center gap-2">
          <PermissionGuard allowedRoles={["operator", "administrator"]}>
            {selected.size > 0 ? (
              <Button
                variant="default"
                onClick={() => setSendOpen(true)}
                title={`Trimite la ${selected.size} angajati`}
              >
                <Mail className="mr-2 h-4 w-4" />
                Trimite Email ({selected.size})
              </Button>
            ) : null}
          </PermissionGuard>
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
      </div>

      {/* IMPORTANT: doar aici overflow-x */}
      <div className="rounded-md border overflow-x-auto bg-white">
        <Table className="min-w-[900px]">
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
              <TableHead className="min-w-[160px] max-w-[200px] p-2 truncate">Angajat</TableHead>
              <TableHead className="w-[100px] p-2 text-center whitespace-nowrap">Săpt.</TableHead>
              <TableHead className="w-[70px] p-2 text-center">Ore</TableHead>
              <TableHead className="w-[110px] p-2 text-right whitespace-nowrap">Salariu Net</TableHead>
              <TableHead className="w-[80px] p-2 text-right whitespace-nowrap">Travel</TableHead>
              <TableHead className="w-[110px] p-2 text-right font-bold whitespace-nowrap">Total</TableHead>
              <TableHead className="w-[60px] p-2 text-center">PDF</TableHead>
              <TableHead className="w-[80px] p-2 text-center">Email</TableHead>
              <TableHead className="w-[50px] p-2 text-center">Acțiuni</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {items.map((p) => {
              const fullName = `${p.employee.lastName} ${p.employee.firstName}`.trim();
              const net = sumByType(p.items, "NET_SALARY");
              const travel = sumByType(p.items, "TRAVEL_ALLOWANCE");
              const totalRaw = Number(p.totalPaid) || 0;
              const totalComputed = computedTotal(p.items);
              const total = totalRaw === 0 && totalComputed !== 0 ? totalComputed : totalRaw;
              const currency = String(p.currency || "EUR").toUpperCase();

              return (
                <TableRow key={p.id}>
                  <TableCell className="w-10 p-2">
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
                  </TableCell>

                  <TableCell className="min-w-[160px] max-w-[200px] p-2 truncate" title={fullName}>
                    <Link className="hover:underline" href={`/fluturasi/${p.id}`}>
                      {fullName}
                    </Link>
                  </TableCell>

                  <TableCell className="w-[100px] p-2 text-center whitespace-nowrap">
                    {String(p.weekNumber).padStart(2, "0")}/{p.year}
                  </TableCell>

                  <TableCell className="w-[70px] p-2 text-center">{Number(p.timesheet.hoursWorked || 0).toFixed(2)}</TableCell>

                  <TableCell className="w-[110px] p-2 text-right whitespace-nowrap">
                    {money(net, currency)}
                  </TableCell>

                  <TableCell className="w-[80px] p-2 text-right whitespace-nowrap">
                    {money(travel, currency)}
                  </TableCell>

                  <TableCell className="w-[110px] p-2 text-right font-bold whitespace-nowrap">
                    {money(total, currency)}
                  </TableCell>

                  <TableCell className="w-[60px] p-2 text-center">
                    {p.pdfPath ? (
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <a href={`/api/payslips/${p.id}/pdf`} download>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>

                  <TableCell className="w-[80px] p-2 text-center">
                    {p.emailSent ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 text-[10px] px-1.5 py-0">
                        Trimis
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 text-[10px] px-1.5 py-0">
                        Netrimis
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="w-[50px] p-2 text-center">
                    {isReadOnly ? (
                      <span className="text-muted-foreground text-xs">-</span>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <PermissionGuard allowedRoles={["operator", "administrator"]}>
                            <DropdownMenuItem onClick={() => handlePreviewPDF(p.id)}>
                              <Eye className="mr-2 h-4 w-4" /> Previzualizează PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadPDF(p.id)}>
                              <Download className="mr-2 h-4 w-4" /> Descarcă PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendEmail(p.id)}>
                              <Mail className="mr-2 h-4 w-4" /> Trimite Email
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </PermissionGuard>
                          <PermissionGuard allowedRoles={["administrator"]}>
                            <DropdownMenuItem onClick={() => handleDeleteClick(p.id)} className="text-red-600">
                              <Trash className="mr-2 h-4 w-4" /> Șterge
                            </DropdownMenuItem>
                          </PermissionGuard>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}

            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="p-6 text-center text-sm text-gray-500">
                  Nu există fluturași pentru filtrele selectate.
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

      <SendEmailModal
        open={sendOpen}
        selectedPayslipIds={Array.from(selected)}
        selectedEmployees={selectedEmployees}
        defaultSubject={defaultSubjectFromSelection()}
        onDismiss={() => setSendOpen(false)}
        onSent={() => {
          // Refresh server data before tearing down overlay/toasts — avoids React portal removeChild races.
          router.refresh();
          window.setTimeout(() => {
            requestAnimationFrame(() => {
              startTransition(() => {
                setSendOpen(false);
                setSelected(new Set());
              });
            });
          }, 150);
        }}
      />

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          Pagina <span className="font-medium text-gray-900">{pagination.page}</span> din{" "}
          <span className="font-medium text-gray-900">{pagination.totalPages}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => updateUrl({ page: String(pagination.page - 1) })}
          >
            Înapoi
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => updateUrl({ page: String(pagination.page + 1) })}
          >
            Înainte
          </Button>
        </div>
      </div>
    </div>
  );
}

function SendEmailModal({
  open,
  selectedPayslipIds,
  selectedEmployees,
  onDismiss,
  defaultSubject,
  onSent,
}: {
  open: boolean;
  /** Toate ID-urile de fluturași selectate (pe orice pagină) — sursa de adevăr pentru număr și trimitere */
  selectedPayslipIds: number[];
  selectedEmployees: Array<{ id: number; nume: string; email: string; saptamana: number; an: number }>;
  onDismiss: () => void;
  defaultSubject: string;
  onSent: () => void;
}) {
  const count = selectedPayslipIds.length;
  const visibleCount = selectedEmployees.length;
  const hiddenSelectionCount = Math.max(0, count - visibleCount);
  const [subiect, setSubiect] = useState(defaultSubject);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSendEmails() {
    if (selectedPayslipIds.length === 0) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "fluturas",
          data: {
            angajatiIds: selectedPayslipIds,
            subiect: subiect.trim() || undefined,
          },
        }),
      });

      const result = (await res.json().catch(() => ({}))) as {
        error?: string;
        total?: number;
        trimise?: number;
        esuate?: number;
      };

      if (!res.ok) throw new Error(result.error || "Eroare la trimitere");

      const ok = Number(result.trimise ?? 0);
      const bad = Number(result.esuate ?? 0);
      if (bad > 0 && ok > 0) {
        toast.warning(`${ok} din ${Number(result.total ?? ok + bad)} email-uri trimise; ${bad} eșuate`);
      } else if (bad > 0 && ok === 0) {
        toast.error(result.error ?? "Trimiterea email-urilor a eșuat");
      } else {
        toast.success(`Email-uri trimise cu succes: ${ok}`);
      }

      // Parent closes after router.refresh + delayed unmount; keep submitting until unmount.
      requestAnimationFrame(() => {
        onSent();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Eroare la trimiterea email-ului");
      setIsSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onClick={() => !isSubmitting && onDismiss()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-email-modal-title"
        className="w-full max-w-2xl rounded-xl border bg-white shadow-xl flex flex-col max-h-[85vh] p-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER - static */}
        <div className="flex items-start justify-between gap-3 border-b px-6 pt-6 pb-2 shrink-0">
          <div>
            <h2 id="send-email-modal-title" className="text-lg font-semibold text-gray-900">
              Trimite fluturași prin email
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Selectați: {count} {count === 1 ? "fluturaș" : "fluturași"}
              {hiddenSelectionCount > 0 ? (
                <span className="block text-xs text-amber-800 mt-0.5">
                  ({visibleCount} pe această pagină, {hiddenSelectionCount} pe alte pagini)
                </span>
              ) : null}
            </p>
          </div>
          <Button variant="outline" disabled={isSubmitting} onClick={onDismiss}>
            Inapoi
          </Button>
        </div>

        {/* CONTENT - scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4 min-h-0">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">
              Detalii pe pagina curentă ({visibleCount}
              {hiddenSelectionCount > 0 ? ` din ${count}` : ""})
            </h3>

            <div className="max-h-[150px] overflow-y-auto rounded-lg border divide-y bg-white">
              {visibleCount === 0 && count > 0 ? (
                <div className="px-3 py-2 text-sm text-gray-600">
                  Fluturașii selectați nu sunt pe această pagină; la trimitere se folosesc toate cele {count}{" "}
                  selectate.
                </div>
              ) : null}
              {count === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">Niciun angajat selectat.</div>
              ) : (
                selectedEmployees.map((emp) => (
                  <div key={emp.id} className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium shrink-0">
                        {(emp.nume || "?").charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{emp.nume}</p>
                        <p className="text-xs text-gray-500 truncate">{emp.email || "—"}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {emp.saptamana}/{emp.an}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Subiect</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="Subiect email"
              value={subiect}
              onChange={(e) => setSubiect(e.target.value)}
            />
          </div>

        </div>

        {/* FOOTER - static */}
        <div className="border-t shrink-0 bg-white px-6 py-4">
          <div className="flex justify-between w-full gap-4">
          <Button variant="outline" onClick={onDismiss} disabled={isSubmitting}>
            Inapoi
          </Button>

          <Button onClick={handleSendEmails} disabled={isSubmitting || count === 0}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Se trimite...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Trimite Email-uri ({count})
              </>
            )}
          </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

