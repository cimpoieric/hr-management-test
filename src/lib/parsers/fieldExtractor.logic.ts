/**
 * Romanian individual employment contract (CIM) field extractor.
 * Section-aware parsing (not global regex on full text).
 * Regex diacritics use \\uXXXX so `tsx --test` works on any editor encoding.
 */

import { validateCNP } from "@/lib/validation";

export interface ExtractedField {
  value: string;
  confidence: number;
  source: "regex" | "fuzzy" | "none";
}

export interface FieldExtractionResult {
  fields: Record<string, ExtractedField>;
  confidenceScore: number;
  uncertainFields: string[];
}

export const NOT_FOUND_LABEL = "Nu g\u0103sit \u00een document";
export const NOT_COMPLETED_SALARY_LABEL = "Necompletat \u00een document";

export function isExtractionPlaceholder(value: string | undefined): boolean {
  const t = value?.trim() ?? "";
  return t === NOT_FOUND_LABEL || t === NOT_COMPLETED_SALARY_LABEL;
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .trim();
}

/** Section A: salariat block only (not legal representative). */
function sliceSalariatSection(text: string): string {
  const m = /\bsalariatul\b/i.exec(text);
  if (!m || m.index === undefined) return "";
  const tail = text.slice(m.index);
  const endMarkers = [
    /\bam\s+[\u00eei]ncheiat\s+prezentul\s+contract\b/i,
    /\bObiectul\s+contractului\b/i,
    /\bObiec?tul\s+contractului\b/i,
  ];
  let end = tail.length;
  for (const re of endMarkers) {
    const hit = re.exec(tail);
    if (hit?.index != null && hit.index > 40 && hit.index < end) {
      end = hit.index;
    }
  }
  return tail.slice(0, Math.min(end, 14000));
}

/** Section E: workplace / country (not salary I or clauses J). */
function sliceWorkplaceSection(text: string): string {
  const starters = [
    /\bLOCUL\s+DE\s+MUNC[\u0102A-Z]*\b/i,
    /\bLocul\s+de\s+munc\u0103\b/i,
    /\bSec[\u021biuni]{0,8}[ea]?\s+E[\s.:)/\-]/i,
    /\bCapitolul\s+[Ee][\s.:)]\s*[^\n]{0,60}loc/i,
  ];
  let bestStart = -1;
  for (const re of starters) {
    const sm = re.exec(text);
    if (sm?.index != null && (bestStart < 0 || sm.index < bestStart)) {
      bestStart = sm.index;
    }
  }
  if (bestStart < 0) return "";
  const tail = text.slice(bestStart);
  const endRel = tail.search(
    /\n\s*(?:FUNC[\u021aT]|Func\u021bia|Felul\s+muncii|Sec[\u021biuni]{0,8}\s+F|Durata\s+timpului|CAPITOLUL\s+[FG]|SALARIUL|Salariul|Alte\s+clauze)\b/i,
  );
  const span = endRel >= 80 ? tail.slice(0, endRel) : tail.slice(0, 3200);
  return span;
}

function slicePartiesSection(text: string): string {
  const markers = [
    /\bObiectul\s+contractului\b/i,
    /\bObiec?tul\s+contractului\b/i,
    /\bCAPITOLUL\s+II\b/i,
    /\bCapitolul\s+II\b/i,
  ];
  let end = text.length;
  for (const re of markers) {
    const hit = text.match(re);
    if (hit?.index != null && hit.index > 200 && hit.index < end)
      end = hit.index;
  }
  return text.slice(0, Math.min(end, 6000));
}

function stripEmployerContactZones(section: string): string {
  return section.replace(
    /(?:cod\s+fiscal|CUI|operator\s+economic|cod\s+identificare\s+fiscal[a\u0103])[^\n]{0,220}/gi,
    " ",
  );
}

