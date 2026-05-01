/**
 * GET /api/reports/download/[id] — Servește un raport PDF generat
 *
 * Verifică:
 * 1. Autentificare
 * 2. Fișierul există în ./data/reports/
 * 3. Fișierul nu e expirat (max 24h)
 *
 * Returnează: PDF ca application/pdf cu Content-Disposition: attachment
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { requireAuth } from "@/lib/auth";

const REPORTS_DIR = join(process.cwd(), "data", "reports");
const REPORT_TTL_MS = 24 * 60 * 60 * 1000; // 24 ore

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Validare UUID simplă
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "ID raport invalid" }, { status: 400 });
    }

    const filePath = join(REPORTS_DIR, `${id}.pdf`);

    // Verifică existența
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: "Raport negasit sau expirat. Rapoartele sunt valabile 24 ore." },
        { status: 404 }
      );
    }

    // Verifică expirarea
    const stats = await stat(filePath);
    const ageMs = Date.now() - stats.mtimeMs;
    if (ageMs > REPORT_TTL_MS) {
      return NextResponse.json(
        { error: "Raport expirat. Genereaza din nou." },
        { status: 410 }
      );
    }

    // Citește și servește
    const buffer = await readFile(filePath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="raport-${id.slice(0, 8)}.pdf"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });

  } catch (error) {
    console.error("[REPORTS_DOWNLOAD]", error);
    return NextResponse.json({ error: "Eroare la descarcare" }, { status: 500 });
  }
}
