"use client";

import { useMemo, useState } from "react";
import { Calculator, X } from "lucide-react";

type SalaryType = "LUNAR" | "SAPTAMANAL" | "ORA";

interface SalaryCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  salaryType?: SalaryType | null;
  salaryAmount?: number | null;
  salaryCurrency?: string | null;
  employeeName?: string;
  employeeId?: number;
  onSaved?: () => void;
}

function formatMoney(value: number, currency: string): string {
  return `${value.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export function SalaryCalculatorModal({
  isOpen,
  onClose,
  salaryType,
  salaryAmount,
  salaryCurrency,
  employeeName,
  employeeId,
  onSaved,
}: SalaryCalculatorModalProps) {
  const [hoursWorked, setHoursWorked] = useState("160");
  const [weeksWorked, setWeeksWorked] = useState("4");
  const [daysWorked, setDaysWorked] = useState("21");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const currency = (salaryCurrency?.trim() || "RON").toUpperCase();
  const amount = salaryAmount ?? 0;

  const calculated = useMemo(() => {
    if (!salaryType || amount <= 0) return 0;
    if (salaryType === "ORA") return Number(hoursWorked || "0") * amount;
    if (salaryType === "SAPTAMANAL") return Number(weeksWorked || "0") * amount;
    if (!daysWorked.trim()) return amount;
    return (Number(daysWorked || "0") / 21) * amount;
  }, [salaryType, amount, hoursWorked, weeksWorked, daysWorked]);

  if (!isOpen) return null;

  async function handleSaveCalculation() {
    if (!employeeId || !salaryType || amount <= 0) return;
    const inputLabel =
      salaryType === "ORA"
        ? "Ore lucrate"
        : salaryType === "SAPTAMANAL"
        ? "Săptămâni lucrate"
        : "Zile lucrate";
    const inputValue =
      salaryType === "ORA"
        ? Number(hoursWorked || "0")
        : salaryType === "SAPTAMANAL"
        ? Number(weeksWorked || "0")
        : daysWorked.trim()
        ? Number(daysWorked || "0")
        : null;

    setSaving(true);
    setSaveMessage("");
    try {
      const res = await fetch(`/api/employees/${employeeId}/salary-calculations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salaryType,
          salaryAmount: amount,
          salaryCurrency: currency,
          inputValue,
          inputLabel,
          calculatedTotal: calculated,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveMessage(data.error ?? "Eroare la salvare");
        return;
      }
      setSaveMessage("Calcul salvat în istoric.");
      onSaved?.();
    } catch {
      setSaveMessage("Eroare la salvare");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-xl border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Calcul salariu</h3>
            <p className="text-xs text-gray-500 mt-1">
              {employeeName ? `${employeeName} · ` : ""}
              Tip plată: {salaryType ?? "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {salaryType === "ORA" && (
            <InputRow
              label="Ore lucrate"
              value={hoursWorked}
              onChange={setHoursWorked}
              suffix="ore"
            />
          )}
          {salaryType === "SAPTAMANAL" && (
            <InputRow
              label="Săptămâni lucrate"
              value={weeksWorked}
              onChange={setWeeksWorked}
              suffix="săptămâni"
            />
          )}
          {salaryType === "LUNAR" && (
            <InputRow
              label="Zile lucrate (opțional)"
              value={daysWorked}
              onChange={setDaysWorked}
              suffix="zile"
              placeholder="Dacă lași gol, se folosește suma integrală"
            />
          )}

          {!salaryType || amount <= 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Completează "Tip plată" și "Sumă brută" pentru a calcula.
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex items-center gap-2 text-emerald-800">
                <Calculator size={16} />
                <span className="text-sm font-medium">Total de plată</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-emerald-900">
                {formatMoney(calculated, currency)}
              </p>
            </div>
          )}
          {saveMessage && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              {saveMessage}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button
            type="button"
            onClick={handleSaveCalculation}
            disabled={!employeeId || !salaryType || amount <= 0 || saving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {saving ? "Se salvează..." : "Salvează calcul în istoric"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Închide
          </button>
        </div>
      </div>
    </div>
  );
}

function InputRow({
  label,
  value,
  onChange,
  suffix,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
        <span className="text-xs text-gray-500">{suffix}</span>
      </div>
      {placeholder && <span className="mt-1 block text-xs text-gray-400">{placeholder}</span>}
    </label>
  );
}
