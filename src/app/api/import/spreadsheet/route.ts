/**
 * POST /api/import/spreadsheet
 *
 * Upload Excel/CSV to R2 (same as manual import), parse employee rows.
 * Response: { success, employees, storedPath, fileName, warnings }
 */

import { requireRole } from "@/lib/auth";
import { ROLES_EMPLOYEES_RW } from "@/lib/roles";
import { MAX_FILE_SIZE } from "@/lib/documentConstants";
import { writePendingImportFile } from "@/lib/importStorage";
import {
  isSpreadsheetImportFileName,
  parseEmployeesFromSpreadsheet,
  SPREADSHEET_IMPORT_EXTENSIONS,
} from "@/lib/parsers/employeeSpreadsheetParser";
import { canEditEmployee } from "@/lib/permissions";
import path from "path";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_EMPLOYEES_RW,
  );
  if (authError || !user) return authError!;
  if (!canEditEmployee(user.role)) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Fisier lipsa" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Fisier prea mare. Max: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 },
      );
    }

    const ext = path.extname(file.name).toLowerCase();
    if (
      !SPREADSHEET_IMPORT_EXTENSIONS.includes(
        ext as (typeof SPREADSHEET_IMPORT_EXTENSIONS)[number],
      ) &&
      !isSpreadsheetImportFileName(file.name)
    ) {
      return NextResponse.json(
        {
          error: `Extensie neacceptata. Foloseste ${SPREADSHEET_IMPORT_EXTENSIONS.join(", ")}.`,
        },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { storedPath } = await writePendingImportFile(buffer, file.name);

    const { employees, warnings } = parseEmployeesFromSpreadsheet(
      buffer,
      file.name,
    );

    return NextResponse.json(
      {
        success: true,
        employees,
        storedPath,
        fileName: file.name,
        rowCount: employees.length,
        warnings,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[IMPORT_SPREADSHEET]", error);
    const msg =
      error instanceof Error
        ? error.message
        : "Eroare la procesarea fisierului";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
