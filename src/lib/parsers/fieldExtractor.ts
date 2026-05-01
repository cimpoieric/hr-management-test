import "server-only";
/**
 * Extractor câmpuri — heuristică din text brut extras din PDF sau OCR.
 *
 * Fiecare câmp are un scor de încredere (0-1):
 *   1.0   = regex match clar, context valid
 *   0.7   = match parțial / fuzzy
 *   0.0   = nu s-a găsit
 *
 * uncertainFields = câmpuri cu scor < 0.8 (necesită verificare umană).
 */

export interface ExtractedField {
  value: string;
  confidence: number;
  source: "regex" | "fuzzy" | "none";
}

export interface FieldExtractionResult {
  fields: Record<string, ExtractedField>;
  confidenceScore: number;    // medie câmpuri găsite (0-1)
  uncertainFields: string[];  // câmpuri cu confidence < 0.8
}

// ─── Regex-uri ───────────────────────────────────────────────────────────────

const REGEX_CNP = /\b[1-8]\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{6}\b/;
const REGEX_IBAN = /\bRO\d{2}[A-Z]{4}\d{4}\d{4}\d{4}\d{4}\b/;
const REGEX_PHONE = /\b(?:\+4)?0?7\d{2}\s?\d{3}\s?\d{3}\b/;
const REGEX_EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
const REGEX_SERIES_CI = /\b[sS][eErRtTyYuUiIoOpPaAsSdDfFgGhHjJkKlLzZxXcCvVbBnNmM]{2}\b/g;
const REGEX_NUMBER_CI = /\b\d{6,9}\b/g;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findMatch(text: string, regex: RegExp): string | null {
  const m = text.match(regex);
  return m ? m[0].replace(/\s/g, "") : null;
}

function findMatchKeepSpaces(text: string, regex: RegExp): string | null {
  const m = text.match(regex);
  return m ? m[0].trim() : null;
}

/**
 * Caută o valoare pe linia de după un label (sau pe aceeași linie).
 * De exemplu: "Nume: Popescu" sau "Nume\nPopescu"
 */
function findAfterLabel(text: string, labels: string[]): string | null {
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const lineLower = line.toLowerCase();
    for (const label of labels) {
      if (lineLower.includes(label.toLowerCase())) {
        // Valoare pe aceeași linie după separator
        const sameLineMatch = line.match(/[:\-]\s*(.+)/);
        if (sameLineMatch) {
          const val = (sameLineMatch[1] ?? "").trim();
          if (val.length > 1 && val.length < 100) return val;
        }
        // Valoare pe linia următoare
        if (i + 1 < lines.length) {
          const nextLine = (lines[i + 1] ?? "").trim();
          if (nextLine && nextLine.length > 1 && nextLine.length < 100 && !labels.some((l) => nextLine.toLowerCase().includes(l.toLowerCase()))) {
            return nextLine;
          }
        }
      }
    }
  }
  return null;
}

// ─── Main Extractor ──────────────────────────────────────────────────────────

