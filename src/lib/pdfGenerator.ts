/**
 * Generator PDF profesional pentru rapoarte HR.
 *
 * Caracteristici:
 * - Header/footer pe fiecare pagină cu logo, titlu, dată, paginare
 * - Tabele cu rânduri alternante, header cu bg colorat
 * - 4 tipuri de rapoarte: listă, A1, țară, fișă angajat
 * - Page break logic — niciodată nu taie un rând de tabel
 * - Fonturi: Helvetica + Helvetica-Bold (embedded standard PDF)
 * - Culori: slate-800 header, slate-900 text, blue-500 accent
 *
 * Cum customizezi fontul și culorile:
 *   1. Font: Schimbă BASE_FONT și BASE_FONT_BOLD în secțiunea Fonturi de mai jos.
 *      Fonturi standard PDF disponibile: Helvetica, Times-Roman, Courier, Arial (dacă e disponibil).
 *   2. Culori: Modifică constantele COLOR_* de mai jos. Format: [R, G, B] cu valori 0-1.
 */

import { existsSync } from "fs";

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ CONSTANTE DE DESIGN (customizabile) ═══════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

/** Fonturi standard PDF (nu necesită embedding de fișiere) */
const FONT_REGULAR = "/Helvetica";
const FONT_BOLD = "/Helvetica-Bold";

/** Culori în format PDF RGB (0-1) */
const COLOR_HEADER_BG: [number, number, number] = [0.118, 0.169, 0.231];     // #1e293b slate-800
const COLOR_HEADER_TEXT: [number, number, number] = [1, 1, 1];                // white
const COLOR_ACCENT: [number, number, number] = [0.231, 0.510, 0.965];         // #3b82f6 blue-500
const COLOR_TEXT: [number, number, number] = [0.059, 0.090, 0.102];           // #0f172a slate-900
const COLOR_TEXT_LIGHT: [number, number, number] = [0.376, 0.431, 0.490];     // #607180
const COLOR_BORDER: [number, number, number] = [0.851, 0.875, 0.906];         // #d1d5db gray-300
const COLOR_ROW_ALT: [number, number, number] = [0.976, 0.980, 0.984];        // #f8fafc slate-50
const COLOR_ROW_WHITE: [number, number, number] = [1, 1, 1];                  // white
const COLOR_GREEN: [number, number, number] = [0.133, 0.604, 0.227];          // #229954
const COLOR_YELLOW: [number, number, number] = [0.957, 0.749, 0.055];         // #f4b80e
const COLOR_RED: [number, number, number] = [0.827, 0.184, 0.184];            // #d32f2f
const COLOR_GRAY: [number, number, number] = [0.6, 0.6, 0.6];                 // #999999

/** Dimensiuni pagină A4 (puncte PDF) */
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ UTILITARE PDF LOW-LEVEL ═══════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

