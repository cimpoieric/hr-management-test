import "server-only";

export type SafeAuditLogInput = {
  action: string;
  entity: string;
  entityId?: number | null;
  userId?: string | number | null;
  userName?: string | null;
  userRole?: string | null;
  oldValues?: string | null;
  newValues?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/** AuditLog.entityId references Employee only; other entities log with null id. */
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

/** Writes an audit row without throwing. Invalid userId values are omitted. */
export async function createSafeAuditLog(
  input: SafeAuditLogInput,
): Promise<boolean> {
  try {
    const { prismaBase } = await import("./prisma");
    const userId = await resolveSafeAuditUserId(input.userId);
    const entityId = resolveAuditEntityId(input.entity, input.entityId);

    await prismaBase.auditLog.create({
      data: {
        action: input.action,
        entity: input.entity,
        entityId,
        userId,
        userName: input.userName ?? null,
        userRole: input.userRole ?? null,
        oldValues: input.oldValues ?? null,
        newValues: input.newValues ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
    return true;
  } catch (error) {
    console.error("[AUDIT_LOG_ERROR]", {
      action: input.action,
      entity: input.entity,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
