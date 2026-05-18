"use client";

import type { ImportRowResult } from "@/app/api/employees/import/route";
import { mapSpreadsheetRowToImportItem } from "@/lib/parsers/employeeSpreadsheetMap";
import type { ParsedEmployeeSpreadsheetRow } from "@/lib/parsers/employeeSpreadsheetParser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSpreadsheetPreviewMissingFields } from "@/lib/parsers/importEmployeeNormalize";
import { ROUTES } from "@/lib/routes";
import { AlertCircle, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export type SpreadsheetEmployeeRow = ParsedEmployeeSpreadsheetRow;

type SpreadsheetUploadResponse = {
  success?: boolean;
  employees?: SpreadsheetEmployeeRow[];
  data?: SpreadsheetEmployeeRow[];
  preview?: SpreadsheetEmployeeRow[];
  rowCount?: number;
  sheetsParsed?: number;
  sheetCount?: number;
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

const IMPORT_BATCH_SIZE = 500;

function ImportRowStatusCell({ row }: { row: SpreadsheetEmployeeRow }) {
  const lipsa = getSpreadsheetPreviewMissingFields(row);

  if (lipsa.length === 0) {
    return (
      <Badge
        variant="outline"
        className="bg-green-50 text-green-700 text-[10px] whitespace-nowrap"
      >
        Complet
      </Badge>
    );
  }

  return (
    <span
      className="inline-block cursor-help"
      title={`Lipseste: ${lipsa.join(", ")}`}
    >
      <Badge
        variant="outline"
        className="bg-amber-50 text-amber-800 text-[10px] whitespace-nowrap"
      >
        Incomplet ({lipsa.length})
      </Badge>
    </span>
  );
}

export function EmployeeSpreadsheetImportClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [employees, setEmployees] = useState<SpreadsheetEmployeeRow[]>([]);
  const [companyId, setCompanyId] = useState("1");
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [createCompaniesFromSheets, setCreateCompaniesFromSheets] =
    useState(false);
  const [companiesSummary, setCompaniesSummary] = useState<{
    existing: string[];
    created: string[];
    missing: string[];
  } | null>(null);
  const [previewResults, setPreviewResults] = useState<ImportRowResult[] | null>(
    null,
  );

  const sheetCompanyNames = useMemo(() => {
    const names = new Set<string>();
    for (const row of employees) {
      const s = row.sourceSheet?.trim();
      if (s) names.add(s);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "ro"));
  }, [employees]);

  const hasSheetCompanies = sheetCompanyNames.length > 0;

  async function loadCompanies() {
    try {
      const res = await fetch("/api/organization/companies?all=1");
      const d = (await res.json()) as {
        companies?: { id: number; name: string }[];
      };
      const list = d.companies ?? [];
      setCompanies(list);
      if (list[0] && !companyId) setCompanyId(String(list[0].id));
    } catch {
      // silent
    }
  }

  useEffect(() => {
    void loadCompanies();
  }, []);

  useEffect(() => {
    if (hasSheetCompanies) setCreateCompaniesFromSheets(true);
  }, [hasSheetCompanies]);

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
    setCompaniesSummary(null);

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
        const sheetInfo =
          typeof data.sheetsParsed === "number" && data.sheetCount
            ? ` (${data.sheetsParsed} foi din ${data.sheetCount})`
            : "";
        toast.success(
          `S-au extras ${rows.length} angajati din fisier${sheetInfo}.`,
        );
      }
    } catch {
      setError("Eroare de retea. Incearca din nou.");
    } finally {
      setUploading(false);
    }
  }

  function buildImportItems() {
    const cid = Number.parseInt(companyId, 10);
    const resolvedCompanyId = Number.isFinite(cid) && cid > 0 ? cid : 1;
    return employees.map((row) =>
      mapSpreadsheetRowToImportItem(row, resolvedCompanyId),
    );
  }

  async function postImportBatch(
    items: ReturnType<typeof buildImportItems>,
    mode: "preview" | "commit",
  ) {
    const res = await fetch("/api/employees/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        items,
        createCompaniesFromSheets:
          createCompaniesFromSheets && hasSheetCompanies,
        fallbackCompanyId: Number.parseInt(companyId, 10) || undefined,
      }),
    });
    const data = await res.json();
    return { res, data };
  }

  async function handleSaveAll() {
    if (employees.length === 0) return;

    const allItems = buildImportItems();
    const totalCount = allItems.length;

    setIsSaving(true);
    setSavedCount(0);
    setFailedCount(0);
    setError("");
    setPreviewResults(null);

    let success = 0;
    let failed = 0;
    let processed = 0;

    try {
      for (let offset = 0; offset < allItems.length; offset += IMPORT_BATCH_SIZE) {
        const chunk = allItems.slice(offset, offset + IMPORT_BATCH_SIZE);
        const { res, data } = await postImportBatch(chunk, "commit");

        if (data.companies) {
          setCompaniesSummary(data.companies as typeof companiesSummary);
        }

        if (!res.ok) {
          failed += chunk.length;
          processed += chunk.length;
          setSavedCount(processed);
          setFailedCount(failed);
          const errMsg =
            typeof data.error === "string"
              ? data.error
              : "Eroare la salvarea unui lot de angajati";
          setError(errMsg);
          continue;
        }

        const results = (data.results ?? []) as ImportRowResult[];
        for (const r of results) {
          if (r.result === "CREATED" || r.result === "UPDATED") success++;
          else if (r.result === "ERROR") failed++;
          else if (r.result === "REVIEW_REQUIRED") failed++;
        }

        processed += chunk.length;
        setSavedCount(processed);
        setFailedCount(failed);
      }

      if (success > 0) {
        const createdCo =
          (companiesSummary?.created.length ?? 0) > 0
            ? ` Firme create: ${companiesSummary!.created.length}.`
            : "";
        toast.success(`Salvati: ${success}, Esuati: ${failed}`, {
          description: `Total procesati: ${totalCount}.${createdCo}`,
        });
        await loadCompanies();
        if (failed === 0) {
          setEmployees([]);
          setFile(null);
        }
      } else if (failed > 0) {
        toast.error(`Niciun angajat salvat. Esuati: ${failed}`);
      }
    } catch {
      setError("Eroare de retea la salvare.");
      toast.error("Eroare de retea la salvare.");
    } finally {
      setIsSaving(false);
    }
  }

  async function runImport(mode: "preview" | "commit") {
    if (employees.length === 0) {
      setError("Nu exista angajati de importat.");
      return;
    }

    setImporting(true);
    setError("");

    try {
      const { res, data } = await postImportBatch(buildImportItems(), mode);

      if (data.companies) {
        setCompaniesSummary(data.companies as typeof companiesSummary);
      }

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
        const co = data.companies as typeof companiesSummary;
        const coHint =
          co && co.missing.length > 0
            ? ` ${co.missing.length} firme noi la import.`
            : "";
        toast.success("Previzualizare gata", {
          description: `${data.stats?.created ?? 0} noi, ${data.stats?.updated ?? 0} actualizari, ${data.stats?.review ?? 0} de revizuit.${coHint}`,
        });
        return;
      }

      const createdCo =
        (data.companies as { created?: string[] } | undefined)?.created
          ?.length ?? 0;
      toast.success("Import finalizat", {
        description: `${data.stats?.created ?? 0} creati, ${data.stats?.updated ?? 0} actualizati.${createdCo > 0 ? ` Firme create: ${createdCo}.` : ""}`,
      });
      await loadCompanies();
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
          Excel cu mai multe foi (HTC, BAKKER, etc.) — se citesc toate foile.
          Coloane: NUME, CNP, ADRESA, FUNCTIA, SALAR NEGOCIAT, DATA ANG., DATA
          INC., BSN, POSTED W., A1, CONT., DECIZIE, CI, FISA APP+PSI.
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
            <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
              {hasSheetCompanies ? (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={createCompaniesFromSheets}
                    onChange={(e) =>
                      setCreateCompaniesFromSheets(e.target.checked)
                    }
                    className="rounded border-gray-300"
                  />
                  Creeaza firme din foile Excel
                </label>
              ) : null}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">
                  {createCompaniesFromSheets && hasSheetCompanies
                    ? "Firma (fallback)"
                    : "Firma"}
                </label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  disabled={
                    createCompaniesFromSheets && hasSheetCompanies
                  }
                  className="rounded-lg border bg-white px-3 py-1.5 text-sm disabled:bg-gray-100"
                >
                {companies.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
                </select>
              </div>
            </div>
          </div>

          {hasSheetCompanies && createCompaniesFromSheets ? (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <p className="font-medium">
                {sheetCompanyNames.length} firme din foile Excel
              </p>
              <p className="mt-1 text-xs text-blue-800">
                {sheetCompanyNames.join(", ")}
              </p>
              <p className="mt-1 text-xs text-blue-700">
                La import, fiecare angajat este asignat firmei cu acelasi nume
                ca foaia. Firmele lipsa se creeaza automat.
              </p>
            </div>
          ) : null}

          {companiesSummary ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              <p className="font-medium">Firme</p>
              {companiesSummary.created.length > 0 ? (
                <p className="mt-1">
                  Create: {companiesSummary.created.join(", ")}
                </p>
              ) : null}
              {companiesSummary.existing.length > 0 ? (
                <p className="mt-1 text-slate-600">
                  Existente: {companiesSummary.existing.join(", ")}
                </p>
              ) : null}
              {companiesSummary.missing.length > 0 ? (
                <p className="mt-1 text-amber-800">
                  Vor fi create la import:{" "}
                  {companiesSummary.missing.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-600">
                  <th className="px-2 py-2">#</th>
                  {employees.some((r) => r.sourceSheet) ? (
                    <th className="px-2 py-2">Foaie</th>
                  ) : null}
                  <th className="px-2 py-2">Nume</th>
                  <th className="px-2 py-2">Prenume</th>
                  <th className="px-2 py-2">CNP</th>
                  <th className="px-2 py-2">Functie</th>
                  <th className="px-2 py-2">Salariu</th>
                  <th className="px-2 py-2">Angajare</th>
                  <th className="px-2 py-2">Stare</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((row) => (
                  <tr
                    key={`${row.sourceSheet ?? ""}-${row.rowIndex}-${row.cnp}`}
                    className="border-b border-gray-100"
                  >
                    <td className="px-2 py-2 text-gray-500">{row.rowIndex}</td>
                    {employees.some((r) => r.sourceSheet) ? (
                      <td className="px-2 py-2 text-xs text-gray-600">
                        {row.sourceSheet ?? "\u2014"}
                      </td>
                    ) : null}
                    <td className="px-2 py-2">{row.lastName}</td>
                    <td className="px-2 py-2">{row.firstName}</td>
                    <td className="px-2 py-2 font-mono text-xs">{row.cnp}</td>
                    <td className="px-2 py-2">{row.position ?? "\u2014"}</td>
                    <td className="px-2 py-2">{row.salary ?? "\u2014"}</td>
                    <td className="px-2 py-2 text-xs">
                      {row.hiredAt ?? "\u2014"}
                    </td>
                    <td className="px-2 py-2 text-xs">
                      {row.terminationDate ? "Incetat" : "Activ"}
                    </td>
                    <td className="px-2 py-2">
                      <ImportRowStatusCell row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            type="button"
            className="w-full"
            disabled={isSaving || importing}
            onClick={() => void handleSaveAll()}
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="mr-2 inline animate-spin" />
                Se salveaza... ({savedCount}/{employees.length})
                {failedCount > 0 ? `, esuate: ${failedCount}` : ""}
              </>
            ) : (
              `Salveaza toti ${employees.length} angajatii`
            )}
          </Button>

          <p className="text-center text-xs text-gray-500">
            Se salveaza toti angajatii extrasi, inclusiv cei cu date incomplete
            (fara prenume, fara CNP etc.).
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={importing || isSaving}
              onClick={() => void runImport("preview")}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {importing ? (
                <Loader2 size={14} className="inline animate-spin" />
              ) : null}{" "}
              Previzualizare import
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

