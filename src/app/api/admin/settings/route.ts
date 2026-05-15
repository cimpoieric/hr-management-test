import {
  getGlobalAppSettings,
  saveGlobalAppSettings,
} from "@/lib/globalAppSettings";
import { withAdminApi } from "@/lib/adminApi";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  defaultLanguage: z.enum(["en", "ro"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  email: z
    .object({
      host: z.string().trim().min(1),
      port: z.coerce.number().int().min(1).max(65535),
      user: z.string().trim().min(1),
      password: z.string().optional(),
      fromEmail: z.string().trim().min(1),
      fromName: z.string().trim().min(1),
      subjectTemplate: z.string().trim().min(1).max(200),
      bodyTemplate: z.string().optional().default(""),
      isActive: z.boolean(),
    })
    .optional(),
});

export async function GET(request: NextRequest) {
  return withAdminApi(request, async () => {
    const settings = await getGlobalAppSettings();
    return NextResponse.json({ settings });
  });
}

export async function PATCH(request: NextRequest) {
  return withAdminApi(request, async () => {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const settings = await saveGlobalAppSettings(parsed.data);
    return NextResponse.json({ settings });
  });
}
