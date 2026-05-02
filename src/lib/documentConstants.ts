/**
 * Constante și utilitare pentru documente — fără Node fs (sigur pentru import din Client Components).
 */

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

export const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const DOCUMENT_TYPES = [
  "CONTRACT",
  "ID",
  "MEDICAL",
  "A1",
  "AUTHORIZATION",
  "VISA",
  "OTHER",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Etichete UI — aceeași sursă pentru upload, tabele, filtre. */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  CONTRACT: "Contract",
  ID: "Act identitate",
  MEDICAL: "Certificat medical",
  A1: "Formular A1",
  AUTHORIZATION: "Autorizație",
  VISA: "Viză",
  OTHER: "Alt document",
};

/** Pentru `<select>`: `value` = cod trimis la API (`CONTRACT`, …), conținut = text afișat. */
export const DOCUMENT_TYPE_OPTIONS: ReadonlyArray<{
  code: DocumentType;
  label: string;
}> = DOCUMENT_TYPES.map((code) => ({
  code,
  label: DOCUMENT_TYPE_LABELS[code],
}));

export function getDocumentTypeLabel(code: string | null | undefined): string {
  if (code == null || code === "") return "—";
  const upper = code.toUpperCase();
  if (DOCUMENT_TYPES.includes(upper as DocumentType)) {
    return DOCUMENT_TYPE_LABELS[upper as DocumentType];
  }
  return code;
}

export function isValidDocumentType(type: string): type is DocumentType {
  return DOCUMENT_TYPES.includes(type as DocumentType);
}

export function isAllowedMimeType(mime: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mime);
}

export function isAllowedExtension(filename: string): boolean {
  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : "";
  return ALLOWED_EXTENSIONS.includes(ext);
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 200);
}

export function getMimeType(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : "";
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
  };
  return map[ext] ?? "application/octet-stream";
}
