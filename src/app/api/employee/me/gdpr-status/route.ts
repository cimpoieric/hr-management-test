import { requireAuth } from "@/lib/auth";
import { resolveEmployeeForUser } from "@/lib/gdpr";
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
    const employee = await resolveEmployeeForUser(user);
    if (!employee) {
      return NextResponse.json({
        employeeId: null,
        gdprInformedAt: null,
        needsBanner: false,
      });
    }

    return NextResponse.json({
      employeeId: employee.id,
      gdprInformedAt: employee.gdprInformedAt?.toISOString() ?? null,
      needsBanner: employee.gdprInformedAt == null,
    });
  } catch (error) {
    console.error("[EMPLOYEE_GDPR_STATUS]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
