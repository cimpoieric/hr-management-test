import type { Decimal } from "@prisma/client/runtime/library";

/**
 * Cursuri indicative EUR/USD/GBP → RON pentru estimarea costului lunar în dashboard.
 * (Nu sunt cursuri BNR live; pot fi înlocuite ulterior cu API sau setări.)
 */
const FX_TO_RON: Record<string, number> = {
  RON: 1,
  EUR: 5.09,
  USD: 4.65,
  GBP: 5.85,
};

export function salaryMonthlyToRon(
  amount: Decimal | null | undefined,
  currency: string | null | undefined
): number {
  if (amount == null) return 0;
  const code = (currency ?? "RON").trim().toUpperCase();
  const rate = FX_TO_RON[code] ?? 1;
  return amount.toNumber() * rate;
}
