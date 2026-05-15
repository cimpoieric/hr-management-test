import { join } from "path";
import { requireRole } from "@/lib/auth";
import { electronDesktopOnlyResponse } from "@/lib/electronMode";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { readFile } from "fs/promises";
import { type NextRequest, NextResponse } from "next/server";

const DB_PATH = join(process.cwd(), "prisma", "dev.db");

export async function GET(request: NextRequest) {
  const blocked = electronDesktopOnlyResponse(
    "Exportul local SQLite este disponibil doar în aplicația desktop.",
  );
  if (blocked) return blocked;

  const { user, response: authError } = await requireRole(
    request,
    ROLES_SETTINGS_ADMIN,
  );
  if (authError || !user) return authError!;

  try {
    const buffer = await readFile(DB_PATH);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.sqlite3",
        "Content-Disposition": `attachment; filename="dev-${new Date().toISOString().slice(0, 10)}.db"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Nu am putut citi baza de date." },
      { status: 500 },
    );
  }
}
