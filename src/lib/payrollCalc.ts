import { Prisma } from "@prisma/client";
import type { PeriodType } from "@/lib/paymentPeriod";

export const RO_CAS_RATE = 0.25;
export const RO_CASS_RATE = 0.1;
export const RO_INCOME_TAX_RATE = 0.1;

export type PayslipCalcResult = {
  type: PeriodType;
  grossTotal: Prisma.Decimal;
  deductionsTotal: Prisma.Decimal;
  netTotal: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  items: Array<{
    type: string;
    label: string;
    description?: string;
    amount: Prisma.Decimal;
    quantity?: Prisma.Decimal | null;
    rate?: Prisma.Decimal | null;
    sortOrder: number;
  }>;
};

export function calcWeeklyPayslip(args: {
  hoursWorked: Prisma.Decimal;
  hourlyRate: Prisma.Decimal;
  travelAllowance: Prisma.Decimal;
  holidayRate?: Prisma.Decimal;
}): PayslipCalcResult {
  const holidayRate = args.holidayRate ?? new Prisma.Decimal(0.4);
  const netSalary = args.hoursWorked.mul(args.hourlyRate);
  const holidayMoney = args.hoursWorked.mul(holidayRate);
  const totalPaid = netSalary.add(holidayMoney).add(args.travelAllowance);

  return {
    type: "weekly",
    grossTotal: totalPaid,
    deductionsTotal: new Prisma.Decimal(0),
    netTotal: totalPaid,
    totalPaid,
    items: [
      {
        type: "NET_SALARY",
        label: "Salariu net",
        description: "Tarif orar",
        amount: netSalary,
        quantity: args.hoursWorked,
        rate: args.hourlyRate,
        sortOrder: 10,
      },
      {
        type: "HOLIDAY_MONEY",
        label: "Bani concediu",
        description: `Rate: ${holidayRate.toString()} / ora`,
        amount: holidayMoney,
        quantity: args.hoursWorked,
        rate: holidayRate,
        sortOrder: 20,
      },
      {
        type: "TRAVEL_ALLOWANCE",
        label: "Diurna / transport",
        description: "Pontaj",
        amount: args.travelAllowance,
        quantity: null,
        rate: null,
        sortOrder: 30,
      },
    ],
  };
}

/** Monthly: CAS 25%, CASS 10%, income tax 10% on gross. */
export function calcMonthlyPayslip(args: {
  grossSalary: Prisma.Decimal;
  travelAllowance?: Prisma.Decimal;
}): PayslipCalcResult {
  const travel = args.travelAllowance ?? new Prisma.Decimal(0);
  const gross = args.grossSalary;
  const cas = gross.mul(RO_CAS_RATE);
  const cass = gross.mul(RO_CASS_RATE);
  const tax = gross.mul(RO_INCOME_TAX_RATE);
  const deductions = cas.add(cass).add(tax);
  const net = gross.sub(deductions);
  const totalPaid = net.add(travel);

  return {
    type: "monthly",
    grossTotal: gross,
    deductionsTotal: deductions,
    netTotal: net,
    totalPaid,
    items: [
      {
        type: "GROSS_SALARY",
        label: "Salariu brut lunar",
        amount: gross,
        sortOrder: 10,
      },
      {
        type: "CAS",
        label: "CAS (25%)",
        amount: cas,
        sortOrder: 20,
      },
      {
        type: "CASS",
        label: "CASS (10%)",
        amount: cass,
        sortOrder: 30,
      },
      {
        type: "INCOME_TAX",
        label: "Impozit venit (10%)",
        amount: tax,
        sortOrder: 40,
      },
      {
        type: "TRAVEL_ALLOWANCE",
        label: "Diurna / transport",
        amount: travel,
        sortOrder: 50,
      },
    ],
  };
}

export function resolvePayslipType(
  timesheetType: string | null | undefined,
  employeeFrequency: string | null | undefined,
): PeriodType {
  const t = String(timesheetType ?? "").toLowerCase();
  if (t === "monthly" || t === "weekly") return t;
  return String(employeeFrequency ?? "weekly").toLowerCase() === "monthly"
    ? "monthly"
    : "weekly";
}
