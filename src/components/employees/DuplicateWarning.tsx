"use client";

import { AlertTriangle, Eye, X, ShieldCheck } from "lucide-react";
import Link from "next/link";

interface DuplicateWarningProps {
  existing: {
    id: number;
    name: string;
    cnp: string;
    status: string;
  };
  isAdmin: boolean;
  onContinueAnyway: () => void;
  onCancel: () => void;
}

export function DuplicateWarning({
  existing,
  isAdmin,
  onContinueAnyway,
  onCancel,
}: DuplicateWarningProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 bg-amber-50 border-b border-amber-100">
          <AlertTriangle size={22} className="text-amber-600 shrink-0" />
          <div>
            <h3 className="font-semibold text-amber-900">
              Angajat cu același CNP există deja
            </h3>
            <p className="text-sm text-amber-700">
              Sistemul a detectat un duplicat
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-3">
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Nume</span>
              <span className="text-sm font-medium text-gray-900">
                {existing.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">CNP</span>
              <span className="text-sm font-mono text-gray-700">
                {existing.cnp}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Status</span>
              <StatusBadge status={existing.status} />
            </div>
          </div>

          <p className="text-sm text-gray-500">
            Dacă este aceeași persoană, verifică profilul existent. Dacă este o
            eroare de CNP, contactează administratorul.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium text-gray-700 hover:bg-white transition-colors"
          >
            Anulează
          </button>

          <Link
            href={`/angajati/${existing.id}`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <Eye size={16} />
            Vezi profil
          </Link>

          {isAdmin && (
            <button
              onClick={onContinueAnyway}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-amber-300 text-amber-800 text-sm font-medium hover:bg-amber-50 transition-colors"
            >
              <ShieldCheck size={16} />
              Continuă
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    ACTIVE: { bg: "bg-green-100", text: "text-green-700", label: "Activ" },
    TERMINATED: { bg: "bg-red-100", text: "text-red-700", label: "Terminat" },
  };
  const c = config[status] ?? { bg: "bg-gray-100", text: "text-gray-700", label: status };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
