"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, Download, X } from "lucide-react";

type SalaryType = "LUNAR" | "SAPTAMANAL" | "ORA";

interface SalaryCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  salaryType?: SalaryType | null;
  salaryAmount?: number | null;
  salaryCurrency?: string | null;
  employeeName?: string;
  employeeId?: number;
  /** Pentru export linie plată (CSV) */
  iban?: string | null;
  bankName?: string | null;
  onSaved?: () => void;
}

function formatMoney(value: number, currency: string): string {
  return `${value.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function csvEscape(value: string): string {
  if (/[;"\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function defaultInputForType(type: SalaryType | null | undefined): string {
  if (type === "ORA") return "160";
  if (type === "SAPTAMANAL") return "4";
  if (type === "LUNAR") return "";
  return "";
}

export function SalaryCalculatorModal({
  isOpen,
  onClose,
  salaryType,
  salaryAmount,
  salaryCurrency,
  employeeName,
  employeeId,
  iban,
  bankName,
  onSaved,
}: SalaryCalculatorModalProps) {
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const currency = (salaryCurrency?.trim() || "RON").toUpperCase();
  const amount = salaryAmount ?? 0;

  useEffect(() => {
    if (!isOpen) return;
    setInputValue(defaultInputForType(salaryType));
    setSaveMessage("");
  }, [isOpen, salaryType]);

  const inputMeta = useMemo(() => {
    if (salaryType === "ORA") {
      return {
        label: "Ore lucrate",
        suffix: "ore",
        hint: "Calcul: ore × sumă brută / oră",
      };
    }
    if (salaryType === "SAPTAMANAL") {
      return {
        label: "Săptămâni lucrate",
        suffix: "săptămâni",
        hint: "Calcul: săptămâni × sumă brută / săptămână",
      };
    }
    if (salaryType === "LUNAR") {
      return {
        label: "Zile lucrate (opțional)",
        suffix: "zile",
        hint: "Lasă gol pentru suma lunară integrală. Altfel: (zile / 21) × sumă brută lunară",
      };
    }
    return { label: "", suffix: "", hint: "" };
  }, [salaryType]);

  const calculated = useMemo(() => {
    if (!salaryType || amount <= 0) return 0;
    if (salaryType === "ORA") {
      const h = Number(inputValue.replace(",", ".") || "0");
      return Number.isFinite(h) && h >= 0 ? h * amount : 0;
    }
    if (salaryType === "SAPTAMANAL") {
      const w = Number(inputValue.replace(",", ".") || "0");
      return Number.isFinite(w) && w >= 0 ? w * amount : 0;
    }
    if (salaryType === "LUNAR") {
      const raw = inputValue.trim();
      if (!raw) return amount;
      const d = Number(raw.replace(",", "."));
      if (!Number.isFinite(d) || d < 0) return 0;
      return (d / 21) * amount;
    }
    return 0;
  }, [salaryType, amount, inputValue]);

  function parsedInputForSave(): { inputLabel: string; inputValue: number | null } {
    if (salaryType === "ORA") {
      return { inputLabel: "Ore lucrate", inputValue: Number(inputValue.replace(",", ".") || "0") };
    }
    if (salaryType === "SAPTAMANAL") {
      return {
        inputLabel: "Săptămâni lucrate",
        inputValue: Number(inputValue.replace(",", ".") || "0"),
      };
    }
    if (salaryType === "LUNAR") {
      const raw = inputValue.trim();
      return {
        inputLabel: "Zile lucrate",
        inputValue: raw ? Number(raw.replace(",", ".")) : null,
      };
    }
    return { inputLabel: "", inputValue: null };
  }

  function handleExportPayLine() {
    if (!salaryType || amount <= 0) return;
    const name = (employeeName ?? "").trim() || "—";
    const ibanPlain = (iban ?? "").trim();
    const bank = (bankName ?? "").trim();
    const sumStr = calculated.toLocaleString("ro-RO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const header = ["Nume", "IBAN", "Bancă", "Suma de plată", "Monedă"].join(";");
    const ibanCell = ibanPlain ? `="${ibanPlain.replace(/"/g, '""')}"` : "";
    const row = [
      csvEscape(name),
      ibanCell,
      csvEscape(bank),
      csvEscape(sumStr),
      csvEscape(currency),
    ].join(";");
    const bom = "\uFEFF";
    const blob = new Blob([bom + header + "\n" + row], {
      type: "text/csv;charset=utf-8;",
    });
    const safeName = name.replace(/[^\w\d\-]+/g, "_").slice(0, 40) || "angajat";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `linie-plata-${safeName}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleSaveCalculation() {
    if (!employeeId || !salaryType || amount <= 0) return;
    const { inputLabel, inputValue: iv } = parsedInputForSave();

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
          inputValue: iv,
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

  if (!isOpen) return null;

  const canCalculate = !!salaryType && amount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-xl border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Calcul salarial</h3>
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
          {salaryType && inputMeta.label ? (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {inputMeta.label}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={salaryType === "LUNAR" ? "ex: 21 sau lasă gol" : undefined}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <span className="shrink-0 text-xs text-gray-500">{inputMeta.suffix}</span>
              </div>
              <span className="mt-1 block text-xs text-gray-400">{inputMeta.hint}</span>
            </label>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Selectează tipul de plată (ORA / SAPTAMANAL / LUNAR) și suma brută pentru acest
              angajat.
            </div>
          )}

          {!canCalculate ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Completează „Tip plată” și „Sumă brută” pentru a calcula.
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex items-center gap-2 text-emerald-800">
                <Calculator size={16} />
                <span className="text-sm font-medium">Total de plată (live)</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-emerald-900 tabular-nums">
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

        <div className="flex flex-wrap items-center justify-end gap-2 border-t px-6 py-4">
          <button
            type="button"
            onClick={handleExportPayLine}
            disabled={!canCalculate}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-40"
          >
            <Download size={16} />
            Export linie plată
          </button>
          <button
            type="button"
            onClick={handleSaveCalculation}
            disabled={!employeeId || !canCalculate || saving}
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
