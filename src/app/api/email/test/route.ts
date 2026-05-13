import { requireRole } from "@/lib/auth";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { prismaTyped as prisma } from "@/lib/prisma";
import { getSMTPConfig, testSMTPConfig } from "@/lib/services/email";
import { type NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { z } from "zod";

const testSchema = z.object({
  host: z.string().trim().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  user: z.string().trim().min(1),
  pass: z.string().min(1),
  secure: z.coerce.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = testSchema.safeParse(body);
    if (parsed.success) {
      const userCount = await prisma.user.count();
      if (userCount > 0) {
        const { user, response: authError } = await requireRole(
          request,
          ROLES_SETTINGS_ADMIN,
        );
        if (authError || !user) return authError!;
      }

      const v = parsed.data;
      const transporter = nodemailer.createTransport({
        host: v.host,
        port: v.port,
        secure: Boolean(v.secure),
        auth: { user: v.user, pass: v.pass },
        tls: { rejectUnauthorized: false },
      });
      await transporter.verify();
      return NextResponse.json({
        success: true,
        message: "Conexiune SMTP reușită!",
      });
    }

    const { user, response: authError } = await requireRole(
      request,
      ROLES_SETTINGS_ADMIN,
    );
    if (authError || !user) return authError!;

    const config = await getSMTPConfig();
    await testSMTPConfig(config);
    return NextResponse.json({ success: true, message: "Conexiune SMTP OK" });
  } catch (error) {
    console.error("[SMTP_TEST_POST]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Test conexiune eșuat",
      },
      { status: 400 },
    );
  }
}
