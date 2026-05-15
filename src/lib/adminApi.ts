import "server-only";

import { toApiErrorResponse } from "@/lib/apiErrorResponse";
import { type AuthContext, requireSuperAdmin } from "@/lib/auth";
import { type NextRequest, NextResponse } from "next/server";

export type AdminApiAuth =
  | { user: AuthContext; response: null }
  | { user: null; response: NextResponse };

/** Ensures the caller is authenticated as SUPER_ADMIN. */
export async function requireAdminApi(
  request: NextRequest,
): Promise<AdminApiAuth> {
  const { user, response } = await requireSuperAdmin(request);
  if (response || !user) {
    return {
      user: null,
      response:
        response ?? NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { user, response: null };
}

export async function withAdminApi(
  request: NextRequest,
  handler: (user: AuthContext) => Promise<Response>,
): Promise<Response> {
  const auth = await requireAdminApi(request);
  if (!auth.user) return auth.response;
  try {
    return await handler(auth.user);
  } catch (error) {
    return toApiErrorResponse(request, error);
  }
}
