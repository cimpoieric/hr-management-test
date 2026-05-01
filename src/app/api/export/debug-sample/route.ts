import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";
import { salaryAmountToJson } from "@/lib/salaryFields";

function safeDecrypt(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  const employees = await prisma.employee.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 3,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      cnp: true,
      iban: true,
      bankName: true,
      salaryType: true,
      salaryAmount: true,
      salaryCurrency: true,
      status: true,
    },
  });

  const rows = employees.map((e, idx) => {
    const ibanPlain = safeDecrypt(e.iban);
    return {
      nr: idx + 1,
      nume: e.lastName,
      prenume: e.firstName,
      cnpRaw: e.cnp,
      ibanRaw: ibanPlain,
      bankName: e.bankName ?? "",
      salaryType: e.salaryType != null ? String(e.salaryType) : "",
      salaryAmount: salaryAmountToJson(e.salaryAmount) ?? "",
      salaryCurrency: e.salaryCurrency ?? "",
      status: e.status,
      csvCnpCell: `="${e.cnp}"`,
      csvIbanCell: `="${ibanPlain}"`,
      xlsxCellTypes: { cnp: "s", iban: "s" },
    };
  });

  const csvPreviewLines = [
    "Nr.;Nume;Prenume;CNP;IBAN;Bancă;Tip plată;Sumă brută;Monedă;Status",
    ...rows.map((r) =>
      [
        String(r.nr),
        r.nume,
        r.prenume,
        r.csvCnpCell,
        r.csvIbanCell,
        r.bankName,
        r.salaryType,
        String(r.salaryAmount),
        r.salaryCurrency,
        r.status,
      ].join(";")
    ),
  ];

  return NextResponse.json({
    totalSampleRows: rows.length,
    rows,
    csvPreview: csvPreviewLines.join("\n"),
    note: "CNP/IBAN sunt forțate text pentru export contabil (CSV: =\"...\", XLSX: cell type s).",
  });
}
