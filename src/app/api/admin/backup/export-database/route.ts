import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { getDatabaseFilePath } from "@/lib/adminDatabase";
import { withAdminApi } from "@/lib/adminApi";
import { electronDesktopOnlyResponse } from "@/lib/electronMode";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return withAdminApi(request, async () => {
    const blocked = electronDesktopOnlyResponse(
      "Exportul fișierului SQLite este disponibil doar în aplicația desktop.",
    );
    if (blocked) return blocked;

    const dbPath = getDatabaseFilePath();
    if (!existsSync(dbPath)) {
      return NextResponse.json(
        { error: "Baza de date nu a fost gasita." },
        { status: 404 },
      );
    }

    const buffer = await readFile(dbPath);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.sqlite3",
        "Content-Disposition": `attachment; filename="hr-management-${new Date().toISOString().slice(0, 10)}.db"`,
        "Content-Length": String(buffer.length),
      },
    });
  });
}
