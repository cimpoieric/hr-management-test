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
import {
  createSafeAuditLog,
} from "./auditInsert";
import {
  type AuditContextData,
  auditStorage,
  clearAuditContext,
  getClientIp,
  setAuditContext,
} from "./auditContext";
import { prismaBase } from "./prisma";

export {
  createSafeAuditLog,
  resolveAuditEntityId,
  resolveSafeAuditUserId,
  type SafeAuditLogInput,
} from "./auditInsert";

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
  | "SETTINGS_CHANGE"
  | "ADMIN_UNBLOCK_LOGIN_RATE";

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
export const AUTO_TRACED_ACTIONS: AuditAction[] = [
  "CREATE",
  "UPDATE",
  "DELETE",
];

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
  "ADMIN_UNBLOCK_LOGIN_RATE",
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
  return SENSITIVE_FIELDS.some((sf) =>
    key.toLowerCase().includes(sf.toLowerCase()),
  );
}

/** Strip-ează câmpuri sensibile dintr-un obiect (deep, recursiv) */
export function stripSensitiveValues(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  if (!obj || typeof obj !== "object" || obj === null) return {};

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveField(key)) {
      result[key] = "***REDACTED***";
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      result[key] = stripSensitiveValues(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? stripSensitiveValues(item as Record<string, unknown>)
          : item,
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
  entityId?: number | null;
  oldValues?: unknown;
  newValues?: unknown;
  details?: string; // Text scurt descriere, opțional
  firmId?: string;
  /** Stored as string on `AuditLog.userId` (User.id is cuid). Numbers are coerced. */
  userId?: string | number | null;
  userName?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

/** Parametri GDPR pentru `logAudit` (salvare directă în AuditLog). */
export type AuditParams = {
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  resource: string;
  resourceId?: string | number | null;
  firmId?: string | null;
  details?: string | Record<string, unknown> | null;
  req?: NextRequest | null;
};

function ipFromReq(req?: NextRequest | null): string {
  if (!req) return "unknown";
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function uaFromReq(req?: NextRequest | null): string | null {
  return req?.headers.get("user-agent") ?? null;
}

function serializeAuditDetails(
  details?: string | Record<string, unknown> | null,
): string | null {
  if (details == null) return null;
  if (typeof details === "string") return details;
  try {
    return JSON.stringify(details);
  } catch {
    return null;
  }
}

/**
 * Înregistrează acțiunea în tabela AuditLog (Prisma).
 * Nu aruncă erori — returnează false la eșec.
 */
export async function logAudit(params: AuditParams): Promise<boolean>;

/**
 * @deprecated Preferă `AuditParams` cu `resource`. Păstrat pentru compatibilitate.
 */
export async function logAudit(options: LogAuditOptions): Promise<void>;

export async function logAudit(
  params: AuditParams | LogAuditOptions,
): Promise<boolean | void> {
  if ("resource" in params && typeof params.resource === "string") {
    return logAuditEntry(params as AuditParams);
  }
  await logAuditFromLegacyOptions(params as LogAuditOptions);
}

async function logAuditEntry(params: AuditParams): Promise<boolean> {
  try {
    const { getTenantRequestContext } = await import("./tenantRequestStorage");
    const firmId =
      params.firmId?.trim() ||
      getTenantRequestContext()?.organizationId ||
      "__unauthenticated__";

    let userId: string | null = null;
    if (params.userId != null && String(params.userId).trim()) {
      const id = String(params.userId).trim();
      const row = await prismaBase.user.findUnique({
        where: { id },
        select: { id: true },
      });
      userId = row?.id ?? id;
    }

    const resourceId =
      params.resourceId == null || params.resourceId === ""
        ? null
        : String(params.resourceId);

    await prismaBase.auditLog.create({
      data: {
        action: params.action,
        resource: params.resource,
        resourceId,
        firmId,
        userId,
        userEmail: params.userEmail ?? null,
        details: serializeAuditDetails(params.details),
        ipAddress: ipFromReq(params.req),
        userAgent: uaFromReq(params.req),
      },
    });
    return true;
  } catch (error) {
    console.error("[AUDIT_LOG]", error);
    return false;
  }
}

async function logAuditFromLegacyOptions(
  options: LogAuditOptions,
): Promise<void> {
  const ctx = auditStorage.getStore();

  const rawUserId = options.userId ?? ctx?.userId ?? null;
  const userName = options.userName ?? ctx?.userName ?? null;
  const userRole = options.userRole ?? ctx?.userRole ?? null;
  const ipAddress = options.ipAddress ?? ctx?.ipAddress ?? null;
  const userAgent = options.userAgent ?? ctx?.userAgent ?? null;

  const detailsPayload =
    options.details != null && options.details !== ""
      ? options.oldValues == null && options.newValues == null
        ? JSON.stringify({ message: options.details })
        : options.details
      : null;

  await createSafeAuditLog({
    action: options.action,
    entity: options.entity,
    entityId: options.entityId ?? null,
    firmId: options.firmId ?? null,
    userId: rawUserId,
    userEmail: userName,
    userRole,
    details: detailsPayload,
    oldValues: options.oldValues ? sanitizeValues(options.oldValues) : null,
    newValues: options.newValues ? sanitizeValues(options.newValues) : null,
    ipAddress,
    userAgent,
  });
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
  request: NextRequest,
): Promise<AuditContextData | null> {
  try {
    const { verifyAuth } = await import("./auth");
    const auth = await verifyAuth(request);
    if (!auth) return null;

    const user = await prismaBase.user.findUnique({
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
  handler: () => Promise<T>,
): Promise<T> {
  const userInfo = await resolveUserForAudit(request);

  if (userInfo) {
    setAuditContext(
      request,
      userInfo.userId,
      userInfo.userName,
      userInfo.userRole,
    );
  }

  try {
    return await handler();
  } finally {
    clearAuditContext();
  }
}
