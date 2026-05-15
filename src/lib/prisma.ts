import "server-only";

/**
 * Singleton Prisma Client pentru Next.js.
 *
 * Extensii:
 * 1) Tenant — toate query-urile pe modele scoped filtrează după `organizationId` (sau echivalent).
 * 2) Audit — log CREATE/UPDATE/DELETE pentru modele selectate.
 *
 * `prismaBase` — client fără extensii (login, setup, migrări) unde tenant-ul nu e încă disponibil.
 */

import { prisma as prismaBase } from "@/prisma/client";
import { PrismaClient } from "@prisma/client";
import { createSafeAuditLog, resolveAuditEntityId } from "./auditInsert";
import { auditStorage } from "./auditContext";
import { isPublicTenantBypassPath } from "@/middleware/tenant";
import {
  applyTenantToArgs,
  isTenantScopedModel,
  mergeTenantIntoWhere,
} from "./tenantPrismaScope";
import {
  getTenantRequestContext,
  isTenantBypassActive,
} from "./tenantRequestStorage";

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = global as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

// ─── Câmpuri sensibile — niciodată logate în oldValues/newValues ─────────────

const NEVER_LOG_FIELDS = [
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
];

function stripSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (
      NEVER_LOG_FIELDS.some((f) => key.toLowerCase().includes(f.toLowerCase()))
    ) {
      result[key] = "***REDACTED***";
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      result[key] = stripSensitive(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? stripSensitive(item as Record<string, unknown>)
          : item,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

const TRACED_MODELS = new Set([
  "Employee",
  "Document",
  "Deployment",
  "User",
  "Company",
  "PendingImport",
]);

const MODEL_TO_FINDER: Record<string, string> = {
  Employee: "employee",
  Document: "document",
  Deployment: "deployment",
  User: "user",
  Company: "company",
  PendingImport: "pendingImport",
};

async function resolveRequestPathname(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    const headerList = await headers();
    const explicit = headerList.get("x-pathname");
    if (explicit) {
      return explicit;
    }
    const urlHeader = headerList.get("x-url") ?? headerList.get("x-invoke-path");
    if (!urlHeader) {
      return null;
    }
    try {
      return new URL(urlHeader, "http://localhost").pathname;
    } catch {
      return urlHeader.startsWith("/") ? urlHeader : null;
    }
  } catch {
    return null;
  }
}

async function resolveTenantOrganizationIdForQuery(): Promise<string | null> {
  if (isTenantBypassActive()) {
    return null;
  }
  const fromAls = getTenantRequestContext();
  if (fromAls?.organizationId) {
    return fromAls.organizationId;
  }
  try {
    const { cookies } = await import("next/headers");
    const { verifyToken, AUTH_TOKEN_COOKIE } = await import("./auth");
    const token = (await cookies()).get(AUTH_TOKEN_COOKIE)?.value;
    if (!token) {
      return null;
    }
    const payload = await verifyToken(token);
    return payload.organizationId;
  } catch {
    return null;
  }
}

export { prismaBase };

function createPrismaClient() {
  const tenantExtension = {
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string | undefined;
          operation: string;
          args: unknown;
          query: (a: unknown) => Promise<unknown>;
        }) {
          const orgId = await resolveTenantOrganizationIdForQuery();
          if (orgId === null) {
            if (isTenantBypassActive()) {
              return query(args);
            }
            const path = await resolveRequestPathname();
            if (path && isPublicTenantBypassPath(path)) {
              return query(args);
            }
            if (isTenantScopedModel(model)) {
              throw new Error(
                "[PRISMA_TENANT] Lipsește organizationId (autentificare sau runWithoutTenantEnforcement).",
              );
            }
            return query(args);
          }
          if (!isTenantScopedModel(model)) {
            return query(args);
          }
          const nextArgs = applyTenantToArgs(
            model ?? "",
            operation,
            args,
            orgId,
          );
          return query(nextArgs);
        },
      },
    },
  };

  const auditExtension = {
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string | undefined;
          operation: string;
          args: unknown;
          query: (a: unknown) => Promise<unknown>;
        }) {
          if (!TRACED_MODELS.has(model ?? "")) {
            return query(args);
          }
          if (!["create", "update", "delete", "upsert"].includes(operation)) {
            return query(args);
          }

          let oldValues: Record<string, unknown> | null = null;
          if (["update", "delete", "upsert"].includes(operation)) {
            try {
              const where = (args as Record<string, unknown>)?.where;
              const modelKey = MODEL_TO_FINDER[model ?? ""];
              const orgId =
                getTenantRequestContext()?.organizationId ??
                (await resolveTenantOrganizationIdForQuery());
              if (where && modelKey && orgId && isTenantScopedModel(model)) {
                const finder = prismaBase[modelKey as keyof PrismaClient] as
                  | {
                      findFirst: (args: { where: unknown }) => Promise<unknown>;
                    }
                  | undefined;
                const mergedWhere = mergeTenantIntoWhere(
                  model ?? "",
                  where,
                  orgId,
                );
                const existing = await finder?.findFirst({
                  where: mergedWhere,
                });
                if (
                  existing &&
                  typeof existing === "object" &&
                  existing !== null
                ) {
                  oldValues = stripSensitive(
                    existing as Record<string, unknown>,
                  );
                }
              } else if (where && modelKey) {
                const finder = prismaBase[modelKey as keyof PrismaClient] as
                  | {
                      findFirst: (args: { where: unknown }) => Promise<unknown>;
                    }
                  | undefined;
                const existing = await finder?.findFirst({ where });
                if (
                  existing &&
                  typeof existing === "object" &&
                  existing !== null
                ) {
                  oldValues = stripSensitive(
                    existing as Record<string, unknown>,
                  );
                }
              }
            } catch {
              // ignore — nu blocăm request-ul
            }
          }

          const result = await query(args);

          const auditAction =
            operation === "create"
              ? "CREATE"
              : operation === "delete"
                ? "DELETE"
                : "UPDATE";

          const rawId = (result as Record<string, unknown>)?.id;
          const entityIdForLog = resolveAuditEntityId(
            model ?? "Unknown",
            typeof rawId === "number" && Number.isFinite(rawId) ? rawId : null,
          );

          let newValues: Record<string, unknown> | null = null;
          if (result && typeof result === "object" && result !== null) {
            newValues = stripSensitive(result as Record<string, unknown>);
          }

          const ctx = auditStorage.getStore();

          void createSafeAuditLog({
            action: auditAction,
            entity: model ?? "Unknown",
            entityId: entityIdForLog,
            userId: ctx?.userId ?? null,
            userName: ctx?.userName ?? null,
            userRole: ctx?.userRole ?? null,
            oldValues: oldValues ? JSON.stringify(oldValues) : null,
            newValues: newValues ? JSON.stringify(newValues) : null,
            ipAddress: ctx?.ipAddress ?? null,
            userAgent: ctx?.userAgent ?? null,
          });

          return result;
        },
      },
    },
  };

  return prismaBase.$extends(tenantExtension).$extends(auditExtension);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;

export const prismaTyped = prisma as unknown as typeof prismaBase;
