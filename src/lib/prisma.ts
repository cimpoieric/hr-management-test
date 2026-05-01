import "server-only";

/**
 * Singleton Prisma Client pentru Next.js.
 *
 * Next.js în development reîncarcă modulele la HMR,
 * ceea ce creează multiple instanțe Prisma.
 * Acest pattern previne eroarea:
 *   "There are already 10 instances of Prisma Client"
 *
 * Extensie: Middleware auto-log pentru CREATE / UPDATE / DELETE
 * pe modelele Employee, Document, Deployment, User, Company, PendingImport.
 *
 * NOTA: Server-only — Prisma Client nu poate rula pe client/browser.
 *
 * Usage:
 *   import { prisma } from "@/lib/prisma";
 *   const users = await prisma.user.findMany();
 */

import { PrismaClient } from "@prisma/client";
import { auditStorage } from "./auditContext";

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
    if (NEVER_LOG_FIELDS.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      result[key] = "***REDACTED***";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = stripSensitive(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? stripSensitive(item as Record<string, unknown>)
          : item
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ─── Modele tracate automat ──────────────────────────────────────────────────

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

// ─── Creare Prisma client ────────────────────────────────────────────────────

function createPrismaClient() {
  const prismaBase = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  // Prisma 6: $use a fost înlocuit cu Client Extensions
  return prismaBase.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
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
              if (where && modelKey) {
                const finder = prismaBase[modelKey as keyof PrismaClient] as
                  | { findUnique: (args: { where: unknown }) => Promise<unknown> }
                  | undefined;
                const existing = await finder?.findUnique({ where });
                if (existing && typeof existing === "object" && existing !== null) {
                  oldValues = stripSensitive(existing as Record<string, unknown>);
                }
              }
            } catch {
              // ignore — nu blocăm request-ul
            }
          }

          const result = await query(args);

          const auditAction =
            operation === "create" ? "CREATE" :
            operation === "delete" ? "DELETE" :
            "UPDATE";

          const entityId =
            result && typeof result === "object"
              ? ((result as Record<string, unknown>).id as number | undefined)
              : undefined;

          let newValues: Record<string, unknown> | null = null;
          if (result && typeof result === "object" && result !== null) {
            newValues = stripSensitive(result as Record<string, unknown>);
          }

          const ctx = auditStorage.getStore();

          prismaBase.auditLog
            .create({
              data: {
                action: auditAction,
                entity: model ?? "Unknown",
                entityId: entityId ?? null,
                userId: ctx?.userId ?? null,
                userName: ctx?.userName ?? null,
                userRole: ctx?.userRole ?? null,
                oldValues: oldValues ? JSON.stringify(oldValues) : null,
                newValues: newValues ? JSON.stringify(newValues) : null,
                ipAddress: ctx?.ipAddress ?? null,
                userAgent: ctx?.userAgent ?? null,
              },
            })
            .catch((e: unknown) => {
              console.error("[PRISMA_AUDIT]", e instanceof Error ? e.message : String(e));
            });

          return result;
        },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
