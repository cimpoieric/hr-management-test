/**
 * GET /api/auth/me
 *
 * Returnează datele utilizatorului autentificat.
 * Citește cookie `auth-token`, verifică JWT.
 * NU returnează passwordHash.
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);

    if (!user) {
      return NextResponse.json(
        { error: "Neautentificat" },
        { status: 401 }
      );
    }

    // Re-fetch din DB pentru datele cele mai recente
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
      },
    });

    if (!dbUser || !dbUser.isActive) {
      return NextResponse.json(
        { error: "Cont dezactivat sau șters" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        user: {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role,
          mustChangePassword: dbUser.mustChangePassword,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[AUTH_ME]", error);
    return NextResponse.json(
      { error: "Eroare server intern" },
      { status: 500 }
    );
  }
}
