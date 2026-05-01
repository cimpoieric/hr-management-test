"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, X, ChevronDown, ChevronUp, AlertCircle, AlertTriangle, Calculator } from "lucide-react";
import { DuplicateWarning } from "./DuplicateWarning";
import { validateCNP } from "@/lib/validation";
import { SalaryCalculatorModal } from "@/components/salary/SalaryCalculatorModal";

interface FormData {
  cnp: string;
  firstName: string;
  lastName: string;
  seriesCI: string;
  numberCI: string;
  email: string;
  phone: string;
  iban: string;
  bankName: string;
  position: string;
  address: string;
  city: string;
  country: string;
  status: string;
  observations: string;
  companyId: number;
  salaryType: "LUNAR" | "SAPTAMANAL" | "ORA" | "";
  salaryAmount: string;
  salaryCurrency: string;
  salaryStartDate: string;
}

interface FormErrors {
  [key: string]: string;
}

interface DuplicateInfo {
  id: number;
  name: string;
  cnp: string;
  status: string;
}

const initialForm: FormData = {
  cnp: "",
  firstName: "",
  lastName: "",
  seriesCI: "",
  numberCI: "",
  email: "",
  phone: "",
  iban: "",
  bankName: "",
  position: "",
  address: "",
  city: "",
  country: "RO",
  status: "ACTIVE",
  observations: "",
  companyId: 1,
  salaryType: "",
  salaryAmount: "",
  salaryCurrency: "RON",
  salaryStartDate: "",
};

interface EmployeeFormProps {
  employeeId?: number;
  isAdmin?: boolean;
}

