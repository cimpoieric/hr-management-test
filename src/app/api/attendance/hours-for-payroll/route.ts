import { requireRole } from "@/lib/auth";
import { ROLES_PAYROLL } from "@/lib/roles";
import { prismaTyped as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";

/** Ore pontaj per angajat pentru o saptamana calendaristica (aceleasi campuri ca in Pontaj). */
export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_PAYROLL,
  );
  if (authError || !user) return authError!;

  try {
    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get("year"));
    const weekNumber = Number(searchParams.get("weekNumber"));
    if (!Number.isFinite(year) || !Number.isFinite(weekNumber)) {
      return NextResponse.json(
        { error: "Parametri year si weekNumber sunt obligatorii" },
        { status: 400 },
      );
    }
    if (year < 2020 || year > 2040 || weekNumber < 1 || weekNumber > 53) {
      return NextResponse.json(
        { error: "year sau weekNumber invalid" },
        { status: 400 },
      );
    }

    const rows = await prisma.timesheet.findMany({
      where: { year, weekNumber },
      select: { employeeId: true, hoursWorked: true },
    });

    const hoursByEmployeeId: Record<string, string> = {};
    for (const r of rows) {
      const n = Number(r.hoursWorked);
      if (!Number.isFinite(n)) continue;
      hoursByEmployeeId[String(r.employeeId)] = trimDecimalString(n);
    }

    return NextResponse.json({
      year,
      weekNumber,
      hoursByEmployeeId,
      count: rows.length,
    });
  } catch (e) {
    console.error("[TIMESHEETS_HOURS_FOR_PAYROLL]", e);
    return NextResponse.json(
      { error: "Eroare la citirea orelor din pontaj" },
      { status: 500 },
    );
  }
}

function trimDecimalString(n: number): string {
  const s = n.toFixed(4).replace(/\.?0+$/, "");
  return s === "" ? "0" : s;
}
