"use client";

import type { ImportRowResult } from "@/app/api/employees/import/route";
import { ROUTES } from "@/lib/routes";
import { AlertCircle, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export type SpreadsheetEmployeeRow = {
  rowIndex: number;
  lastName: string;
  firstName: string;
  cnp: string;
  position?: string;
  salary?: string;
  email?: string;
  phone?: string;
  iban?: string;
  bankName?: string;
  address?: string;
  city?: string;
};

type SpreadsheetUploadResponse = {
  success?: boolean;
  employees?: SpreadsheetEmployeeRow[];
  data?: SpreadsheetEmployeeRow[];
  preview?: SpreadsheetEmployeeRow[];
  rowCount?: number;
  warnings?: string[];
  error?: string;
};

function pickEmployeesFromResponse(
  data: SpreadsheetUploadResponse,
): SpreadsheetEmployeeRow[] {
  const list =
    data.employees ?? data.preview ?? data.data ?? ([] as SpreadsheetEmployeeRow[]);
  return Array.isArray(list) ? list : [];
}

export function EmployeeSpreadsheetImportClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [employees, setEmployees] = useState<SpreadsheetEmployeeRow[]>([]);
  const [companyId, setCompanyId] = useState("1");
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [previewResults, setPreviewResults] = useState<ImportRowResult[] | null>(
    null,
  );

  useEffect(() => {
    fetch("/api/organization/companies")
      .then((r) => r.json())
      .then((d: { companies?: { id: number; name: string }[] }) => {
        const list = d.companies ?? [];
        setCompanies(list);
        if (list[0]) setCompanyId(String(list[0].id));
      })
      .catch(() => undefined);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      setError("");
      setEmployees([]);
      setPreviewResults(null);
    }
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setError("");
      setEmployees([]);
      setPreviewResults(null);
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError("");
    setWarnings([]);
    setEmployees([]);
    setPreviewResults(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import/spreadsheet", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as SpreadsheetUploadResponse;

      if (!res.ok) {
        setError(data.error ?? "Eroare la procesare");
        return;
      }

      const rows = pickEmployeesFromResponse(data);
      setEmployees(rows);
      setWarnings(data.warnings ?? []);

      if (rows.length === 0) {
        toast.warning("Fisier incarcat, dar nu s-au extras angajati.", {
          description:
            data.warnings?.join(" ") ||
            "Verifica antetul: Nume, Prenume, CNP.",
        });
      } else {
        toast.success(`S-au extras ${rows.length} angajati din fisier.`);
      }
    } catch {
      setError("Eroare de retea. Incearca din nou.");
    } finally {
      setUploading(false);
    }
  }

  function buildImportItems() {
    const cid = Number.parseInt(companyId, 10);
    return employees.map((row) => ({
      cnp: row.cnp.replace(/\D/g, ""),
      firstName: row.firstName === "\u2014" ? "" : row.firstName,
      lastName: row.lastName === "\u2014" ? "" : row.lastName,
      email: row.email ?? null,
      phone: row.phone ?? null,
      iban: row.iban ?? null,
      bankName: row.bankName ?? null,
      address: row.address ?? null,
      city: row.city ?? null,
      companyId: Number.isFinite(cid) && cid > 0 ? cid : 1,
    }));
  }

  async function runImport(mode: "preview" | "commit") {
    if (employees.length === 0) {
      setError("Nu exista angajati de importat.");
      return;
    }

    setImporting(true);
    setError("");

    try {
      const res = await fetch("/api/employees/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, items: buildImportItems() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Import esuat");
        if (data.issues) {
          toast.error("Date invalide in fisier", {
            description: "Verifica CNP-urile si campurile obligatorii.",
          });
        }
        return;
      }

      if (mode === "preview") {
        setPreviewResults((data.results ?? []) as ImportRowResult[]);
        toast.success("Previzualizare gata", {
          description: `${data.stats?.created ?? 0} noi, ${data.stats?.updated ?? 0} actualizari, ${data.stats?.review ?? 0} de revizuit.`,
        });
        return;
      }

      toast.success("Import finalizat", {
        description: `${data.stats?.created ?? 0} creati, ${data.stats?.updated ?? 0} actualizati.`,
      });
      setEmployees([]);
      setPreviewResults(null);
      setFile(null);
    } catch {
      setError("Eroare de retea la import.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href={ROUTES.imports}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          {"\u2190"} Inapoi la importuri
        </Link>
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Import angajati Excel / CSV
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Coloane: Nume, Prenume, CNP (obligatorii). Optional: Functie, Salariu,
          Email, Telefon, IBAN.
        </p>
      </div>

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
          uploading
            ? "cursor-not-allowed border-gray-200 bg-gray-50"
            : dragActive
              ? "scale-[1.01] border-slate-900 bg-slate-50"
              : file
                ? "border-green-300 bg-green-50"
                : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />

        {uploading ? (
          <div className="space-y-3">
            <Loader2
              size={40}
              className="mx-auto animate-spin text-slate-900"
            />
            <p className="font-medium text-gray-900">
              Se incarca si extrag datele...
            </p>
          </div>
        ) : file ? (
          <div className="space-y-3">
            <FileSpreadsheet size={40} className="mx-auto text-green-600" />
            <p className="font-medium text-gray-900">{file.name}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                setEmployees([]);
                setPreviewResults(null);
              }}
              className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
            >
              <X size={14} />
              Elimina
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload size={40} className="mx-auto text-gray-400" />
            <p className="font-medium text-gray-700">
              Trage fisierul aici sau click pentru a selecta
            </p>
            <p className="text-sm text-gray-400">Excel (.xlsx, .xls) sau CSV</p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="mb-1 font-medium">Avertismente</p>
          <ul className="list-inside list-disc space-y-0.5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {file && !uploading && employees.length === 0 && (
        <button
          type="button"
          onClick={handleUpload}
          className="w-full rounded-xl bg-slate-900 py-3 font-medium text-white transition-colors hover:bg-slate-800"
        >
          Incarca si extrage angajatii
        </button>
      )}

      {employees.length > 0 && (
        <div className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-gray-900">
              Angajati extrasi ({employees.length})
            </h2>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Firma</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="rounded-lg border bg-white px-3 py-1.5 text-sm"
              >
                {companies.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-600">
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Nume</th>
                  <th className="px-2 py-2">Prenume</th>
                  <th className="px-2 py-2">CNP</th>
                  <th className="px-2 py-2">Functie</th>
                  <th className="px-2 py-2">Salariu</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((row) => (
                  <tr key={row.rowIndex} className="border-b border-gray-100">
                    <td className="px-2 py-2 text-gray-500">{row.rowIndex}</td>
                    <td className="px-2 py-2">{row.lastName}</td>
                    <td className="px-2 py-2">{row.firstName}</td>
                    <td className="px-2 py-2 font-mono text-xs">{row.cnp}</td>
                    <td className="px-2 py-2">{row.position ?? "\u2014"}</td>
                    <td className="px-2 py-2">{row.salary ?? "\u2014"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={importing}
              onClick={() => runImport("preview")}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {importing ? (
                <Loader2 size={14} className="inline animate-spin" />
              ) : null}{" "}
              Previzualizare import
            </button>
            <button
              type="button"
              disabled={importing}
              onClick={() => runImport("commit")}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Importa in sistem
            </button>
          </div>

          {previewResults && previewResults.length > 0 && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="mb-2 font-medium text-slate-800">
                Rezultat previzualizare
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {previewResults.map((r) => (
                  <li key={`${r.index}-${r.cnp}`} className="text-slate-700">
                    {r.cnp}: {r.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

