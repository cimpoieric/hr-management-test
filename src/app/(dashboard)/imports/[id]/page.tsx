"use client";

import {
  formatDateDotRo,
  isCimPlaceholder,
  parseCimDateToUtcDate,
  utcDateKey,
} from "@/lib/cimImportHelpers";
import { matchCountryId } from "@/lib/countryMatch";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FileImage,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface ExtractedField {
  value: string;
  confidence: number;
  source: string;
}

export type UpdateFieldKey =
  | "position"
  | "companyId"
  | "workNorm"
  | "deploymentCountry"
  | "contractStartDate"
  | "grossSalary"
  | "salaryCurrency"
  | "phone"
  | "email";

interface DuplicateSnapshot {
  id: number;
  name: string;
  cnp: string;
  status: string;
  position: string | null;
  companyId: number;
  companyName: string;
  countryId: number | null;
  countryName: string | null;
  workNorm: string | null;
  salaryAmount: number | null;
  salaryCurrency: string;
  salaryStartDate: string | null;
  hiredAt: string;
  phone: string | null;
  email: string | null;
}

interface PendingImportDetail {
  id: number;
  employeeId: number | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: string;
  confidenceScore: number;
  uncertainFields: string[];
  extractedFields: Record<string, ExtractedField>;
  rawText: string;
  duplicateEmployee: DuplicateSnapshot | null;
  companies: { id: number; name: string }[];
  countries: { id: number; name: string; code: string }[];
  createdAt: string;
}

const FIELD_LABELS: Record<string, string> = {
  cnp: "CNP",
  lastName: "Nume",
  firstName: "Prenume",
  seriesCI: "Serie CI",
  numberCI: "Număr CI",
  email: "Email",
  phone: "Telefon",
  iban: "IBAN",
  bankName: "Bancă",
  position: "Funcție",
  address: "Adresă",
  city: "Oraș",
  contractStartDate: "Data început activitate",
  workNorm: "Normă / timp de muncă",
  deploymentCountry: "Țară / loc muncă",
  grossSalary: "Salariu brut",
  salaryCurrency: "Monedă salarială",
};

function labelForExtractedField(key: string): string {
  if (key === "lastName") return "Nume";
  return FIELD_LABELS[key] ?? key;
}

const UPDATE_FIELD_LABELS: Record<UpdateFieldKey, string> = {
  position: "Funcție",
  companyId: "Firmă",
  workNorm: "Normă / timp de muncă",
  deploymentCountry: "Țară / loc muncă",
  contractStartDate: "Data început activitate",
  grossSalary: "Salariu brut",
  salaryCurrency: "Monedă salarială",
  phone: "Telefon",
  email: "Email",
};

const FIELD_ORDER = [
  "cnp",
  "lastName",
  "firstName",
  "seriesCI",
  "numberCI",
  "address",
  "city",
  "email",
  "phone",
  "iban",
  "bankName",
  "position",
  "contractStartDate",
  "workNorm",
  "deploymentCountry",
  "grossSalary",
  "salaryCurrency",
];

function trim(s: string | null | undefined) {
  return (s ?? "").trim();
}

/** Draft-ul salvează uneori valori plate; extragerea OCR folosește { value, confidence }. */
function stringFromExtractedEntry(entry: unknown): string {
  if (entry == null) return "";
  if (typeof entry === "string") return entry;
  if (typeof entry === "object" && entry !== null && "value" in entry) {
    return String((entry as ExtractedField).value ?? "");
  }
  return "";
}

