/**
 * GET /api/audit-logs/export — Export audit logs în Excel (Admin only)
 *
 * Query params: aceleași ca GET /api/audit-logs (userId, entityType, action, dateFrom, dateTo)
 *
 * Returnează: .xlsx cu toate logurile (nu e paginat)
 * Doar ADMIN poate exporta.
 */

import { createSafeAuditLog, mapAuditLogToLegacy } from "@/lib/auditInsert";
import { requireRole } from "@/lib/auth";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

const VALID_ACTIONS = [
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
];

const VALID_ENTITIES = [
  "Employee",
  "Document",
  "Deployment",
  "User",
  "Report",
  "System",
  "PendingImport",
  "Company",
];

function parseDate(dateStr: string): Date | null {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_SETTINGS_ADMIN,
  );
  if (authError || !user) return authError!;

  try {
    const { searchParams } = request.nextUrl;

    // ── Parse filters ──
    const filterUserId = searchParams.get("userId");
    const entityType = searchParams.get("entityType");
    const action = searchParams.get("action");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // ── Build where ──
    const where: Record<string, unknown> = {
      firmId: user.organizationId,
    };

    if (filterUserId) {
      where.userId = filterUserId;
    }
    if (entityType && VALID_ENTITIES.includes(entityType)) {
      where.resource = entityType;
    }
    if (action && VALID_ACTIONS.includes(action)) {
      where.action = action;
    }

    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {};
      if (dateFrom) {
        const d = parseDate(dateFrom);
        if (d) createdAt.gte = d;
      }
      if (dateTo) {
        const d = parseDate(dateTo);
        if (d) {
          d.setHours(23, 59, 59, 999);
          createdAt.lte = d;
        }
      }
      if (Object.keys(createdAt).length > 0) {
        where.createdAt = createdAt;
      }
    }

    // ── Query all logs (no pagination for export) ──
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        resource: true,
        resourceId: true,
        userId: true,
        userEmail: true,
        details: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
      take: 10000, // max 10k for export
    });

    // ── Build Excel ──
    const headers = [
      "ID",
      "Data",
      "Utilizator",
      "Rol",
      "Actiune",
      "Entitate",
      "Entity ID",
      "IP",
      "Old Values",
      "New Values",
    ];

    const rows = logs.map((log) => {
      const legacy = mapAuditLogToLegacy(log);
      return [
        legacy.id,
        log.createdAt.toISOString(),
        legacy.userName ?? "System",
        legacy.userRole ?? "—",
        legacy.action,
        legacy.entity,
        legacy.entityId ?? "—",
        legacy.ipAddress ?? "—",
        legacy.oldValues != null ? JSON.stringify(legacy.oldValues) : "",
        legacy.newValues != null ? JSON.stringify(legacy.newValues) : "",
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [
      { wch: 8 },
      { wch: 20 },
      { wch: 20 },
      { wch: 10 },
      { wch: 16 },
      { wch: 14 },
      { wch: 10 },
      { wch: 14 },
      { wch: 40 },
      { wch: 40 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit Logs");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Audit: export log
    void createSafeAuditLog({
      action: "EXPORT_EXCEL",
      entity: "System",
      firmId: user.organizationId,
      userId: user.userId,
      userEmail: user.email,
      userRole: user.role,
      newValues: JSON.stringify({
        count: logs.length,
        type: "audit_logs_export",
      }),
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("x-real-ip") ??
        "unknown",
    });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        "Content-Length": String(buf.byteLength),
      },
    });
  } catch (error) {
    console.error("[AUDIT_LOGS_EXPORT]", error);
    return NextResponse.json({ error: "Eroare la export" }, { status: 500 });
  }
}
