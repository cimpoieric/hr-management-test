/**
 * Middleware Next.js — protecție rutelor autentificate.
 *
 * Interceptează TOATE rutele protejate, verifică cookie `auth-token`,
 * și adaugă headere `x-user-id` și `x-user-role` pentru Server Components.
 *
 * Excluse: API routes, assets statice, login page.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

// Rute publice — fără autentificare (prefixe; „/” doar egalitate exactă)
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth/login",
  "/api/auth/register",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

// Pattern pentru assete statice și API
const EXCLUDED_PATTERN =
  /^\/(?:api\/(?!auth(?:\/|$)).*|_next\/static|_next\/image|favicon\.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map))$/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Exclude assete statice și API (except auth)
  if (EXCLUDED_PATTERN.test(pathname)) {
    return NextResponse.next();
  }

  // 2. Exclude rute explicit publice
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // 3. Verifică cookie auth-token
  const token = request.cookies.get("auth-token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const payload = await verifyToken(token);

    // 4. Token valid — adaugă headere pentru Server Components
    const response = NextResponse.next();
    response.headers.set("x-user-id", String(payload.userId));
    response.headers.set("x-user-role", payload.role);

    return response;
  } catch {
    // Token invalid sau expirat — redirect la login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);

    // Șterge cookie-ul invalid
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

// Matcher — se aplică pe TOATE rutele (except cele statice din EXCLUDED_PATTERN)
export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
};
