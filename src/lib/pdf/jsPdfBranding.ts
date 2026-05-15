import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { jsPDF } from "jspdf";
import { getTenantRequestContext } from "@/lib/tenantRequestStorage";
import { registerRobotoFonts } from "./registerRobotoForJsPdf";

export function settingsLogoPath(organizationId: string): string {
  return join(process.cwd(), "data", "settings", organizationId, "logo.png");
}

/** Roboto dacă fonturile din `assets/fonts` sunt disponibile; altfel Helvetica (ASCII). */
export function registerPdfFontWithFallback(
  doc: jsPDF,
): "Roboto" | "helvetica" {
  try {
    registerRobotoFonts(doc);
    return "Roboto";
  } catch {
    return "helvetica";
  }
}

/**
 * Adaugă logo PNG în colțul stânga sus. Returnează offset X pentru text (după logo).
 */
export function addSettingsLogo(
  doc: jsPDF,
  marginLeft: number,
  topY: number,
  logoW = 48,
  logoH = 36,
  organizationId?: string,
): number {
  const orgId = organizationId ?? getTenantRequestContext()?.organizationId;
  if (!orgId) return marginLeft;

  const logoPath = settingsLogoPath(orgId);
  if (!existsSync(logoPath)) return marginLeft;
  try {
    const buf = readFileSync(logoPath);
    doc.addImage(buf, "PNG", marginLeft, topY, logoW, logoH);
    return marginLeft + logoW + 12;
  } catch {
    return marginLeft;
  }
}
