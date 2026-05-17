import { requireAuth } from "@/lib/auth";
import { resolveEmployeeForUser } from "@/lib/gdpr";
import { prismaBase as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
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
      return NextResponse.json(
        { error: "Profil angajat negasit." },
        { status: 404 },
      );
    }

    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        gdprInformedAt: new Date(),
        gdprInformedBy: user.userId,
      },
      select: { id: true, gdprInformedAt: true },
    });

    return NextResponse.json({
      success: true,
      employeeId: updated.id,
      gdprInformedAt: updated.gdprInformedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("[EMPLOYEE_GDPR_INFORMED]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
