import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { requireAuth } from "@/lib/auth";

const DB_PATH = join(process.cwd(), "prisma", "dev.db");

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request, ["administrator"]);
  if (authError || !user) return authError!;

  try {
    const formData = await request.formData();
    const file = formData.get("database") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Fișierul bazei de date lipsește." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".db")) {
      return NextResponse.json({ error: "Fișier invalid. Se acceptă doar .db." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    await writeFile(DB_PATH, Buffer.from(bytes));
    return NextResponse.json({
      success: true,
      warning: "Baza de date a fost importată. Repornește aplicația pentru a reinițializa conexiunile.",
    });
  } catch {
    return NextResponse.json({ error: "Importul bazei de date a eșuat." }, { status: 500 });
  }
}
