/**
 * POST /api/internal/test-email
 * Body: { "to": "you@example.com" }
 * Header: Authorization: Bearer <EMAIL_TEST_SECRET>
 */

import {
  getActiveEmailProvider,
  isTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "@/lib/mail/transactional";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  to: z.string().email(),
});

function authorize(request: NextRequest): boolean {
  const secret = process.env.EMAIL_TEST_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return token.length > 0 && token === secret;
}

export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isTransactionalEmailConfigured())) {
    return NextResponse.json(
      {
        error: "Email not configured. Set RESEND_API_KEY or SMTP_* on Vercel.",
        provider: getActiveEmailProvider(),
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  try {
    const result = await sendTransactionalEmail({
      to: parsed.data.to,
      subject: "HR Management - Vercel email test",
      html: "<p>Test OK. Password reset and transactional mail should work.</p>",
      text: "Test OK. Password reset and transactional mail should work.",
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