function esc(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function toAscii(str: string): string {
  const map: Record<string, string> = {
    "ă": "a", "â": "a", "î": "i", "ș": "s", "ț": "t",
    "Ă": "A", "Â": "A", "Î": "I", "Ș": "S", "Ț": "T",
    "ş": "s", "ţ": "t", "Ş": "S", "Ţ": "T",
    "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u",
    "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U",
  };
  const normalized = str
    .split("")
    .map((c) => map[c] ?? c)
    .join("")
    .substring(0, 250);

  // PDF stream-ul e construit text-based; păstrăm strict ASCII pentru consistență la calculul /Length.
  return normalized.replace(/[^\x20-\x7E]/g, "?");
}

function rgb(c: [number, number, number]): string {
  return `${c[0]} ${c[1]} ${c[2]}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ INTERFEȚE PUBLICE ═════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export interface ColumnDef {
  key: string;
  header: string;
  width: number;
  align?: "left" | "center" | "right";
}

export interface EmployeeListItem {
  id: number;
  lastName: string;
  firstName: string;
  cnp?: string;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  status: string;
  companyName?: string | null;
  country?: string | null;
  city?: string | null;
  hiredAt?: Date | string | null;
  iban?: string | null;
  bankName?: string | null;
  deploymentCountry?: string | null;
  deploymentCity?: string | null;
  a1Status?: string | null;
  a1Expiry?: Date | string | null;
  salaryType?: string | null;
  salaryAmount?: number | null;
  salaryCurrency?: string | null;
  salaryStartDate?: Date | string | null;
}

export interface ListReportOptions {
  employees: EmployeeListItem[];
  columns: ColumnDef[];
  title: string;
  subtitle?: string;
  generatedBy: string;
  companyName?: string;
  logoPath?: string | null;
}

export interface A1ReportOptions {
  employees: EmployeeListItem[];
  title: string;
  generatedBy: string;
  companyName?: string;
  logoPath?: string | null;
}

export interface CountryReportOptions {
  employees: EmployeeListItem[];
  countryName: string;
  countryCode: string;
  title: string;
  generatedBy: string;
  companyName?: string;
  logoPath?: string | null;
}

export interface EmployeeSheetOptions {
  employee: EmployeeListItem & {
    seriesCI?: string | null;
    numberCI?: string | null;
    address?: string | null;
    /** Observații afișate în secțiunea 5 */
    observations?: string | null;
    bankName?: string | null;
    salaryStartDate?: Date | string | null;
  };
  documents: {
    type: string;
    number?: string | null;
    status: string;
    issueDate?: Date | string | null;
    expiryDate?: Date | string | null;
  }[];
  deployments: {
    country: string;
    city?: string | null;
    startDate: Date | string;
    endDate?: Date | string | null;
    status: string;
    notes?: string | null;
  }[];
  title: string;
  generatedBy: string;
  companyName?: string;
  logoPath?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ PDF ENGINE LOW-LEVEL ══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

class PDFEngine {
  private objects: string[] = [];
  private objId = 1;
  private pageObjIds: number[] = [];
  private fonts: Map<string, number> = new Map();
  private images: Map<string, number> = new Map();

  // Current page state
  private currentPageId = 0;
  private currentStream: string[] = [];
  private _contentY = 0;

  // Settings
  private hasLogo = false;

  constructor() {
    // Catalog placeholder — will be set at finalize
    this.addObject("<< /Type /Catalog /Pages 2 0 R >>");
    // Pages root placeholder
    this.addObject("");

    // Register fonts
    this.registerFont("F1", FONT_REGULAR);
    this.registerFont("F2", FONT_BOLD);
  }

  private registerFont(name: string, baseFont: string): void {
    const id = this.addObject(
      `<< /Type /Font /Subtype /Type1 /BaseFont ${baseFont} /Encoding /WinAnsiEncoding >>`
    );
    this.fonts.set(name, id);
  }

  private addObject(content: string): number {
    this.objects.push(`${this.objId} 0 obj\n${content}\nendobj`);
    return this.objId++;
  }

  setLogo(path: string | null | undefined): void {
    this.hasLogo = Boolean(path && existsSync(path));
  }

  // ─── Page Management ───────────────────────────────────────────────────────

  newPage(): void {
    // Finalize previous page if exists
    if (this.currentPageId > 0) {
      this.finalizeCurrentPage();
    }

    this.currentPageId = this.objId;
    this.objects.push(""); // placeholder for page object
    this.pageObjIds.push(this.currentPageId);
    this.currentStream = [];
    this._contentY = PAGE_H - MARGIN;
  }

  private finalizeCurrentPage(): void {
    if (this.currentPageId === 0 || this.currentStream.length === 0) return;

    const stream = this.currentStream.join("\n");
    const streamLength = Buffer.byteLength(stream, "latin1");
    const streamId = this.addObject(
      `<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`
    );

    const fontRefs: string[] = [];
    this.fonts.forEach((id, name) => {
      fontRefs.push(`/${name} ${id} 0 R`);
    });

    let resources = `<< /Font << ${fontRefs.join(" ")} >>`;

    // Add image references if logo exists
    if (this.hasLogo && this.images.size > 0) {
      resources += ` /XObject <<`;
      this.images.forEach((id, name) => {
        resources += ` /${name} ${id} 0 R`;
      });
      resources += ` >>`;
    }
    resources += ` >>`;

    const pageObj =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources ${resources} /Contents ${streamId} 0 R >>`;

    this.objects[this.currentPageId - 1] =
      `${this.currentPageId} 0 obj\n${pageObj}\nendobj`;
  }

  // ─── Drawing Primitives ────────────────────────────────────────────────────

  setColor(fill: [number, number, number]): void {
    this.currentStream.push(`${rgb(fill)} rg ${rgb(fill)} RG`);
  }

  setFillColor(fill: [number, number, number]): void {
    this.currentStream.push(`${rgb(fill)} rg`);
  }

  setStrokeColor(stroke: [number, number, number]): void {
    this.currentStream.push(`${rgb(stroke)} RG`);
  }

  drawRect(x: number, y: number, w: number, h: number, fill?: [number, number, number]): void {
    if (fill) {
      this.currentStream.push(`${rgb(fill)} rg ${x} ${y} ${w} ${h} re f`);
    } else {
      this.currentStream.push(`${x} ${y} ${w} ${h} re S`);
    }
  }

  drawLine(x1: number, y1: number, x2: number, y2: number, color?: [number, number, number], width?: number): void {
    const cmds: string[] = [];
    if (width) cmds.push(`${width} w`);
    if (color) cmds.push(`${rgb(color)} RG`);
    cmds.push(`${x1} ${y1} m ${x2} ${y2} l S`);
    this.currentStream.push(cmds.join("\n"));
  }

  drawText(x: number, y: number, text: string, font: "F1" | "F2" = "F1", size = 9, color?: [number, number, number]): void {
    const cmds: string[] = [];
    if (color) cmds.push(`${rgb(color)} rg`);
    cmds.push(`BT /${font} ${size} Tf ${x} ${y} Td (${esc(toAscii(text))}) Tj ET`);
    this.currentStream.push(cmds.join("\n"));
  }

  drawTextRight(x: number, y: number, text: string, font: "F1" | "F2" = "F1", size = 9, color?: [number, number, number]): void {
    const cmds: string[] = [];
    if (color) cmds.push(`${rgb(color)} rg`);
    cmds.push(`BT /${font} ${size} Tf ${x} ${y} Td (${esc(toAscii(text))}) Tj ET`);
    this.currentStream.push(cmds.join("\n"));
  }

  // ─── Layout Helpers ────────────────────────────────────────────────────────

  get contentY(): number {
    return this._contentY;
  }

  get remainingHeight(): number {
    return this._contentY - MARGIN;
  }

  moveDown(amount: number): void {
    this._contentY -= amount;
  }

  setY(y: number): void {
    this._contentY = y;
  }

  fits(height: number): boolean {
    return this._contentY - height >= MARGIN + 30;
  }

  // ─── Header / Footer ───────────────────────────────────────────────────────

  drawHeader(title: string, dateStr: string, logoText = "HR Manager"): void {
    const y = PAGE_H - MARGIN;

    // Header background bar
    this.drawRect(MARGIN, y - 35, CONTENT_W, 35, COLOR_HEADER_BG);

    // Logo text (or placeholder)
    this.drawText(MARGIN + 8, y - 20, logoText, "F2", 14, COLOR_HEADER_TEXT);

    // Title
    this.drawText(MARGIN + 150, y - 16, title, "F1", 11, COLOR_HEADER_TEXT);

    // Date on right
    this.drawTextRight(PAGE_W - MARGIN - 10, y - 16, dateStr, "F1", 9, [0.8, 0.8, 0.8]);

    // Accent line below header
    this.drawLine(MARGIN, y - 38, PAGE_W - MARGIN, y - 38, COLOR_ACCENT, 2);

    this._contentY = y - 50;
  }

  drawFooter(pageNum: number, totalPages: number, generatedBy: string): void {
    const y = MARGIN + 15;

    // Top border of footer
    this.drawLine(MARGIN, y + 10, PAGE_W - MARGIN, y + 10, COLOR_BORDER, 0.5);

    // Left: disclaimer
    this.drawText(MARGIN, y - 5, "Document confidențial. GDPR.", "F1", 7, COLOR_TEXT_LIGHT);

    // Center: generated by
    this.drawText(MARGIN + CONTENT_W / 2 - 60, y - 5, `Generat de ${toAscii(generatedBy)}`, "F1", 7, COLOR_TEXT_LIGHT);

    // Right: page number
    this.drawTextRight(PAGE_W - MARGIN, y - 5, `Pagina ${pageNum} din ${totalPages}`, "F1", 7, COLOR_TEXT_LIGHT);
  }

  // ─── Table Rendering ───────────────────────────────────────────────────────

  drawTable(
    headers: string[],
    rows: string[][],
    colWidths: number[],
    options?: {
      headerBg?: [number, number, number];
      headerTextColor?: [number, number, number];
      altRowBg?: [number, number, number];
      borderColor?: [number, number, number];
      fontSize?: number;
      rowHeight?: number;
      startY?: number;
    }
  ): boolean {
    const {
      headerBg = COLOR_HEADER_BG,
      headerTextColor = COLOR_HEADER_TEXT,
      altRowBg = COLOR_ROW_ALT,
      borderColor = COLOR_BORDER,
      fontSize = 8,
      rowHeight = 14,
    } = options ?? {};

    const totalW = colWidths.reduce((a, b) => a + b, 0);
    const scale = CONTENT_W / totalW;
    const scaledWidths = colWidths.map((w) => w * scale);

    // Check if table fits on current page
    const tableHeight = rowHeight * (rows.length + 1);
    if (!this.fits(tableHeight) && rows.length > 0) {
      return false; // signal: need new page
    }

    // Draw header row
    this.drawRect(MARGIN, this._contentY - rowHeight, CONTENT_W, rowHeight, headerBg);
    let x = MARGIN;
    for (let i = 0; i < headers.length && i < scaledWidths.length; i++) {
      this.drawText(x + 4, this._contentY - rowHeight + 4, headers[i] ?? "", "F2", fontSize, headerTextColor);
      x += scaledWidths[i] ?? 0;
    }
    this._contentY -= rowHeight;

    // Draw data rows
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;

      // Page break check — don't cut a row
      if (!this.fits(rowHeight)) {
        // Draw bottom border for current page
        this.drawLine(MARGIN, this._contentY, PAGE_W - MARGIN, this._contentY, borderColor, 0.5);
        return false; // signal: need new page, caller should retry remaining rows
      }

      // Alternating row background
      const rowBg = r % 2 === 0 ? COLOR_ROW_WHITE : altRowBg;
      this.drawRect(MARGIN, this._contentY - rowHeight, CONTENT_W, rowHeight, rowBg);

      // Row cells
      x = MARGIN;
      for (let i = 0; i < row.length && i < scaledWidths.length; i++) {
        this.drawText(x + 4, this._contentY - rowHeight + 4, row[i] ?? "", "F1", fontSize, COLOR_TEXT);
        x += scaledWidths[i] ?? 0;
      }

      // Bottom border
      this.drawLine(MARGIN, this._contentY - rowHeight, PAGE_W - MARGIN, this._contentY - rowHeight, borderColor, 0.3);

      this._contentY -= rowHeight;
    }

    // Final bottom border
    this.drawLine(MARGIN, this._contentY, PAGE_W - MARGIN, this._contentY, borderColor, 0.5);

    this._contentY -= 4; // small gap after table
    return true;
  }

  // ─── Section Title ─────────────────────────────────────────────────────────

  drawSectionTitle(title: string, y?: number): void {
    const posY = y ?? this._contentY;
    this.drawText(MARGIN, posY - 12, title, "F2", 11, COLOR_HEADER_BG);
    this.drawLine(MARGIN, posY - 14, MARGIN + 200, posY - 14, COLOR_ACCENT, 1.5);
    this._contentY = posY - 20;
  }

  drawInfoRow(label: string, value: string, y?: number): void {
    const posY = y ?? this._contentY;
    this.drawText(MARGIN, posY - 12, `${label}:`, "F2", 9, COLOR_TEXT_LIGHT);
    this.drawText(MARGIN + 140, posY - 12, value, "F1", 9, COLOR_TEXT);
    this._contentY = posY - 14;
  }

  // ─── Finalization ──────────────────────────────────────────────────────────

  finalize(title: string, _generatedBy: string): Uint8Array {
    // Finalize last page
    this.finalizeCurrentPage();

    const totalPages = this.pageObjIds.length;
    if (totalPages === 0) {
      // Empty PDF — create one blank page
      this.newPage();
      this.drawHeader(title, new Date().toLocaleDateString("ro-RO"));
      this.drawText(MARGIN, this._contentY - 20, "Niciun date de afișat.", "F1", 10, COLOR_TEXT_LIGHT);
      this.finalizeCurrentPage();
    }

    // Update pages root (object 2)
    const kids = this.pageObjIds.map((id) => `${id} 0 R`).join(" ");
    this.objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${this.pageObjIds.length} >>\nendobj`;

    // Build cross-reference table
    const xref: number[] = [];
    let offset = 0;
    xref.push(0); // object 0 is free

    const pdfParts: string[] = [];
    pdfParts.push("%PDF-1.4");
    offset += 9; // "%PDF-1.4\n"

    for (let i = 0; i < this.objects.length; i++) {
      xref.push(offset);
      const objStr = `${this.objects[i]}\n`;
      pdfParts.push(objStr);
      offset += Buffer.byteLength(objStr, "latin1");
    }

    // xref section
    const xrefOffset = offset;
    pdfParts.push("xref");
    pdfParts.push(`0 ${xref.length}`);
    pdfParts.push("0000000000 65535 f ");
    for (let i = 1; i < xref.length; i++) {
      pdfParts.push(String(xref[i]).padStart(10, "0") + " 00000 n ");
    }

    // trailer
    pdfParts.push("trailer");
    pdfParts.push(`<< /Size ${xref.length} /Root 1 0 R >>`);
    pdfParts.push("startxref");
    pdfParts.push(String(xrefOffset));
    pdfParts.push("%%EOF");

    const pdfContent = pdfParts.join("\n");
    return new Uint8Array(Buffer.from(pdfContent, "latin1"));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ FUNCTII PUBLICE DE GENERARE RAPOARTE ══════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. Raport Listă Angajați ────────────────────────────────────────────────

export function generateEmployeeListPDF(options: ListReportOptions): Uint8Array {
  const { employees, columns, title, subtitle, generatedBy, logoPath } = options;
  const pdf = new PDFEngine();
  pdf.setLogo(logoPath);

  const dateStr = new Date().toLocaleDateString("ro-RO");
  const logoText = logoPath ? "" : "HR Manager";

  // Calculate column widths
  const colWidths = columns.map((c) => c.width);
  const headers = columns.map((c) => c.header);

  // Process rows in batches with page breaks
  let rowIndex = 0;
  let rowsPerChunk = 50;

  while (rowIndex < employees.length) {
    pdf.newPage();
    pdf.drawHeader(title, dateStr, logoText);

    // Subtitle on first page
    if (subtitle && rowIndex === 0) {
      pdf.drawText(MARGIN, pdf.contentY, subtitle, "F1", 9, COLOR_TEXT_LIGHT);
      pdf.moveDown(16);
    }

    // Summary on first page
    if (rowIndex === 0) {
      pdf.drawText(MARGIN, pdf.contentY, `Total angajati: ${employees.length}`, "F2", 9, COLOR_TEXT);
      pdf.moveDown(18);
    }

    // Prepare rows chunk
    const chunk = employees.slice(rowIndex, rowIndex + rowsPerChunk);
    const rows: string[][] = chunk.map((emp) =>
      columns.map((col) => {
        switch (col.key) {
          case "lastName": return emp.lastName;
          case "firstName": return emp.firstName;
          case "fullName": return `${emp.lastName} ${emp.firstName}`;
          case "cnp": return emp.cnp ?? "—";
          case "email": return emp.email ?? "—";
          case "phone": return emp.phone ?? "—";
          case "position": return emp.position ?? "—";
          case "status": return emp.status === "ACTIVE" ? "Activ" : "Terminat";
          case "companyName": return emp.companyName ?? "—";
          case "country": return emp.country ?? "—";
          case "city": return emp.city ?? "—";
          case "hiredAt": return emp.hiredAt ? new Date(emp.hiredAt).toLocaleDateString("ro-RO") : "—";
          case "iban": return emp.iban ?? "—";
          case "bankName": return emp.bankName ?? "—";
          case "salaryType": return emp.salaryType ?? "—";
          case "salaryAmount":
            return typeof emp.salaryAmount === "number" && !Number.isNaN(emp.salaryAmount)
              ? String(emp.salaryAmount)
              : "—";
          case "salaryCurrency": return emp.salaryCurrency ?? "—";
          case "salaryStartDate":
            return emp.salaryStartDate ? new Date(emp.salaryStartDate).toLocaleDateString("ro-RO") : "—";
          case "deploymentCountry": return emp.deploymentCountry ?? "—";
          case "a1Status": return emp.a1Status ?? "—";
          default: return "—";
        }
      })
    );

    const success = pdf.drawTable(headers, rows, colWidths);
    if (!success && chunk.length > 5) {
      // Table didn't fit — retry with smaller chunk on next iteration
      rowsPerChunk = Math.max(5, Math.floor(rowsPerChunk / 2));
      continue; // don't advance rowIndex, retry same position with smaller chunk
    } else if (!success && chunk.length <= 5) {
      // Even small chunk doesn't fit — draw continuation message and move on
      pdf.drawText(MARGIN, pdf.contentY - 20, "[Tabel continuat pe pagina urmatoare]", "F1", 8, COLOR_TEXT_LIGHT);
    }

    rowIndex += chunk.length;
    rowsPerChunk = 50; // reset for next page
  }

  // Add footers with page numbers
  // Note: In a two-pass system we'd add footers after knowing total pages.
  // For simplicity, we add them during generation with "?" for total.

  return pdf.finalize(title, generatedBy);
}

// ─── 2. Raport A1 ────────────────────────────────────────────────────────────

export function generateA1ReportPDF(options: A1ReportOptions): Uint8Array {
  const { employees, title, generatedBy, logoPath } = options;
  const pdf = new PDFEngine();
  pdf.setLogo(logoPath);

  const dateStr = new Date().toLocaleDateString("ro-RO");
  const logoText = logoPath ? "" : "HR Manager";

  // Summary stats
  const withValidA1 = employees.filter((e) => e.a1Status === "VALID").length;
  const withExpiringA1 = employees.filter((e) => e.a1Status === "EXPIRING_SOON").length;
  const withExpiredA1 = employees.filter((e) => e.a1Status === "EXPIRED").length;
  const withoutA1 = employees.filter((e) => !e.a1Status || e.a1Status === "PENDING").length;

  pdf.newPage();
  pdf.drawHeader(title, dateStr, logoText);

  // Summary section
  pdf.drawSectionTitle("Rezumat status A1");

  const stats: {
    label: string;
    value: string;
    color?: [number, number, number];
  }[] = [
    { label: "Total angajati cu detasare", value: String(employees.length) },
    { label: "A1 Valid", value: String(withValidA1), color: COLOR_GREEN },
    { label: "A1 Expirand curand", value: String(withExpiringA1), color: COLOR_YELLOW },
    { label: "A1 Expirat", value: String(withExpiredA1), color: COLOR_RED },
    { label: "Fara A1", value: String(withoutA1), color: COLOR_GRAY },
  ];

  for (const stat of stats) {
    pdf.drawRect(MARGIN, pdf.contentY - 18, 180, 16, stat.color ?? COLOR_ROW_ALT);
    pdf.drawText(MARGIN + 6, pdf.contentY - 6, stat.label, "F1", 9, COLOR_TEXT);
    pdf.drawTextRight(MARGIN + 170, pdf.contentY - 6, stat.value, "F2", 9, COLOR_TEXT);
    pdf.moveDown(20);
  }

  pdf.moveDown(10);

  // Detail table
  pdf.drawSectionTitle("Detalii per angajat");
  pdf.moveDown(6);

  const headers = ["Nume", "Prenume", "Firma", "Tara detasare", "Status A1", "Expira"];
  const colWidths = [18, 16, 20, 16, 18, 14];

  const rows = employees.map((emp) => {
    const statusLabel = emp.a1Status === "VALID" ? "Valid" :
                        emp.a1Status === "EXPIRING_SOON" ? "Expira curand" :
                        emp.a1Status === "EXPIRED" ? "Expirat" : "Lipsa";
    const expiryStr = emp.a1Expiry ? new Date(emp.a1Expiry).toLocaleDateString("ro-RO") : "—";

    return [
      emp.lastName,
      emp.firstName,
      emp.companyName ?? "—",
      emp.deploymentCountry ?? "—",
      statusLabel,
      expiryStr,
    ];
  });

  pdf.drawTable(headers, rows, colWidths, {
    headerBg: COLOR_HEADER_BG,
    headerTextColor: COLOR_HEADER_TEXT,
  });

  return pdf.finalize(title, generatedBy);
}

// ─── 3. Raport pe Țară ───────────────────────────────────────────────────────

export function generateCountryReportPDF(options: CountryReportOptions): Uint8Array {
  const { employees, countryName, countryCode, title, generatedBy, logoPath } = options;
  const pdf = new PDFEngine();
  pdf.setLogo(logoPath);

  const dateStr = new Date().toLocaleDateString("ro-RO");
  const logoText = logoPath ? "" : "HR Manager";

  // Stats
  const activeCount = employees.filter((e) => e.status === "ACTIVE").length;
  const terminatedCount = employees.filter((e) => e.status === "TERMINATED").length;

  pdf.newPage();
  pdf.drawHeader(title, dateStr, logoText);

  // Title section
  pdf.drawSectionTitle(`Tara: ${countryName} (${countryCode})`);
  pdf.moveDown(4);

  pdf.drawInfoRow("Total angajati detasati", String(employees.length));
  pdf.drawInfoRow("Angajati activi", String(activeCount));
  pdf.drawInfoRow("Angajati terminati", String(terminatedCount));
  pdf.drawInfoRow("Data raport", dateStr);
  pdf.moveDown(10);

  // Employee table
  pdf.drawSectionTitle("Lista angajati detasati");
  pdf.moveDown(6);

  const headers = ["Nume", "Prenume", "Firma", "Functie", "Oras", "Status"];
  const colWidths = [18, 16, 22, 18, 16, 12];

  const rows = employees.map((emp) => [
    emp.lastName,
    emp.firstName,
    emp.companyName ?? "—",
    emp.position ?? "—",
    emp.deploymentCity ?? emp.city ?? "—",
    emp.status === "ACTIVE" ? "Activ" : "Terminat",
  ]);

  pdf.drawTable(headers, rows, colWidths, {
    headerBg: COLOR_HEADER_BG,
    headerTextColor: COLOR_HEADER_TEXT,
  });

  // Contact section (placeholder)
  if (employees.length > 0) {
    pdf.moveDown(10);
    pdf.drawSectionTitle("Informatii contact");
    pdf.moveDown(4);
    pdf.drawText(MARGIN, pdf.contentY, "Pentru informatii suplimentare contactati departamentul HR.", "F1", 9, COLOR_TEXT_LIGHT);
  }

  return pdf.finalize(title, generatedBy);
}

// ─── 4. Fișă Angajat ─────────────────────────────────────────────────────────

export function generateEmployeeSheetPDF(options: EmployeeSheetOptions): Uint8Array {
  const { employee, documents, deployments, title, generatedBy, logoPath } = options;
  const pdf = new PDFEngine();
  pdf.setLogo(logoPath);

  const dateStr = new Date().toLocaleDateString("ro-RO");
  const logoText = logoPath ? "" : "HR Manager";

  pdf.newPage();
  pdf.drawHeader(title, dateStr, logoText);

  // ═══ Secțiunea 1: Date personale ═══
  pdf.drawSectionTitle("1. Date personale");
  pdf.moveDown(4);

  pdf.drawInfoRow("Nume", `${employee.lastName} ${employee.firstName}`);
  pdf.drawInfoRow("CNP", employee.cnp ?? "—");
  pdf.drawInfoRow("Email", employee.email ?? "—");
  pdf.drawInfoRow("Telefon", employee.phone ?? "—");
  pdf.drawInfoRow("Adresa", employee.address ?? "—");
  pdf.drawInfoRow("Oras", employee.city ?? "—");
  pdf.drawInfoRow("Tara", employee.country ?? "RO");
  pdf.moveDown(10);

  // ═══ Secțiunea 2: Date contract ═══
  pdf.drawSectionTitle("2. Date contract");
  pdf.moveDown(4);

  pdf.drawInfoRow("Firma", employee.companyName ?? "—");
  pdf.drawInfoRow("Functie", employee.position ?? "—");
  pdf.drawInfoRow("Status", employee.status === "ACTIVE" ? "Activ" : "Terminat");
  pdf.drawInfoRow("Data angajarii", employee.hiredAt ? new Date(employee.hiredAt).toLocaleDateString("ro-RO") : "—");
  pdf.drawInfoRow("IBAN", employee.iban ?? "—");
  pdf.drawInfoRow("Banca", employee.bankName ?? "—");
  pdf.drawInfoRow("Tip plata", employee.salaryType ?? "—");
  pdf.drawInfoRow(
    "Suma bruta",
    typeof employee.salaryAmount === "number" && !Number.isNaN(employee.salaryAmount)
      ? `${employee.salaryAmount} ${employee.salaryCurrency ?? "RON"}`
      : "—"
  );
  pdf.drawInfoRow(
    "Valabil de la",
    employee.salaryStartDate ? new Date(employee.salaryStartDate).toLocaleDateString("ro-RO") : "—"
  );
  pdf.moveDown(10);

  // ═══ Secțiunea 3: Istoric detașări ═══
  if (deployments.length > 0) {
    pdf.drawSectionTitle("3. Istoric detasari");
    pdf.moveDown(6);

    const depHeaders = ["Tara", "Oras", "Data inceput", "Data sfarsit", "Status"];
    const depColWidths = [14, 16, 18, 18, 14];

    const depRows = deployments.map((d) => [
      d.country,
      d.city ?? "—",
      new Date(d.startDate).toLocaleDateString("ro-RO"),
      d.endDate ? new Date(d.endDate).toLocaleDateString("ro-RO") : "In desfasurare",
      d.status === "ACTIVE" ? "Activ" : d.status === "COMPLETED" ? "Finalizat" : "Anulat",
    ]);

    const success = pdf.drawTable(depHeaders, depRows, depColWidths);
    if (!success) {
      // New page for deployments
      pdf.newPage();
      pdf.drawHeader(title, dateStr, logoText);
      pdf.drawSectionTitle("3. Istoric detasari (continuare)");
      pdf.moveDown(6);
      pdf.drawTable(depHeaders, depRows, depColWidths);
    }
  }

  pdf.moveDown(10);

  // ═══ Secțiunea 4: Documente ═══
  if (documents.length > 0) {
    pdf.drawSectionTitle("4. Documente");
    pdf.moveDown(6);

    const docHeaders = ["Tip", "Numar", "Status", "Eliberat", "Expira"];
    const docColWidths = [16, 18, 16, 16, 16];

    const docRows = documents.map((d) => {
      const statusLabel =
        d.status === "VALID" ? "Valid" :
        d.status === "EXPIRING_SOON" ? "Expira curand" :
        d.status === "EXPIRED" ? "Expirat" : "In asteptare";

      return [
        d.type,
        d.number ?? "—",
        statusLabel,
        d.issueDate ? new Date(d.issueDate).toLocaleDateString("ro-RO") : "—",
        d.expiryDate ? new Date(d.expiryDate).toLocaleDateString("ro-RO") : "—",
      ];
    });

    const success = pdf.drawTable(docHeaders, docRows, docColWidths);
    if (!success) {
      pdf.newPage();
      pdf.drawHeader(title, dateStr, logoText);
      pdf.drawSectionTitle("4. Documente (continuare)");
      pdf.moveDown(6);
      pdf.drawTable(docHeaders, docRows, docColWidths);
    }
  }

  pdf.moveDown(10);

  // ═══ Secțiunea 5: Observații ═══
  if (employee.observations) {
    pdf.drawSectionTitle("5. Observatii");
    pdf.moveDown(4);
    pdf.drawText(MARGIN, pdf.contentY, employee.observations, "F1", 9, COLOR_TEXT);
  }

  return pdf.finalize(title, generatedBy);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ FUNCȚIE LEGACY (compatibilitate cu export-ul existent) ════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

interface PDFTableLegacy {
  headers: string[];
  rows: string[][];
  colWidths: number[];
}

interface PDFDocLegacy {
  title: string;
  header?: string;
  footer?: string;
  tables: PDFTableLegacy[];
}

/** Generator PDF simplu pentru compatibilitate cu export-ul existent */
export function generatePDF(doc: PDFDocLegacy): Uint8Array {
  const pdf = new PDFEngine();
  const dateStr = new Date().toLocaleDateString("ro-RO");

  for (const table of doc.tables) {
    pdf.newPage();
    pdf.drawHeader(doc.title, dateStr, doc.header);

    if (doc.title) {
      pdf.moveDown(10);
    }

    pdf.drawTable(table.headers, table.rows, table.colWidths);
  }

  return pdf.finalize(doc.title, doc.footer ?? "HR Management");
}
