"use client";

import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { formatDate } from "@/components/admin/adminUtils";
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
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Eye,
  Loader2,
  Pause,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  plan: string;
  email: string | null;
  adminEmail: string | null;
  employeeCount: number;
  documentCount: number;
  createdAt: string;
};

type OrganizationDetail = OrganizationRow & {
  users: Array<{
    id: string;
    name: string | null;
    email: string;
    role: string;
  }>;
};

const PLAN_OPTIONS = ["", "starter", "business", "enterprise", "custom"];
const STATUS_OPTIONS = ["", "active", "suspended", "trial", "grace"];
const SUBSCRIPTION_OPTIONS = ["", "active", "trial", "expired"];

type AdminOrganizationsPanelProps = {
  showFilters?: boolean;
  enableExpand?: boolean;
  actionStyle?: "icons" | "labels";
  tableVariant?: "global" | "directory";
};

export function AdminOrganizationsPanel({
  showFilters = false,
  enableExpand = false,
  actionStyle = "labels",
  tableVariant = "directory",
}: AdminOrganizationsPanelProps) {
  const showAdminEmailColumn = tableVariant === "directory";
  const columnCount =
    (enableExpand ? 1 : 0) +
    7 +
    (showAdminEmailColumn ? 1 : 0) +
    1;
  const [rows, setRows] = useState<OrganizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailById, setDetailById] = useState<
    Record<string, OrganizationDetail | undefined>
  >({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [viewRow, setViewRow] = useState<OrganizationDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [editRow, setEditRow] = useState<OrganizationRow | null>(null);
  const [suspendRow, setSuspendRow] = useState<OrganizationRow | null>(null);
  const [reactivateRow, setReactivateRow] = useState<OrganizationRow | null>(
    null,
  );
  const [deleteRow, setDeleteRow] = useState<OrganizationRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    plan: "starter",
    status: "active",
    subscriptionStatus: "active",
    trialEndsAt: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (plan) params.set("plan", plan);
      const response = await fetch(
        `/api/admin/organizations?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Could not load organizations");
      const payload = await response.json();
      setRows(payload.organizations ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unexpected error",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [plan, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const empty = useMemo(() => !loading && rows.length === 0, [loading, rows]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoadingId(id);
    try {
      const response = await fetch(`/api/admin/organizations/${id}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not load organization details");
      const payload = await response.json();
      setDetailById((current) => ({
        ...current,
        [id]: payload.organization,
      }));
      return payload.organization as OrganizationDetail;
    } catch (detailError) {
      setError(
        detailError instanceof Error ? detailError.message : "Unexpected error",
      );
      return null;
    } finally {
      setDetailLoadingId(null);
    }
  }, []);

  async function toggleExpanded(row: OrganizationRow) {
    if (!enableExpand) return;
    if (expandedId === row.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(row.id);
    if (!detailById[row.id]) {
      await loadDetail(row.id);
    }
  }

  async function openView(row: OrganizationRow) {
    setViewLoading(true);
    setViewRow(null);
    try {
      const cached = detailById[row.id];
      const detail = cached ?? (await loadDetail(row.id));
      if (detail) setViewRow(detail);
    } finally {
      setViewLoading(false);
    }
  }

  async function saveEdit() {
    if (!editRow) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/organizations/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          plan: form.plan,
          status: form.status,
          subscriptionStatus: form.subscriptionStatus,
          trialEndsAt: form.trialEndsAt.trim()
            ? new Date(form.trialEndsAt).toISOString()
            : null,
        }),
      });
      if (!response.ok) throw new Error("Could not save organization");
      setEditRow(null);
      setDetailById((current) => {
        const next = { ...current };
        delete next[editRow.id];
        return next;
      });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unexpected error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmSuspend() {
    if (!suspendRow) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/organizations/${suspendRow.id}/suspend`,
        { method: "PATCH" },
      );
      if (!response.ok) throw new Error("Could not suspend organization");
      setSuspendRow(null);
      setDetailById((current) => {
        const next = { ...current };
        delete next[suspendRow.id];
        return next;
      });
      await load();
    } catch (suspendError) {
      setError(
        suspendError instanceof Error ? suspendError.message : "Unexpected error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmReactivate() {
    if (!reactivateRow) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/organizations/${reactivateRow.id}/reactivate`,
        { method: "PATCH" },
      );
      if (!response.ok) throw new Error("Could not reactivate organization");
      setReactivateRow(null);
      setDetailById((current) => {
        const next = { ...current };
        delete next[reactivateRow.id];
        return next;
      });
      await load();
    } catch (reactivateError) {
      setError(
        reactivateError instanceof Error
          ? reactivateError.message
          : "Unexpected error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteRow) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/organizations/${deleteRow.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Could not delete organization");
      setDeleteRow(null);
      setExpandedId((current) => (current === deleteRow.id ? null : current));
      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Unexpected error",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {showFilters ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or slug"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option || "all-status"} value={option}>
                {option ? option : "All statuses"}
              </option>
            ))}
          </select>
          <select
            value={plan}
            onChange={(event) => setPlan(event.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {PLAN_OPTIONS.map((option) => (
              <option key={option || "all-plans"} value={option}>
                {option ? option : "All plans"}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <AdminTableSkeleton columns={9} />
      ) : empty ? (
        <AdminEmptyState
          title="No organizations found"
          description="Organizations will appear here after registration."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                {enableExpand ? <TableHead className="w-8" /> : null}
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                {showAdminEmailColumn ? (
                  <TableHead>Admin email</TableHead>
                ) : null}
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Employee Count</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const expanded = expandedId === row.id;
                const detail = detailById[row.id];
                const detailLoading = detailLoadingId === row.id;

                return (
                  <OrganizationTableGroup
                    key={row.id}
                    row={row}
                    expanded={expanded}
                    detail={detail}
                    detailLoading={detailLoading}
                    enableExpand={enableExpand}
                    actionStyle={actionStyle}
                    showAdminEmailColumn={showAdminEmailColumn}
                    columnCount={columnCount}
                    onToggle={() => void toggleExpanded(row)}
                    onView={(event) => {
                      event.stopPropagation();
                      void openView(row);
                    }}
                    onEdit={(event) => {
                      event.stopPropagation();
                      setEditRow(row);
                      setForm({
                        name: row.name,
                        plan: row.plan,
                        status: row.status,
                        subscriptionStatus: row.subscriptionStatus,
                        trialEndsAt: row.trialEndsAt
                          ? row.trialEndsAt.slice(0, 16)
                          : "",
                      });
                    }}
                    onSuspend={(event) => {
                      event.stopPropagation();
                      setSuspendRow(row);
                    }}
                    onReactivate={(event) => {
                      event.stopPropagation();
                      setReactivateRow(row);
                    }}
                    onDelete={(event) => {
                      event.stopPropagation();
                      setDeleteRow(row);
                    }}
                  />
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={viewLoading || Boolean(viewRow)}
        onOpenChange={(open) => {
          if (!open) {
            setViewRow(null);
            setViewLoading(false);
          }
        }}
        title={viewRow?.name ?? "Organization"}
        description="Complete organization details"
      >
        {viewLoading ? (
          <PanelLoading />
        ) : viewRow ? (
          <OrganizationDetailPanel organization={viewRow} />
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(editRow)}
        onOpenChange={(open) => !open && setEditRow(null)}
        title="Edit organization"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void saveEdit()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Name"
          />
          <select
            value={form.plan}
            onChange={(event) =>
              setForm((current) => ({ ...current, plan: event.target.value }))
            }
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {PLAN_OPTIONS.filter(Boolean).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({ ...current, status: event.target.value }))
            }
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {STATUS_OPTIONS.filter(Boolean).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            value={form.subscriptionStatus}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                subscriptionStatus: event.target.value,
              }))
            }
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {SUBSCRIPTION_OPTIONS.filter(Boolean).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <Input
            type="datetime-local"
            value={form.trialEndsAt}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                trialEndsAt: event.target.value,
              }))
            }
            placeholder="Trial ends at"
          />
        </div>
      </Dialog>

      <AlertDialog
        open={Boolean(suspendRow)}
        onOpenChange={(open) => !open && setSuspendRow(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend organization</AlertDialogTitle>
            <AlertDialogDescription>
              {suspendRow?.name} will be marked as suspended.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmSuspend()}>
              Suspend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(reactivateRow)}
        onOpenChange={(open) => !open && setReactivateRow(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivate organization</AlertDialogTitle>
            <AlertDialogDescription>
              {reactivateRow?.name} will be marked as active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmReactivate()}>
              Reactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteRow)}
        onOpenChange={(open) => !open && setDeleteRow(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete organization</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteRow?.name} and all related
              data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PanelLoading() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
    </div>
  );
}

