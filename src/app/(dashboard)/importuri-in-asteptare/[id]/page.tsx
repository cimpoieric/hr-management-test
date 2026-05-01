"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Save,
  FileText,
  FileImage,
  Eye,
  ArrowLeft,
  Loader2,
  AlertCircle,
  UserCheck,
  UserPlus,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ExtractedField {
  value: string;
  confidence: number;
  source: string;
}

interface PendingImportDetail {
  id: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: string;
  confidenceScore: number;
  uncertainFields: string[];
  extractedFields: Record<string, ExtractedField>;
  rawText: string;
  duplicateEmployee: {
    id: number;
    name: string;
    cnp: string;
    status: string;
  } | null;
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
};

const FIELD_ORDER = [
  "cnp",
  "lastName",
  "firstName",
  "seriesCI",
  "numberCI",
  "email",
  "phone",
  "iban",
  "bankName",
  "position",
  "city",
  "address",
];

export default function ImportReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const importId = parseInt(params.id, 10);

  const [data, setData] = useState<PendingImportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [companyId, setCompanyId] = useState("1");
  const [saving, setSaving] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [action, setAction] = useState<"" | "APPROVE" | "DRAFT" | "REJECT">("");

  useEffect(() => {
    fetch(`/api/import/pending/${importId}`)
      .then((res) => res.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          setLoading(false);
          return;
        }
        setData(d);
        // Inițializează editedValues cu valorile extrase
        const initial: Record<string, string> = {};
        for (const [key, field] of Object.entries(d.extractedFields as Record<string, ExtractedField>)) {
          initial[key] = (field as ExtractedField).value;
        }
        setEditedValues(initial);
        setLoading(false);
      })
      .catch(() => {
        setError("Eroare la încărcare");
        setLoading(false);
      });
  }, [importId]);

  function updateField(key: string, value: string) {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(chosenAction: "APPROVE" | "DRAFT" | "REJECT") {
    setAction(chosenAction);

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
          router.push("/importuri");
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
          router.push(`/angajati/${d.employeeId}`);
        } else {
          router.push("/importuri");
        }
      } else if (res.status === 409 && d.error === "DUPLICATE_CNP") {
        setError(`CNP duplicat: ${d.message}`);
        setSaving(false);
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
          href="/importuri"
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/importuri"
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Review import #{data.id}
          </h1>
          <p className="text-sm text-gray-500">
            {data.fileName} · scor încredere: {" "}
            <span className={confidenceColor(data.confidenceScore)}>
              {Math.round(data.confidenceScore * 100)}%
            </span>
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coloana stângă: Preview + Raw text */}
        <div className="lg:col-span-1 space-y-4">
          {/* Document source */}
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
              <p className="text-xs text-gray-500 mt-1">
                {data.mimeType}
              </p>
            </div>
          </div>

          {/* Raw text */}
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <button
              onClick={() => setShowRawText(!showRawText)}
              className="flex items-center justify-between w-full"
            >
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Eye size={16} />
                Text extras
              </h3>
              {showRawText ? (
                <ChevronUp size={16} className="text-gray-400" />
              ) : (
                <ChevronDown size={16} className="text-gray-400" />
              )}
            </button>
            {showRawText && (
              <pre className="mt-3 text-xs text-gray-600 bg-gray-50 rounded-lg p-3 max-h-64 overflow-y-auto whitespace-pre-wrap">
                {data.rawText || "(niciun text extras)"}
              </pre>
            )}
          </div>

          {/* Verificare duplicat */}
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <UserCheck size={16} />
              Verificare duplicat
            </h3>
            {data.duplicateEmployee ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">
                      Angajat existent detectat
                    </p>
                    <p className="text-amber-700 mt-1">
                      {data.duplicateEmployee.name}
                    </p>
                    <p className="text-amber-600 text-xs">
                      CNP: {data.duplicateEmployee.cnp}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/angajati/${data.duplicateEmployee.id}`}
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

        {/* Coloana dreaptă: Date extrase + Acțiuni */}
        <div className="lg:col-span-2 space-y-4">
          {/* Date extrase */}
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
                      uncertain ? "bg-amber-50 border border-amber-200" : "bg-gray-50"
                    }`}
                  >
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      {FIELD_LABELS[key] ?? key}
                      {uncertain && (
                        <span title="Necesită verificare">
                          <AlertTriangle
                            size={12}
                            className="text-amber-500"
                          />
                        </span>
                      )}
                    </label>

                    <input
                      type="text"
                      value={value}
                      onChange={(e) => updateField(key, e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950 ${
                        uncertain ? "border-amber-300" : "border-gray-200"
                      }`}
                      placeholder={key === "cnp" ? "1881234567890" : ""}
                    />

                    <span
                      className={`text-xs font-medium text-right ${confidenceColor(
                        field?.confidence ?? 0
                      )}`}
                    >
                      {field?.confidence
                        ? `${Math.round(field.confidence * 100)}%`
                        : "—"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Firmă */}
            <div className="mt-4 grid grid-cols-[120px_1fr] gap-3 items-center p-3 rounded-lg bg-gray-50">
              <label className="text-sm font-medium text-gray-700">Firmă *</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
              >
                <option value="1">RomForce Detașări SRL</option>
                <option value="2">EuroWork HR Solutions</option>
                <option value="3">BuildTeam Internațional</option>
              </select>
            </div>
          </div>

          {/* Acțiuni */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => handleSubmit("APPROVE")}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {saving && action === "APPROVE" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              Aprobă și salvează
            </button>

            <button
              onClick={() => handleSubmit("DRAFT")}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {saving && action === "DRAFT" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Salvează ca draft
            </button>

            <button
              onClick={() => handleSubmit("REJECT")}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {saving && action === "REJECT" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <XCircle size={16} />
              )}
              Respinge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
