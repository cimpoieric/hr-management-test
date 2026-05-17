import "server-only";

import type { NextRequest } from "next/server";
import type { AuthContext } from "@/lib/auth";
import { getClientIp } from "./auditContext";
import { getTenantRequestContext } from "./tenantRequestStorage";

/** Actions stored in AuditLog (filter dropdowns should include these). */
export const VALID_AUDIT_ACTIONS = [
  "LOGIN",
  "LOGOUT",
  "LOGIN_FAILED",
  "CREATE",
  "UPDATE",
  "DELETE",
  "VIEW",
  "EXPORT_EXCEL",
  "EXPORT_PDF",
  "REPORT_GENERATE",
  "IMPORT_APPROVE",
  "IMPORT_REJECT",
  "BACKUP",
  "PASSWORD_CHANGE",
  "SETTINGS_CHANGE",
  "CREATE_EMPLOYEE",
  "UPDATE_EMPLOYEE",
  "DELETE_EMPLOYEE",
  "VIEW_EMPLOYEE",
  "EMPLOYEE_CREATED",
  "EMPLOYEE_UPDATED",
  "EMPLOYEE_DELETED",
  "EMPLOYEE_IMPORTED",
  "GENERATE_PAYROLL",
  "PAYSLIP_CREATED",
  "PAYSLIP_UPDATED",
  "PAYSLIP_DELETED",
  "PAYSLIP_SENT",
  "TIMESHEET_CREATED",
  "TIMESHEET_UPDATED",
  "TIMESHEET_DELETED",
  "DOCUMENT_UPLOADED",
  "DOCUMENT_DELETED",
  "GENERATE_REPORT",
  "DOWNLOAD_DOCUMENT",
  "UPLOAD_DOCUMENT",
  "IMPORT_DATA",
  "REGISTER_ORGANIZATION",
] as const;

export const VALID_AUDIT_ENTITIES = [
  "Employee",
  "Document",
  "Deployment",
  "User",
  "Report",
  "System",
  "PendingImport",
  "Company",
  "Organization",
  "Payroll",
  "Payslip",
  "Timesheet",
  "Country",
] as const;

export type SafeAuditLogInput = {
  action: string;
  /** @deprecated use `resource` — kept for backward compatibility */
  entity?: string;
  resource?: string;
  entityId?: number | string | null;
  resourceId?: number | string | null;
  userId?: string | number | null;
  userEmail?: string | null;
  /** @deprecated use `userEmail` */
  userName?: string | null;
  userRole?: string | null;
  firmId?: string | null;
  details?: string | null;
  oldValues?: string | null;
  newValues?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type AuthAuditInput = Omit<
  SafeAuditLogInput,
  "userId" | "userEmail" | "userRole" | "firmId" | "ipAddress" | "userAgent"
>;

/** Log with authenticated user + org (use in API routes after requireAuth). */
export function logAuditForUser(
  user: Pick<AuthContext, "userId" | "email" | "role" | "organizationId">,
  request: NextRequest,
  input: AuthAuditInput,
): void {
  void createSafeAuditLog({
    ...input,
    resource: input.resource ?? input.entity ?? "System",
    userId: user.userId,
    userEmail: user.email,
    userRole: user.role,
    firmId: user.organizationId,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
  });
}

/** @deprecated Employee-only FK removed; kept for callers that pass entityId. */
export function resolveAuditEntityId(
  entity: string,
  entityId?: number | null,
): number | null {
  if (entity !== "Employee") return null;
  if (typeof entityId !== "number" || !Number.isFinite(entityId)) return null;
  return entityId;
}

export async function resolveSafeAuditUserId(
  userId: string | number | null | undefined,
): Promise<string | null> {
  if (userId === null || userId === undefined) return null;
  const normalized = String(userId).trim();
  if (!normalized) return null;

  try {
    const { prismaBase } = await import("./prisma");
    const user = await prismaBase.user.findUnique({
      where: { id: normalized },
      select: { id: true },
    });
    return user?.id ?? null;
  } catch {
    return null;
  }
}

function resolveResourceId(
  resource: string,
  id?: number | string | null,
): string | null {
  if (id === null || id === undefined) return null;
  const normalized = String(id).trim();
  if (!normalized) return null;
  if (resource === "Employee") {
    const n = Number.parseInt(normalized, 10);
    if (!Number.isFinite(n)) return null;
    return String(n);
  }
  return normalized;
}

function mergeDetails(input: SafeAuditLogInput): string | null {
  if (input.details) return input.details;
  const payload: Record<string, unknown> = {};
  if (input.oldValues) {
    try {
      payload.oldValues = JSON.parse(input.oldValues);
    } catch {
      payload.oldValues = input.oldValues;
    }
  }
  if (input.newValues) {
    try {
      payload.newValues = JSON.parse(input.newValues);
    } catch {
      payload.newValues = input.newValues;
    }
  }
  if (input.userRole) payload.userRole = input.userRole;
  if (Object.keys(payload).length === 0) return null;
  return JSON.stringify(payload);
}

function resolveFirmId(explicit?: string | null): string {
  if (explicit?.trim()) return explicit.trim();
  return (
    getTenantRequestContext()?.organizationId ?? "__unauthenticated__"
  );
}

export function buildAuditLogCreateData(input: SafeAuditLogInput) {
  const resource = input.resource ?? input.entity ?? "System";
  const rawId = input.resourceId ?? input.entityId ?? null;
  const resourceId = resolveResourceId(resource, rawId);
  const firmId = resolveFirmId(input.firmId);

  return {
    action: input.action,
    resource,
    resourceId,
    firmId,
    userId: null as string | null,
    userEmail: input.userEmail ?? input.userName ?? null,
    details: mergeDetails(input),
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  };
}

/** Writes an audit row without throwing. Invalid userId values are omitted. */
export async function createSafeAuditLog(
  input: SafeAuditLogInput,
): Promise<boolean> {
  try {
    const { prismaBase } = await import("./prisma");
    const tenant = getTenantRequestContext();
    const userId = await resolveSafeAuditUserId(
      input.userId ?? tenant?.userId ?? null,
    );
    const data = buildAuditLogCreateData({
      ...input,
      firmId: input.firmId ?? tenant?.organizationId ?? null,
      userEmail: input.userEmail ?? input.userName ?? tenant?.email ?? null,
      userRole: input.userRole ?? tenant?.role ?? null,
    });
    data.userId = userId;

    await prismaBase.auditLog.create({ data });
    return true;
  } catch (error) {
    console.error("[AUDIT_LOG_ERROR]", {
      action: input.action,
      resource: input.resource ?? input.entity,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/** Map DB row to legacy API shape for existing UI. */
export function mapAuditLogToLegacy<T extends {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  userId: string | null;
  userEmail: string | null;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}>(log: T) {
  let oldValues: unknown = null;
  let newValues: unknown = null;
  let userRole: string | null = null;
  if (log.details) {
    try {
      const parsed = JSON.parse(log.details) as Record<string, unknown>;
      oldValues = parsed.oldValues ?? null;
      newValues = parsed.newValues ?? null;
      userRole =
        typeof parsed.userRole === "string" ? parsed.userRole : null;
    } catch {
      oldValues = log.details;
    }
  }

  const parsedId = log.resourceId
    ? Number.parseInt(log.resourceId, 10)
    : Number.NaN;
  const entityId = Number.isFinite(parsedId) ? parsedId : null;

  return {
    id: log.id,
    action: log.action,
    entity: log.resource,
    entityId,
    userId: log.userId,
    userName: log.userEmail,
    userRole,
    oldValues,
    newValues,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt,
  };
}
