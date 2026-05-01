/**
 * POST /api/auth/login
 *
 * Autentificare cu email + parola.
 * - Verifică credențialele în DB
 * - Generează JWT + setează httpOnly cookie
 * - Rate limiting simplu: contor eșecuri în memorie (5 încercări / IP / 15 min)
 * - NU returnează niciodată passwordHash
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import {
  verifyPassword,
  generateToken,
  setAuthCookie,
  type UserRole,
} from "@/lib/auth";
import { logAuditFF, getClientIp } from "@/lib/audit";

const prisma = new PrismaClient();

// ─── Rate Limiting (memorie simplă) ──────────────────────────────────────────

type AttemptEntry = {
  count: number;
  firstAttempt: number;
};

const attemptStore = new Map<string, AttemptEntry>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attemptStore.get(ip);

  if (!entry) {
    attemptStore.set(ip, { count: 1, firstAttempt: now });
    return true;
  }

  // Reset dacă a trecut fereastra
  if (now - entry.firstAttempt > WINDOW_MS) {
    attemptStore.set(ip, { count: 1, firstAttempt: now });
    return true;
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return false;
  }

  entry.count++;
  return true;
}

function clearAttempts(ip: string): void {
  attemptStore.delete(ip);
}

// ─── POST /api/auth/login ────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Email invalid"),
  password: z.string().min(6, "Parola trebuie să aibă minim 6 caractere"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    // 1. Rate limiting
    const clientIp = getClientIp(request);
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: "Prea multe încercări. Încearcă din nou peste 15 minute." },
        { status: 429 }
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
      });
      return NextResponse.json(
        { error: "Email sau parolă invalidă" },
        { status: 401 }
      );
    }

    // 3. Verifică parola
    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      // Audit: login eșuat (parolă greșită)
      logAuditFF({
        action: "LOGIN_FAILED",
        entity: "User",
        entityId: user.id,
        userId: user.id,
        userName: user.name || user.email,
        userRole: user.role,
        ipAddress: clientIp,
        details: `Autentificare esuata (parola gresita): ${email}`,
      });
      return NextResponse.json(
        { error: "Email sau parolă invalidă" },
        { status: 401 }
      );
    }

    // 4. Autentificare reușită — curăță contorul, generează token
    clearAttempts(clientIp);

    const token = await generateToken(user.id, user.email, user.role as UserRole);

    // Update last login
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    } catch {
      // ignore
    }

    // Audit: login reușit
    logAuditFF({
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      userId: user.id,
      userName: user.name || user.email,
      userRole: user.role,
      ipAddress: clientIp,
      details: `Autentificare reusita: ${user.email}`,
    });

    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        },
      },
      { status: 200 }
    );

    setAuthCookie(response, token);

    return response;
  } catch (error) {
    console.error("[AUTH_LOGIN]", error);
    return NextResponse.json(
      { error: "Eroare server intern" },
      { status: 500 }
    );
  }
}
