"use client";

import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
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
import { Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type CountryRow = {
  id: number;
  name: string;
  code: string;
  phoneCode: string | null;
  isActive: boolean;
  employeeCount: number;
  companyCount: number;
  createdAt: string;
};

export default function AdminCountriesPage() {
  const [rows, setRows] = useState<CountryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CountryRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<CountryRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    phoneCode: "",
    isActive: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/countries", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load countries");
      const payload = await response.json();
      setRows(payload.countries ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unexpected error",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const empty = useMemo(() => !loading && rows.length === 0, [loading, rows]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", code: "", phoneCode: "", isActive: true });
    setModalOpen(true);
  }

  function openEdit(row: CountryRow) {
    setEditing(row);
    setForm({
      name: row.name,
      code: row.code,
      phoneCode: row.phoneCode ?? "",
      isActive: row.isActive,
    });
    setModalOpen(true);
  }

  async function saveCountry() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        editing ? `/api/admin/countries/${editing.id}` : "/api/admin/countries",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            code: form.code,
            phoneCode: form.phoneCode.trim() || null,
            isActive: form.isActive,
          }),
        },
      );
      if (!response.ok) throw new Error("Could not save country");
      setModalOpen(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unexpected error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: CountryRow) {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/countries/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      if (!response.ok) throw new Error("Could not update country");
      await load();
    } catch (toggleError) {
      setError(
        toggleError instanceof Error ? toggleError.message : "Unexpected error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteRow) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/countries/${deleteRow.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Could not delete country");
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
        title="Countries"
        description="Supported countries available across the platform."
      />

      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add country
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <AdminTableSkeleton columns={7} />
      ) : empty ? (
        <AdminEmptyState
          title="No countries found"
          description="Add the first supported country for deployments and companies."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Companies</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.code}</TableCell>
                  <TableCell>{row.phoneCode ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {row.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.companyCount}</TableCell>
                  <TableCell>{row.employeeCount}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(row)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() => void toggleActive(row)}
                      >
                        {row.isActive ? "Deactivate" : "Activate"}
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
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit country" : "Add country"}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void saveCountry()}>
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
            placeholder="Country name"
          />
          <Input
            value={form.code}
            onChange={(event) =>
              setForm((current) => ({ ...current, code: event.target.value }))
            }
            placeholder="Code (RO)"
          />
          <Input
            value={form.phoneCode}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                phoneCode: event.target.value,
              }))
            }
            placeholder="Phone code"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
            />
            Active
          </label>
        </div>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteRow)}
        onOpenChange={(open) => !open && setDeleteRow(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete country</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteRow?.name}.
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
