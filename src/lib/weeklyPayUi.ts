import {
  LUNAR_WORKING_DAYS_NORM,
  computeWeeklyPayTotal,
  parseSalaryTypeInput,
} from "@/lib/salaryFields";

export function defaultWeeklyPayUnitValue(salaryType: unknown): string {
  const t = parseSalaryTypeInput(String(salaryType ?? ""));
  if (t === "ORA") return "40";
  if (t === "SAPTAMANAL") return "1";
  if (t === "LUNAR") return "";
  return "";
}

export function getWeeklyPayInputConfig(salaryType: unknown): {
  label: string;
  step: number;
  min: number;
  placeholder: string;
} {
  const t = parseSalaryTypeInput(String(salaryType ?? ""));
  if (t === "ORA")
    return { label: "Ore lucrate", step: 0.5, min: 0, placeholder: "" };
  if (t === "SAPTAMANAL")
    return { label: "Săptămâni lucrate", step: 1, min: 0, placeholder: "" };
  if (t === "LUNAR")
    return {
      label: "Zile lucrate (opțional, default 21)",
      step: 1,
      min: 0,
      placeholder: `Lasă gol pentru ${LUNAR_WORKING_DAYS_NORM} zile`,
    };
  return { label: "Perioadă", step: 1, min: 0, placeholder: "" };
}

/** Unități numerice pentru calcul live (LUNAR gol → 21). */
export function unitsForLiveCalculation(
  raw: string | undefined,
  salaryType: unknown,
): number {
  const t = parseSalaryTypeInput(String(salaryType ?? ""));
  const s = raw !== undefined ? String(raw).trim() : "";
  if (t === "LUNAR") {
    if (s === "") return LUNAR_WORKING_DAYS_NORM;
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : LUNAR_WORKING_DAYS_NORM;
  }
  const n = Number((raw !== undefined ? raw : "0").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function liveWeeklyPayTotal(
  salaryType: unknown,
  rawUnits: string | undefined,
  salaryAmount: unknown,
): number | null {
  const u = unitsForLiveCalculation(rawUnits, salaryType);
  return computeWeeklyPayTotal(salaryType, u, salaryAmount);
}
