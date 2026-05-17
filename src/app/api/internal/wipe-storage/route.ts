/**
 * POST /api/internal/wipe-storage
 * Header: Authorization: Bearer <STORAGE_WIPE_SECRET>
 *
 * Sterge obiectele R2/S3: documents/, imports/, firm/
 */

import { wipeTenantObjectStorage } from "@/lib/storageWipe";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorize(request: NextRequest): boolean {
  const secret = process.env.STORAGE_WIPE_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return token.length > 0 && token === secret;
}

export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.headers.get("x-confirm") !== "wipe-all-storage") {
    return NextResponse.json(
      {
        error: "Missing confirmation header",
        hint: 'Set header x-confirm: wipe-all-storage',
      },
      { status: 400 },
    );
  }

  const summary = await wipeTenantObjectStorage();
  return NextResponse.json({ ok: true, ...summary });
}
