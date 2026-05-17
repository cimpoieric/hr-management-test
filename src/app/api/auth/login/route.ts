/**
 * POST /api/auth/login
 *
 * Autentificare cu email + parola.
 * - Verifică credențialele în DB
 * - Generează JWT + setează httpOnly cookie
 * - Rate limiting simplu: contor în memorie (5 încercări / email+IP / 15 min)
 * - NU returnează niciodată passwordHash
 */

import { getClientIp, logAuditFF } from "@/lib/audit";
import { generateToken, setAuthCookie, verifyPassword } from "@/lib/auth";
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  makeLoginRateLimitKey,
} from "@/lib/loginRateLimit";
import { prismaBase as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// ─── POST /api/auth/login ────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Email invalid"),
  password: z.string().min(6, "Parola trebuie să aibă minim 6 caractere"),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;

    // 1. Rate limiting (email + IP — nu blochează alte conturi pe același IP)
    const clientIp = getClientIp(request);
    const rateKey = makeLoginRateLimitKey(email, clientIp);
    if (!checkLoginRateLimit(rateKey)) {
      return NextResponse.json(
        { error: "Prea multe încercări. Încearcă din nou peste 15 minute." },
        { status: 429 },
      );
    }

    // 2. Găsește utilizatorul
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        organizationId: true,
        isActive: true,
        mustChangePassword: true,
      },
    });

    if (!user || !user.isActive) {
      // Audit: login eșuat (user negăsit)
      logAuditFF({
        action: "LOGIN_FAILED",
        entity: "User",
        ipAddress: clientIp,
        details: `Autentificare esuata (email negasit): ${email}`,
        firmId: "__unauthenticated__",
      });
      return NextResponse.json(
        { error: "Email sau parolă invalidă" },
        { status: 401 },
      );
    }

    // 3. Verifică parola
    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { failedAttempts: { increment: 1 } },
        });
      } catch {
        // ignore if column missing in old deploy
      }
      // Audit: login eșuat (parolă greșită)
      logAuditFF({
        action: "LOGIN_FAILED",
        entity: "User",
        entityId: null,
        userId: user.id,
        userName: user.name || user.email,
        userRole: user.role,
        ipAddress: clientIp,
        details: `Autentificare esuata (parola gresita): ${email}`,
        firmId: user.organizationId,
      });
      return NextResponse.json(
        { error: "Email sau parolă invalidă" },
        { status: 401 },
      );
    }

    // 4. Autentificare reușită — curăță contorul, generează token
    clearLoginRateLimit(rateKey);

    const organizationId = String(user.organizationId);

    const token = await generateToken(
      user.id,
      user.email,
      user.role,
      organizationId,
    );

    // Update last login + reset failed attempts
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), failedAttempts: 0 },
      });
    } catch {
      // ignore (e.g. schema not migrated yet)
    }

    // Audit: login reușit
    logAuditFF({
      action: "LOGIN",
      entity: "User",
      entityId: null,
      userId: user.id,
      userName: user.name || user.email,
      userRole: user.role,
      ipAddress: clientIp,
      details: `Autentificare reusita: ${user.email}`,
      firmId: organizationId,
    });

    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId,
          mustChangePassword: user.mustChangePassword,
        },
      },
      { status: 200 },
    );

    setAuthCookie(response, token);

    return response;
  } catch (error) {
    console.error("[AUTH_LOGIN]", error);
    return NextResponse.json(
      { error: "Eroare server intern" },
      { status: 500 },
    );
  }
}
