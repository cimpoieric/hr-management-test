import { requireAuth } from "@/lib/auth";
import {
  assertEmployeeSelfService,
  buildEmployeePortableExport,
  resolveEmployeeForUser,
} from "@/lib/gdpr";
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
    assertEmployeeSelfService(user);
    const employee = await resolveEmployeeForUser(user);
    if (!employee) {
      return NextResponse.json(
        {
          error:
            "Nu exista un profil de angajat asociat contului (email). Contacteaza HR.",
        },
        { status: 404 },
      );
    }

    const payload = await buildEmployeePortableExport(employee.id);
    if (!payload) {
      return NextResponse.json({ error: "Date indisponibile" }, { status: 404 });
    }

    const fileName = `date-personale-${employee.id}-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "EMPLOYEE_ROLE_REQUIRED") {
      return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
    }
    console.error("[EMPLOYEE_EXPORT_DATA]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