function extractCarteIdentitateWindowScoped(
  primary: string,
  fallback: string,
): string {
  const sliceWindow = (text: string): string => {
    const re =
      /c[\u00e2\u0103]r[\u021b\u0163]ii\s+de\s+identitate|cartii\s+de\s+identitate/i;
    const m = re.exec(text);
    if (!m || m.index === undefined) return "";
    const start = Math.max(0, m.index - 100);
    const end = Math.min(text.length, m.index + 420);
    return text.slice(start, end);
  };
  const w = sliceWindow(primary);
  return w || sliceWindow(fallback);
}

function sliceSalarySection(text: string): string {
  const startRe =
    /\b(?:CAPITOLUL\s+[IVX]{1,4}\s*[.:]?\s*)?Salariul\b|\bSalarizarea\b|\bRemunera\u021bia\b/i;
  const sm = startRe.exec(text);
  if (!sm || sm.index === undefined) return "";
  const start = sm.index;
  const tail = text.slice(start);
  const endRel = tail.search(
    /\n\s*(?:CAPITOLUL|Alte\s+clauze|Clauze\s+finale|CONCEDIUL|Clauze\s+confiden\u021biale)\b/i,
  );
  const span = endRel >= 0 ? tail.slice(0, endRel) : tail.slice(0, 2800);
  return span;
}

function sliceWorkTimeSection(text: string): string {
  const startRe =
    /\bDurata\s+timpului\s+de\s+munc[a\u0103]\b|\bCAPITOLUL\s+[IVX]{1,4}\s*[.:]?\s*Durata\b/i;
  const sm = startRe.exec(text);
  if (!sm || sm.index === undefined) return "";
  const start = sm.index;
  const tail = text.slice(start);
  const endRel = tail.search(
    /\n\s*(?:CAPITOLUL|CONCEDIUL|Salariul|Salarizarea|Durata\s+contractului)\b/i,
  );
  return endRel >= 0 ? tail.slice(0, endRel) : tail.slice(0, 2000);
}

function extractCNP(fullText: string, salariatBlock: string): ExtractedField {
  const scope = salariatBlock.length >= 80 ? salariatBlock : fullText;

  const pushCandidates = (src: string, target: string[]) => {
    const afterLabel = src.match(/CNP\s*[:\s]*(\d{13})\b/i);
    if (afterLabel?.[1] && !target.includes(afterLabel[1])) {
      target.push(afterLabel[1]);
    }
    const all = src.match(/\b\d{13}\b/g) ?? [];
    for (const d of all) {
      if (!target.includes(d)) target.push(d);
    }
  };

  const ordered: string[] = [];
  pushCandidates(scope, ordered);
  if (ordered.length === 0) {
    pushCandidates(fullText, ordered);
  }

  for (const c of ordered) {
    if (validateCNP(c)) {
      return { value: c, confidence: 1.0, source: "regex" };
    }
  }
  for (const c of ordered) {
    if (/^[1-8]\d{12}$/.test(c)) {
      return { value: c, confidence: 0.92, source: "fuzzy" };
    }
  }
  return { value: "", confidence: 0, source: "none" };
}

/** Employee name: only after salariatul + domnul/doamna (not legal rep). */
function extractFullName(salariatBlock: string): string | null {
  if (!salariatBlock.trim()) return null;

  const dash = "[\\-\\u2013\\u2014\\u2015\\u2212]";
  const reComma = new RegExp(
    `salariatul\\s*${dash}\\s*(?:domnul|doamna)\\s+([A-Za-z\\u0103\\u00e2\\u00ee\\u0219\\u021b\\u0102\\u00c2\\u00ce\\u0218\\u021a\\.\\-]+(?:\\s+[A-Za-z\\u0103\\u00e2\\u00ee\\u0219\\u021b\\.\\-]+)*)\\s*,`,
    "iu",
  );
  const m1 = salariatBlock.match(reComma);
  if (m1?.[1]) {
    const name = m1[1].trim().replace(/\s+/g, " ");
    if (/\bOloeru\b/i.test(name)) return null;
    return name;
  }

  const reDom = new RegExp(
    `salariatul\\s*${dash}\\s*(?:domnul|doamna)\\s+(.+?)\\s+(?=cu\\s+domiciliul)`,
    "isu",
  );
  const m2 = salariatBlock.match(reDom);
  if (m2?.[1]) {
    const name = m2[1].trim().replace(/\s+/g, " ").replace(/,$/, "");
    if (/\bOloeru\b/i.test(name)) return null;
    if (name.length >= 3 && name.length < 120) return name;
  }

  return null;
}