function OrganizationTableGroup({
  row,
  expanded,
  detail,
  detailLoading,
  enableExpand,
  actionStyle,
  showAdminEmailColumn,
  columnCount,
  onToggle,
  onView,
  onEdit,
  onSuspend,
  onReactivate,
  onDelete,
}: {
  row: OrganizationRow;
  expanded: boolean;
  detail?: OrganizationDetail;
  detailLoading: boolean;
  enableExpand: boolean;
  actionStyle: "icons" | "labels";
  showAdminEmailColumn: boolean;
  columnCount: number;
  onToggle: () => void;
  onView: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onEdit: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onSuspend: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onReactivate: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onDelete: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const adminEmail = row.adminEmail ?? row.email ?? "-";

  return (
    <>
      <TableRow
        className={enableExpand ? "cursor-pointer" : undefined}
        onClick={enableExpand ? onToggle : undefined}
        data-state={expanded ? "selected" : undefined}
      >
        {enableExpand ? (
          <TableCell>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-slate-500 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </TableCell>
        ) : null}
        <TableCell className="font-mono text-xs">{row.id}</TableCell>
        <TableCell className="font-medium">{row.name}</TableCell>
        <TableCell>{row.slug}</TableCell>
        {showAdminEmailColumn ? <TableCell>{adminEmail}</TableCell> : null}
        <TableCell>
          <Badge variant="outline">{row.status}</Badge>
        </TableCell>
        <TableCell className="capitalize">{row.plan}</TableCell>
        <TableCell>{formatDate(row.createdAt)}</TableCell>
        <TableCell>{row.employeeCount}</TableCell>
        <TableCell>
          <OrganizationRowActions
            row={row}
            actionStyle={actionStyle}
            onView={onView}
            onEdit={onEdit}
            onSuspend={onSuspend}
            onReactivate={onReactivate}
            onDelete={onDelete}
          />
        </TableCell>
      </TableRow>
      {enableExpand && expanded ? (
        <TableRow className="bg-slate-50 hover:bg-slate-50">
          <TableCell colSpan={columnCount} className="p-0">
            <OrganizationExpandedPanel
              row={row}
              detail={detail}
              loading={detailLoading}
            />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function OrganizationRowActions({
  row,
  actionStyle,
  onView,
  onEdit,
  onSuspend,
  onReactivate,
  onDelete,
}: {
  row: OrganizationRow;
  actionStyle: "icons" | "labels";
  onView: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onEdit: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onSuspend: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onReactivate: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onDelete: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  if (actionStyle === "labels") {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onView}>
          View
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit}>
          Edit
        </Button>
        {row.status !== "suspended" ? (
          <Button size="sm" variant="outline" onClick={onSuspend}>
            Suspend
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onReactivate}>
            Reactivate
          </Button>
        )}
        <Button size="sm" variant="destructive" onClick={onDelete}>
          Delete
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Button size="icon" variant="outline" aria-label="View" onClick={onView}>
        <Eye className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="outline" aria-label="Edit" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      {row.status !== "suspended" ? (
        <Button
          size="icon"
          variant="outline"
          aria-label="Suspend"
          onClick={onSuspend}
        >
          <Pause className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          size="icon"
          variant="outline"
          aria-label="Reactivate"
          onClick={onReactivate}
        >
          <Play className="h-4 w-4" />
        </Button>
      )}
      {row.status === "trial" ? (
        <Button
          size="icon"
          variant="destructive"
          aria-label="Delete"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

function OrganizationExpandedPanel({
  row,
  detail,
  loading,
}: {
  row: OrganizationRow;
  detail?: OrganizationDetail;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading organization details...
      </div>
    );
  }

  const users = detail?.users ?? [];

  return (
    <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
      <div className="space-y-2 text-sm">
        <p>
          <span className="text-slate-500">Admin email:</span>{" "}
          {detail?.adminEmail ?? row.adminEmail ?? row.email ?? "-"}
        </p>
        <p>
          <span className="text-slate-500">Employees:</span>{" "}
          {detail?.employeeCount ?? row.employeeCount}
        </p>
        <p>
          <span className="text-slate-500">Documents:</span>{" "}
          {detail?.documentCount ?? row.documentCount}
        </p>
        <p>
          <span className="text-slate-500">Created:</span>{" "}
          {formatDate(detail?.createdAt ?? row.createdAt)}
        </p>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-slate-900">
          Organization users
        </p>
        {users.length === 0 ? (
          <p className="text-sm text-slate-500">No users found.</p>
        ) : (
          <ul className="space-y-1 text-sm text-slate-700">
            {users.map((user) => (
              <li key={user.id}>
                {user.name ?? user.email} ({user.role})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function OrganizationDetailPanel({
  organization,
}: {
  organization: OrganizationDetail;
}) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <DetailItem label="ID" value={organization.id} mono />
      <DetailItem label="Slug" value={organization.slug} />
      <DetailItem
        label="Admin email"
        value={organization.adminEmail ?? organization.email ?? "-"}
      />
      <DetailItem label="Status" value={organization.status} />
      <DetailItem
        label="Subscription"
        value={organization.subscriptionStatus}
      />
      <DetailItem label="Plan" value={organization.plan} />
      <DetailItem
        label="Trial ends"
        value={
          organization.trialEndsAt
            ? formatDate(organization.trialEndsAt)
            : "-"
        }
      />
      <DetailItem
        label="Employees"
        value={String(organization.employeeCount)}
      />
      <DetailItem
        label="Documents"
        value={String(organization.documentCount)}
      />
      <DetailItem
        label="Created"
        value={formatDate(organization.createdAt)}
      />
      <div className="sm:col-span-2">
        <dt className="text-slate-500">Users</dt>
        <dd className="mt-2 space-y-1">
          {organization.users.length === 0 ? (
            <span>-</span>
          ) : (
            organization.users.map((user) => (
              <div key={user.id}>
                {user.name ?? user.email} ({user.role})
              </div>
            ))
          )}
        </dd>
      </div>
    </dl>
  );
}

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className={mono ? "font-mono text-xs" : undefined}>{value}</dd>
    </div>
  );
}
