import { requireAuth } from "@/lib/auth";
import { runApi } from "@/lib/apiErrorResponse";
import { Errors } from "@/lib/errors";
import { prismaTyped as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return runApi(request, async () => {
    const { user, response: authError } = await requireAuth(request);
    if (authError || !user) {
      if (authError) return authError;
      throw Errors.UNAUTHORIZED;
    }

    const count = await prisma.employee.count({
      where: { organizationId: user.organizationId },
    });

    const company = await prisma.company.findFirst({
      where: { organizationId: user.organizationId },
      select: { id: true, name: true },
    });

    return NextResponse.json({
      needsOnboarding: count === 0,
      employeeCount: count,
      defaultCompanyId: company?.id ?? null,
    });
  });
}
