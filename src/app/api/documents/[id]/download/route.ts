/**
 * GET /api/documents/[id]/download
 *
 * Returnează fișierul ca stream cu headers corecte.
 * Verifică acces: user autentificat.
 * Niciodată nu expune calea absolută.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { fileExists, resolveAbsolutePath, getMimeType } from "@/lib/storage";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";

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
    const documentId = parseInt(id, 10);
    if (isNaN(documentId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const document = await prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
      select: {
        id: true,
        fileName: true,
        storagePath: true,
        mimeType: true,
        employeeId: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document negăsit" }, { status: 404 });
    }

    // Verifică existența fișierului
    const exists = await fileExists(document.storagePath);
    if (!exists) {
      return NextResponse.json(
        { error: "Fișier negăsit pe disk" },
        { status: 404 }
      );
    }

    const absolutePath = resolveAbsolutePath(document.storagePath);
    const fileStat = await stat(absolutePath);
    const mimeType = document.mimeType || getMimeType(document.fileName);

    // Stream pentru fișiere mari (>10MB)
    const stream = createReadStream(absolutePath);

    return new NextResponse(stream as unknown as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(fileStat.size),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(document.fileName)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[DOCUMENT_DOWNLOAD]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
