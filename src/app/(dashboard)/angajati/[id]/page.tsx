"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Calculator,
  Download,
  Building2,
  MapPin,
  FileText,
  Phone,
  Mail,
  Calendar,
  Hash,
  Globe,
  StickyNote,
  Briefcase,
  CreditCard,
  Trash2,
} from "lucide-react";
import { EmployeeForm } from "@/components/employees/EmployeeForm";
import { DocumentList } from "@/components/documents/DocumentList";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { DeploymentForm } from "@/components/deployments/DeploymentForm";
import { DeploymentList } from "@/components/deployments/DeploymentList";
import { DeploymentTimeline } from "@/components/deployments/DeploymentTimeline";
import { SalaryCalculatorModal } from "@/components/salary/SalaryCalculatorModal";

type EmployeeDetail = {
  id: number;
  firstName: string;
  lastName: string;
  cnp: string;
  seriesCI?: string | null;
  numberCI?: string | null;
  email?: string | null;
  phone?: string | null;
  iban?: string | null;
  bankName?: string | null;
  position?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string;
  status: string;
  observations?: string | null;
  salaryType?: "LUNAR" | "SAPTAMANAL" | "ORA" | null;
  salaryAmount?: number | null;
  salaryCurrency?: string | null;
  salaryStartDate?: string | null;
  hiredAt?: string;
  createdAt?: string;
  updatedAt?: string;
  company?: { id: number; name: string; cui?: string | null } | null;
  deployments?: { id: number; country: string; city?: string | null; startDate: string; endDate?: string | null; status: string; notes?: string | null }[];
};

type SalaryCalculationItem = {
  id: number;
  salaryType: "LUNAR" | "SAPTAMANAL" | "ORA";
  salaryAmount: number;
  salaryCurrency: string;
  inputValue?: number | null;
  inputLabel?: string | null;
  calculatedTotal: number;
  createdAt: string;
};

const tabs = [
  { key: "info", label: "Informații" },
  { key: "documents", label: "Documente" },
  { key: "deployments", label: "Detașări" },
  { key: "history", label: "Istoric" },
];

