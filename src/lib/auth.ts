/**
 * JWT auth (HS256, httpOnly cookie). Payload: userId, email, role, organizationId.
 */

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { type NextRequest, NextResponse } from "next/server";
import { forbiddenJson, unauthorizedJson } from "@/lib/apiErrorResponse";
import {
  assertValidJwtRole,
  parseJwtRole,
  type RequireRoleOptions,
  UserRole,
} from "./roles";

export type { RequireRoleOptions, UserRole } from "./roles";
export {
  assertValidJwtRole,
  isJwtRoleIn,
  parseJwtRole,
  ROLES_EMPLOYEES_RW,
  ROLES_PAYROLL,
  ROLES_SETTINGS_ADMIN,
  WRITE_ROLES,
} from "./roles";

export type AuthContext = {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string;
};

let cachedJwtSecretKey: Uint8Array | null = null;

function getJwtSecretKey(): Uint8Array {
  if (cachedJwtSecretKey) return cachedJwtSecretKey;
  const s = (process.env.JWT_SECRET ?? "").trim();
  if (s.length < 32) {
    throw new Error(
      "JWT_SECRET lipsește sau are sub 32 de caractere. Setează în .env sau rulează: npm run setup",
    );
  }
  cachedJwtSecretKey = new TextEncoder().encode(s);
  return cachedJwtSecretKey;
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "8h";
export const AUTH_TOKEN_COOKIE = "auth-token";
const COOKIE_NAME = AUTH_TOKEN_COOKIE;
const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

const PASSWORD_RESET_PURPOSE = "password-reset";

export async function generatePasswordResetToken(
  userId: string,
  email: string,
): Promise<string> {
  return new SignJWT({
    purpose: PASSWORD_RESET_PURPOSE,
    userId,
    email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .setAudience("hr-management")
    .setIssuer("hr-management-api")
    .sign(getJwtSecretKey());
}

export async function verifyPasswordResetToken(
  token: string,
): Promise<{ userId: string; email: string }> {
  const { payload } = await jwtVerify(token, getJwtSecretKey(), {
    audience: "hr-management",
    issuer: "hr-management-api",
  });

  if (payload.purpose !== PASSWORD_RESET_PURPOSE) {
    throw new Error("JWT invalid: token de resetare parola invalid");
  }

  const userId = String(payload.userId ?? "").trim();
  const email = String(payload.email ?? "").trim().toLowerCase();

  if (!userId || !email) {
    throw new Error("JWT invalid: token de resetare parola incomplet");
  }

  return { userId, email };
}

export async function generateToken(
  userId: string,
  email: string,
  role: UserRole,
  organizationId: string,
): Promise<string> {
  return new SignJWT({
    userId,
    email,
    role,
    organizationId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .setAudience("hr-management")
    .setIssuer("hr-management-api")
    .sign(getJwtSecretKey());
}

export async function verifyToken(token: string): Promise<AuthContext> {
  const { payload } = await jwtVerify(token, getJwtSecretKey(), {
    clockTolerance: 60,
    audience: "hr-management",
    issuer: "hr-management-api",
  });

  const organizationId = payload.organizationId;
  if (
    organizationId === undefined ||
    organizationId === null ||
    String(organizationId).trim() === ""
  ) {
    throw new Error("JWT invalid: lipsește organizationId");
  }

  const rawUserId = payload.userId;
  const userId =
    typeof rawUserId === "string"
      ? rawUserId
      : rawUserId !== undefined && rawUserId !== null
        ? String(rawUserId)
        : "";

  if (!userId) {
    throw new Error("JWT invalid: lipsește userId");
  }

  const role = parseJwtRole(payload.role);
  assertValidJwtRole(role);

  return {
    userId,
    email: String(payload.email ?? ""),
    role,
    organizationId: String(organizationId),
  };
}

export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
}

export async function verifyAuth(
  request: NextRequest,
): Promise<AuthContext | null> {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const ctx = await verifyToken(token);
    const { enterTenantContextFromAuth } =
      await import("./tenantRequestStorage");
    const { setAuditContext } = await import("./auditContext");
    enterTenantContextFromAuth({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      email: ctx.email,
      role: ctx.role,
    });
    setAuditContext(request, ctx.userId, ctx.email, ctx.role);
    return ctx;
  } catch {
    return null;
  }
}

export async function requireAuth(
  request: NextRequest,
): Promise<
  { user: AuthContext; response: null } | { user: null; response: NextResponse }
> {
  const user = await verifyAuth(request);

  if (!user) {
    return {
      user: null,
      response: unauthorizedJson(request),
    };
  }

  return { user, response: null };
}

export async function requireRole(
  request: NextRequest,
  allowed: UserRole[],
  options?: RequireRoleOptions,
): Promise<
  { user: AuthContext; response: null } | { user: null; response: NextResponse }
> {
  const base = await requireAuth(request);
  if (!base.user) return base;

  const bypass = options?.superAdminBypass !== false;
  if (bypass && base.user.role === UserRole.SUPER_ADMIN) {
    return { user: base.user, response: null };
  }

  if (!allowed.includes(base.user.role)) {
    return {
      user: null,
      response: forbiddenJson(request),
    };
  }

  return { user: base.user, response: null };
}

export async function requireOrgAdmin(request: NextRequest) {
  return requireRole(request, [UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN], {
    superAdminBypass: false,
  });
}

export async function requireSuperAdmin(request: NextRequest) {
  return requireRole(request, [UserRole.SUPER_ADMIN], {
    superAdminBypass: false,
  });
}
