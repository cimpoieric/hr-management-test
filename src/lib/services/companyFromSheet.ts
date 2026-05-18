import { prismaTyped as prisma } from "@/lib/prisma";

const GENERIC_SHEET_KEYS = new Set([
  "SHEET1",
  "SHEET2",
  "SHEET3",
  "FOAIE1",
  "FOAIE2",
  "FOAIE",
]);

export function normalizeCompanySheetKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

export function formatCompanyNameFromSheet(sheetName: string): string {
  return sheetName.trim().replace(/\s+/g, " ");
}

export function isValidCompanySheetName(sheetName: string): boolean {
  const display = formatCompanyNameFromSheet(sheetName);
  if (display.length < 2 || display.length > 200) return false;
  const key = normalizeCompanySheetKey(display);
  if (GENERIC_SHEET_KEYS.has(key)) return false;
  return true;
}

export type EnsureCompaniesForImportResult = {
  /** normalized sheet key ? company id */
  companyIdBySheetKey: Map<string, number>;
  /** normalized sheet key ? display company name */
  displayNameBySheetKey: Map<string, string>;
  existing: string[];
  created: string[];
  /** Present when createMissing=false and company not in DB */
  missing: string[];
};

/**
 * Match Excel sheet names to companies (find or create per organization).
 */
export async function ensureCompaniesForSheetNames(
  organizationId: string,
  sheetNames: Iterable<string>,
  options: { createMissing: boolean },
): Promise<EnsureCompaniesForImportResult> {
  const uniqueDisplay = new Map<string, string>();
  for (const raw of sheetNames) {
    if (!isValidCompanySheetName(raw)) continue;
    const display = formatCompanyNameFromSheet(raw);
    const key = normalizeCompanySheetKey(display);
    if (!uniqueDisplay.has(key)) uniqueDisplay.set(key, display);
  }

  const companyIdBySheetKey = new Map<string, number>();
  const displayNameBySheetKey = new Map(uniqueDisplay);
  const existing: string[] = [];
  const created: string[] = [];
  const missing: string[] = [];

  if (uniqueDisplay.size === 0) {
    return {
      companyIdBySheetKey,
      displayNameBySheetKey,
      existing,
      created,
      missing,
    };
  }

  const orgCompanies = await prisma.company.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  });

  const idByKey = new Map<string, number>();
  for (const c of orgCompanies) {
    idByKey.set(normalizeCompanySheetKey(c.name), c.id);
  }

  for (const [key, displayName] of uniqueDisplay) {
    const foundId = idByKey.get(key);
    if (foundId != null) {
      companyIdBySheetKey.set(key, foundId);
      existing.push(displayName);
      continue;
    }

    if (!options.createMissing) {
      missing.push(displayName);
      continue;
    }

    try {
      const company = await prisma.company.create({
        data: {
          organizationId,
          name: displayName,
          status: "Activ",
        },
        select: { id: true, name: true },
      });
      companyIdBySheetKey.set(key, company.id);
      idByKey.set(key, company.id);
      created.push(displayName);
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code)
          : "";
      if (code === "P2002") {
        const again = await prisma.company.findFirst({
          where: { organizationId, name: displayName },
          select: { id: true },
        });
        if (again) {
          companyIdBySheetKey.set(key, again.id);
          existing.push(displayName);
          continue;
        }
      }
      throw err;
    }
  }

  return {
    companyIdBySheetKey,
    displayNameBySheetKey,
    existing,
    created,
    missing,
  };
}

export function resolveCompanyIdForImportRow(
  sourceSheet: string | null | undefined,
  fallbackCompanyId: number,
  companyIdBySheetKey: Map<string, number>,
): number {
  if (!sourceSheet?.trim()) return fallbackCompanyId;
  const key = normalizeCompanySheetKey(sourceSheet);
  return companyIdBySheetKey.get(key) ?? fallbackCompanyId;
}
