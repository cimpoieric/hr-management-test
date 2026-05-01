import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const result = await prisma.employee.aggregate({
      where: {
        salaryType: "LUNAR",
        status: "ACTIVE",
        salaryCurrency: "RON",
        salaryAmount: { not: null },
      },
      _sum: { salaryAmount: true },
      _count: { _all: true },
    });

    return NextResponse.json({
      totalMonthlySalaryRON:
        result._sum.salaryAmount != null ? result._sum.salaryAmount.toNumber() : 0,
      employeeCount: result._count._all ?? 0,
    });
  } catch (error) {
    console.error("[DASHBOARD_SALARY_SUMMARY]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
