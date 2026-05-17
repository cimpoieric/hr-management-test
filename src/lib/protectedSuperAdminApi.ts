import "server-only";

import { NextResponse } from "next/server";
import { getSuperAdminDeletionBlockReason } from "@/lib/protectedSuperAdmin";

export function superAdminDeletionForbiddenResponse(user: {
  role: string;
  email: string;
}): NextResponse | null {
  const reason = getSuperAdminDeletionBlockReason(user);
  if (!reason) return null;
  return NextResponse.json({ error: reason }, { status: 403 });
}
