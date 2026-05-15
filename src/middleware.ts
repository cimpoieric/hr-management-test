/**
 * Middleware Next.js — protecție rutelor autentificate + context tenant pentru RSC/API.
 *
 * - Pagini: cookie JWT; setează headere `x-user-id`, `x-user-role`, `x-organization-id` pentru RSC.
 * - API (rute ne-publice): verifică JWT și propagă același set de headere.
 *
 * Izolarea datelor pe `organizationId` la nivel de query Prisma NU se face aici — este aplicată
 * de extensia din `src/lib/prisma.ts` (tenant scope) pentru modele marcate tenant-scoped.
 */

import {
  HEADER_ORGANIZATION_ID,
  HEADER_USER_ID,
  HEADER_USER_ROLE,
  isPublicApiPath,
} from "@/middleware/tenant";
import {
  ADMIN_PAGE_DENY_PATH,
  isSuperAdminRole,
  resolveAdminApiAccess,
  resolveAdminPageAccess,
} from "@/middleware/adminAccess";
import {
  HEADER_TRIAL_ENDING,
  isSubscriptionExemptApi,
  isSubscriptionExemptPage,
  subscriptionExpiredJson,
} from "@/middleware/subscriptionGate";
import { verifyToken } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/setup",
  "/pricing",
  "/privacy",
  "/terms",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/setup",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

const STATIC_PATTERN =
  /^\/(?:_next\/static|_next\/image|favicon\.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map))$/;

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function nextWithPath(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

async function applySubscriptionGate(
  request: NextRequest,
  pathname: string,
  role: string,
): Promise<NextResponse | null> {
  if (isSuperAdminRole(role)) return null;
  if (pathname.startsWith("/api/") && isSubscriptionExemptApi(pathname)) {
    return null;
  }
  if (!pathname.startsWith("/api/") && isSubscriptionExemptPage(pathname)) {
    return null;
  }

  const gateUrl = new URL("/api/internal/subscription-gate", request.url);
  const cookie = request.cookies.get("auth-token")?.value;
  if (!cookie) return null;

  try {
    const gateRes = await fetch(gateUrl, {
      headers: { cookie: `auth-token=${cookie}` },
      cache: "no-store",
    });
    if (!gateRes.ok) return null;

    const data = (await gateRes.json()) as {
      blocked?: boolean;
      trialEnding?: boolean;
    };

    if (data.blocked) {
      if (pathname.startsWith("/api/")) {
        return new NextResponse(subscriptionExpiredJson().body, {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
      return NextResponse.redirect(new URL("/pricing", request.url));
    }

    const res = nextWithPath(request, pathname);
    if (data.trialEnding) {
      res.headers.set(HEADER_TRIAL_ENDING, "true");
    }
    return res;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rute API (inclusiv /api/auth/*)
  if (pathname.startsWith("/api/")) {
    if (STATIC_PATTERN.test(pathname)) {
      return nextWithPath(request, pathname);
    }
    if (isPublicApiPath(pathname)) {
      return nextWithPath(request, pathname);
    }

    const token = request.cookies.get("auth-token")?.value;
    if (!token) {
      return jsonError(401, "Unauthorized");
    }
    try {
      const payload = await verifyToken(token);
      if (resolveAdminApiAccess(pathname, payload.role) === "deny") {
        return jsonError(403, "Forbidden");
      }
      const gated = await applySubscriptionGate(
        request,
        pathname,
        payload.role,
      );
      if (gated) {
        gated.headers.set(HEADER_USER_ID, String(payload.userId));
        gated.headers.set(HEADER_USER_ROLE, payload.role);
        gated.headers.set(HEADER_ORGANIZATION_ID, payload.organizationId);
        return gated;
      }
      const res = nextWithPath(request, pathname);
      res.headers.set(HEADER_USER_ID, String(payload.userId));
      res.headers.set(HEADER_USER_ROLE, payload.role);
      res.headers.set(HEADER_ORGANIZATION_ID, payload.organizationId);
      return res;
    } catch {
      return jsonError(401, "Invalid or expired token");
    }
  }

  if (STATIC_PATTERN.test(pathname)) {
    return nextWithPath(request, pathname);
  }

  // Setup gate (fără Prisma în Edge middleware).
  if (!pathname.startsWith("/_next")) {
    try {
      const res = await fetch(new URL("/api/setup", request.url), {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        needsSetup?: boolean;
      };
      const needsSetup = Boolean(json.needsSetup);
      if (needsSetup) {
        if (!pathname.startsWith("/setup")) {
          return NextResponse.redirect(new URL("/setup", request.url));
        }
        return nextWithPath(request, pathname);
      }

      if (pathname.startsWith("/setup")) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    } catch {
      // Dacă /api/setup pică, nu blocăm aplicația în middleware.
    }
  }

  if (isPublicPath(pathname)) {
    return nextWithPath(request, pathname);
  }

  const token = request.cookies.get("auth-token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const payload = await verifyToken(token);

    if (resolveAdminPageAccess(pathname, payload.role) === "deny") {
      return NextResponse.redirect(new URL(ADMIN_PAGE_DENY_PATH, request.url));
    }

    const gated = await applySubscriptionGate(request, pathname, payload.role);
    if (gated) {
      gated.headers.set(HEADER_USER_ID, String(payload.userId));
      gated.headers.set(HEADER_USER_ROLE, payload.role);
      gated.headers.set(HEADER_ORGANIZATION_ID, payload.organizationId);
      return gated;
    }

    const response = nextWithPath(request, pathname);
    response.headers.set(HEADER_USER_ID, String(payload.userId));
    response.headers.set(HEADER_USER_ROLE, payload.role);
    response.headers.set(HEADER_ORGANIZATION_ID, payload.organizationId);

    return response;
  } catch {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);

    response.cookies.set("auth-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0,
      path: "/",
    });

    return response;
  }
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
};
