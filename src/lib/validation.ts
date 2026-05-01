/**
 * Utilitare validare pentru date HR românești.
 *
 * - CNP: format 13 cifre + checksum valid + dată validă
 * - IBAN: format standard + MOD-97-10 checksum
 * - Email: regex standard
 * - Telefon: format RO (07xx...) sau internațional (+40...)
 */

// ─── CNP ─────────────────────────────────────────────────────────────────────

const CNP_WEIGHTS = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];

/** Verifică validitatea completă a unui CNP românesc. */
export function validateCNP(cnp: string): boolean {
  if (!cnp || cnp.length !== 13) return false;
  if (!/^\d{13}$/.test(cnp)) return false;

  // Prima cifră: sex + secol (1-8)
  const sex = parseInt(cnp.charAt(0), 10);
  if (sex < 1 || sex > 8) return false;

  // Extrage și validează data nașterii
  const yearShort = parseInt(cnp.substring(1, 3), 10);
  const month = parseInt(cnp.substring(3, 5), 10);
  const day = parseInt(cnp.substring(5, 7), 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Determină secolul
  let fullYear: number;
  if (sex === 1 || sex === 2) fullYear = 1900 + yearShort;
  else if (sex === 3 || sex === 4) fullYear = 1800 + yearShort;
  else if (sex === 5 || sex === 6) fullYear = 2000 + yearShort;
  else fullYear = 2000 + yearShort; // 7, 8 — rezidenți

  // Validează data calendaristică
  const birthDate = new Date(fullYear, month - 1, day);
  if (birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day) {
    return false;
  }

  // Județ: 01-52 (sau coduri speciale)
  const county = parseInt(cnp.substring(7, 9), 10);
  if (county < 1 || county > 52) return false;

  // Checksum
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnp.charAt(i), 10) * CNP_WEIGHTS[i]!;
  }
  const remainder = sum % 11;
  const checksum = remainder < 10 ? remainder : 1;

  return checksum === parseInt(cnp.charAt(12), 10);
}

/** Extrage data nașterii din CNP. Returnează null dacă CNP invalid. */
export function extractBirthDateFromCNP(cnp: string): Date | null {
  if (!validateCNP(cnp)) return null;

  const sex = parseInt(cnp.charAt(0), 10);
  const yearShort = parseInt(cnp.substring(1, 3), 10);
  const month = parseInt(cnp.substring(3, 5), 10) - 1;
  const day = parseInt(cnp.substring(5, 7), 10);

  let fullYear: number;
  if (sex === 1 || sex === 2) fullYear = 1900 + yearShort;
  else if (sex === 3 || sex === 4) fullYear = 1800 + yearShort;
  else fullYear = 2000 + yearShort;

  return new Date(fullYear, month, day);
}

/** Maschează CNP pentru afișare: primele 6 caractere + **** */
export function maskCNP(cnp: string): string {
  if (!cnp || cnp.length !== 13) return "****";
  return cnp.substring(0, 6) + "****";
}

// ─── IBAN ────────────────────────────────────────────────────────────────────

/** Verifică IBAN folosind algoritmul MOD-97-10. */
export function validateIBAN(iban: string): boolean {
  if (!iban) return false;

  const clean = iban.replace(/\s/g, "").toUpperCase();
  if (clean.length < 15 || clean.length > 34) return false;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(clean)) return false;

  // Rearanjează: mută primele 4 caractere la final
  const rearranged = clean.slice(4) + clean.slice(0, 4);

  // Convertește litere în numere (A=10, B=11, ..., Z=35)
  let numeric = "";
  for (const char of rearranged) {
    if (/[A-Z]/.test(char)) {
      numeric += (char.charCodeAt(0) - 55).toString();
    } else {
      numeric += char;
    }
  }

  // MOD-97: procesează câte 9 cifre odată pentru a evita overflow
  let segment = numeric.slice(0, 9);
  let idx = 9;
  while (idx < numeric.length) {
    const remainder = parseInt(segment, 10) % 97;
    const nextDigits = Math.min(7, numeric.length - idx);
    segment = String(remainder) + numeric.substring(idx, idx + nextDigits);
    idx += nextDigits;
  }

  return parseInt(segment, 10) % 97 === 1;
}

/** Maschează IBAN: primele 4 + **** + ultimele 4 */
export function maskIBAN(iban: string): string | null {
  if (!iban) return null;
  const clean = iban.replace(/\s/g, "");
  if (clean.length < 12) return clean.slice(0, 4) + "****";
  return clean.slice(0, 4) + "****" + clean.slice(-4);
}

// ─── Email ───────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  return EMAIL_REGEX.test(email);
}

// ─── Telefon ─────────────────────────────────────────────────────────────────

/** Validează număr de telefon românesc sau internațional. */
export function validatePhone(phone: string): boolean {
  if (!phone) return false;
  const clean = phone.replace(/[\s\-\.]/g, "");

  // Format românesc: 07xxxxxxxx (10 cifre)
  if (/^07\d{8}$/.test(clean)) return true;

  // Format internațional: +40xxxxxxxx sau +407xxxxxxxx
  if (/^\+40\d{8,9}$/.test(clean)) return true;

  // Format general internațional: +prefix număr
  if (/^\+\d{8,15}$/.test(clean)) return true;

  return false;
}

/** Curăță și normalizează numărul de telefon. */
export function normalizePhone(phone: string): string {
  if (!phone) return phone;
  return phone.replace(/[\s\-\.]/g, "").trim();
}
