import { getAppSettings } from "@/lib/appSettings";
import { requireAuth } from "@/lib/auth";
import { documentsWhereVisible } from "@/lib/documentVisibility";
import { prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";

type NotificationType = "warning" | "info" | "success";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return (
      authError ??
      NextResponse.json({ error: "Neautentificat" }, { status: 401 })
    );
  }

  try {
    const now = new Date();
    const settings = await getAppSettings(user.organizationId);
    if (!settings.inAppNotificationsEnabled) {
      return NextResponse.json({ data: [], unreadCount: 0 });
    }
    const inDocAlertDays = new Date(
      now.getTime() + settings.alertExpiredDocumentsDays * 24 * 60 * 60 * 1000,
    );
    const inDeploymentAlertDays = new Date(
      now.getTime() +
        settings.alertExpiringDeploymentsDays * 24 * 60 * 60 * 1000,
    );

    const [
      expiredDocs,
      expiringDocs,
      expiringDeployments,
      pendingImports,
      recentAudit,
    ] = await Promise.all([
      prisma.document.count({
        where: documentsWhereVisible({ expiryDate: { not: null, lt: now } }),
      }),
      prisma.document.count({
        where: documentsWhereVisible({
          expiryDate: { not: null, gte: now, lte: inDocAlertDays },
        }),
      }),
      prisma.deployment.count({
        where: {
          status: "ACTIVE",
          endDate: { not: null, gte: now, lte: inDeploymentAlertDays },
        },
      }),
      prisma.pendingImport.count({ where: { status: "PENDING" } }),
      prisma.auditLog.findMany({
        where: { firmId: user.organizationId },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, action: true, resource: true, createdAt: true },
      }),
    ]);

    const notifications: Array<{
      id: number;
      type: NotificationType;
      message: string;
      time: string;
      read: boolean;
    }> = [];

    if (expiredDocs > 0) {
      notifications.push({
        id: 1,
        type: "warning",
        message: `${expiredDocs} documente expirate necesită atenție.`,
        time: "Acum",
        read: false,
      });
    }
    if (pendingImports > 0) {
      notifications.push({
        id: 2,
        type: "info",
        message: `${pendingImports} importuri în așteptare.`,
        time: "Acum",
        read: false,
      });
    }
    if (expiringDocs > 0) {
      notifications.push({
        id: 3,
        type: "info",
        message: `${expiringDocs} documente expiră în ${settings.alertExpiredDocumentsDays} zile.`,
        time: "Acum",
        read: false,
      });
    }
    if (expiringDeployments > 0) {
      notifications.push({
        id: 4,
        type: "warning",
        message: `${expiringDeployments} detașări expiră în ${settings.alertExpiringDeploymentsDays} zile.`,
        time: "Acum",
        read: false,
      });
    }

    recentAudit.forEach((item, idx) => {
      notifications.push({
        id: 100 + idx,
        type: item.action === "CREATE" ? "success" : "info",
        message: `${item.action.replaceAll("_", " ")} · ${item.resource}`,
        time: formatRelativeTime(item.createdAt),
        read: true,
      });
    });

    return NextResponse.json({
      data: notifications.slice(0, 8),
      unreadCount: notifications.filter((n) => !n.read).length,
    });
  } catch (error) {
    console.error("[NOTIFICATIONS_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Acum";
  if (mins < 60) return `Acum ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Acum ${hours} h`;
  return date.toLocaleDateString("ro-RO");
}
