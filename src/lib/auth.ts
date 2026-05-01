/**
 * Sistem autentificare JWT custom pentru HR Management.
 *
 * - Nu folosește NextAuth (auth 100% local)
 * - JWT semnat cu HS256 via `jose` (Edge-compatible)
 * - Cookie httpOnly, Secure, SameSite=Strict
 * - Niciodată nu expune passwordHash în responses
 */

import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserRole = "ADMIN" | "OPERATOR" | "ACCOUNTING";

export type AuthContext = {
  userId: number;
  email: string;
  role: UserRole;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "FALLBACK_SECRET_MINIM_32_CARACTERE_LONG_!"
);

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "8h";
const COOKIE_NAME = "auth-token";
const BCRYPT_ROUNDS = 12;

// ─── Password Hashing ────────────────────────────────────────────────────────

/**
 * Hash parolă cu bcrypt, 12 rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verifică parola contra hash-ului stocat.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── JWT Token ───────────────────────────────────────────────────────────────

/**
 * Generează JWT semnat cu HS256. Expiră în 8h (default).
 * Include: userId, email, role.
 */
export async function generateToken(
  userId: number,
  email: string,
  role: UserRole
): Promise<string> {
  return new SignJWT({ userId, email, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .setAudience("hr-management")
    .setIssuer("hr-management-api")
    .sign(JWT_SECRET);
}

/**
 * Verifică token JWT. Throw dacă invalid / expirat.
 */
export async function verifyToken(
  token: string
): Promise<AuthContext> {
  const { payload } = await jwtVerify(token, JWT_SECRET, {
    clockTolerance: 60,
    audience: "hr-management",
    issuer: "hr-management-api",
  });

  return {
    userId: payload.userId as number,
    email: payload.email as string,
    role: payload.role as UserRole,
  };
}

// ─── Cookie Helpers ──────────────────────────────────────────────────────────

/**
 * Setează cookie httpOnly cu tokenul JWT.
 * SameSite=Strict pentru protecție CSRF.
 */
export function setAuthCookie(
  response: NextResponse,
  token: string
): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 8, // 8 ore
    path: "/",
  });
}

/**
 * Șterge cookie-ul de autentificare (logout).
 */
export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
}

// ─── Request Helpers ─────────────────────────────────────────────────────────

/**
 * Extrage și verifică token din request (cookie).
 * Returnează AuthContext sau null.
 */
export async function verifyAuth(
  request: NextRequest
): Promise<AuthContext | null> {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifyToken(token);
  } catch {
    return null;
  }
}

/**
 * Verifică autentificare + rol permis.
 * Returnează user valid sau un NextResponse de eroare.
 */
export async function requireAuth(
  request: NextRequest,
  allowedRoles?: UserRole[]
): Promise<
  | { user: AuthContext; response: null }
  | { user: null; response: NextResponse }
> {
  const user = await verifyAuth(request);

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Neautentificat" },
        { status: 401 }
      ),
    };
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Acces interzis" },
        { status: 403 }
      ),
    };
  }

  return { user, response: null };
}
