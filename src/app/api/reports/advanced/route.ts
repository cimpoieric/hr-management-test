/**
 * POST /api/reports/advanced - a1 / tara / fisa reports (ADVANCED_REPORTS).
 */

import { checkPlan, FEATURES } from "@/lib/middleware/plan-check";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ADVANCED_TYPES = new Set(["a1", "tara", "fisa"]);

export async function POST(request: NextRequest) {
  const planCheck = await checkPlan(request, FEATURES.ADVANCED_REPORTS, {
    roles: ROLES_SETTINGS_ADMIN,
  });
  if (!planCheck.allowed) return planCheck.response;

  try {
    const body = (await request.json()) as { type?: string };
    const reportType = body.type?.trim() ?? "";

    if (!ADVANCED_TYPES.has(reportType)) {
      return NextResponse.json(
        {
          error: "Tip raport invalid",
          message: 'Foloseste type: "a1", "tara" sau "fisa"',
        },
        { status: 400 },
      );
    }

    const generateUrl = new URL("/api/reports/generate", request.url);
    const forward = await fetch(generateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify(body),
    });

    const payload = await forward.json().catch(() => ({}));
    return NextResponse.json(payload, { status: forward.status });
  } catch (error) {
    console.error("[REPORTS_ADVANCED]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
