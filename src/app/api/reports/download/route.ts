/**
 * GET /api/reports/download?key=firm/{orgId}/reports/{type}-{timestamp}.pdf
 *
 * Verific? autentificarea ?i c? raportul apar?ine organiza?iei utilizatorului.
 * Returneaz? PDF din R2 (sau ?redirect=1 pentru URL semnat 1h, dac? S3 e configurat).
 */

import { requireRole } from "@/lib/auth";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import {
  getOrganizationReportBuffer,
  isReportKeyForOrganization,
} from "@/lib/organizationReportStorage";
import {
  isS3ObjectStorageEnabled,
  s3GetPresignedUrl,
} from "@/lib/s3ObjectStorage";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_SETTINGS_ADMIN,
  );
  if (authError || !user) {
    return (
      authError ??
      NextResponse.json({ error: "Neautentificat" }, { status: 401 })
    );
  }

  try {
    const key = request.nextUrl.searchParams.get("key")?.trim();
    if (!key) {
      return NextResponse.json(
        { error: "Parametrul key este necesar" },
        { status: 400 },
      );
    }

    if (!isReportKeyForOrganization(key, user.organizationId)) {
      return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
    }

    const wantsRedirect =
      request.nextUrl.searchParams.get("redirect") === "1" &&
      isS3ObjectStorageEnabled();

    if (wantsRedirect) {
      const signedUrl = await s3GetPresignedUrl(key, 3600);
      return NextResponse.redirect(signedUrl, 302);
    }

    const buffer = await getOrganizationReportBuffer(
      user.organizationId,
      key,
    );

    const filename =
      key.split("/").pop()?.replace(/\.pdf$/i, "") ?? "raport";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eroare";
    const status = message.includes("expirat")
      ? 410
      : message.includes("negasit")
        ? 404
        : 500;
    if (status >= 500) {
      console.error("[REPORTS_DOWNLOAD]", error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
