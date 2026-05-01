import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

type NotificationType = "warning" | "info" | "success";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [expiredDocs, expiringDocs, pendingImports, recentAudit] = await Promise.all([
      prisma.document.count({ where: { expiryDate: { not: null, lt: now } } }),
      prisma.document.count({
        where: { expiryDate: { not: null, gte: now, lte: in30Days } },
      }),
      prisma.pendingImport.count({ where: { status: "PENDING" } }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, action: true, entity: true, createdAt: true },
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
        message: `${expiringDocs} documente expiră în 30 zile.`,
        time: "Acum",
        read: false,
      });
    }

    recentAudit.forEach((item, idx) => {
      notifications.push({
        id: 100 + idx,
        type: item.action === "CREATE" ? "success" : "info",
        message: `${item.action.replaceAll("_", " ")} · ${item.entity}`,
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
