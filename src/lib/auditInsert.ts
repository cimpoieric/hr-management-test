import "server-only";

import { getTenantRequestContext } from "./tenantRequestStorage";

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
    const userId = await resolveSafeAuditUserId(input.userId);
    const data = buildAuditLogCreateData(input);
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

  const entityId =
    log.resource === "Employee" && log.resourceId
      ? Number.parseInt(log.resourceId, 10)
      : log.resourceId
        ? Number.parseInt(log.resourceId, 10)
        : null;

  return {
    id: log.id,
    action: log.action,
    entity: log.resource,
    entityId: Number.isFinite(entityId as number) ? entityId : null,
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