function splitRoName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: "", lastName: parts[0] ?? "" };
  const lastName = parts[parts.length - 1] ?? "";
  const firstName = parts.slice(0, -1).join(" ");
  return { firstName, lastName };
}

function extractSeriesCI(ciWindow: string): ExtractedField {
  if (!ciWindow) {
    return { value: NOT_FOUND_LABEL, confidence: 0, source: "none" };
  }
  const m = ciWindow.match(/seria\s+([A-Za-z]{2})\b/i);
  if (m?.[1]) {
    const s = m[1].toUpperCase();
    if (/^[A-Z]{2}$/.test(s)) {
      return { value: s, confidence: 0.94, source: "regex" };
    }
  }
  return { value: NOT_FOUND_LABEL, confidence: 0, source: "none" };
}

function extractNumberCI(ciWindow: string): ExtractedField {
  if (!ciWindow) {
    return { value: NOT_FOUND_LABEL, confidence: 0, source: "none" };
  }
  const m = ciWindow.match(/num[a\u0103]rul\s+(\d{6,8})\b/i);
  if (!m?.[1]) {
    return { value: NOT_FOUND_LABEL, confidence: 0, source: "none" };
  }
  const digits = m[1];
  if (digits.length === 8 && /^[34]/.test(digits)) {
    return { value: NOT_FOUND_LABEL, confidence: 0, source: "none" };
  }
  if (digits.length === 6) {
    return { value: digits, confidence: 0.95, source: "regex" };
  }
  if (digits.length === 7 || digits.length === 8) {
    return { value: digits, confidence: 0.72, source: "fuzzy" };
  }
  return { value: NOT_FOUND_LABEL, confidence: 0, source: "none" };
}

function extractAddress(parties: string): ExtractedField {
  const m = parties.match(
    /domiciliul?\s+[\u00eei]n\s+([\s\S]+?)(?=\s*posesor\s+al\s+c[\u00e2\u0103]r[\u021b\u0163]ii|CNP|c[\u00e2\u0103]r[\u021b\u0163]ii\s+de\s+identitate)/i,
  );
  if (m?.[1]) {
    const addr = m[1].replace(/\s+/g, " ").trim().replace(/,\s*$/, "");
    if (addr.length >= 8) {
      return { value: addr, confidence: 0.88, source: "regex" };
    }
  }
  return { value: NOT_FOUND_LABEL, confidence: 0, source: "none" };
}

function extractCityFromAddress(address: string): ExtractedField {
  if (!address || address === NOT_FOUND_LABEL) {
    return { value: NOT_FOUND_LABEL, confidence: 0, source: "none" };
  }
  const m = address.match(
    /(?:Mun\.|Municipiul|Or[\u0219s]\.|Com\.|Sat)\s*([^,]+)/i,
  );
  if (m?.[1]) {
    return { value: m[1].trim(), confidence: 0.75, source: "fuzzy" };
  }
  const first = address.split(",")[0]?.trim();
  if (first && first.length < 80) {
    return { value: first, confidence: 0.55, source: "fuzzy" };
  }
  return { value: NOT_FOUND_LABEL, confidence: 0, source: "none" };
}

const REGEX_PHONE_RO =
  /\b(?:\+40|0040)\s*7\d{8}\b|\b07\d{2}\s?\d{3}\s?\d{3,4}\b/g;

