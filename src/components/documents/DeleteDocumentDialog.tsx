"use client";

import { useState } from "react";
import { toast } from "sonner";

export type DeleteDocumentDialogProps = {
  /** Când e `null` sau `open` e false, dialogul nu se afișează. */
  documentId: number | null;
  fileName: string;
  status: string;
  employeeHasActiveDeployment?: boolean;
  userRole: string;
  open: boolean;
  onClose: () => void;
  /** După ștergere reușită — ex. `fetchDocuments` + `router.refresh()`. */
  onSuccess: () => void;
};

function deleteBlockedForNonAdmin(
  status: string,
  employeeHasActiveDeployment: boolean
): { blocked: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (status === "EXPIRED") {
    reasons.push("Document expirat: doar administratorul poate șterge.");
  }
  if (employeeHasActiveDeployment) {
    reasons.push(
      "Angajat cu detașare activă: doar administratorul poate șterge documentul."
    );
  }
  return { blocked: reasons.length > 0, reasons };
}

export function DeleteDocumentDialog({
  documentId,
  fileName,
  status,
  employeeHasActiveDeployment = false,
  userRole,
  open,
  onClose,
  onSuccess,
}: DeleteDocumentDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const isAdmin = userRole === "administrator";
  const { blocked, reasons } = deleteBlockedForNonAdmin(
    status,
    employeeHasActiveDeployment
  );
  const deleteDisabled = !isAdmin && blocked;

  if (!open || documentId == null) return null;

  const displayName = fileName.trim().length > 0 ? fileName.trim() : "document";

  async function confirmDelete() {
    if (deleteDisabled) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (res.ok) {
        toast.success("Document șters cu succes");
        onSuccess();
        onClose();
        return;
      }

      const msg = data.error ?? "Operațiunea a eșuat";
      toast.error(msg);
    } catch {
      toast.error("Eroare de rețea");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-document-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="delete-document-title"
          className="text-lg font-semibold text-gray-900"
        >
          Confirmare ștergere
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Sigur doriți să ștergeți documentul{" "}
          <span className="font-medium text-gray-900">„{displayName}”</span>?{" "}
          Această acțiune este ireversibilă.
        </p>

        {deleteDisabled && (
          <div
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            role="note"
          >
            <ul className="list-inside list-disc space-y-1">
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Anulează
          </button>
          <button
            type="button"
            onClick={() => void confirmDelete()}
            disabled={deleting || deleteDisabled}
            className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? "Se șterge…" : "Șterge"}
          </button>
        </div>
      </div>
    </div>
  );
}
