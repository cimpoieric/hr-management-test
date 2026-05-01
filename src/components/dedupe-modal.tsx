"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Types matching the backend dedupe engine
export type DedupeAction = "CREATE" | "UPDATE" | "REVIEW";

export type FieldDiff = {
  field: string;
  old: string | null;
  new: string | null;
};

export type DedupeResult = {
  action: DedupeAction;
  confidence: number;
  message: string | null;
  diff: FieldDiff[] | null;
  existing: {
    id: number;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    cnp: string;
    iban: string | null;
    bankName: string | null;
    address: string | null;
    city: string | null;
  } | null;
};

type DedupeModalProps = {
  dedupe: DedupeResult;
  incoming: {
    cnp: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    iban: string | null;
    bankName: string | null;
    address: string | null;
    city: string | null;
    companyId: number;
  };
  onConfirm: (action: "CREATE" | "UPDATE", employeeId?: number) => void;
  onCancel: () => void;
};

function FieldRow({
  label,
  oldVal,
  newVal,
  changed,
}: {
  label: string;
  oldVal: string | null;
  newVal: string | null;
  changed: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 py-2 text-sm border-b last:border-b-0">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className={changed ? "text-red-600 line-through decoration-red-400" : ""}>
        {oldVal ?? "—"}
      </span>
      <span className={changed ? "text-green-700 font-semibold" : ""}>
        {newVal ?? "—"}
      </span>
    </div>
  );
}

export function DedupeModal({ dedupe, incoming, onConfirm, onCancel }: DedupeModalProps) {
  const existing = dedupe.existing;
  const diffMap = new Map(dedupe.diff?.map((d) => [d.field, d]) ?? []);

  const changedFields = dedupe.diff?.map((d) => d.field) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {dedupe.action === "UPDATE"
                ? "Angajat existent — propus UPDATE"
                : "Posibil duplicat detectat"}
            </h2>
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                dedupe.action === "UPDATE"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              Match {Math.round(dedupe.confidence * 100)}%
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {dedupe.message}
          </p>
        </div>

        {/* Comparison table */}
        <div className="px-6 py-4">
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            <span>Câmp</span>
            <span>Există în sistem</span>
            <span>Nou / Importat</span>
          </div>

          <FieldRow
            label="CNP"
            oldVal={existing?.cnp ?? null}
            newVal={incoming.cnp}
            changed={false}
          />
          <FieldRow
            label="Nume"
            oldVal={existing?.lastName ?? null}
            newVal={incoming.lastName}
            changed={changedFields.includes("nume")}
          />
          <FieldRow
            label="Prenume"
            oldVal={existing?.firstName ?? null}
            newVal={incoming.firstName}
            changed={changedFields.includes("prenume")}
          />
          <FieldRow
            label="Email"
            oldVal={existing?.email ?? null}
            newVal={incoming.email}
            changed={changedFields.includes("email")}
          />
          <FieldRow
            label="Telefon"
            oldVal={existing?.phone ?? null}
            newVal={incoming.phone}
            changed={changedFields.includes("telefon")}
          />
          <FieldRow
            label="IBAN"
            oldVal={existing?.iban ?? null}
            newVal={incoming.iban}
            changed={changedFields.includes("iban")}
          />
          <FieldRow
            label="Bancă"
            oldVal={existing?.bankName ?? null}
            newVal={incoming.bankName}
            changed={changedFields.includes("banca")}
          />
          <FieldRow
            label="Adresă"
            oldVal={existing?.address ?? null}
            newVal={incoming.address}
            changed={changedFields.includes("adresa")}
          />
          <FieldRow
            label="Oraș"
            oldVal={existing?.city ?? null}
            newVal={incoming.city}
            changed={changedFields.includes("oras")}
          />
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t bg-zinc-50 dark:bg-zinc-800/50 rounded-b-xl flex items-center justify-between gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Anulează
          </button>

          <div className="flex items-center gap-3">
            {dedupe.action === "UPDATE" && (
              <button
                onClick={() => onConfirm("UPDATE", existing?.id)}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
              >
                Actualizează angajatul
              </button>
            )}

            {dedupe.action === "REVIEW" && (
              <>
                <button
                  onClick={() => onConfirm("CREATE")}
                  className="px-4 py-2 rounded-lg border border-green-600 text-green-700 text-sm font-medium hover:bg-green-50 transition-colors"
                >
                  Crează ca angajat nou
                </button>
                <button
                  onClick={() => onConfirm("UPDATE", existing?.id)}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
                >
                  Actualizează existent
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