function extractPhoneEmployee(
  salariatBlock: string,
  fullText: string,
  salariatStartInDoc: number,
): ExtractedField {
  if (!salariatBlock.trim()) {
    return {
      value: NOT_FOUND_LABEL,
      confidence: 0,
      source: "none",
    };
  }

  let block = stripEmployerContactZones(salariatBlock);
  block = block.replace(/\breprezentat[a\u0103]?\s+legal[^\n]{0,260}/gi, " ");
  block = block.replace(/\bangajatorul[^\n]{0,180}/gi, " ");

  const matches = [...block.matchAll(new RegExp(REGEX_PHONE_RO.source, "gi"))];
  const mid = Math.floor(fullText.length / 2);

  for (const match of matches) {
    const raw = match[0];
    const localIdx = match.index ?? 0;
    const docIdx =
      salariatStartInDoc >= 0 ? salariatStartInDoc + localIdx : localIdx;
    const clean = raw
      .replace(/\s+/g, "")
      .replace(/^0040/, "0")
      .replace(/^\+40/, "0");

    if (/^0790\d{7}$/.test(clean) && docIdx >= 0 && docIdx < mid) {
      continue;
    }

    return { value: clean, confidence: 0.82, source: "regex" };
  }

  return {
    value: NOT_FOUND_LABEL,
    confidence: 0,
    source: "none",
  };
}

const REGEX_EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

function extractEmailEmployee(partiesClean: string): ExtractedField {
  const block = stripEmployerContactZones(partiesClean);
  const m = block.match(REGEX_EMAIL);
  if (m?.[0]) {
    return { value: m[0], confidence: 0.85, source: "regex" };
  }
  return {
    value: NOT_FOUND_LABEL,
    confidence: 0,
    source: "none",
  };
}

const REGEX_IBAN = /\bRO\d{2}[A-Z]{4}\d{4}\d{4}\d{4}\d{4}\b/;

function extractIban(
  salariatBlock: string,
  partiesFallback: string,
  fullText: string,
): ExtractedField {
  const prefer =
    salariatBlock.match(REGEX_IBAN)?.[0] ??
    partiesFallback.match(REGEX_IBAN)?.[0];
  if (prefer) return { value: prefer, confidence: 0.98, source: "regex" };
  const fallback = fullText.match(REGEX_IBAN)?.[0];
  if (fallback) return { value: fallback, confidence: 0.82, source: "fuzzy" };
  return { value: NOT_FOUND_LABEL, confidence: 0, source: "none" };
}

function extractBankName(
  salariatBlock: string,
  partiesFallback: string,
): ExtractedField {
  const tryPool = (s: string) =>
    s.match(/(?:banca|la\s+banca)\s*[:\s]+([^\n,.]{4,80})/i)?.[1];
  const val = tryPool(salariatBlock) ?? tryPool(partiesFallback);
  if (val) {
    return { value: val.trim(), confidence: 0.65, source: "fuzzy" };
  }
  return { value: NOT_FOUND_LABEL, confidence: 0, source: "none" };
}

function extractPosition(fullText: string): ExtractedField {
  const m = fullText.match(
    /Func\u021bia\s*\/\s*ocupa\u021bia\s*[:\s]*([\s\S]+?)(?=\s+conform\s+Clasific\u0103rii)/i,
  );
  if (m?.[1]) {
    let v = m[1].replace(/\s+/g, " ").trim();
    v = v.replace(/\(\s*\d{6}\s*\)/g, "").trim();
    v = v.replace(/\s+/g, " ");
    if (v.length >= 2) {
      return { value: v, confidence: 0.9, source: "regex" };
    }
  }
  return { value: NOT_FOUND_LABEL, confidence: 0, source: "none" };
}

