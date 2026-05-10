/**
 * GET /api/import/pending
 *
 * Returnează toate PendingImport-urile (email + manual).
 * Query params: status, source, search, limit, offset.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;

    const statusRaw = searchParams.get("status");
    const status = statusRaw?.trim() ? statusRaw.trim().toUpperCase() : null;
    const source = searchParams.get("source");
    const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const where: Record<string, unknown> = {};

    if (
      status &&
      ["PENDING", "APPROVED", "REJECTED", "DRAFT", "COMPLETED_UPDATE"].includes(status)
    ) {
      where.status = status;
    }

    if (source && ["MANUAL_UPLOAD", "EMAIL"].includes(source)) {
      where.sourceType = source;
    }

    const [imports, total] = await Promise.all([
      prisma.pendingImport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        select: {
          id: true,
          sourceType: true,
          fileName: true,
          mimeType: true,
          confidenceScore: true,
          status: true,
          employeeId: true,
          notes: true,
          createdAt: true,
        },
      }),
      prisma.pendingImport.count({ where }),
    ]);

    // Parse extractedFields pentru preview rapid
    const enriched = imports.map((imp) => ({
      ...imp,
      sourceIcon: imp.sourceType === "EMAIL" ? "email" : "upload",
      sourceLabel: imp.sourceType === "EMAIL" ? "Email" : "Upload",
    }));

    return NextResponse.json({ imports: enriched, total }, { status: 200 });
  } catch (error) {
    console.error("[PENDING_IMPORTS_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