export function EmployeeForm({ employeeId, isAdmin = false }: EmployeeFormProps) {
  const router = useRouter();
  const isEdit = !!employeeId;

  const [form, setForm] = useState<FormData>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openSection, setOpenSection] = useState<string>("personal");
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [submitWarning, setSubmitWarning] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCriticalFields, setConfirmCriticalFields] = useState<string[]>([]);
  const [salaryCalculatorOpen, setSalaryCalculatorOpen] = useState(false);

  // Încarcă date existente la edit
  useEffect(() => {
    if (!employeeId) return;
    setLoading(true);
    fetch(`/api/employees/${employeeId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          alert(data.error);
          router.push("/angajati");
          return;
        }
        setForm({
          cnp: (data.cnp ?? "").replace(/[^0-9]/g, ""),
          firstName: data.firstName ?? "",
          lastName: data.lastName ?? "",
          seriesCI: data.seriesCI ?? "",
          numberCI: data.numberCI ?? "",
          email: data.email ?? "",
          phone: data.phone ?? "",
          iban: data.iban ?? "",
          bankName: data.bankName ?? "",
          position: data.position ?? "",
          address: data.address ?? "",
          city: data.city ?? "",
          country: data.country ?? "RO",
          status: data.status ?? "ACTIVE",
          observations: data.observations ?? "",
          companyId: data.company?.id ?? 1,
          salaryType: data.salaryType ?? "",
          salaryAmount:
            typeof data.salaryAmount === "number" ? String(data.salaryAmount) : "",
          salaryCurrency: data.salaryCurrency ?? "RON",
          salaryStartDate: data.salaryStartDate
            ? new Date(data.salaryStartDate).toISOString().slice(0, 10)
            : "",
        });
      })
      .catch(() => alert("Eroare la încărcarea datelor"))
      .finally(() => setLoading(false));
  }, [employeeId, router]);

  useEffect(() => {
    if (employeeId) return;
    fetch("/api/settings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed"))))
      .then((data) => {
        setForm((prev) => ({
          ...prev,
          salaryCurrency: data.salaryDefaultCurrency ?? prev.salaryCurrency,
          salaryType: data.salaryDefaultType ?? prev.salaryType,
        }));
      })
      .catch(() => {
        // keep defaults
      });
  }, [employeeId]);

  const updateField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear error on change
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  function validateField(name: string, value: string): string | undefined {
    switch (name) {
      case "cnp":
        if (value.length !== 13) return "CNP trebuie să aibă 13 cifre";
        if (!/^\d{13}$/.test(value)) return "CNP conține doar cifre";
        if (!validateCNP(value)) return "CNP invalid";
        break;
      case "firstName":
        if (!value.trim()) return "Prenume obligatoriu";
        break;
      case "lastName":
        if (!value.trim()) return "Nume obligatoriu";
        break;
      case "email":
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
          return "Email invalid";
        break;
      case "phone":
        if (value) {
          const clean = value.replace(/[\s\-\.]/g, "");
          if (!/^07\d{8}$/.test(clean) && !/^\+\d{8,15}$/.test(clean))
            return "Telefon invalid";
        }
        break;
      case "iban":
        if (value && value.length < 15) return "IBAN prea scurt";
        break;
      case "companyId":
        if (!value || Number(value) <= 0) return "Selectează o firmă";
        break;
    }
    return undefined;
  }

  function handleBlur(field: string) {
    const error = validateField(
      field,
      form[field as keyof FormData] as string
    );
    if (error) {
      setErrors((prev) => ({ ...prev, [field]: error }));
    }
  }

  function collectValidationIssues(): { fieldIssues: FormErrors } {
    const newErrors: FormErrors = {};
    const required = ["cnp", "firstName", "lastName", "companyId"];

    for (const field of required) {
      const error = validateField(field, form[field as keyof FormData] as string);
      if (error) newErrors[field] = error;
    }

    const softEmail = validateField("email", form.email);
    if (softEmail) newErrors.email = softEmail;
    const softPhone = validateField("phone", form.phone);
    if (softPhone) newErrors.phone = softPhone;
    const softIban = validateField("iban", form.iban);
    if (softIban) newErrors.iban = softIban;

    const amtRaw = form.salaryAmount.trim();
    if (amtRaw) {
      const n = Number(amtRaw.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) {
        newErrors.salaryAmount = "Sumă invalidă sau ≤ 0";
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      const sectionFields: Record<string, string[]> = {
        personal: ["cnp", "firstName", "lastName", "seriesCI", "numberCI", "phone", "email", "address", "city"],
        bank: ["iban", "bankName", "companyId"],
        contract: ["position", "status", "observations"],
        salary: ["salaryType", "salaryAmount", "salaryCurrency", "salaryStartDate"],
      };
      const firstErrorField = Object.keys(newErrors)[0] ?? "";
      const targetSection =
        Object.entries(sectionFields).find(([, fields]) => fields.includes(firstErrorField))?.[0] ??
        "personal";
      setOpenSection(targetSection);
    }
    return { fieldIssues: newErrors };
  }

  const salaryAmountParsed = Number(form.salaryAmount.trim().replace(",", "."));
  const salaryAmountNonPositiveWarning =
    form.salaryAmount.trim() !== "" &&
    Number.isFinite(salaryAmountParsed) &&
    salaryAmountParsed <= 0;

  const salaryIncomplete =
    !form.salaryType || !form.salaryAmount.trim() || !form.salaryCurrency.trim();

  const salaryAmountNumber = Number(form.salaryAmount || 0);
  const salaryPreview =
    form.salaryType === "ORA"
      ? `Ex: 160 ore/lună × ${salaryAmountNumber || 25} ${form.salaryCurrency || "RON"}/oră = ${(
          (salaryAmountNumber || 25) * 160
        ).toLocaleString("ro-RO")} ${form.salaryCurrency || "RON"}/lună`
      : form.salaryType === "SAPTAMANAL"
      ? `Ex: ${(salaryAmountNumber || 1000).toLocaleString("ro-RO")} ${
          form.salaryCurrency || "RON"
        }/săptămână ≈ ${((salaryAmountNumber || 1000) * 4).toLocaleString(
          "ro-RO"
        )} ${form.salaryCurrency || "RON"}/lună`
      : `Ex: ${(salaryAmountNumber || 4000).toLocaleString("ro-RO")} ${
          form.salaryCurrency || "RON"
        }/lună`;

  async function handleSubmit(force = false) {
    setSubmitError("");
    setSubmitSuccess("");
    setSubmitWarning("");

    const { fieldIssues } = collectValidationIssues();
    const issueKeys = Object.keys(fieldIssues);
    if (issueKeys.length > 0 && !force) {
      const labels: Record<string, string> = {
        cnp: "CNP",
        firstName: "Prenume",
        lastName: "Nume",
        companyId: "Firmă",
        email: "Email",
        phone: "Telefon",
        iban: "IBAN",
        salaryType: "Tip plată",
        salaryAmount: "Sumă brută",
        salaryCurrency: "Monedă",
        salaryStartDate: "Valabil de la",
      };
      setConfirmCriticalFields(issueKeys.map((k) => labels[k] ?? k));
      setConfirmOpen(true);
      return;
    }

    if (Object.keys(fieldIssues).length > 0) {
      setSubmitWarning(
        "Există câmpuri cu format incorect. Salvarea continuă, iar valorile invalide pot fi ignorate de server."
      );
    }

    setSaving(true);
    setDuplicate(null);

    try {
      const hasSalaryCore =
        !!form.salaryType ||
        !!form.salaryAmount.trim() ||
        !!form.salaryStartDate.trim();

      const salaryAmountPayload =
        form.salaryAmount.trim() === ""
          ? null
          : Number(form.salaryAmount.trim().replace(",", "."));

      const payload: Record<string, unknown> = {
        cnp: form.cnp,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        seriesCI: form.seriesCI.trim() || null,
        numberCI: form.numberCI.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        iban: form.iban.trim() || null,
        bankName: form.bankName.trim() || null,
        position: form.position.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        country: form.country || "RO",
        status: form.status || "ACTIVE",
        observations: form.observations.trim() || null,
        companyId: Number(form.companyId),
        salaryType: form.salaryType || null,
        salaryAmount:
          salaryAmountPayload != null && Number.isFinite(salaryAmountPayload)
            ? salaryAmountPayload
            : null,
        salaryCurrency: hasSalaryCore ? form.salaryCurrency || "RON" : null,
        salaryStartDate: form.salaryStartDate.trim() || null,
      };

      const url = isEdit
        ? `/api/employees/${employeeId}`
        : "/api/employees";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      // Duplicat detectat
      if (res.status === 409 && data.error === "DUPLICATE_CNP") {
        setDuplicate(data.existing);
        setSubmitError("Există deja un angajat cu acest CNP.");
        setSaving(false);
        return;
      }

      if (!res.ok) {
        if (data.error === "CNP_INVALID") {
          setErrors((p) => ({ ...p, cnp: data.message }));
        } else if (data.error === "IBAN_INVALID") {
          setErrors((p) => ({ ...p, iban: data.message }));
        } else if (data.error === "EMAIL_INVALID") {
          setErrors((p) => ({ ...p, email: data.message }));
        } else if (data.error === "PHONE_INVALID") {
          setErrors((p) => ({ ...p, phone: data.message }));
        } else if (Array.isArray(data.issues) && data.issues.length > 0) {
          setSubmitError(data.issues[0]?.message ?? "Date invalide");
        } else {
          setSubmitError(data.error ?? "Eroare la salvare");
        }
        setSaving(false);
        return;
      }

      setSubmitSuccess(
        isEdit ? "Angajatul a fost actualizat cu succes." : "Angajatul a fost creat cu succes."
      );
      if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        setSubmitWarning(`Avertizări: ${data.warnings.join(" | ")}`);
      }
      setTimeout(() => {
        router.push("/angajati");
        router.refresh();
      }, 1200);
    } catch {
      setSubmitError("Eroare de rețea");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
        Se încarcă datele...
      </div>
    );
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        noValidate
        className="bg-white rounded-xl border shadow-sm overflow-hidden"
      >
        {(submitError || submitSuccess || submitWarning) && (
          <div className="px-6 pt-5">
            {submitError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}
            {submitWarning && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 mt-2">
                {submitWarning}
              </div>
            )}
            {submitSuccess && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 mt-2">
                {submitSuccess}
              </div>
            )}
          </div>
        )}

        {/* Secțiune 1: Date personale */}
        <FormSection
          title="Date personale"
          isOpen={openSection === "personal"}
          onToggle={() =>
            setOpenSection(openSection === "personal" ? "" : "personal")
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="CNP *"
              name="cnp"
              value={form.cnp}
              onChange={(v) =>
                updateField("cnp", v.replace(/\D/g, "").slice(0, 13))
              }
              onBlur={() => handleBlur("cnp")}
              error={errors.cnp}
              maxLength={13}
              placeholder="1881234567890"
              disabled={isEdit}
            />
            <Field
              label="Nume *"
              name="lastName"
              value={form.lastName}
              onChange={(v) => updateField("lastName", v)}
              onBlur={() => handleBlur("lastName")}
              error={errors.lastName}
              placeholder="Popescu"
            />
            <Field
              label="Prenume *"
              name="firstName"
              value={form.firstName}
              onChange={(v) => updateField("firstName", v)}
              onBlur={() => handleBlur("firstName")}
              error={errors.firstName}
              placeholder="Ion"
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="CI Serie"
                name="seriesCI"
                value={form.seriesCI}
                onChange={(v) => updateField("seriesCI", v.toUpperCase())}
                placeholder="RT"
                maxLength={4}
              />
              <Field
                label="CI Număr"
                name="numberCI"
                value={form.numberCI}
                onChange={(v) => updateField("numberCI", v)}
                placeholder="123456"
                maxLength={10}
              />
            </div>
            <Field
              label="Telefon"
              name="phone"
              value={form.phone}
              onChange={(v) => updateField("phone", v)}
              onBlur={() => handleBlur("phone")}
              error={errors.phone}
              placeholder="0722 123 456"
            />
            <Field
              label="Email"
              name="email"
              value={form.email}
              onChange={(v) => updateField("email", v)}
              onBlur={() => handleBlur("email")}
              error={errors.email}
              type="email"
              placeholder="ion.popescu@email.ro"
            />
            <Field
              label="Adresă"
              name="address"
              value={form.address}
              onChange={(v) => updateField("address", v)}
              placeholder="Str. Exemplu nr. 1"
              className="sm:col-span-2"
            />
            <Field
              label="Oraș"
              name="city"
              value={form.city}
              onChange={(v) => updateField("city", v)}
              placeholder="București"
            />
          </div>
        </FormSection>

        {/* Secțiune 2: Date bancare */}
        <FormSection
          title="Date bancare și firmă"
          isOpen={openSection === "bank"}
          onToggle={() => setOpenSection(openSection === "bank" ? "" : "bank")}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="IBAN"
              name="iban"
              value={form.iban}
              onChange={(v) => updateField("iban", v.toUpperCase())}
              onBlur={() => handleBlur("iban")}
              error={errors.iban}
              placeholder="RO49 AAAA BBBB CCCC DDDD EEEE"
              maxLength={34}
            />
            <Field
              label="Bancă"
              name="bankName"
              value={form.bankName}
              onChange={(v) => updateField("bankName", v)}
              placeholder="Banca Transilvania"
            />
            <Field
              label="Firmă angajatoare *"
              name="companyId"
              value={String(form.companyId)}
              onChange={(v) => updateField("companyId", Number(v))}
              onBlur={() => handleBlur("companyId")}
              error={errors.companyId}
              type="select"
              options={[
                { value: "1", label: "RomForce Detașări SRL" },
                { value: "2", label: "EuroWork HR Solutions" },
                { value: "3", label: "BuildTeam Internațional" },
              ]}
            />
          </div>
        </FormSection>

        {/* Secțiune 3: Date contract */}
        <FormSection
          title="Date contract"
          isOpen={openSection === "contract"}
          onToggle={() =>
            setOpenSection(openSection === "contract" ? "" : "contract")
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Funcție"
              name="position"
              value={form.position}
              onChange={(v) => updateField("position", v)}
              placeholder="Muncitor necalificat"
            />
            <Field
              label="Status"
              name="status"
              value={form.status}
              onChange={(v) => updateField("status", v)}
              type="select"
              options={[
                { value: "ACTIVE", label: "Activ" },
                { value: "TERMINATED", label: "Terminat" },
              ]}
            />
            <Field
              label="Observații"
              name="observations"
              value={form.observations}
              onChange={(v) => updateField("observations", v)}
              type="textarea"
              placeholder="Note suplimentare..."
              className="sm:col-span-2"
            />
          </div>
        </FormSection>

        {/* Secțiune 4: Date salariale (pliată implicit — openSection inițial nu e „salary”) */}
        <FormSection
          title="Date salariale"
          isOpen={openSection === "salary"}
          onToggle={() =>
            setOpenSection(openSection === "salary" ? "" : "salary")
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Tip plată"
              name="salaryType"
              value={form.salaryType}
              onChange={(v) =>
                updateField(
                  "salaryType",
                  (v as "LUNAR" | "SAPTAMANAL" | "ORA" | "") ?? ""
                )
              }
              type="select"
              options={[
                { value: "", label: "— Lăsați gol dacă nu se aplică —" },
                { value: "ORA", label: "Pe oră (ORA)" },
                { value: "SAPTAMANAL", label: "Săptămânal (SAPTAMANAL)" },
                { value: "LUNAR", label: "Lunar (LUNAR)" },
              ]}
            />
            <Field
              label="Sumă brută"
              name="salaryAmount"
              value={form.salaryAmount}
              onChange={(v) =>
                updateField("salaryAmount", v.replace(/[^0-9.,]/g, ""))
              }
              type="number"
              step="0.01"
              placeholder="ex: 4500.50"
              warning={
                salaryAmountNonPositiveWarning
                  ? "Valoare lipsă de sens pentru sumă (≤ 0). Puteți corecta sau salva oricum."
                  : undefined
              }
            />
            <Field
              label="Monedă"
              name="salaryCurrency"
              value={form.salaryCurrency}
              onChange={(v) => updateField("salaryCurrency", v)}
              type="select"
              options={[
                { value: "RON", label: "RON" },
                { value: "EUR", label: "EUR" },
                { value: "USD", label: "USD" },
                { value: "GBP", label: "GBP" },
              ]}
            />
            <Field
              label="Valabil de la (opțional)"
              name="salaryStartDate"
              value={form.salaryStartDate}
              onChange={(v) => updateField("salaryStartDate", v)}
              type="date"
            />
          </div>

          {salaryIncomplete && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Date salariale incomplete — se poate completa ulterior.
            </div>
          )}

          <p className="mt-3 text-xs text-gray-500">{salaryPreview}</p>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setSalaryCalculatorOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Calculator size={14} />
              Calculează plată
            </button>
          </div>
        </FormSection>

        {/* Acțiuni */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
          <button
            type="button"
            onClick={() => router.push("/angajati")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium text-gray-700 hover:bg-white transition-colors"
          >
            <X size={16} />
            Anulează
          </button>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              <Save size={16} />
              {saving ? "Se salvează..." : isEdit ? "Salvează modificările" : "Salvează angajat"}
            </button>
          </div>
        </div>
      </form>

      {/* Modal duplicat */}
      {duplicate && (
        <DuplicateWarning
          existing={duplicate}
          isAdmin={isAdmin}
          onContinueAnyway={() => {
            setDuplicate(null);
            // Admin poate forța crearea — implementare opțională
          }}
          onCancel={() => setDuplicate(null)}
        />
      )}

      {confirmOpen && (
        <ConfirmSaveModal
          criticalFields={confirmCriticalFields}
          onConfirm={() => {
            setConfirmOpen(false);
            handleSubmit(true);
          }}
          onCancel={() => {
            setConfirmOpen(false);
          }}
        />
      )}

      <SalaryCalculatorModal
        isOpen={salaryCalculatorOpen}
        onClose={() => setSalaryCalculatorOpen(false)}
        employeeId={employeeId}
        employeeName={`${form.lastName} ${form.firstName}`.trim()}
        iban={form.iban}
        bankName={form.bankName}
        salaryType={form.salaryType || null}
        salaryAmount={form.salaryAmount ? Number(form.salaryAmount.replace(",", ".")) : null}
        salaryCurrency={form.salaryCurrency || "RON"}
      />
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FormSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-900">{title}</span>
        {isOpen ? (
          <ChevronUp size={18} className="text-gray-400" />
        ) : (
          <ChevronDown size={18} className="text-gray-400" />
        )}
      </button>
      {isOpen && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

interface FieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  /** Avertisment soft (portocaliu), nu blochează submit-ul */
  warning?: string;
  type?: "text" | "email" | "number" | "date" | "select" | "textarea";
  placeholder?: string;
  maxLength?: number;
  step?: string;
  disabled?: boolean;
  className?: string;
  options?: { value: string; label: string }[];
}

function Field({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  warning,
  type = "text",
  placeholder,
  maxLength,
  step,
  disabled,
  className = "",
  options,
}: FieldProps) {
  const inputClass =
    "w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950 " +
    (error ? "border-red-300 focus:ring-red-500" : "border-gray-200");

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {type === "select" ? (
        <select
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          className={inputClass}
        >
          {options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          className={inputClass + " resize-none"}
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          step={type === "number" ? step : undefined}
          disabled={disabled}
          className={inputClass}
        />
      )}
      {warning && !error && (
        <div className="flex items-start gap-1 mt-1">
          <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
          <span className="text-xs text-amber-700">{warning}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-1 mt-1">
          <AlertCircle size={12} className="text-red-500 shrink-0" />
          <span className="text-xs text-red-600">{error}</span>
        </div>
      )}
    </div>
  );
}

function ConfirmSaveModal({
  criticalFields,
  onConfirm,
  onCancel,
}: {
  criticalFields: string[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border bg-white shadow-xl">
        <div className="px-6 py-5 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-600" />
            <h3 className="text-base font-semibold text-gray-900">Confirmare salvare</h3>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Există probleme la următoarele câmpuri (incomplete sau invalide):
          </p>
          <p className="text-sm font-medium text-amber-700 mt-1">
            {criticalFields.join(", ")}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Poți reveni să corectezi sau poți continua — serverul poate ignora unele valori.
          </p>
        </div>
        <div className="px-6 py-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Completează
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
          >
            Salvează oricum
          </button>
        </div>
      </div>
    </div>
  );
}
