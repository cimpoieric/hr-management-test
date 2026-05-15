import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { equivalentMonthlyGrossToRon } from "@/lib/salaryCostRon";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return (
      authError ??
      NextResponse.json({ error: "Neautentificat" }, { status: 401 })
    );
  }

  try {
    const rows = await prisma.employee.findMany({
      where: {
        status: "ACTIVE",
        salaryAmount: { not: null },
      },
      select: { salaryAmount: true, salaryCurrency: true, salaryType: true },
    });
    const totalMonthlySalaryRON = rows.reduce(
      (s, e) =>
        s +
        equivalentMonthlyGrossToRon(
          e.salaryAmount,
          e.salaryType != null ? String(e.salaryType) : null,
          e.salaryCurrency,
        ),
      0,
    );

    return NextResponse.json({
      totalMonthlySalaryRON: Math.round(totalMonthlySalaryRON * 100) / 100,
      employeeCount: rows.length,
    });
  } catch (error) {
    console.error("[DASHBOARD_SALARY_SUMMARY]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
