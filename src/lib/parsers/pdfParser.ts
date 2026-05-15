import "server-only";

/**
 * Parser PDF — extrage text brut din fișiere PDF (pdf-parse v1.x).
 */

import pdfParse from "pdf-parse";

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const result = await pdfParse(buffer);
    return result.text ?? "";
  } catch (error) {
    console.error("[PDF_PARSER] Eroare la parsare:", error);
    throw new Error(
      "Nu am putut extrage textul din PDF. Verifică dacă fișierul nu este corupt sau scanat (imagine).",
    );
  }
}
