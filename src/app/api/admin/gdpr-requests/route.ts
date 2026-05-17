import { requireAuth } from "@/lib/auth";
import { prismaBase as prisma } from "@/lib/prisma";
import { isJwtRoleIn, ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { isSuperAdminRole } from "@/middleware/adminAccess";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return (
      authError ??
      NextResponse.json({ error: "Neautentificat" }, { status: 401 })
    );
  }

  if (!isJwtRoleIn(user, ROLES_SETTINGS_ADMIN)) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const filterFirmId = searchParams.get("firmId");

    const where: {
      firmId?: string;
      status?: string;
    } = {};

    if (isSuperAdminRole(user.role)) {
      if (filterFirmId) where.firmId = filterFirmId;
    } else {
      where.firmId = user.organizationId;
    }

    if (status) where.status = status;

    const rows = await prisma.gdprRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const employeeIds = [
      ...new Set(
        rows
          .map((r) => Number.parseInt(r.employeeId, 10))
          .filter((id) => !Number.isNaN(id)),
      ),
    ];

    const employees = employeeIds.length
      ? await prisma.employee.findMany({
          where: { id: { in: employeeIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        })
      : [];

    const empMap = new Map(employees.map((e) => [e.id, e]));

    const orgIds = [...new Set(rows.map((r) => r.firmId))];
    const orgs = orgIds.length
      ? await prisma.organization.findMany({
          where: { id: { in: orgIds } },
          select: { id: true, name: true },
        })
      : [];
    const orgMap = new Map(orgs.map((o) => [o.id, o.name]));

    const data = rows.map((r) => {
      const empId = Number.parseInt(r.employeeId, 10);
      const emp = Number.isNaN(empId) ? null : empMap.get(empId);
      return {
        id: r.id,
        type: r.type,
        status: r.status,
        employeeId: r.employeeId,
        employeeName: emp
          ? `${emp.firstName} ${emp.lastName}`.trim()
          : `Angajat #${r.employeeId}`,
        employeeEmail: emp?.email ?? null,
        firmId: r.firmId,
        firmName: orgMap.get(r.firmId) ?? r.firmId,
        details: r.details,
        adminNotes: r.adminNotes,
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      };
    });

    const pendingCount = await prisma.gdprRequest.count({
      where: {
        ...where,
        status: "pending",
      },
    });

    return NextResponse.json({ data, pendingCount });
  } catch (error) {
    console.error("[ADMIN_GDPR_REQUESTS_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
