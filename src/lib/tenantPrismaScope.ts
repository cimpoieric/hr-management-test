import { mergeWhere, type WhereInput } from "@/middleware/tenant";

/**
 * findUnique: only unique scalar fields - avoid AND wrapper here.
 */
function mergeUniqueWhere(existing: unknown, clause: WhereInput): WhereInput {
  if (
    existing &&
    typeof existing === "object" &&
    !Array.isArray(existing) &&
    !("AND" in (existing as object)) &&
    !("OR" in (existing as object)) &&
    !("NOT" in (existing as object))
  ) {
    return { ...(existing as WhereInput), ...clause };
  }
  return mergeWhere(existing, clause);
}

/** Models with organizationId column. */
const TENANT_BY_ORGANIZATION_ID = new Set([
  "User",
  "Company",
  "Employee",
  "Document",
  "Timesheet",
  "Payslip",
  "Settings",
  "PendingImport",
]);

/** Current tenant row is Organization where id === context organizationId. */
const TENANT_ORGANIZATION_ROW = new Set(["Organization"]);

const TENANT_VIA_EMPLOYEE = new Set([
  "Deployment",
  "EmployeeHistory",
  "SalaryCalculation",
]);

const TENANT_VIA_PAYSLIP = new Set(["PayslipItem"]);

export function isTenantScopedModel(model: string | undefined): boolean {
  if (!model) return false;
  return (
    TENANT_BY_ORGANIZATION_ID.has(model) ||
    TENANT_ORGANIZATION_ROW.has(model) ||
    TENANT_VIA_EMPLOYEE.has(model) ||
    TENANT_VIA_PAYSLIP.has(model)
  );
}

function tenantClauseForWhere(
  model: string,
  organizationId: string,
): WhereInput {
  if (TENANT_ORGANIZATION_ROW.has(model)) {
    return { id: organizationId };
  }
  if (TENANT_BY_ORGANIZATION_ID.has(model)) {
    return { organizationId };
  }
  if (TENANT_VIA_EMPLOYEE.has(model)) {
    return { employee: { organizationId } };
  }
  if (TENANT_VIA_PAYSLIP.has(model)) {
    return { payslip: { organizationId } };
  }
  return {};
}

function patchDataOrganizationId(
  model: string,
  data: Record<string, unknown>,
  organizationId: string,
): Record<string, unknown> {
  if (TENANT_ORGANIZATION_ROW.has(model)) {
    return data;
  }
  if (TENANT_BY_ORGANIZATION_ID.has(model)) {
    return { ...data, organizationId };
  }
  return data;
}

type ArgsRecord = Record<string, unknown>;

/** Apply tenant filter to Prisma args (where / create / update / upsert). */
export function applyTenantToArgs(
  model: string,
  operation: string,
  args: unknown,
  organizationId: string,
): unknown {
  if (!isTenantScopedModel(model)) {
    return args;
  }

  const a = (args ?? {}) as ArgsRecord;

  if (operation === "create" || operation === "createMany") {
    if (operation === "createMany" && Array.isArray(a.data)) {
      return {
        ...a,
        data: a.data.map((row) =>
          patchDataOrganizationId(
            model,
            row as Record<string, unknown>,
            organizationId,
          ),
        ),
      };
    }
    return {
      ...a,
      data: patchDataOrganizationId(
        model,
        (a.data as Record<string, unknown>) ?? {},
        organizationId,
      ),
    };
  }

  if (operation === "update") {
    const next: ArgsRecord = { ...a };
    if ("where" in next) {
      next.where = mergeUniqueWhere(
        next.where,
        tenantClauseForWhere(model, organizationId),
      );
    }
    if (next.data && typeof next.data === "object") {
      next.data = patchDataOrganizationId(
        model,
        next.data as Record<string, unknown>,
        organizationId,
      );
    }
    return next;
  }

  if (operation === "delete") {
    const next: ArgsRecord = { ...a };
    if ("where" in next) {
      next.where = mergeUniqueWhere(
        next.where,
        tenantClauseForWhere(model, organizationId),
      );
    }
    return next;
  }

  if (operation === "upsert") {
    const next: ArgsRecord = { ...a };
    if ("where" in next) {
      next.where = mergeUniqueWhere(
        next.where,
        tenantClauseForWhere(model, organizationId),
      );
    }
    if (next.create && typeof next.create === "object") {
      next.create = patchDataOrganizationId(
        model,
        next.create as Record<string, unknown>,
        organizationId,
      );
    }
    if (next.update && typeof next.update === "object") {
      next.update = patchDataOrganizationId(
        model,
        next.update as Record<string, unknown>,
        organizationId,
      );
    }
    return next;
  }

  if (
    operation === "findUnique" ||
    operation === "findFirst" ||
    operation === "findMany" ||
    operation === "count" ||
    operation === "aggregate" ||
    operation === "groupBy"
  ) {
    const clause = tenantClauseForWhere(model, organizationId);
    const mergedWhere =
      operation === "findUnique"
        ? mergeUniqueWhere(a.where, clause)
        : mergeWhere(a.where, clause);
    return {
      ...a,
      where: mergedWhere,
    };
  }

  if (operation === "updateMany" || operation === "deleteMany") {
    return {
      ...a,
      where: mergeWhere(a.where, tenantClauseForWhere(model, organizationId)),
    };
  }

  return args;
}

/** Merge tenant clause into where for audit prefetch (findFirst). */
export function mergeTenantIntoWhere(
  model: string,
  where: unknown,
  organizationId: string,
): Record<string, unknown> {
  const clause = tenantClauseForWhere(model, organizationId);
  if (
    where &&
    typeof where === "object" &&
    !Array.isArray(where) &&
    !("AND" in (where as object)) &&
    !("OR" in (where as object)) &&
    !("NOT" in (where as object))
  ) {
    return { ...(where as WhereInput), ...clause } as Record<string, unknown>;
  }
  return mergeWhere(where, clause) as Record<string, unknown>;
}
