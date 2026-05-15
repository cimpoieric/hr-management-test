/**
 * GET /api/import/email/status
 *
 * Returnează statusul cron-ului, ultimele emailuri procesate, erori.
 */

import { requireAuth } from "@/lib/auth";
import { getCronStatus } from "@/lib/cron";
import { prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return (
      authError ??
      NextResponse.json({ error: "Neautentificat" }, { status: 401 })
    );
  }

  try {
    // Status cron
    const cron = getCronStatus();

    // Emailuri procesate astăzi
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayCount, lastEmails, pendingCount, totalPending] =
      await Promise.all([
        prisma.emailImport.count({
          where: { createdAt: { gte: today } },
        }),
        prisma.emailImport.findMany({
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            subject: true,
            fromAddress: true,
            receivedAt: true,
            attachments: true,
            processed: true,
            status: true,
            errorMessage: true,
            createdAt: true,
          },
        }),
        prisma.pendingImport.count({
          where: { status: "PENDING" },
        }),
        prisma.pendingImport.count(),
      ]);

    return NextResponse.json(
      {
        cron,
        todayCount,
        pendingImports: { pending: pendingCount, total: totalPending },
        recentEmails: lastEmails,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[EMAIL_STATUS_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
