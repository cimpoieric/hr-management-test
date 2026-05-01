/**
 * API Logo Firmă
 *
 * GET    /api/settings/logo — Verifică dacă logo-ul există, returnează URL
 * POST   /api/settings/logo — Upload logo nou (PNG/JPG, max 500KB)
 * DELETE /api/settings/logo — Șterge logo
 *
 * Logo stocat în: ./data/settings/logo.png
 */

import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { requireAuth } from "@/lib/auth";

const SETTINGS_DIR = join(process.cwd(), "data", "settings");
const LOGO_PATH = join(SETTINGS_DIR, "logo.png");
const MAX_SIZE = 500 * 1024; // 500KB

async function ensureSettingsDir(): Promise<void> {
  if (!existsSync(SETTINGS_DIR)) {
    await mkdir(SETTINGS_DIR, { recursive: true });
  }
}

// ─── GET: Check if logo exists ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const exists = existsSync(LOGO_PATH);
    if (!exists) {
      return NextResponse.json({ exists: false });
    }

    // Return logo as base64 data URL
    const buffer = await readFile(LOGO_PATH);
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

// ─── POST: Upload logo ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    await ensureSettingsDir();

    const formData = await request.formData();
    const file = formData.get("logo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Niciun fișier" }, { status: 400 });
    }

    // Validate type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Tip fișier invalid. Doar PNG/JPG." }, { status: 400 });
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Maxim 500KB" }, { status: 400 });
    }

    // Convert to buffer and save as PNG
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await writeFile(LOGO_PATH, buffer);

    return NextResponse.json({
      success: true,
      size: buffer.length,
    });

  } catch (error) {
    console.error("[LOGO_POST]", error);
    return NextResponse.json({ error: "Eroare la upload" }, { status: 500 });
  }
}

// ─── DELETE: Remove logo ─────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    if (existsSync(LOGO_PATH)) {
      await unlink(LOGO_PATH);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[LOGO_DELETE]", error);
    return NextResponse.json({ error: "Eroare la stergere" }, { status: 500 });
  }
}
