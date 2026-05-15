"use client";

import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
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
import { UserRole } from "@/lib/roles";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
  isActive: boolean;
  createdAt: string;
};

type OrganizationOption = { id: string; name: string };

const ROLE_OPTIONS = [
  "",
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.OPERATOR,
  UserRole.EMPLOYEE,
];

export default function AdminUsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [viewRow, setViewRow] = useState<UserRow | null>(null);
  const [editRow, setEditRow] = useState<UserRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<UserRow | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.EMPLOYEE);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (role) params.set("role", role);
      if (organizationId) params.set("organizationId", organizationId);
      const [usersResponse, organizationsResponse] = await Promise.all([
        fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/admin/organizations", { cache: "no-store" }),
      ]);
      if (!usersResponse.ok) throw new Error("Could not load users");
      if (!organizationsResponse.ok) {
        throw new Error("Could not load organizations");
      }
      const usersPayload = await usersResponse.json();
      const organizationsPayload = await organizationsResponse.json();
      setRows(usersPayload.users ?? []);
      setOrganizations(
        (organizationsPayload.organizations ?? []).map(
          (organization: { id: string; name: string }) => ({
            id: organization.id,
            name: organization.name,
          }),
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unexpected error",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId, role, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const empty = useMemo(() => !loading && rows.length === 0, [loading, rows]);

  async function saveRole() {
    if (!editRow) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });
      if (!response.ok) throw new Error("Could not update role");
      setEditRow(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unexpected error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteRow) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${deleteRow.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Could not delete user");
      setDeleteRow(null);
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
    <div className="max-w-7xl space-y-6">
      <AdminPageHeader
        title="Users"
        description="All users across every organization."
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or email"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option || "all"} value={option}>
              {option ? option : "All roles"}
            </option>
          ))}
        </select>
        <select
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All organizations</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <AdminTableSkeleton columns={8} />
      ) : empty ? (
        <AdminEmptyState
          title="No users found"
          description="Try changing the filters or invite a new user from an organization."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.id}</TableCell>
                  <TableCell>{row.name ?? "-"}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.role}</Badge>
                  </TableCell>
                  <TableCell>{row.organizationName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {row.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(row.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewRow(row)}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditRow(row);
                          setSelectedRole(row.role);
                        }}
                      >
                        Edit Role
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteRow(row)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={Boolean(viewRow)}
        onOpenChange={(open) => !open && setViewRow(null)}
        title={viewRow?.name ?? viewRow?.email ?? "User"}
        description="User details"
      >
        {viewRow ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">ID</dt>
              <dd className="font-mono text-xs">{viewRow.id}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd>{viewRow.email}</dd>
            </div>
            <AdminDetailRow label="Role" value={viewRow.role} />
            <AdminDetailRow
              label="Organization"
              value={viewRow.organizationName}
            />
            <AdminDetailRow
              label="Status"
              value={viewRow.isActive ? "Active" : "Inactive"}
            />
            <AdminDetailRow
              label="Created"
              value={formatDate(viewRow.createdAt)}
            />
          </dl>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(editRow)}
        onOpenChange={(open) => !open && setEditRow(null)}
        title="Edit role"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void saveRole()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </>
        }
      >
        <select
          value={selectedRole}
          onChange={(event) =>
            setSelectedRole(event.target.value as UserRole)
          }
          className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          {ROLE_OPTIONS.filter(Boolean).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteRow)}
        onOpenChange={(open) => !open && setDeleteRow(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteRow?.email}.
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

function AdminDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
