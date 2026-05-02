"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Upload, FileText, X, CheckCircle2, AlertCircle, FileImage } from "lucide-react";
import {
  DOCUMENT_TYPE_OPTIONS,
  isValidDocumentType,
  type DocumentType,
} from "@/lib/documentConstants";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import { calculateStatus } from "@/lib/documentStatus";
import { notifyDocumentsChanged } from "@/lib/documentsSync";

interface EmployeeOption {
  id: number;
  firstName: string;
  lastName: string;
}

interface DocumentUploadProps {
  /**
   * Dacă e setat și > 0 — același flux ca pe /angajati/[id] (angajat fix).
   * Dacă lipsește sau e ≤ 0 — se afișează listă de selectare angajat (pagina /documente).
   */
  employeeId?: number;
  onSuccess?: () => void;
}

export function DocumentUpload({ employeeId: employeeIdProp, onSuccess }: DocumentUploadProps) {
  const fixedEmployeeId =
    employeeIdProp != null && employeeIdProp > 0 ? employeeIdProp : null;
  const needsEmployeePicker = fixedEmployeeId == null;

  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<DocumentType>("CONTRACT");
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeFieldError, setEmployeeFieldError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!needsEmployeePicker) return;
    let cancelled = false;
    setEmployeesLoading(true);
    setEmployeesError(null);
    const load = async () => {
      try {
        const all: EmployeeOption[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const params = new URLSearchParams({
            page: String(page),
            limit: "100",
            sortBy: "lastName",
            sortOrder: "asc",
            status: "ACTIVE",
          });
          const res = await fetch(`/api/employees?${params}`, {
            credentials: "include",
          });
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(err.error ?? "Nu s-a putut încărca lista de angajați");
          }
          const json = (await res.json()) as {
            data?: Array<{ id: number; firstName: string; lastName: string }>;
            totalPages?: number;
          };
          const chunk = json.data ?? [];
          for (const e of chunk) {
            all.push({
              id: e.id,
              firstName: e.firstName,
              lastName: e.lastName,
            });
          }
          totalPages = Math.max(1, Number(json.totalPages) || 1);
          page += 1;
        } while (page <= totalPages && page <= 20);
        if (!cancelled) setEmployees(all);
      } catch (e) {
        if (!cancelled) {
          setEmployees([]);
          setEmployeesError(e instanceof Error ? e.message : "Eroare la încărcare");
        }
      } finally {
        if (!cancelled) setEmployeesLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [needsEmployeePicker]);

  /** Valoare sigură pentru `<select>` — coduri DOCUMENT_TYPES, nu id numerice. */
  const documentTypeValue: DocumentType = isValidDocumentType(type)
    ? type
    : "CONTRACT";

  useEffect(() => {
    if (!isValidDocumentType(type)) setType("CONTRACT");
  }, [type]);

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => {
      const full = `${e.lastName} ${e.firstName} ${e.firstName} ${e.lastName}`.toLowerCase();
      return full.includes(q);
    });
  }, [employees, employeeSearch]);

  const previewStatus = expiryDate
    ? calculateStatus(new Date(expiryDate))
    : "PENDING";

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      setFile(e.dataTransfer.files[0]);
      setResult(null);
    }
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    if (needsEmployeePicker) {
      const trimmedSel = selectedEmployeeId.trim();
      if (!trimmedSel) {
        setEmployeeFieldError("Angajatul este obligatoriu");
        setResult(null);
        return;
      }
      setEmployeeFieldError(null);
    }

    const uploadEmployeeId = fixedEmployeeId ?? parseInt(selectedEmployeeId, 10);
    if (!uploadEmployeeId || Number.isNaN(uploadEmployeeId)) {
      setEmployeeFieldError("Angajatul este obligatoriu");
      setResult(null);
      return;
    }

    if (!number.trim()) {
      setResult({ success: false, message: "Completează numărul documentului." });
      return;
    }
    if (!issueDate) {
      setResult({ success: false, message: "Selectează data emiterii." });
      return;
    }
    if (!expiryDate) {
      setResult({ success: false, message: "Selectează data expirării." });
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("employeeId", String(uploadEmployeeId));
      formData.append("type", documentTypeValue);
      formData.append("number", number.trim());
      formData.append("issueDate", issueDate);
      formData.append("expiryDate", expiryDate);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        field?: string;
        fileName?: string;
      };

      if (res.ok) {
        setEmployeeFieldError(null);
        setResult({
          success: true,
          message: `Document „${data.fileName ?? "fișier"}" încărcat cu succes`,
        });
        setFile(null);
        setType("CONTRACT");
        setNumber("");
        setIssueDate("");
        setExpiryDate("");
        setSelectedEmployeeId("");
        setEmployeeSearch("");
        if (inputRef.current) inputRef.current.value = "";
        onSuccess?.();
        notifyDocumentsChanged();
      } else {
        if (data.field === "employeeId" && data.error) {
          setEmployeeFieldError(data.error);
          setResult(null);
        } else {
          setEmployeeFieldError(null);
          setResult({ success: false, message: data.error ?? "Eroare la upload" });
        }
      }
    } catch {
      setResult({ success: false, message: "Eroare de rețea" });
    } finally {
      setUploading(false);
    }
  }

  const isImage = file?.type.startsWith("image/");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Dropzone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragActive
            ? "border-slate-900 bg-slate-50"
            : "border-gray-300 hover:border-gray-400"
        } ${file ? "bg-green-50 border-green-300" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileSelect}
          className="hidden"
        />

        {file ? (
          <div className="flex items-center justify-center gap-3">
            {isImage ? (
              <FileImage size={24} className="text-green-600" />
            ) : (
              <FileText size={24} className="text-green-600" />
            )}
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
              className="p-1 rounded text-gray-400 hover:text-red-600"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <Upload size={32} className="mx-auto text-gray-400 mb-2" />
            <p className="text-sm font-medium text-gray-700">
              Drag & drop sau click pentru a selecta
            </p>
            <p className="text-xs text-gray-400 mt-1">
              PDF, JPG, PNG — maxim 50MB
            </p>
          </>
        )}
      </div>

      {needsEmployeePicker && (
        <div className="rounded-xl border-2 border-slate-300 bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <label
            htmlFor="upload-employee-select"
            className="mb-2 block text-sm font-semibold text-slate-900"
          >
            Angajat *
          </label>
          <p className="mb-3 text-xs text-slate-600">
            Selectați angajatul activ căruia îi aparține documentul (obligatoriu înainte de
            încărcare).
          </p>
          {employeesLoading ? (
            <div
              className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm text-slate-500"
              aria-busy="true"
            >
              Se încarcă angajații activi…
            </div>
          ) : employeesError ? (
            <p className="text-sm font-medium text-red-600" role="alert">
              {employeesError}
            </p>
          ) : employees.length === 0 ? (
            <p className="text-sm text-amber-800">
              Nu există angajați activi în sistem. Adăugați un angajat sau activați unul
              existent.
            </p>
          ) : (
            <>
              <input
                type="search"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Filtrați după nume…"
                className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-slate-400 focus:ring-2"
                aria-label="Filtru nume angajat"
              />
              <select
                id="upload-employee-select"
                value={selectedEmployeeId}
                onChange={(e) => {
                  setSelectedEmployeeId(e.target.value);
                  setEmployeeFieldError(null);
                  setResult(null);
                }}
                className={`w-full rounded-lg border bg-white px-3 py-3 text-sm font-medium text-slate-900 shadow-inner outline-none focus:ring-2 focus:ring-slate-900 ${
                  employeeFieldError ? "border-red-400 ring-1 ring-red-200" : "border-slate-300"
                }`}
                aria-invalid={employeeFieldError ? "true" : "false"}
                aria-describedby={
                  employeeFieldError ? "upload-employee-error" : undefined
                }
              >
                <option value="">Selectați angajatul</option>
                {filteredEmployees.map((emp) => (
                  <option key={emp.id} value={String(emp.id)}>
                    {emp.lastName} {emp.firstName}
                  </option>
                ))}
              </select>
              {employeeFieldError && (
                <p
                  id="upload-employee-error"
                  className="mt-2 text-sm font-medium text-red-600"
                  role="alert"
                >
                  {employeeFieldError}
                </p>
              )}
              {employeeSearch.trim() && filteredEmployees.length === 0 && (
                <p className="mt-2 text-xs text-slate-500">Niciun angajat nu se potrivește filtrului.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Form fields */}
      {file && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white rounded-xl border p-4">
          <div>
            <label
              htmlFor="upload-document-type"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Tip document *
            </label>
            <select
              id="upload-document-type"
              name="documentType"
              value={documentTypeValue}
              onChange={(e) => {
                const v = e.target.value;
                setType(isValidDocumentType(v) ? v : "CONTRACT");
              }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-950"
            >
              {DOCUMENT_TYPE_OPTIONS.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Număr document *
            </label>
            <input
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Ex: 123/2024"
              required
              className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data emitere *
            </label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data expirare *
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
            />
          </div>

          {expiryDate && (
            <div className="sm:col-span-2 flex items-center gap-2">
              <span className="text-sm text-gray-500">Status previzualizat:</span>
              <DocumentStatusBadge status={previewStatus} />
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      {file && (
        <button
          type="submit"
          disabled={uploading}
          className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {uploading ? "Se încarcă..." : "Încarcă document"}
        </button>
      )}

      {/* Result */}
      {result && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            result.success
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {result.success ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          {result.message}
        </div>
      )}
    </form>
  );
}
