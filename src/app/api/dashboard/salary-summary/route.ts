import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { salaryMonthlyToRon } from "@/lib/salaryCostRon";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const rows = await prisma.employee.findMany({
      where: {
        salaryType: "LUNAR",
        status: "ACTIVE",
        salaryAmount: { not: null },
      },
      select: { salaryAmount: true, salaryCurrency: true },
    });
    const totalMonthlySalaryRON = rows.reduce(
      (s, e) => s + salaryMonthlyToRon(e.salaryAmount, e.salaryCurrency),
      0
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
