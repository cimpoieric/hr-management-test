import { join } from "path";
import { requireRole } from "@/lib/auth";
import { electronDesktopOnlyResponse } from "@/lib/electronMode";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { writeFile } from "fs/promises";
import { type NextRequest, NextResponse } from "next/server";

const DB_PATH = join(process.cwd(), "prisma", "dev.db");

export async function POST(request: NextRequest) {
  const blocked = electronDesktopOnlyResponse(
    "Importul local SQLite este disponibil doar în aplicația desktop.",
  );
  if (blocked) return blocked;

  const { user, response: authError } = await requireRole(
    request,
    ROLES_SETTINGS_ADMIN,
  );
  if (authError || !user) return authError!;

  try {
    const formData = await request.formData();
    const file = formData.get("database") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "Fișierul bazei de date lipsește." },
        { status: 400 },
      );
    }
    if (!file.name.toLowerCase().endsWith(".db")) {
      return NextResponse.json(
        { error: "Fișier invalid. Se acceptă doar .db." },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    await writeFile(DB_PATH, Buffer.from(bytes));
    return NextResponse.json({
      success: true,
      warning:
        "Baza de date a fost importată. Repornește aplicația pentru a reinițializa conexiunile.",
    });
  } catch {
    return NextResponse.json(
      { error: "Importul bazei de date a eșuat." },
      { status: 500 },
    );
  }
}