export function extractFields(text: string): FieldExtractionResult {
  const cleanText = text.replace(/\s+/g, " ").replace(/\n+/g, "\n").trim();
  const singleLine = cleanText.replace(/\n/g, " ");

  const fields: Record<string, ExtractedField> = {};

  // ─── CNP ─────────────────────────────────────────────────────
  const cnpMatch = findMatch(singleLine, REGEX_CNP);
  if (cnpMatch && cnpMatch.length === 13) {
    fields.cnp = { value: cnpMatch, confidence: 1.0, source: "regex" };
  } else {
    fields.cnp = { value: "", confidence: 0, source: "none" };
  }

  // ─── IBAN ────────────────────────────────────────────────────
  const ibanMatch = findMatch(singleLine, REGEX_IBAN);
  if (ibanMatch) {
    fields.iban = { value: ibanMatch, confidence: 1.0, source: "regex" };
  } else {
    fields.iban = { value: "", confidence: 0, source: "none" };
  }

  // ─── Telefon ─────────────────────────────────────────────────
  const phoneMatch = findMatchKeepSpaces(singleLine, REGEX_PHONE);
  if (phoneMatch) {
    const cleanPhone = phoneMatch.replace(/\s/g, "");
    fields.phone = { value: cleanPhone, confidence: 1.0, source: "regex" };
  } else {
    fields.phone = { value: "", confidence: 0, source: "none" };
  }

  // ─── Email ───────────────────────────────────────────────────
  const emailMatch = findMatchKeepSpaces(singleLine, REGEX_EMAIL);
  if (emailMatch) {
    fields.email = { value: emailMatch, confidence: 1.0, source: "regex" };
  } else {
    fields.email = { value: "", confidence: 0, source: "none" };
  }

  // ─── Nume (lastName) ─────────────────────────────────────────
  const numeValue = findAfterLabel(cleanText, ["nume", "nume de familie", "numele", "nume și prenume"]);
  if (numeValue) {
    // Dacă e "Nume Prenume", ia doar primul cuvânt ca nume
    const parts = numeValue.split(/\s+/);
    const lastName = parts[0] ?? numeValue;
    fields.lastName = { value: lastName, confidence: 0.7, source: "fuzzy" };
  } else {
    fields.lastName = { value: "", confidence: 0, source: "none" };
  }

  // ─── Prenume ─────────────────────────────────────────────────
  const prenumeValue = findAfterLabel(cleanText, ["prenume", "prenumele"]);
  if (prenumeValue) {
    fields.firstName = { value: prenumeValue, confidence: 0.7, source: "fuzzy" };
  } else if (numeValue) {
    // Fallback: ia cuvintele după primul din "Nume Prenume"
    const parts = numeValue.split(/\s+/);
    if (parts.length > 1) {
      fields.firstName = { value: parts.slice(1).join(" "), confidence: 0.5, source: "fuzzy" };
    } else {
      fields.firstName = { value: "", confidence: 0, source: "none" };
    }
  } else {
    fields.firstName = { value: "", confidence: 0, source: "none" };
  }

  // ─── Serie CI ────────────────────────────────────────────────
  const seriesMatch = findMatch(singleLine, REGEX_SERIES_CI);
  if (seriesMatch && seriesMatch.length === 2) {
    fields.seriesCI = { value: seriesMatch.toUpperCase(), confidence: 0.8, source: "regex" };
  } else {
    fields.seriesCI = { value: "", confidence: 0, source: "none" };
  }

  // ─── Număr CI ────────────────────────────────────────────────
  // Caută un număr de 6-9 cifre care NU face parte din CNP sau IBAN
  const allNumbers = singleLine.match(REGEX_NUMBER_CI);
  const cnpStart = fields.cnp.value ? fields.cnp.value.slice(0, 6) : null;
  let numberCI = "";
  if (allNumbers) {
    for (const n of allNumbers) {
      if (fields.cnp.value?.includes(n)) continue;
      if (fields.iban.value?.includes(n)) continue;
      if (n === cnpStart) continue;
      if (n.length >= 6 && n.length <= 9) {
        numberCI = n;
        break;
      }
    }
  }
  if (numberCI) {
    fields.numberCI = { value: numberCI, confidence: 0.6, source: "fuzzy" };
  } else {
    fields.numberCI = { value: "", confidence: 0, source: "none" };
  }

  // ─── Adresă ──────────────────────────────────────────────────
  const addressValue = findAfterLabel(cleanText, ["adresa", "adresă", "domiciliu"]);
  if (addressValue) {
    fields.address = { value: addressValue, confidence: 0.6, source: "fuzzy" };
  } else {
    fields.address = { value: "", confidence: 0, source: "none" };
  }

  // ─── Calculează scoruri ─────────────────────────────────────
  const allFieldValues = Object.values(fields);
  const foundFields = allFieldValues.filter((f) => f.confidence > 0);
  const confidenceScore = foundFields.length > 0
    ? foundFields.reduce((s, f) => s + f.confidence, 0) / foundFields.length
    : 0;

  const uncertainFields = Object.entries(fields)
    .filter(([, f]) => f.confidence < 0.8)
    .map(([name]) => name);

  return { fields, confidenceScore, uncertainFields };
}
