import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { jsPDF } from "jspdf";
import { registerRobotoFonts } from "./registerRobotoForJsPdf";

/** Logo încărcat în Setări — aceeași cale ca `/api/settings/logo`. */
export const SETTINGS_LOGO_PATH = join(process.cwd(), "data", "settings", "logo.png");

/** Roboto dacă fonturile din `assets/fonts` sunt disponibile; altfel Helvetica (ASCII). */
export function registerPdfFontWithFallback(doc: jsPDF): "Roboto" | "helvetica" {
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
  logoH = 36
): number {
  if (!existsSync(SETTINGS_LOGO_PATH)) return marginLeft;
  try {
    const buf = readFileSync(SETTINGS_LOGO_PATH);
    doc.addImage(buf, "PNG", marginLeft, topY, logoW, logoH);
    return marginLeft + logoW + 12;
  } catch {
    return marginLeft;
  }
}
