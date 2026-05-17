import { requireOrgAdmin } from "@/lib/auth";
import { prismaBase as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";

/** Marks GDPR informed for the latest employee in the org (admin onboarding flow). */
export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireOrgAdmin(request);
  if (authError || !user) {
    return (
      authError ??
      NextResponse.json({ error: "Neautentificat" }, { status: 401 })
    );
  }

  try {
    const employee = await prisma.employee.findFirst({
      where: { organizationId: user.organizationId },
      orderBy: { id: "desc" },
      select: { id: true, gdprInformedAt: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Nu exista inca un angajat inregistrat." },
        { status: 404 },
      );
    }

    if (employee.gdprInformedAt) {
      return NextResponse.json({
        success: true,
        employeeId: employee.id,
        gdprInformedAt: employee.gdprInformedAt.toISOString(),
      });
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
    console.error("[ONBOARDING_GDPR_INFORMED]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