function parseGrossNumber(s: string): number | null {
  const t = s.replace(/\s/g, "").replace(",", ".");
  if (!t || isCimPlaceholder(s)) return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function computeDiff(
  dup: DuplicateSnapshot,
  edited: Record<string, string>,
  companyIdStr: string,
  countries: { id: number; name: string }[],
  companies: { id: number; name: string }[],
): UpdateFieldKey[] {
  const out: UpdateFieldKey[] = [];

  const posNew = trim(edited.position);
  const posEff = posNew && !isCimPlaceholder(posNew) ? posNew : "";
  if (posEff !== trim(dup.position)) out.push("position");

  const cid = Number.parseInt(companyIdStr, 10);
  if (!Number.isNaN(cid) && cid !== dup.companyId) out.push("companyId");

  const wNew = trim(edited.workNorm);
  const wEff = wNew && !isCimPlaceholder(wNew) ? wNew : "";
  if (wEff !== trim(dup.workNorm)) out.push("workNorm");

  const dep = trim(edited.deploymentCountry);
  if (dep && !isCimPlaceholder(dep)) {
    const newId = matchCountryId(dep, countries);
    if (newId !== dup.countryId) out.push("deploymentCountry");
  }

  const nd = parseCimDateToUtcDate(edited.contractStartDate);
  const oldRef = dup.salaryStartDate ?? dup.hiredAt;
  const oldK = utcDateKey(oldRef);
  const newK = utcDateKey(nd);
  if (nd && newK !== oldK) out.push("contractStartDate");

  const gNew = parseGrossNumber(trim(edited.grossSalary));
  const oldSal = dup.salaryAmount;
  if (gNew != null && oldSal !== gNew) out.push("grossSalary");

  const curNew = (trim(edited.salaryCurrency) || "RON").toUpperCase();
  const curOld = (trim(dup.salaryCurrency) || "RON").toUpperCase();
  if (curNew !== curOld) out.push("salaryCurrency");

  const phNew = trim(edited.phone);
  const phEff = phNew && !isCimPlaceholder(phNew) ? phNew : "";
  if (phEff !== trim(dup.phone)) out.push("phone");

  const emNew = trim(edited.email);
  const emEff = emNew && !isCimPlaceholder(emNew) ? emNew : "";
  if (emEff !== trim(dup.email)) out.push("email");

  return out;
}

function formatDisplayForKey(
  key: UpdateFieldKey,
  dup: DuplicateSnapshot,
  edited: Record<string, string>,
  companyIdStr: string,
  countries: { id: number; name: string }[],
  companies: { id: number; name: string }[],
): { oldLabel: string; newLabel: string } {
  switch (key) {
    case "position":
      return {
        oldLabel: trim(dup.position) || "—",
        newLabel: trim(edited.position) || "—",
      };
    case "companyId": {
      const cid = Number.parseInt(companyIdStr, 10);
      const newName = companies.find((c) => c.id === cid)?.name ?? companyIdStr;
      return { oldLabel: dup.companyName, newLabel: newName };
    }
    case "workNorm":
      return {
        oldLabel: trim(dup.workNorm) || "—",
        newLabel: trim(edited.workNorm) || "—",
      };
    case "deploymentCountry": {
      const dep = trim(edited.deploymentCountry);
      const resolved = dep ? matchCountryId(dep, countries) : null;
      const newName = resolved
        ? (countries.find((c) => c.id === resolved)?.name ?? "—")
        : "—";
      return { oldLabel: dup.countryName ?? "—", newLabel: newName };
    }
    case "contractStartDate":
      return {
        oldLabel: formatDateDotRo(dup.salaryStartDate ?? dup.hiredAt),
        newLabel: formatDateDotRo(
          parseCimDateToUtcDate(edited.contractStartDate),
        ),
      };
    case "grossSalary":
      return {
        oldLabel: dup.salaryAmount != null ? String(dup.salaryAmount) : "—",
        newLabel: trim(edited.grossSalary) || "—",
      };
    case "salaryCurrency":
      return {
        oldLabel: dup.salaryCurrency || "RON",
        newLabel: trim(edited.salaryCurrency) || "RON",
      };
    case "phone":
      return {
        oldLabel: trim(dup.phone) || "—",
        newLabel: trim(edited.phone) || "—",
      };
    case "email":
      return {
        oldLabel: trim(dup.email) || "—",
        newLabel: trim(edited.email) || "—",
      };
    default:
      return { oldLabel: "—", newLabel: "—" };
  }
}

export default function ImportReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const importId = Number.parseInt(params.id, 10);

  const [data, setData] = useState<PendingImportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [companyId, setCompanyId] = useState("1");
  const [saving, setSaving] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [action, setAction] = useState<"" | "APPROVE" | "DRAFT" | "REJECT">("");
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [modalDiff, setModalDiff] = useState<UpdateFieldKey[]>([]);
  const [modalChecked, setModalChecked] = useState<Record<string, boolean>>({});
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetch(`/api/import/pending/${importId}`)
      .then((res) => res.json())
      .then((d: PendingImportDetail & { error?: string }) => {
        if (d.error) {
          setError(d.error);
          setLoading(false);
          return;
        }
        setData(d);
        const initial: Record<string, string> = {};
        for (const [key, field] of Object.entries(
          d.extractedFields as Record<string, unknown>,
        )) {
          initial[key] = stringFromExtractedEntry(field);
        }
        setEditedValues(initial);
        if (d.companies?.length) {
          const firstCo = d.companies[0];
          const pref =
            d.duplicateEmployee?.companyId != null
              ? String(d.duplicateEmployee.companyId)
              : firstCo
                ? String(firstCo.id)
                : "1";
          setCompanyId(pref);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Eroare la încărcare");
        setLoading(false);
      });
  }, [importId]);

  const updateField = useCallback((key: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const openUpdateModal = useCallback(() => {
    if (!data?.duplicateEmployee || !data.countries?.length) return;
    const diff = computeDiff(
      data.duplicateEmployee,
      editedValues,
      companyId,
      data.countries,
      data.companies ?? [],
    );
    if (diff.length === 0) {
      toast.message("Nu există modificări de actualizat", {
        description:
          "Datele din CIM coincid cu angajatul existent. Poți respinge importul sau salva ca draft.",
      });
      return;
    }
    setModalDiff(diff);
    const init: Record<string, boolean> = {};
    for (const k of diff) init[k] = true;
    setModalChecked(init);
    setShowUpdateModal(true);
  }, [data, editedValues, companyId]);

  const confirmUpdate = useCallback(async () => {
    if (!data?.duplicateEmployee) return;
    const selected = modalDiff.filter((k) => modalChecked[k]);
    if (selected.length === 0) {
      toast.error("Selectează cel puțin un câmp de actualizat.");
      return;
    }
    setUpdating(true);
    try {
      const res = await fetch(
        `/api/employees/${data.duplicateEmployee.id}/update-from-import`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            importId: data.id,
            selectedFields: selected,
            editedFields: { ...editedValues, companyId },
          }),
        },
      );
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Angajat actualizat cu succes");
        setShowUpdateModal(false);
        router.push(ROUTES.employees);
        return;
      }
      if (res.status === 409 && d.error === "NO_CHANGES") {
        toast.message("Nu există modificări de aplicat", {
          description: "Dezactivează câmpurile identice sau verifică datele.",
        });
      } else {
        toast.error(
          typeof d.message === "string"
            ? d.message
            : (d.error ?? "Eroare la actualizare"),
        );
      }
    } catch {
      toast.error("Eroare de rețea");
    } finally {
      setUpdating(false);
    }
  }, [data, modalDiff, modalChecked, editedValues, companyId, router]);

  async function handleSubmit(chosenAction: "APPROVE" | "DRAFT" | "REJECT") {
    setAction(chosenAction);

    if (chosenAction === "APPROVE" && data?.duplicateEmployee) {
      setAction("");
      return;
    }

    if (chosenAction === "REJECT") {
      if (!confirm("Ești sigur că vrei să respingi acest import?")) {
        setAction("");
        return;
      }
      setSaving(true);
      try {
        const res = await fetch(`/api/import/pending/${importId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          router.push(ROUTES.imports);
        } else {
          const d = await res.json();
          setError(d.error ?? "Eroare");
          setSaving(false);
        }
      } catch {
        setError("Eroare de rețea");
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      const payload = {
        action: chosenAction,
        fields: { ...editedValues, companyId },
      };

      const res = await fetch(`/api/import/pending/${importId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const d = await res.json();

      if (res.ok) {
        if (chosenAction === "APPROVE" && d.employeeId) {
          router.push(`${ROUTES.employees}/${d.employeeId}`);
        } else {
          router.push(ROUTES.imports);
        }
      } else if (res.status === 409 && d.error === "DUPLICATE_CNP") {
        setSaving(false);
        setAction("");
      } else {
        setError(d.error ?? "Eroare la salvare");
        setSaving(false);
      }
    } catch {
      setError("Eroare de rețea");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
        <p className="text-red-600">{error}</p>
        <Link
          href={ROUTES.imports}
          className="mt-4 inline-flex items-center gap-2 text-sm text-slate-900 hover:underline"
        >
          <ArrowLeft size={14} />
          Înapoi la importuri
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const isUncertain = (key: string) => data.uncertainFields.includes(key);
  const confidenceColor = (conf: number) => {
    if (conf >= 0.9) return "text-green-600";
    if (conf >= 0.7) return "text-amber-600";
    return "text-red-600";
  };

  const importLocked =
    data.status === "COMPLETED_UPDATE" || data.status === "APPROVED";
  const hasDuplicate = Boolean(data.duplicateEmployee);
  const companies = data.companies ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={ROUTES.imports}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          title="Înapoi la lista de importuri"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Revizuire import #{data.id}
          </h1>
          <p className="text-sm text-gray-500">
            {data.fileName} · scor încredere:{" "}
            <span className={confidenceColor(data.confidenceScore)}>
              {Math.round(data.confidenceScore * 100)}%
            </span>
          </p>
        </div>
      </div>

      {data.status === "COMPLETED_UPDATE" && (
        <div className="flex items-start gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-900">
          <CheckCircle2
            size={18}
            className="shrink-0 mt-0.5 text-emerald-600"
          />
          <div>
            <p className="font-medium">Actualizat</p>
            <p className="mt-1 text-emerald-800">
              Acest import a fost folosit pentru actualizarea unui angajat
              existent.
            </p>
            {data.employeeId != null && (
              <Link
                href={`${ROUTES.employees}/${data.employeeId}`}
                className="inline-block mt-2 text-sm font-medium text-emerald-950 underline"
              >
                Deschide fișa angajatului
              </Link>
            )}
          </div>
        </div>
      )}

      {data.status === "APPROVED" && (
        <div className="flex items-start gap-2 p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-900">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Import aprobat</p>
            {data.employeeId != null && (
              <Link
                href={`${ROUTES.employees}/${data.employeeId}`}
                className="inline-block mt-2 text-sm font-medium underline"
              >
                Vezi angajatul creat
              </Link>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileText size={16} />
              Document sursă
            </h3>
            <div className="bg-gray-100 rounded-lg p-4 text-center">
              {data.mimeType.startsWith("image/") ? (
                <FileImage size={48} className="mx-auto text-gray-400 mb-2" />
              ) : (
                <FileText size={48} className="mx-auto text-gray-400 mb-2" />
              )}
              <p className="text-sm font-medium text-gray-700 truncate">
                {data.fileName}
              </p>
              <p className="text-xs text-gray-500 mt-1">{data.mimeType}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-4">
            <button
              type="button"
              onClick={() => setShowRawText(!showRawText)}
              className="flex items-center justify-between w-full"
            >
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Eye size={16} />
                Text extras
              </h3>
              <span className="inline-flex shrink-0">
                <span className={cn(!showRawText && "hidden")}>
                  <ChevronUp size={16} className="text-gray-400" />
                </span>
                <span className={cn(showRawText && "hidden")}>
                  <ChevronDown size={16} className="text-gray-400" />
                </span>
              </span>
            </button>
            {showRawText && (
              <pre className="mt-3 text-xs text-gray-600 bg-gray-50 rounded-lg p-3 max-h-64 overflow-y-auto whitespace-pre-wrap">
                {data.rawText || "(niciun text extras)"}
              </pre>
            )}
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <UserCheck size={16} />
              Verificare duplicat
            </h3>
            {data.duplicateEmployee ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle
                    size={16}
                    className="text-amber-600 shrink-0 mt-0.5"
                  />
                  <div className="text-sm">
                    <p className="font-medium text-amber-900">
                      Angajat existent detectat
                    </p>
                    <p className="text-amber-800 mt-1 font-medium">
                      Nume existent: {data.duplicateEmployee.name}
                    </p>
                    <p className="text-amber-700 text-xs mt-1">
                      CNP: {data.duplicateEmployee.cnp}
                    </p>
                  </div>
                </div>
                <Link
                  href={`${ROUTES.employees}/${data.duplicateEmployee.id}`}
                  className="block w-full text-center py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Vezi profil existent
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                <CheckCircle2 size={16} />
                Niciun duplicat detectat
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText size={16} />
              Date extrase
              {data.uncertainFields.length > 0 && (
                <span className="text-xs font-normal text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                  {data.uncertainFields.length} câmpuri necesită verificare
                </span>
              )}
            </h3>

            <div className="space-y-3">
              {FIELD_ORDER.map((key) => {
                const field = data.extractedFields[key];
                const uncertain = isUncertain(key);
                const value = editedValues[key] ?? "";

                return (
                  <div
                    key={key}
                    className={`grid grid-cols-[120px_1fr_80px] gap-3 items-center p-3 rounded-lg ${
                      uncertain
                        ? "bg-amber-50 border border-amber-200"
                        : "bg-gray-50"
                    }`}
                  >
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      {labelForExtractedField(key)}
                      {uncertain && (
                        <span title="Necesită verificare">
                          <AlertTriangle size={12} className="text-amber-500" />
                        </span>
                      )}
                    </label>

                    <input
                      type="text"
                      value={value}
                      onChange={(e) => updateField(key, e.target.value)}
                      disabled={importLocked}
                      className={`w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950 disabled:opacity-60 ${
                        uncertain ? "border-amber-300" : "border-gray-200"
                      }`}
                      placeholder={key === "cnp" ? "1881234567890" : ""}
                    />

                    <span
                      className={`text-xs font-medium text-right ${confidenceColor(field?.confidence ?? 0)}`}
                    >
                      {field?.confidence
                        ? `${Math.round(field.confidence * 100)}%`
                        : "—"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-[120px_1fr] gap-3 items-center p-3 rounded-lg bg-gray-50">
              <label className="text-sm font-medium text-gray-700">
                Firmă *
              </label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                disabled={importLocked}
                className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950 disabled:opacity-60"
              >
                {companies.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleSubmit("APPROVE")}
              disabled={saving || importLocked || hasDuplicate}
              title={
                hasDuplicate
                  ? "CNP duplicat — folosește Actualizează angajat"
                  : undefined
              }
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              <span className="inline-flex items-center shrink-0">
                <span
                  className={cn(
                    "inline-flex",
                    !(saving && action === "APPROVE") && "hidden",
                  )}
                  aria-hidden={!(saving && action === "APPROVE")}
                >
                  <Loader2 size={16} className="animate-spin" />
                </span>
                <span
                  className={cn(
                    "inline-flex",
                    saving && action === "APPROVE" && "hidden",
                  )}
                  aria-hidden={Boolean(saving && action === "APPROVE")}
                >
                  <CheckCircle2 size={16} />
                </span>
              </span>
              Aprobă și salvează
            </button>

            <button
              type="button"
              onClick={openUpdateModal}
              disabled={saving || importLocked || !hasDuplicate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-amber-400 text-amber-800 bg-white text-sm font-medium hover:bg-amber-50 disabled:opacity-50 transition-colors"
            >
              <span className="inline-flex items-center shrink-0">
                <RefreshCw size={16} />
              </span>
              Actualizează angajat
            </button>

            <button
              type="button"
              onClick={() => handleSubmit("DRAFT")}
              disabled={saving || importLocked}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <span className="inline-flex items-center shrink-0">
                <span
                  className={cn(
                    "inline-flex",
                    !(saving && action === "DRAFT") && "hidden",
                  )}
                  aria-hidden={!(saving && action === "DRAFT")}
                >
                  <Loader2 size={16} className="animate-spin" />
                </span>
                <span
                  className={cn(
                    "inline-flex",
                    saving && action === "DRAFT" && "hidden",
                  )}
                  aria-hidden={Boolean(saving && action === "DRAFT")}
                >
                  <Save size={16} />
                </span>
              </span>
              Salvează ca draft
            </button>

            <button
              type="button"
              onClick={() => handleSubmit("REJECT")}
              disabled={saving || importLocked}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              <span className="inline-flex items-center shrink-0">
                <span
                  className={cn(
                    "inline-flex",
                    !(saving && action === "REJECT") && "hidden",
                  )}
                  aria-hidden={!(saving && action === "REJECT")}
                >
                  <Loader2 size={16} className="animate-spin" />
                </span>
                <span
                  className={cn(
                    "inline-flex",
                    saving && action === "REJECT" && "hidden",
                  )}
                  aria-hidden={Boolean(saving && action === "REJECT")}
                >
                  <XCircle size={16} />
                </span>
              </span>
              Respinge
            </button>
          </div>
        </div>
      </div>

      {showUpdateModal && data.duplicateEmployee && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="update-modal-title"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2
                id="update-modal-title"
                className="text-lg font-semibold text-gray-900"
              >
                Actualizează date angajat
              </h2>
              <button
                type="button"
                onClick={() => setShowUpdateModal(false)}
                className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
                aria-label="Închide"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4 text-sm">
              <div>
                <p className="text-gray-600">
                  <span className="font-medium text-gray-800">Angajat:</span>{" "}
                  {data.duplicateEmployee.name}
                </p>
                <p className="text-gray-600 mt-1">
                  <span className="font-medium text-gray-800">CNP:</span>{" "}
                  {data.duplicateEmployee.cnp}
                </p>
              </div>

              <p className="font-medium text-gray-800">
                Selecționează câmpurile de actualizat:
              </p>

              <ul className="space-y-3">
                {modalDiff.map((key) => {
                  const { oldLabel, newLabel } = formatDisplayForKey(
                    key,
                    data.duplicateEmployee!,
                    editedValues,
                    companyId,
                    data.countries,
                    companies,
                  );
                  return (
                    <li
                      key={key}
                      className="flex gap-3 items-start p-2 rounded-lg bg-amber-50/80 border border-amber-100"
                    >
                      <label className="flex gap-2 items-start cursor-pointer shrink-0 pt-0.5">
                        <input
                          type="checkbox"
                          checked={modalChecked[key] ?? false}
                          onChange={(e) =>
                            setModalChecked((prev) => ({
                              ...prev,
                              [key]: e.target.checked,
                            }))
                          }
                          className="mt-1 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="font-medium text-gray-800">
                          {UPDATE_FIELD_LABELS[key]}
                        </span>
                      </label>
                      <span className="text-gray-700 flex-1 min-w-0 break-words">
                        <span className="text-gray-500">{oldLabel}</span>
                        <span className="mx-1 text-amber-600">→</span>
                        <span className="text-gray-900 font-medium">
                          {newLabel}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              <button
                type="button"
                onClick={() => setShowUpdateModal(false)}
                className="px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-white"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={() => void confirmUpdate()}
                disabled={updating}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                <span
                  className={cn("inline-flex shrink-0", !updating && "hidden")}
                  aria-hidden={!updating}
                >
                  <Loader2 size={16} className="animate-spin" />
                </span>
                <span>Confirmă actualizarea</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