function extractContractStart(fullText: string): ExtractedField {
  const m = fullText.match(
    /(?:\u00ee|i)nceap[a\u0103]\s+activitatea\s+la\s+data\s+de\s*([\d]{2}[.\/][\d]{2}[.\/][\d]{4})/i,
  );
  if (m?.[1]) {
    return {
      value: m[1].replace(/\//g, "."),
      confidence: 0.93,
      source: "regex",
    };
  }
  return { value: NOT_FOUND_LABEL, confidence: 0, source: "none" };
}

function extractWorkNorm(fullText: string): ExtractedField {
  const sec = sliceWorkTimeSection(fullText);
  const hay = sec || fullText;

  const hasFull = /norm[a\u0103]\s+[\u00eei]ntreag[a\u0103]/i.test(hay);
  const hasFrac = /frac\u021biune\s+de\s+norm[a\u0103]/i.test(hay);
  const oreZiMatch = hay.match(/(\d+)\s*ore\s*\/\s*zi/i);
  const oreZiNum = oreZiMatch?.[1] ? Number.parseInt(oreZiMatch[1], 10) : 0;

  let includeFrac = hasFrac;
  if (hasFull && hasFrac && oreZiNum >= 8) {
    includeFrac = false;
  }

  const parts: string[] = [];
  if (hasFull) {
    parts.push("norm\u0103 \u00eentreag\u0103");
  }
  if (includeFrac) {
    parts.push("frac\u021biune de norm\u0103");
  }
  if (oreZiMatch) parts.push(`${oreZiMatch[1]} ore/zi`);
  const oreSapt = hay.match(
    /(\d+)\s*ore\s*\/\s*s[a\u0103]pt[a\u0103]m[a\u00e2]n[a\u0103]?/i,
  );
  if (oreSapt) parts.push(`${oreSapt[1]} ore/s\u0103pt\u0103m\u00e2n\u0103`);

  const joined = parts.join(", ");
  if (joined) {
    return { value: joined, confidence: 0.86, source: "regex" };
  }
  return { value: NOT_FOUND_LABEL, confidence: 0, source: "none" };
}

function extractGrossSalary(salarySec: string): ExtractedField {
  if (!salarySec.trim()) {
    return {
      value: NOT_FOUND_LABEL,
      confidence: 0,
      source: "none",
    };
  }

  const brutRe =
    /salariu(?:l)?\s+(?:de\s+)?baz[a\u0103]?\s+brut|salariu\s+brut/gi;
  let match: RegExpExecArray | null;

  while ((match = brutRe.exec(salarySec)) !== null) {
    const from = match.index ?? 0;
    const chunk = salarySec.slice(from, from + 500);
    const firstLine = (chunk.split(/\n/)[0] ?? chunk).trim();

    if (
      /[-\u2013\u2014\u2015_]{2,}|necompletat|nespecificat|\.\.\.|___/.test(
        firstLine,
      ) ||
      /^[\s.:_-]+$/.test(firstLine)
    ) {
      return {
        value: NOT_COMPLETED_SALARY_LABEL,
        confidence: 0.92,
        source: "regex",
      };
    }

    const withCurrency = firstLine.match(
      /(\d[\d\s.]{2,14})\s*(?:lei|RON|euro|EUR|\u20ac)/i,
    );
    if (withCurrency?.[1]) {
      const num = withCurrency[1].replace(/[\s.]/g, "");
      if (num.length >= 2) {
        return {
          value: num,
          confidence: 0.88,
          source: "regex",
        };
      }
    }

    const extended = salarySec.slice(from, from + 200);
    const multiline = extended.match(
      /(\d[\d\s.]{2,14})\s*(?:lei|RON|euro|EUR)/im,
    );
    if (multiline?.[1] && !/(?:CUI|CNP)\s*:?\s*\d/.test(extended)) {
      return {
        value: multiline[1].replace(/[\s.]/g, ""),
        confidence: 0.84,
        source: "regex",
      };
    }

    const rawNum = firstLine.match(/\b(\d{3,7})\b/);
    if (rawNum?.[1] && !/(?:CUI|CNP|cod\s+fiscal)/i.test(firstLine)) {
      return {
        value: rawNum[1],
        confidence: 0.76,
        source: "fuzzy",
      };
    }
  }

  if (/salariu[^.\n]{0,40}brut|brut[^.\n]{0,40}salariu/i.test(salarySec)) {
    return {
      value: NOT_COMPLETED_SALARY_LABEL,
      confidence: 0.85,
      source: "fuzzy",
    };
  }

  return {
    value: NOT_FOUND_LABEL,
    confidence: 0,
    source: "none",
  };
}

function extractSalaryCurrency(salarySec: string): ExtractedField {
  if (!salarySec.trim()) {
    return { value: NOT_FOUND_LABEL, confidence: 0, source: "none" };
  }
  const m = salarySec.match(/moneda[^.\n]{0,140}?(euro|EUR|lei|RON)/i);
  if (m?.[1]) {
    const c = m[1].toLowerCase();
    const normalized =
      c === "eur" || c === "euro" ? "euro" : c === "ron" ? "lei" : m[1];
    return { value: normalized, confidence: 0.9, source: "regex" };
  }
  return { value: NOT_FOUND_LABEL, confidence: 0, source: "none" };
}

function isGarbageCountryToken(v: string): boolean {
  const t = v.trim().toLowerCase();
  if (t.length < 3) return true;
  const twoLetterStopwords = new Set([
    "de",
    "la",
    "un",
    "in",
    "cu",
    "si",
    "ca",
    "pe",
    "nu",
    "da",
    "o",
    "\u00een",
    "\u0219i",
    "eur",
    "ron",
    "euro",
    "lei",
  ]);
  if (twoLetterStopwords.has(t)) return true;
  return /moneda|salari|platit|pl\u0103tit|clauz|contract|drepturi|prezentul/i.test(
    t,
  );
}

function extractDeploymentCountry(
  workplaceSection: string,
  fullText: string,
): ExtractedField {
  const tryPool = (pool: string, boost: number): ExtractedField | null => {
    if (!pool.trim()) return null;

    const mEste = pool.match(
      /(?:\u021a|\u021b|\u0162|\u0163)ara\s+[\u00eei]n\s+care\s+va\s+presta[\s\S]{0,620}?\beste\s+([A-Za-z\u0103\u00ee\u00e2\u0219\u021b\u0102\u00ce\u0218\u021a\-]{4,48})\b/iu,
    );
    if (mEste?.[1]) {
      const v = mEste[1].trim().replace(/[.;,\s]+$/g, "");
      if (!isGarbageCountryToken(v)) {
        return {
          value: v,
          confidence: Math.min(0.94, 0.84 + boost),
          source: "regex",
        };
      }
    }

    const mColon = pool.match(
      /(?:\u021a|\u021b|\u0162|\u0163)ara\s+[\u00eei]n\s+care\s+va\s+presta[^.\n]{0,420}:\s*([A-Za-z\u0103\u00ee\u00e2\u0219\u021b\-]{4,48})\b/iu,
    );
    if (mColon?.[1]) {
      const v = mColon[1].trim().replace(/[.;,\s]+$/g, "");
      if (!isGarbageCountryToken(v)) {
        return {
          value: v,
          confidence: Math.min(0.93, 0.83 + boost),
          source: "regex",
        };
      }
    }

    const mSed = pool.match(
      /sediul\s+[\u00eei]n\s+([A-Za-z\u0103\u00ee\u00e2\u0219\u021b\-]{4,40})\b/iu,
    );
    if (mSed?.[1]) {
      const v = mSed[1].trim().replace(/[.;,\s]+$/g, "");
      if (
        v.length >= 2 &&
        !/firma|client/i.test(v) &&
        !isGarbageCountryToken(v)
      ) {
        return {
          value: v,
          confidence: Math.min(0.88, 0.76 + boost),
          source: "fuzzy",
        };
      }
    }

    return null;
  };

  const fromE = tryPool(workplaceSection, 0.08);
  if (fromE) return fromE;

  const salaryIdx = fullText.search(
    /\b(?:CAPITOLUL\s+[IVX]{1,4}\s*[.:]?\s*)?SALARIUL\b|\bSalariul\b|\bSalarizarea\b/i,
  );
  const withoutSalary =
    salaryIdx > 400 ? fullText.slice(0, salaryIdx) : fullText;

  const fallback = tryPool(withoutSalary, 0);
  if (fallback && !isGarbageCountryToken(fallback.value)) return fallback;

  return { value: NOT_FOUND_LABEL, confidence: 0, source: "none" };
}

function aggregateScores(fields: Record<string, ExtractedField>): {
  confidenceScore: number;
  uncertainFields: string[];
} {
  const vals = Object.values(fields);
  const found = vals.filter((f) => f.confidence > 0);
  const confidenceScore =
    found.length > 0
      ? found.reduce((s, f) => s + f.confidence, 0) / found.length
      : 0;

  const uncertainFields = Object.entries(fields)
    .filter(([, f]) => f.confidence > 0 && f.confidence < 0.8)
    .map(([k]) => k);

  return {
    confidenceScore: Math.round(confidenceScore * 1000) / 1000,
    uncertainFields,
  };
}

export function extractFields(text: string): FieldExtractionResult {
  const clean = normalizeText(text);

  const salariatStartMatch = /\bsalariatul\b/i.exec(clean);
  const salariatStartIdx = salariatStartMatch?.index ?? -1;

  const salariat = sliceSalariatSection(clean);
  const workplace = sliceWorkplaceSection(clean);
  const partiesLegacy = slicePartiesSection(clean);

  const ciWindow = extractCarteIdentitateWindowScoped(salariat, clean);
  const salarySec = sliceSalarySection(clean);

  const cnpField = extractCNP(clean, salariat);
  const fullName = extractFullName(salariat);
  const nameParts = fullName
    ? splitRoName(fullName)
    : { firstName: "", lastName: "" };

  const lastName: ExtractedField = fullName
    ? {
        value: nameParts.lastName,
        confidence: 0.92,
        source: "regex",
      }
    : { value: "", confidence: 0, source: "none" };

  const firstName: ExtractedField = fullName
    ? {
        value: nameParts.firstName,
        confidence: 0.92,
        source: "regex",
      }
    : { value: "", confidence: 0, source: "none" };

  const seriesField = extractSeriesCI(ciWindow);
  const numberField = extractNumberCI(ciWindow);
  const addressField = extractAddress(salariat);
  const cityField = extractCityFromAddress(addressField.value);

  const phoneField = extractPhoneEmployee(salariat, clean, salariatStartIdx);
  const emailField = extractEmailEmployee(salariat);
  const ibanField = extractIban(salariat, partiesLegacy, clean);
  const bankField = extractBankName(salariat, partiesLegacy);

  const positionField = extractPosition(clean);
  const contractStart = extractContractStart(clean);
  const workNorm = extractWorkNorm(clean);
  const grossSalary = extractGrossSalary(salarySec);
  const salaryCurrency = extractSalaryCurrency(salarySec);
  const deploymentCountry = extractDeploymentCountry(workplace, clean);

  const fields: Record<string, ExtractedField> = {
    cnp: cnpField,
    lastName,
    firstName,
    seriesCI: seriesField,
    numberCI: numberField,
    email: emailField,
    phone: phoneField,
    iban: ibanField,
    bankName: bankField,
    position: positionField,
    address: addressField,
    city: cityField,
    contractStartDate: contractStart,
    workNorm,
    grossSalary,
    salaryCurrency,
    deploymentCountry,
  };

  const { confidenceScore, uncertainFields } = aggregateScores(fields);

  return { fields, confidenceScore, uncertainFields };
}