export default function AngajatDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editMode = searchParams.get("edit") === "true";

  const employeeId = parseInt(params.id, 10);
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("info");
  const [docRefreshKey, setDocRefreshKey] = useState(0);
  const [depRefreshKey, setDepRefreshKey] = useState(0);
  const [salaryCalculatorOpen, setSalaryCalculatorOpen] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [exportingSheet, setExportingSheet] = useState(false);

  useEffect(() => {
    fetch(`/api/employees/${employeeId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          router.push("/angajati");
          return;
        }
        setEmployee(data);
      })
      .catch(() => router.push("/angajati"))
      .finally(() => setLoading(false));
  }, [employeeId, router]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
        Se încarcă...
      </div>
    );
  }

  if (!employee) return null;

  async function handleExportEmployeeSheet() {
    if (!employee) return;
    const currentEmployee = employee;
    setExportingSheet(true);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "fisa",
          title: `Fișă angajat — ${currentEmployee.lastName} ${currentEmployee.firstName}`,
          params: { employeeId },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.downloadUrl) {
        alert(data?.error ?? "Eroare la export fișă angajat");
        return;
      }

      const dl = await fetch(data.downloadUrl);
      if (!dl.ok) {
        alert("Fișa a fost generată, dar nu a putut fi descărcată.");
        return;
      }
      const blob = await dl.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fisa-angajat-${currentEmployee.lastName}-${currentEmployee.firstName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Eroare la export fișă angajat");
    } finally {
      setExportingSheet(false);
    }
  }

  if (editMode) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/angajati/${employeeId}`}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            Editează: {employee.lastName} {employee.firstName}
          </h1>
        </div>
        <EmployeeForm employeeId={employeeId} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/angajati"
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {employee.lastName} {employee.firstName}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <StatusBadge status={employee.status} />
              {employee.position && (
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <Briefcase size={14} />
                  {employee.position}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportEmployeeSheet}
            disabled={exportingSheet}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            {exportingSheet ? "Se exportă..." : "Export fișă angajat"}
          </button>
          <button
            type="button"
            onClick={() => setSalaryCalculatorOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Calculator size={16} />
            Calculează plată
          </button>
          <Link
            href={`/angajati/${employeeId}?edit=true`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Pencil size={16} />
            Editează
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "info" && <InfoTab employee={employee} />}
        {activeTab === "documents" && (
          <DocumentsTab
            employeeId={employeeId}
            refreshKey={docRefreshKey}
            onUploadSuccess={() => setDocRefreshKey((k) => k + 1)}
          />
        )}
        {activeTab === "deployments" && (
          <DeploymentsTab
            employeeId={employeeId}
            employeeName={`${employee.lastName} ${employee.firstName}`}
            deployments={employee.deployments ?? []}
            refreshKey={depRefreshKey}
            onRefresh={() => setDepRefreshKey((k) => k + 1)}
          />
        )}
        {activeTab === "history" && (
          <HistoryTab employeeId={employeeId} refreshKey={historyRefreshKey} />
        )}
      </div>

      <SalaryCalculatorModal
        isOpen={salaryCalculatorOpen}
        onClose={() => setSalaryCalculatorOpen(false)}
        employeeName={`${employee.lastName} ${employee.firstName}`}
        salaryType={employee.salaryType}
        salaryAmount={employee.salaryAmount ?? null}
        salaryCurrency={employee.salaryCurrency ?? "RON"}
        employeeId={employeeId}
        onSaved={() => setHistoryRefreshKey((k) => k + 1)}
      />
    </div>
  );
}

// ─── Info Tab ────────────────────────────────────────────────────────────────

function InfoTab({ employee }: { employee: EmployeeDetail }) {
  const salaryTypeLabel =
    employee.salaryType === "LUNAR"
      ? "Lunar"
      : employee.salaryType === "SAPTAMANAL"
      ? "Săptămânal"
      : employee.salaryType === "ORA"
      ? "Pe oră"
      : null;

  const salaryValue =
    typeof employee.salaryAmount === "number"
      ? `${employee.salaryAmount.toLocaleString("ro-RO")} ${employee.salaryCurrency ?? "RON"}`
      : null;

  const fields = [
    { icon: Hash, label: "CNP", value: employee.cnp },
    { icon: CreditCard, label: "CI", value: employee.seriesCI && employee.numberCI ? `${employee.seriesCI} ${employee.numberCI}` : null },
    { icon: Phone, label: "Telefon", value: employee.phone },
    { icon: Mail, label: "Email", value: employee.email },
    { icon: CreditCard, label: "IBAN", value: employee.iban },
    { icon: Building2, label: "Bancă", value: employee.bankName },
    { icon: CreditCard, label: "Tip plată", value: salaryTypeLabel },
    { icon: CreditCard, label: "Salariu brut", value: salaryValue },
    {
      icon: Calendar,
      label: "Salariu valabil de la",
      value: employee.salaryStartDate
        ? new Date(employee.salaryStartDate).toLocaleDateString("ro-RO")
        : null,
    },
    { icon: Building2, label: "Firmă", value: employee.company?.name },
    { icon: Globe, label: "Țară", value: employee.country },
    { icon: MapPin, label: "Adresă", value: employee.address ? `${employee.address}${employee.city ? `, ${employee.city}` : ""}` : null },
    { icon: Calendar, label: "Data angajării", value: employee.hiredAt ? new Date(employee.hiredAt).toLocaleDateString("ro-RO") : null },
    { icon: StickyNote, label: "Observații", value: employee.observations },
  ];

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((f, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
            <f.icon size={16} className="text-gray-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500 uppercase tracking-wider">{f.label}</p>
              <p className="text-sm font-medium text-gray-900 break-all">{f.value ?? "—"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Documents Tab (with upload + list) ─────────────────────────────────────

function DocumentsTab({
  employeeId,
  refreshKey,
  onUploadSuccess,
}: {
  employeeId: number;
  refreshKey: number;
  onUploadSuccess: () => void;
}) {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Documente angajat</h3>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <FileText size={14} />
          {showUpload ? "Închide" : "Adaugă document"}
        </button>
      </div>

      {showUpload && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <DocumentUpload
            employeeId={employeeId}
            onSuccess={() => {
              onUploadSuccess();
              setShowUpload(false);
            }}
          />
        </div>
      )}

      <DocumentList key={refreshKey} employeeId={employeeId} />
    </div>
  );
}

// ─── Deployments Tab ────────────────────────────────────────────────────────

function DeploymentsTab({
  employeeId,
  employeeName,
  deployments,
  refreshKey,
  onRefresh,
}: {
  employeeId: number;
  employeeName: string;
  deployments: EmployeeDetail["deployments"];
  refreshKey: number;
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<"list" | "timeline">("list");

  const timelineData = (deployments ?? []).map((d) => ({
    id: d.id,
    country: d.country,
    city: d.city ?? null,
    startDate: d.startDate,
    endDate: d.endDate ?? null,
    status: d.status,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              view === "list" ? "bg-slate-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Listă
          </button>
          <button
            onClick={() => setView("timeline")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              view === "timeline" ? "bg-slate-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Timeline
          </button>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <MapPin size={14} />
          {showForm ? "Închide" : "Adaugă detașare"}
        </button>
      </div>

      {showForm && (
        <DeploymentForm
          employeeId={employeeId}
          employeeName={employeeName}
          onSuccess={() => {
            onRefresh();
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {view === "list" ? (
        <DeploymentList employeeId={employeeId} key={refreshKey} />
      ) : (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <DeploymentTimeline deployments={timelineData} />
        </div>
      )}
    </div>
  );
}

// ─── History Tab ────────────────────────────────────────────────────────────

function HistoryTab({ employeeId, refreshKey }: { employeeId: number; refreshKey: number }) {
  const [items, setItems] = useState<SalaryCalculationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"all" | "today" | "7d" | "30d">("all");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<SalaryCalculationItem | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/employees/${employeeId}/salary-calculations?period=${period}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setItems(Array.isArray(data.data) ? data.data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [employeeId, refreshKey, period]);

  async function handleDelete(itemId: number) {
    setDeletingId(itemId);
    try {
      const res = await fetch(`/api/employees/${employeeId}/salary-calculations/${itemId}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-gray-900">Istoric calcule salariu</h3>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as "all" | "today" | "7d" | "30d")}
          className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
        >
          <option value="all">Toate</option>
          <option value="today">Astăzi</option>
          <option value="7d">Ultimele 7 zile</option>
          <option value="30d">Ultimele 30 zile</option>
        </select>
      </div>
      {loading ? (
        <p className="text-sm text-gray-400">Se încarcă...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400">Nu există calcule salvate încă.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">
                  {item.calculatedTotal.toLocaleString("ro-RO", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  {item.salaryCurrency}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(item.createdAt).toLocaleString("ro-RO")}
                </p>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Tip: {item.salaryType} · Bază: {item.salaryAmount} {item.salaryCurrency}
                {item.inputLabel && item.inputValue !== null && item.inputValue !== undefined
                  ? ` · ${item.inputLabel}: ${item.inputValue}`
                  : ""}
              </p>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteItem(item)}
                  disabled={deletingId === item.id}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 size={12} />
                  {deletingId === item.id ? "Se șterge..." : "Șterge"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDeleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border bg-white shadow-xl">
            <div className="border-b px-5 py-4">
              <h4 className="text-base font-semibold text-gray-900">Confirmă ștergerea</h4>
              <p className="mt-2 text-sm text-gray-600">
                Vrei să ștergi acest calcul salarial?
              </p>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {confirmDeleteItem.calculatedTotal.toLocaleString("ro-RO", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                {confirmDeleteItem.salaryCurrency}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4">
              <button
                type="button"
                onClick={() => setConfirmDeleteItem(null)}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = confirmDeleteItem.id;
                  setConfirmDeleteItem(null);
                  await handleDelete(id);
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Șterge calcul
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Status badges ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    ACTIVE: { bg: "bg-green-100", text: "text-green-700", label: "Activ" },
    TERMINATED: { bg: "bg-red-100", text: "text-red-700", label: "Terminat" },
  };
  const c = map[status] ?? { bg: "bg-gray-100", text: "text-gray-700", label: status };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

