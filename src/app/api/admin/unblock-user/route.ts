import { logAuditFF, getClientIp } from "@/lib/audit";
import { withAdminApi } from "@/lib/adminApi";
import type { AuthContext } from "@/lib/auth";
import { clearLoginRateLimitForEmail } from "@/lib/loginRateLimit";
import { prismaBase as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  email: z.string().email("Email invalid"),
});

/**
 * POST /api/admin/unblock-user
 * SUPER_ADMIN only. Clears in-memory login rate limit for the given email (all IPs on this instance).
 */
export async function POST(request: NextRequest) {
  return withAdminApi(request, async (admin: AuthContext) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const email = parsed.data.email;
    const normalized = email.toLowerCase().trim();

    const update = await prisma.user.updateMany({
      where: { email: normalized },
      data: { failedAttempts: 0 },
    });

    const removed = clearLoginRateLimitForEmail(email);

    logAuditFF({
      action: "ADMIN_UNBLOCK_LOGIN_RATE",
      entity: "User",
      ipAddress: getClientIp(request),
      userId: admin.userId,
      userName: admin.email,
      userRole: admin.role,
      details: `Unblock: failedAttempts=0, rate buckets cleared for ${email} (usersUpdated=${update.count}, buckets=${removed})`,
    });

    return NextResponse.json({
      success: true,
      email: normalized,
      usersUpdated: update.count,
      bucketsCleared: removed,
      message:
        update.count > 0 || removed > 0
          ? "Cont deblocat (failedAttempts si/sau limita de login resetate)."
          : "Nu s-a gasit utilizatorul sau nu existau limite active pe acest server.",
    });
  });
}
