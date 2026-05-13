import fs from "fs";
import path from "path";
import type { jsPDF } from "jspdf";

/** Roboto TTF subset (latin + Latin Extended-A) în `assets/fonts/` — pentru jsPDF; regenerare: `npm run subset-pdf-fonts`. */
const FONT_SPECS = [
  { vfsName: "Roboto-Regular.ttf", family: "Roboto", style: "normal" as const },
  { vfsName: "Roboto-Bold.ttf", family: "Roboto", style: "bold" as const },
  { vfsName: "Roboto-Italic.ttf", family: "Roboto", style: "italic" as const },
];

/**
 * Înregistrează Roboto în jsPDF (VFS + addFont). Apelați imediat după `new jsPDF()`, înainte de `text` / `autoTable`.
 */
export function registerRobotoFonts(doc: jsPDF): void {
  const dir = path.join(process.cwd(), "assets", "fonts");
  for (const { vfsName, family, style } of FONT_SPECS) {
    const fullPath = path.join(dir, vfsName);
    const base64 = fs.readFileSync(fullPath).toString("base64");
    doc.addFileToVFS(vfsName, base64);
    doc.addFont(vfsName, family, style);
  }
}
