/**
 * GET /api/documents/[id]/view
 *
 * Returnează fișierul inline (preview) — același flux ca download, fără Readable.from.
 */

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isS3ObjectStorageEnabled } from "@/lib/s3ObjectStorage";
import { fileExists, getMimeType, readFile } from "@/lib/storage";
import { type NextRequest, NextResponse } from "next/server";

function storageNotConfiguredResponse(): NextResponse {
  return NextResponse.json({ error: "Storage configuration missing" }, { status: 500 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return (
      authError ??
      NextResponse.json({ error: "Neautentificat" }, { status: 401 })
    );
  }

  if (!isS3ObjectStorageEnabled() && process.env.VERCEL === "1") {
    return storageNotConfiguredResponse();
  }

  try {
    const { id } = await params;
    const documentId = Number.parseInt(id, 10);
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
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document negasit" }, { status: 404 });
    }

    const exists = await fileExists(document.storagePath);
    if (!exists) {
      return NextResponse.json(
        { error: "Fisier negasit in stocare" },
        { status: 404 },
      );
    }

    const mimeType = document.mimeType || getMimeType(document.fileName);
    const buffer = await readFile(document.storagePath);
    const safeName = encodeURIComponent(document.fileName);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `inline; filename*=UTF-8''${safeName}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[DOCUMENT_VIEW]", error);
    const message =
      error instanceof Error ? error.message : "Eroare la vizualizare";
    if (
      message.includes("S3") ||
      message.includes("configured") ||
      message.includes("Storage")
    ) {
      return storageNotConfiguredResponse();
    }
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
