import { requireAuth } from "@/lib/auth";
import {
  assertEmployeeSelfService,
  GDPR_REQUEST_TYPES,
  resolveEmployeeForUser,
} from "@/lib/gdpr";
import { prismaBase as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  type: z.enum(GDPR_REQUEST_TYPES),
  details: z.string().max(2000).optional().nullable(),
});

export async function POST(request: NextRequest) {
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
        { error: "Profil angajat negasit pentru acest cont." },
        { status: 404 },
      );
    }

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const pending = await prisma.gdprRequest.findFirst({
      where: {
        employeeId: String(employee.id),
        firmId: user.organizationId,
        status: "pending",
        type: parsed.data.type,
      },
    });
    if (pending) {
      return NextResponse.json(
        {
          success: true,
          message:
            "Exista deja o solicitare in asteptare. Vei fi contactat de adminul HR.",
          requestId: pending.id,
        },
        { status: 200 },
      );
    }

    const row = await prisma.gdprRequest.create({
      data: {
        type: parsed.data.type,
        status: "pending",
        employeeId: String(employee.id),
        firmId: user.organizationId,
        details: parsed.data.details?.trim() || null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        requestId: row.id,
        message:
          "Solicitarea ta a fost inregistrata. Vei fi contactat de adminul HR.",
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "EMPLOYEE_ROLE_REQUIRED") {
      return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
    }
    console.error("[EMPLOYEE_GDPR_REQUEST]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
