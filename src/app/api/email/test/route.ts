import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { getSMTPConfig, testSMTPConfig } from "@/lib/services/email";

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request, ["ADMIN"]);
  if (authError || !user) return authError!;
  if (!canManageUsers(user.role)) {
    return NextResponse.json({ error: "Acces interzis — doar ADMIN" }, { status: 403 });
  }

  try {
    // opțional: dacă vrei să permiți test cu config din body, se poate extinde ulterior.
    const config = await getSMTPConfig();
    await testSMTPConfig(config);
    return NextResponse.json({ success: true, message: "Conexiune SMTP OK" });
  } catch (error) {
    console.error("[SMTP_TEST_POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Test conexiune eșuat" },
      { status: 400 }
    );
  }
}

