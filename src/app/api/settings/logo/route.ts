/**
 * API Logo Firmă
 *
 * GET    /api/settings/logo — Verifică dacă logo-ul există, returnează URL
 * POST   /api/settings/logo — Upload logo nou (PNG/JPG, max 500KB)
 * DELETE /api/settings/logo — Șterge logo
 *
 * Logo stocat per organizație în: ./data/settings/{organizationId}/logo.png
 */

import { existsSync } from "fs";
import { join } from "path";
import { requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { type NextRequest, NextResponse } from "next/server";

const SETTINGS_ROOT = join(process.cwd(), "data", "settings");
const MAX_SIZE = 500 * 1024; // 500KB

function logoDirForOrganization(organizationId: string): string {
  return join(SETTINGS_ROOT, organizationId);
}

function logoPathForOrganization(organizationId: string): string {
  return join(logoDirForOrganization(organizationId), "logo.png");
}

async function ensureSettingsDir(organizationId: string): Promise<void> {
  const dir = logoDirForOrganization(organizationId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function clearStoredLogo(organizationId: string): Promise<void> {
  const logoPath = logoPathForOrganization(organizationId);
  if (existsSync(logoPath)) {
    await unlink(logoPath);
  }

  await prisma.settings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      logoUrl: null,
      language: "en",
    },
    update: {
      logoUrl: null,
    },
  });
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
    const logoPath = logoPathForOrganization(user.organizationId);
    const exists = existsSync(logoPath);
    if (!exists) {
      return NextResponse.json({ exists: false });
    }

    const buffer = await readFile(logoPath);
    const base64 = buffer.toString("base64");
    const mimeType = "image/png";

    return NextResponse.json({
      exists: true,
      url: `data:${mimeType};base64,${base64}`,
      size: buffer.length,
    });
  } catch (error) {
    console.error("[LOGO_GET]", error);
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    await ensureSettingsDir(user.organizationId);

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
    const logoPath = logoPathForOrganization(user.organizationId);

    await writeFile(logoPath, buffer);

    await prisma.settings.upsert({
      where: { organizationId: user.organizationId },
      create: {
        organizationId: user.organizationId,
        logoUrl: logoPath,
        language: "en",
      },
      update: {
        logoUrl: logoPath,
      },
    });

    return NextResponse.json({
      success: true,
      size: buffer.length,
    });
  } catch (error) {
    console.error("[LOGO_POST]", error);
    return NextResponse.json({ error: "Eroare la upload" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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
    await clearStoredLogo(user.organizationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[LOGO_DELETE]", error);
    return NextResponse.json({ error: "Eroare la stergere" }, { status: 500 });
  }
}
