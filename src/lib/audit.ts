import "server-only";

/**
 * Sistem Audit Log centralizat.
 *
 * - logAudit: funcție principală pentru logarea manuală a acțiunilor
 * - Cuplare slabă cu Prisma via auditContext.ts (fără circular deps)
 * - Niciodată nu blochează request-ul principal (fire-and-forget)
 * - Date sensibile (password, cnp, iban) sunt automat strip-uite sau mascate
 *
 * NOTA: Server-only — folosit doar în API routes și server actions.
 *
 * Cum extinzi logarea la o entitate nouă:
 *   1. Adaugă modelul în TRACED_MODELS din prisma.ts (pentru auto-log)
 *   2. Adaugă acțiuni manuale noi în AuditAction de mai jos
 *   3. Folosește logAudit() în rutele care fac acțiunea respectivă
 */

import type { NextRequest } from "next/server";
import { prisma } from "./prisma";
import {
  auditStorage,
  setAuditContext,
  clearAuditContext,
  getClientIp,
  type AuditContextData,
} from "./auditContext";

export { auditStorage, setAuditContext, clearAuditContext, getClientIp };
export type { AuditContextData };

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ TIPURI  ══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "LOGIN_FAILED"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "VIEW"
  | "EXPORT_EXCEL"
  | "EXPORT_PDF"
  | "REPORT_GENERATE"
  | "IMPORT_APPROVE"
  | "IMPORT_REJECT"
  | "BACKUP"
  | "PASSWORD_CHANGE"
  | "SETTINGS_CHANGE";

export type EntityType =
  | "Employee"
  | "Document"
  | "Deployment"
  | "User"
  | "Report"
  | "System"
  | "PendingImport"
  | "Company";

/** Acțiuni tracate automat de Prisma middleware */
export const AUTO_TRACED_ACTIONS: AuditAction[] = ["CREATE", "UPDATE", "DELETE"];

/** Acțiuni care NU sunt tracate automat (doar manual) */
export const MANUAL_ONLY_ACTIONS: AuditAction[] = [
  "LOGIN",
  "LOGOUT",
  "LOGIN_FAILED",
  "VIEW",
  "EXPORT_EXCEL",
  "EXPORT_PDF",
  "REPORT_GENERATE",
  "IMPORT_APPROVE",
  "IMPORT_REJECT",
  "BACKUP",
  "PASSWORD_CHANGE",
  "SETTINGS_CHANGE",
];

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ SENSITIVE DATA STRIPPING  ════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

/** Câmpuri sensibile — niciodată logate în oldValues/newValues */
const SENSITIVE_FIELDS = [
  "password",
  "passwordHash",
  "cnpEncrypted",
  "cnpHash",
  "ibanHash",
  "iban",
  "cnp",
  "token",
  "jwt",
  "secret",
  "cookie",
  "session",
];

/** Verifică dacă un key conține câmp sensibil */
function isSensitiveField(key: string): boolean {
  return SENSITIVE_FIELDS.some((sf) => key.toLowerCase().includes(sf.toLowerCase()));
}

/** Strip-ează câmpuri sensibile dintr-un obiect (deep, recursiv) */
export function stripSensitiveValues(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj || typeof obj !== "object" || obj === null) return {};

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveField(key)) {
      result[key] = "***REDACTED***";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = stripSensitiveValues(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? stripSensitiveValues(item as Record<string, unknown>)
          : item
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Serializează și sanitizează valori pentru audit */
export function sanitizeValues(values: unknown): string {
  try {
    if (!values || (typeof values !== "object" && typeof values !== "string")) {
      return "{}";
    }
    if (typeof values === "string") return values;

    const cleaned = stripSensitiveValues(values as Record<string, unknown>);
    return JSON.stringify(cleaned);
  } catch {
    return "{}";
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ FUNCȚIA PRINCIPALĂ: logAudit  ════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export interface LogAuditOptions {
  action: AuditAction;
  entity: EntityType;
  entityId?: number;
  oldValues?: unknown;
  newValues?: unknown;
  details?: string; // Text scurt descriere, opțional
  userId?: number;
  userName?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Loghează o acțiune în AuditLog.
 *
 * Fire-and-forget: nu blochează request-ul principal.
 * Completează automat userId, userName, userRole, ipAddress din context
 * dacă acesta e setat via setAuditContext().
 */
export async function logAudit(options: LogAuditOptions): Promise<void> {
  const ctx = auditStorage.getStore();

  const userId = options.userId ?? ctx?.userId ?? null;
  const userName = options.userName ?? ctx?.userName ?? null;
  const userRole = options.userRole ?? ctx?.userRole ?? null;
  const ipAddress = options.ipAddress ?? ctx?.ipAddress ?? null;
  const userAgent = options.userAgent ?? ctx?.userAgent ?? null;

  try {
    await prisma.auditLog.create({
      data: {
        action: options.action,
        entity: options.entity,
        entityId: options.entityId ?? null,
        userId,
        userName,
        userRole,
        oldValues: options.oldValues ? sanitizeValues(options.oldValues) : null,
        newValues: options.newValues ? sanitizeValues(options.newValues) : null,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // Loghează eroarea dar NU o propagă — audit-ul nu trebuie să blocheze funcționalitatea
    console.error("[AUDIT_LOG_ERROR]", {
      action: options.action,
      entity: options.entity,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Variantă fire-and-forget care NU așteaptă completarea.
 * Pentru utilizare în locuri unde nu se poate await.
 */
export function logAuditFF(options: LogAuditOptions): void {
  logAudit(options).catch(() => {
    // Error already logged inside logAudit
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ WRAPPER PENTRU RUTE API  ═════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Rezolvă utilizatorul din request pentru context audit.
 */
export async function resolveUserForAudit(
  request: NextRequest
): Promise<AuditContextData | null> {
  try {
    const { verifyAuth } = await import("./auth");
    const auth = await verifyAuth(request);
    if (!auth) return null;

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) return null;

    return {
      userId: user.id,
      userName: user.name || user.email,
      userRole: user.role,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Wrapper pentru rute API: setează context audit, execută handler-ul,
 * apoi curăță contextul. Garantează cleanup în finally.
 *
 * Usage:
 *   export async function POST(request: NextRequest) {
 *     return withAuditContext(request, async () => {
 *       // ... handler logic
 *       return NextResponse.json(data);
 *     });
 *   }
 */
export async function withAuditContext<T>(
  request: NextRequest,
  handler: () => Promise<T>
): Promise<T> {
  const userInfo = await resolveUserForAudit(request);

  if (userInfo) {
    setAuditContext(request, userInfo.userId, userInfo.userName, userInfo.userRole);
  }

  try {
    return await handler();
  } finally {
    clearAuditContext();
  }
}
