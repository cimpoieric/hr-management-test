/**
 * API Logo Firmă
 *
 * GET    /api/settings/logo — Verifică dacă logo-ul există, returnează URL
 * POST   /api/settings/logo — Upload logo nou (PNG/JPG, max 500KB)
 * DELETE /api/settings/logo — Șterge logo
 *
 * Producție (Vercel): Cloudflare R2 / S3 (`S3_*`, opțional `S3_PUBLIC_BASE_URL`).
 * Local: fallback pe disc în ./data/settings/{organizationId}/logo.png
 */

import { requireAuth } from "@/lib/auth";
import { checkPlan, FEATURES } from "@/lib/middleware/plan-check";
import {
  clearOrganizationLogo,
  resolveOrganizationLogo,
  uploadOrganizationLogo,
} from "@/lib/organizationLogoStorage";
import { prisma } from "@/lib/prisma";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { type NextRequest, NextResponse } from "next/server";

const MAX_SIZE = 500 * 1024; // 500KB

async function getStoredLogoUrl(
  organizationId: string,
): Promise<string | null> {
  const settings = await prisma.settings.findUnique({
    where: { organizationId },
    select: { logoUrl: true },
  });
  return settings?.logoUrl ?? null;
}

async function persistLogoUrl(
  organizationId: string,
  logoUrl: string | null,
): Promise<void> {
  await prisma.$transaction([
    prisma.settings.upsert({
      where: { organizationId },
      create: {
        organizationId,
        logoUrl,
        language: "en",
      },
      update: { logoUrl },
    }),
    prisma.organization.update({
      where: { id: organizationId },
      data: { logoUrl },
    }),
  ]);
}

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return (
      authError ??
      NextResponse.json({ error: "Neautentificat" }, { status: 401 })
    );
  }

  try {
    const storedLogoUrl = await getStoredLogoUrl(user.organizationId);
    const logo = await resolveOrganizationLogo(
      user.organizationId,
      storedLogoUrl,
    );
    if (!logo.exists) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({
      exists: true,
      url: logo.url,
      size: logo.size,
    });
  } catch (error) {
    console.error("[LOGO_GET]", error);
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const planCheck = await checkPlan(request, FEATURES.CUSTOM_BRANDING, {
    roles: ROLES_SETTINGS_ADMIN,
  });
  if (!planCheck.allowed) return planCheck.response;
  const { user } = planCheck;

  try {
    const formData = await request.formData();
    const file = formData.get("logo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Niciun fișier" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Tip fișier invalid. Doar PNG/JPG." },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Maxim 500KB" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const previousLogoUrl = await getStoredLogoUrl(user.organizationId);
    const uploaded = await uploadOrganizationLogo(
      user.organizationId,
      file,
      buffer,
    );

    await persistLogoUrl(user.organizationId, uploaded.url);

    if (previousLogoUrl && previousLogoUrl !== uploaded.url) {
      await clearOrganizationLogo(user.organizationId, previousLogoUrl);
    }

    return NextResponse.json({
      success: true,
      url: uploaded.url,
      size: uploaded.size,
      storage: uploaded.storage,
    });
  } catch (error) {
    console.error("[LOGO_POST]", error);
    const message =
      error instanceof Error ? error.message : "Eroare la upload";
    if (message.includes("S3_") || message.includes("R2/S3")) {
      return NextResponse.json(
        {
          error:
            "Stocarea logo-ului nu este configurata. Seteaza variabilele S3_* (si optional S3_PUBLIC_BASE_URL) in Vercel.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Eroare la upload" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const planCheck = await checkPlan(request, FEATURES.CUSTOM_BRANDING, {
    roles: ROLES_SETTINGS_ADMIN,
  });
  if (!planCheck.allowed) return planCheck.response;
  const { user } = planCheck;

  try {
    const storedLogoUrl = await getStoredLogoUrl(user.organizationId);
    await clearOrganizationLogo(user.organizationId, storedLogoUrl);
    await persistLogoUrl(user.organizationId, null);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[LOGO_DELETE]", error);
    return NextResponse.json({ error: "Eroare la stergere" }, { status: 500 });
  }
}
