/**
 * GET /api/audit-logs — Query audit logs cu filtrare și RBAC
 *
 * Query params:
 *   userId?      — filtrare după utilizator
 *   entityType?  — filtrare după entitate (Employee, Document, etc.)
 *   action?      — filtrare după acțiune (CREATE, UPDATE, DELETE, LOGIN, etc.)
 *   dateFrom?    — YYYY-MM-DD
 *   dateTo?      — YYYY-MM-DD
 *   page?        — default 1
 *   limit?       — default 50, max 200
 *
 * RBAC:
 *   administrator     — vezi toate logurile
 *   operator          — vezi doar logurile proprii
 *   doar_vizualizare  — vezi doar logurile proprii
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// ─── Tipuri acțiuni pentru filtrare ──────────────────────────────────────────

const VALID_ACTIONS = [
  "LOGIN", "LOGOUT", "LOGIN_FAILED",
  "CREATE", "UPDATE", "DELETE",
  "VIEW", "EXPORT_EXCEL", "EXPORT_PDF", "REPORT_GENERATE",
  "IMPORT_APPROVE", "IMPORT_REJECT",
  "BACKUP", "PASSWORD_CHANGE", "SETTINGS_CHANGE",
];

const VALID_ENTITIES = [
  "Employee", "Document", "Deployment",
  "User", "Report", "System",
  "PendingImport", "Company",
];

// ─── Helper: parse date ──────────────────────────────────────────────────────

function parseDate(dateStr: string): Date | null {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

// ─── GET handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;

    // ── Parse params ──
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
    const skip = (page - 1) * limit;

    const filterUserId = searchParams.get("userId");
    const entityType = searchParams.get("entityType");
    const action = searchParams.get("action");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // ── Build where ──
    const where: Record<string, unknown> = {};

    // RBAC: non-admin vede doar logurile proprii
    if (user.role !== "administrator") {
      where.userId = user.userId;
    } else if (filterUserId) {
      where.userId = parseInt(filterUserId, 10);
    }

    if (entityType && VALID_ENTITIES.includes(entityType)) {
      where.entity = entityType;
    }

    if (action && VALID_ACTIONS.includes(action)) {
      where.action = action;
    }

    // Date range
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {};
      if (dateFrom) {
        const d = parseDate(dateFrom);
        if (d) createdAt.gte = d;
      }
      if (dateTo) {
        const d = parseDate(dateTo);
        if (d) {
          // Set time to end of day
          d.setHours(23, 59, 59, 999);
          createdAt.lte = d;
        }
      }
      if (Object.keys(createdAt).length > 0) {
        where.createdAt = createdAt;
      }
    }

    // ── Query ──
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          userId: true,
          userName: true,
          userRole: true,
          oldValues: true,
          newValues: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Parse JSON values
    const parsedLogs = logs.map((log) => ({
      ...log,
      oldValues: log.oldValues ? parseJsonSafe(log.oldValues) : null,
      newValues: log.newValues ? parseJsonSafe(log.newValues) : null,
    }));

    return NextResponse.json({
      data: parsedLogs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });

  } catch (error) {
    console.error("[AUDIT_LOGS_GET]", error);
    return NextResponse.json({ error: "Eroare la citirea logurilor" }, { status: 500 });
  }
}

function parseJsonSafe(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
