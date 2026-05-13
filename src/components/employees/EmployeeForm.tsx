"use client";

import { SalaryCalculatorModal } from "@/components/salary/SalaryCalculatorModal";
import { validateCNP } from "@/lib/validation";
import {
  AlertTriangle,
  Calculator,
  ChevronDown,
  ChevronUp,
  Save,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";
import { DuplicateWarning } from "./DuplicateWarning";
import { ROUTES } from "@/lib/routes";

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
  /** ID țară din DB; "" = neales */
  countryId: number | "";
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
  countryId: "",
  status: "ACTIVE",
  observations: "",
  companyId: 0,
  salaryType: "",
  salaryAmount: "",
  salaryCurrency: "RON",
  salaryStartDate: "",
};

interface EmployeeFormProps {
  employeeId?: number;
  isAdmin?: boolean;
  /** `infoOnly` = doar personal, bancă, contract, firmă (fără salarizare) — pentru tab Informații */
  variant?: "full" | "infoOnly";
  onSaved?: () => void | Promise<void>;
  onCancel?: () => void;
}

export function EmployeeForm({
  employeeId,
  isAdmin = false,
  variant = "full",
  onSaved,
  onCancel,
}: EmployeeFormProps) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const numberLocale = i18n.language?.startsWith("ro") ? "ro-RO" : "en-US";
  const isEdit = !!employeeId;
  const infoOnly = variant === "infoOnly";

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
  const [salaryCalculatorOpen, setSalaryCalculatorOpen] = useState(false);
  const [companyOptions, setCompanyOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [countryOptions, setCountryOptions] = useState<
    { value: string; label: string }[]
  >([]);

  const statusSelectOptions = useMemo(
    () => [
      {
        value: "ACTIVE",
        label: t("components.employeeForm.field.statusActive"),
      },
      {
        value: "TERMINATED",
        label: t("components.employeeForm.field.statusTerminated"),
      },
    ],
    [t],
  );

  const salaryTypeSelectOptions = useMemo(
    () => [
      { value: "", label: t("components.employeeForm.field.salaryTypeEmpty") },
      { value: "ORA", label: t("components.employeeForm.field.salaryHourly") },
      {
        value: "SAPTAMANAL",
        label: t("components.employeeForm.field.salaryWeekly"),
      },
      {
        value: "LUNAR",
        label: t("components.employeeForm.field.salaryMonthly"),
      },
    ],
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/organization/companies", { cache: "no-store" }).then((r) =>
        r.json(),
      ),
      fetch("/api/organization/countries", { cache: "no-store" }).then((r) =>
        r.json(),
      ),
    ])
      .then(([compRes, ctryRes]) => {
        if (cancelled) return;
        const comps = compRes.companies ?? [];
        const ctr = ctryRes.countries ?? [];
        setCompanyOptions(
          comps.map((c: { id: number; name: string }) => ({
            value: String(c.id),
            label: c.name,
          })),
        );
        setCountryOptions([
          { value: "", label: t("components.employeeForm.countryNone") },
          ...ctr.map((c: { id: number; name: string; code: string }) => ({
            value: String(c.id),
            label: `${c.name} (${c.code})`,
          })),
        ]);
        if (!employeeId && comps.length > 0) {
          setForm((prev) => ({
            ...prev,
            companyId: prev.companyId <= 0 ? comps[0].id : prev.companyId,
          }));
        }
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, t]);

  // Încarcă date existente la edit
  useEffect(() => {
    if (!employeeId) return;
    setLoading(true);
    fetch(`/api/employees/${employeeId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          toast.error(
            typeof data.error === "string"
              ? data.error
              : t("components.employeeForm.loadDataError"),
          );
          router.push(ROUTES.employees);
          return;
        }
        setForm({
          // Acceptăm CNP-uri temporare/străine (ex: TEMP_...) — nu strip-uim aici.
          cnp: String(data.cnp ?? ""),
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
          countryId:
            data.country?.id != null
              ? data.country.id
              : typeof data.countryId === "number"
                ? data.countryId
                : "",
          status: data.status ?? "ACTIVE",
          observations: data.observations ?? "",
          companyId: data.company?.id ?? 0,
          salaryType: data.salaryType ?? "",
          salaryAmount:
            typeof data.salaryAmount === "number"
              ? String(data.salaryAmount)
              : "",
          salaryCurrency: data.salaryCurrency ?? "RON",
          salaryStartDate: data.salaryStartDate
            ? new Date(data.salaryStartDate).toISOString().slice(0, 10)
            : "",
        });
      })
      .catch(() => {
        toast.error(t("components.employeeForm.loadDataError"));
      })
      .finally(() => setLoading(false));
  }, [employeeId, router, t]);

  useEffect(() => {
    if (employeeId) return;
    fetch("/api/settings", { cache: "no-store" })
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("Failed")),
      )
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

  const updateField = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      // Clear error on change
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [],
  );

  const validateField = useCallback(
    (name: string, value: string): string | undefined => {
      switch (name) {
        case "cnp": {
          const v = (value ?? "").trim();
          if (!v) return t("components.employeeForm.cnpRequired");
          if (v.startsWith("TEMP_")) {
            if (v.length < 5)
              return t("components.employeeForm.cnpTempTooShort");
            return undefined;
          }
          if (/^\d+$/.test(v)) {
            if (v.length !== 13)
              return t("components.employeeForm.cnpRoLength");
            if (!validateCNP(v))
              return t("components.employeeForm.cnpRoInvalid");
            return undefined;
          }
          if (v.length < 5)
            return t("components.employeeForm.cnpIdentifierInvalid");
          return undefined;
        }
        case "firstName":
          if (!value.trim())
            return t("components.employeeForm.firstNameRequired");
          break;
        case "lastName":
          if (!value.trim())
            return t("components.employeeForm.lastNameRequired");
          break;
        case "email":
          if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
            return t("components.employeeForm.emailInvalid");
          break;
        case "phone":
          if (value) {
            const clean = value.replace(/[\s\-\.]/g, "");
            if (!/^07\d{8}$/.test(clean) && !/^\+\d{8,15}$/.test(clean))
              return t("components.employeeForm.phoneInvalid");
          }
          break;
        case "iban":
          if (value && value.length < 15)
            return t("components.employeeForm.ibanTooShort");
          break;
        case "companyId":
          if (!value || Number(value) <= 0)
            return t("components.employeeForm.companyRequired");
          break;
      }
      return undefined;
    },
    [t],
  );

  function handleBlur(field: string) {
    const error = validateField(field, form[field as keyof FormData] as string);
    if (error) {
      setErrors((prev) => ({ ...prev, [field]: error }));
    }
  }

  function collectValidationIssues(): { fieldIssues: FormErrors } {
    const newErrors: FormErrors = {};
    const required = ["cnp", "firstName", "lastName", "companyId"];

    for (const field of required) {
      const error = validateField(
        field,
        form[field as keyof FormData] as string,
      );
      if (error) newErrors[field] = error;
    }

    const softEmail = validateField("email", form.email);
    if (softEmail) newErrors.email = softEmail;
    const softPhone = validateField("phone", form.phone);
    if (softPhone) newErrors.phone = softPhone;
    const softIban = validateField("iban", form.iban);
    if (softIban) newErrors.iban = softIban;

    if (!infoOnly) {
      const amtRaw = form.salaryAmount.trim();
      if (amtRaw) {
        const n = Number(amtRaw.replace(",", "."));
        if (!Number.isFinite(n) || n <= 0) {
          newErrors.salaryAmount = t(
            "components.employeeForm.salaryAmountInvalid",
          );
        }
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      const sectionFields: Record<string, string[]> = {
        personal: [
          "cnp",
          "firstName",
          "lastName",
          "seriesCI",
          "numberCI",
          "phone",
          "email",
          "address",
          "city",
        ],
        bank: ["iban", "bankName", "companyId"],
        contract: ["position", "status", "observations"],
        ...(infoOnly
          ? {}
          : {
              salary: [
                "salaryType",
                "salaryAmount",
                "salaryCurrency",
                "salaryStartDate",
              ],
            }),
      };
      const firstErrorField = Object.keys(newErrors)[0] ?? "";
      const targetSection =
        Object.entries(sectionFields).find(([, fields]) =>
          fields.includes(firstErrorField),
        )?.[0] ?? "personal";
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
    !form.salaryType ||
    !form.salaryAmount.trim() ||
    !form.salaryCurrency.trim();

  const salaryAmountNumber = Number(form.salaryAmount || 0);
  const salaryPreview = useMemo(() => {
    const cur = form.salaryCurrency || "RON";
    if (form.salaryType === "ORA") {
      const rate = salaryAmountNumber || 25;
      const total = (rate * 160).toLocaleString(numberLocale);
      return t("components.employeeForm.salaryPreviewHourly", {
        rate,
        currency: cur,
        total,
      });
    }
    if (form.salaryType === "SAPTAMANAL") {
      const weekly = (salaryAmountNumber || 1000).toLocaleString(numberLocale);
      const monthly = ((salaryAmountNumber || 1000) * 4).toLocaleString(
        numberLocale,
      );
      return t("components.employeeForm.salaryPreviewWeekly", {
        weekly,
        monthly,
        currency: cur,
      });
    }
    return t("components.employeeForm.salaryPreviewMonthly", {
      amount: (salaryAmountNumber || 4000).toLocaleString(numberLocale),
      currency: cur,
    });
  }, [
    form.salaryType,
    form.salaryCurrency,
    salaryAmountNumber,
    numberLocale,
    t,
  ]);

  async function handleSubmit(force = false) {
    setSubmitError("");
    setSubmitSuccess("");
    setSubmitWarning("");

    const { fieldIssues } = collectValidationIssues();
    const issueKeys = Object.keys(fieldIssues);
    if (issueKeys.length > 0 && !force) {
      setConfirmOpen(true);
      return;
    }

    setSaving(true);
    setDuplicate(null);

    try {
      const hasSalaryCore =
        !infoOnly &&
        (!!form.salaryType ||
          !!form.salaryAmount.trim() ||
          !!form.salaryStartDate.trim());

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
        countryId: form.countryId === "" ? null : Number(form.countryId),
        status: form.status || "ACTIVE",
        observations: form.observations.trim() || null,
        companyId: Number(form.companyId),
      };

      if (!infoOnly) {
        Object.assign(payload, {
          salaryType: form.salaryType || null,
          salaryAmount:
            salaryAmountPayload != null && Number.isFinite(salaryAmountPayload)
              ? salaryAmountPayload
              : null,
          salaryCurrency: hasSalaryCore ? form.salaryCurrency || "RON" : null,
          salaryStartDate: form.salaryStartDate.trim() || null,
        });
      }

      const url = isEdit ? `/api/employees/${employeeId}` : "/api/employees";
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
        setSubmitError(t("components.employeeForm.duplicateCnp"));
        setSaving(false);
        return;
      }

      if (!res.ok) {
        if (Array.isArray(data.issues) && data.issues.length > 0) {
          setSubmitError(
            data.issues[0]?.message ?? t("components.employeeForm.invalidData"),
          );
        } else {
          setSubmitError(data.error ?? t("components.employeeForm.saveError"));
        }
        setSaving(false);
        return;
      }

      setSubmitSuccess(
        isEdit
          ? t("components.employeeForm.updatedSuccess")
          : t("components.employeeForm.createdSuccess"),
      );
      if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        setSubmitWarning(
          `${t("components.employeeForm.warningsPrefix")} ${data.warnings.join(" | ")}`,
        );
      }
      setSaving(false);
      if (onSaved) {
        setTimeout(() => {
          void Promise.resolve(onSaved());
        }, 500);
      } else {
        setTimeout(() => {
          router.push(ROUTES.employees);
          router.refresh();
        }, 1200);
      }
    } catch {
      setSubmitError(t("components.employeeForm.networkError"));
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
        {t("components.employeeForm.loadingFormData")}
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
          title={t("components.employeeForm.sectionPersonal")}
          isOpen={openSection === "personal"}
          onToggle={() =>
            setOpenSection(openSection === "personal" ? "" : "personal")
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label={t("components.employeeForm.field.cnp")}
              name="cnp"
              value={form.cnp}
              onChange={(v) => updateField("cnp", v)}
              onBlur={() => handleBlur("cnp")}
              error={errors.cnp}
              maxLength={64}
              placeholder={t("components.employeeForm.field.cnpPh")}
              disabled={false}
            />
            <Field
              label={t("components.employeeForm.field.lastName")}
              name="lastName"
              value={form.lastName}
              onChange={(v) => updateField("lastName", v)}
              onBlur={() => handleBlur("lastName")}
              error={errors.lastName}
              placeholder={t("components.employeeForm.field.lastNamePh")}
            />
            <Field
              label={t("components.employeeForm.field.firstName")}
              name="firstName"
              value={form.firstName}
              onChange={(v) => updateField("firstName", v)}
              onBlur={() => handleBlur("firstName")}
              error={errors.firstName}
              placeholder={t("components.employeeForm.field.firstNamePh")}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={t("components.employeeForm.field.seriesCI")}
                name="seriesCI"
                value={form.seriesCI}
                onChange={(v) => updateField("seriesCI", v.toUpperCase())}
                placeholder={t("components.employeeForm.field.seriesCIPh")}
                maxLength={4}
              />
              <Field
                label={t("components.employeeForm.field.numberCI")}
                name="numberCI"
                value={form.numberCI}
                onChange={(v) => updateField("numberCI", v)}
                placeholder={t("components.employeeForm.field.numberCIPh")}
                maxLength={10}
              />
            </div>
            <Field
              label={t("components.employeeForm.field.phone")}
              name="phone"
              value={form.phone}
              onChange={(v) => updateField("phone", v)}
              onBlur={() => handleBlur("phone")}
              error={errors.phone}
              placeholder={t("components.employeeForm.field.phonePh")}
            />
            <Field
              label={t("components.employeeForm.field.email")}
              name="email"
              value={form.email}
              onChange={(v) => updateField("email", v)}
              onBlur={() => handleBlur("email")}
              error={errors.email}
              type="email"
              placeholder={t("components.employeeForm.field.emailPh")}
            />
            <Field
              label={t("components.employeeForm.field.address")}
              name="address"
              value={form.address}
              onChange={(v) => updateField("address", v)}
              placeholder={t("components.employeeForm.field.addressPh")}
              className="sm:col-span-2"
            />
            <Field
              label={t("components.employeeForm.field.city")}
              name="city"
              value={form.city}
              onChange={(v) => updateField("city", v)}
              placeholder={t("components.employeeForm.field.cityPh")}
            />
            <Field
              label={t("components.employeeForm.field.country")}
              name="countryId"
              value={form.countryId === "" ? "" : String(form.countryId)}
              onChange={(v) =>
                updateField("countryId", v === "" ? "" : Number(v))
              }
              type="select"
              options={countryOptions}
            />
          </div>
        </FormSection>

        {/* Secțiune 2: Date bancare */}
        <FormSection
          title={t("components.employeeForm.sectionBank")}
          isOpen={openSection === "bank"}
          onToggle={() => setOpenSection(openSection === "bank" ? "" : "bank")}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label={t("components.employeeForm.field.iban")}
              name="iban"
              value={form.iban}
              onChange={(v) => updateField("iban", v.toUpperCase())}
              onBlur={() => handleBlur("iban")}
              error={errors.iban}
              placeholder={t("components.employeeForm.field.ibanPh")}
              maxLength={34}
            />
            <Field
              label={t("components.employeeForm.field.bankName")}
              name="bankName"
              value={form.bankName}
              onChange={(v) => updateField("bankName", v)}
              placeholder={t("components.employeeForm.field.bankNamePh")}
            />
            <Field
              label={t("components.employeeForm.field.employingCompany")}
              name="companyId"
              value={form.companyId > 0 ? String(form.companyId) : ""}
              onChange={(v) => updateField("companyId", Number(v))}
              onBlur={() => handleBlur("companyId")}
              error={errors.companyId}
              type="select"
              options={
                companyOptions.length > 0
                  ? [
                      {
                        value: "",
                        label: t(
                          "components.employeeForm.companySelectPlaceholder",
                        ),
                      },
                      ...companyOptions,
                    ]
                  : [
                      {
                        value: "",
                        label: t("components.employeeForm.loadingCompanies"),
                      },
                    ]
              }
            />
          </div>
        </FormSection>

        {/* Secțiune 3: Date contract */}
        <FormSection
          title={t("components.employeeForm.sectionContract")}
          isOpen={openSection === "contract"}
          onToggle={() =>
            setOpenSection(openSection === "contract" ? "" : "contract")
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label={t("components.employeeForm.field.position")}
              name="position"
              value={form.position}
              onChange={(v) => updateField("position", v)}
              placeholder={t("components.employeeForm.field.positionPh")}
            />
            <Field
              label={t("components.employeeForm.field.status")}
              name="status"
              value={form.status}
              onChange={(v) => updateField("status", v)}
              type="select"
              options={statusSelectOptions}
            />
            <Field
              label={t("components.employeeForm.field.observations")}
              name="observations"
              value={form.observations}
              onChange={(v) => updateField("observations", v)}
              type="textarea"
              placeholder={t("components.employeeForm.field.observationsPh")}
              className="sm:col-span-2"
            />
          </div>
        </FormSection>

        {/* Secțiune 4: Date salariale (doar formular complet) */}
        {!infoOnly && (
          <FormSection
            title={t("components.employeeForm.sectionSalary")}
            isOpen={openSection === "salary"}
            onToggle={() =>
              setOpenSection(openSection === "salary" ? "" : "salary")
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label={t("components.employeeForm.field.salaryType")}
                name="salaryType"
                value={form.salaryType}
                onChange={(v) =>
                  updateField(
                    "salaryType",
                    (v as "LUNAR" | "SAPTAMANAL" | "ORA" | "") ?? "",
                  )
                }
                type="select"
                options={salaryTypeSelectOptions}
              />
              <Field
                label={t("components.employeeForm.field.grossAmount")}
                name="salaryAmount"
                value={form.salaryAmount}
                onChange={(v) =>
                  updateField("salaryAmount", v.replace(/[^0-9.,]/g, ""))
                }
                type="number"
                step="0.01"
                placeholder={t("components.employeeForm.field.grossAmountPh")}
                warning={
                  salaryAmountNonPositiveWarning
                    ? t("components.employeeForm.field.grossAmountWarning")
                    : undefined
                }
              />
              <Field
                label={t("components.employeeForm.field.currency")}
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
                label={t("components.employeeForm.field.salaryValidFrom")}
                name="salaryStartDate"
                value={form.salaryStartDate}
                onChange={(v) => updateField("salaryStartDate", v)}
                type="date"
              />
            </div>

            {salaryIncomplete && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {t("components.employeeForm.sectionSalaryIncompleteNote")}
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
                {t("components.employeeForm.field.calcPayButton")}
              </button>
            </div>
          </FormSection>
        )}

        {/* Acțiuni */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
          <button
            type="button"
            onClick={() =>
              onCancel ? onCancel() : router.push(ROUTES.employees)
            }
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium text-gray-700 hover:bg-white transition-colors"
          >
            <X size={16} />
            {t("components.employeeForm.cancel")}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              <Save size={16} />
              {saving
                ? t("components.employeeForm.savingInProgress")
                : isEdit
                  ? t("components.employeeForm.saveEdit")
                  : t("components.employeeForm.saveCreate")}
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
          onConfirm={() => {
            setConfirmOpen(false);
            handleSubmit(true);
          }}
          onCancel={() => {
            setConfirmOpen(false);
          }}
        />
      )}

      {!infoOnly && (
        <SalaryCalculatorModal
          isOpen={salaryCalculatorOpen}
          onClose={() => setSalaryCalculatorOpen(false)}
          employeeId={employeeId}
          employeeName={`${form.lastName} ${form.firstName}`.trim()}
          iban={form.iban}
          bankName={form.bankName}
          salaryType={form.salaryType || null}
          salaryAmount={
            form.salaryAmount
              ? Number(form.salaryAmount.replace(",", "."))
              : null
          }
          salaryCurrency={form.salaryCurrency || "RON"}
        />
      )}
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
    (error ? "border-amber-300 focus:ring-amber-500/80" : "border-gray-200");

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
        <div className="flex items-start gap-1 mt-1">
          <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
          <span className="text-xs text-amber-800">{error}</span>
        </div>
      )}
    </div>
  );
}

function ConfirmSaveModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border bg-white shadow-xl">
        <div className="px-6 py-5 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-600" />
            <h3 className="text-base font-semibold text-gray-900">
              {t("components.employeeForm.confirmSaveTitle")}
            </h3>
          </div>
          <p className="text-sm text-gray-700 mt-3">
            {t("components.employeeForm.confirmSaveDescription")}
          </p>
        </div>
        <div className="px-6 py-4 flex items-center justify-end gap-2 border-t bg-gray-50">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-white"
          >
            {t("components.employeeForm.confirmSaveReview")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700"
          >
            {t("components.employeeForm.confirmSaveAnyway")}
          </button>
        </div>
      </div>
    </div>
  );
}
