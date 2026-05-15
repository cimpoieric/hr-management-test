import type { Decimal } from "@prisma/client/runtime/library";

/**
 * Cursuri indicative → RON pentru agregări dashboard (fără API BNR).
 * EUR = 5 RON conform cerinței; celelalte rămân orientative.
 */
const FX_TO_RON: Record<string, number> = {
  RON: 1,
  EUR: 5,
  USD: 4.65,
  GBP: 5.85,
};

/** Săptămâni medii / lună (52 / 12). */
const WEEKS_PER_MONTH = 52 / 12;

/** Normă full-time: 40 h/săpt × 52 / 12 ≈ ore lună pentru echivalent din tarif orar. */
const FULL_TIME_HOURS_PER_MONTH = (40 * 52) / 12;

function toNumber(amount: Decimal | null | undefined): number {
  if (amount == null) return 0;
  const n = amount.toNumber();
  return Number.isFinite(n) ? n : 0;
}

function applyFx(
  monthlyInOriginalCurrency: number,
  currency: string | null | undefined,
): number {
  const raw = (currency ?? "RON").trim().toUpperCase();
  const code = raw || "RON";
  const rate = FX_TO_RON[code] ?? 1;
  return monthlyInOriginalCurrency * rate;
}

/**
 * Brut lunar echivalent în RON: LUNAR = sumă lunară; SAPTAMANAL = brut/săpt × 52/12;
 * ORA = tarif/h × ore lună (normă 40 h/săpt); tip lipsă → tratat ca LUNAR.
 */
export function equivalentMonthlyGrossToRon(
  amount: Decimal | null | undefined,
  salaryType: string | null | undefined,
  currency: string | null | undefined,
): number {
  const base = toNumber(amount);
  if (base <= 0) return 0;

  const t = String(salaryType ?? "LUNAR").toUpperCase();
  let monthlyInPayCurrency = base;
  if (t === "SAPTAMANAL") monthlyInPayCurrency = base * WEEKS_PER_MONTH;
  else if (t === "ORA") monthlyInPayCurrency = base * FULL_TIME_HOURS_PER_MONTH;

  return applyFx(monthlyInPayCurrency, currency);
}

/** Brut lunar deja în moneda contractului → RON (fără conversie SAPTAMANAL/ORA). */
export function salaryMonthlyToRon(
  amount: Decimal | null | undefined,
  currency: string | null | undefined,
): number {
  if (amount == null) return 0;
  return applyFx(toNumber(amount), currency);
}
