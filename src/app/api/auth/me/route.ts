/**
 * GET /api/auth/me
 *
 * Returnează datele utilizatorului autentificat.
 * Citește cookie `auth-token`, verifică JWT.
 * NU returnează passwordHash.
 */

import { verifyAuth } from "@/lib/auth";
import { runApi } from "@/lib/apiErrorResponse";
import { Errors } from "@/lib/errors";
import { prismaTyped as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return runApi(request, async () => {
    const user = await verifyAuth(request);

    if (!user) {
      throw Errors.UNAUTHORIZED;
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        isActive: true,
        mustChangePassword: true,
      },
    });

    if (!dbUser || !dbUser.isActive) {
      throw Errors.ACCOUNT_INACTIVE;
    }

    return NextResponse.json(
      {
        user: {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role,
          organizationId: dbUser.organizationId,
          mustChangePassword: dbUser.mustChangePassword,
        },
      },
      { status: 200 },
    );
  });
}
