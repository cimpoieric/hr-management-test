import { type NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/register
 *
 * Public registration is disabled. Accounts are created via setup wizard or by an administrator.
 * This app uses custom JWT auth (see /api/auth/login), not NextAuth.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error:
        "Public registration is disabled. Use the setup wizard or ask an administrator to create an account.",
    },
    { status: 403 },
  );
}
