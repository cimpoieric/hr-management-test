import "server-only";

import { decrypt, encrypt } from "@/lib/encryption";
import { prismaBase as prisma } from "@/lib/prisma";

const GLOBAL_KEYS = {
  defaultLanguage: "app.default_language",
  theme: "app.theme",
} as const;

export type GlobalAppSettings = {
  defaultLanguage: "en" | "ro";
  theme: "light" | "dark" | "system";
  email: {
    host: string;
    port: number;
    user: string;
    hasPassword: boolean;
    fromEmail: string;
    fromName: string;
    subjectTemplate: string;
    bodyTemplate: string;
    isActive: boolean;
  };
};

async function readConfigValue(key: string): Promise<string | null> {
  const row = await prisma.systemConfig.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function writeConfigValue(key: string, value: string): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function getGlobalAppSettings(): Promise<GlobalAppSettings> {
  const [defaultLanguageRaw, themeRaw, emailRow] = await Promise.all([
    readConfigValue(GLOBAL_KEYS.defaultLanguage),
    readConfigValue(GLOBAL_KEYS.theme),
    prisma.emailSettings.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const defaultLanguage =
    defaultLanguageRaw === "ro" || defaultLanguageRaw === "en"
      ? defaultLanguageRaw
      : "en";
  const theme =
    themeRaw === "light" || themeRaw === "dark" || themeRaw === "system"
      ? themeRaw
      : "system";

  return {
    defaultLanguage,
    theme,
    email: {
      host: emailRow?.smtpHost ?? "",
      port: Number(emailRow?.smtpPort ?? 587),
      user: emailRow?.smtpUser ?? "",
      hasPassword: Boolean((emailRow?.smtpPass ?? "").trim()),
      fromEmail: emailRow?.fromEmail ?? "",
      fromName: emailRow?.fromName ?? "HR Management",
      subjectTemplate:
        emailRow?.subjectTemplate ?? "Fluturas salariu - {luna} {an}",
      bodyTemplate: emailRow?.bodyTemplate ?? "",
      isActive: emailRow?.isActive ?? true,
    },
  };
}

export type SaveGlobalAppSettingsInput = {
  defaultLanguage?: "en" | "ro";
  theme?: "light" | "dark" | "system";
  email?: {
    host: string;
    port: number;
    user: string;
    password?: string;
    fromEmail: string;
    fromName: string;
    subjectTemplate: string;
    bodyTemplate: string;
    isActive: boolean;
  };
};

export async function saveGlobalAppSettings(
  input: SaveGlobalAppSettingsInput,
): Promise<GlobalAppSettings> {
  if (input.defaultLanguage) {
    await writeConfigValue(GLOBAL_KEYS.defaultLanguage, input.defaultLanguage);
  }
  if (input.theme) {
    await writeConfigValue(GLOBAL_KEYS.theme, input.theme);
  }

  if (input.email) {
    const existing = await prisma.emailSettings.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    const password =
      input.email.password?.trim() ||
      (existing?.smtpPass ? decrypt(existing.smtpPass) : "");

    if (existing) {
      await prisma.emailSettings.update({
        where: { id: existing.id },
        data: {
          smtpHost: input.email.host.trim(),
          smtpPort: input.email.port,
          smtpUser: input.email.user.trim(),
          smtpPass: password ? encrypt(password) : existing.smtpPass,
          fromEmail: input.email.fromEmail.trim(),
          fromName: input.email.fromName.trim(),
          subjectTemplate: input.email.subjectTemplate.trim(),
          bodyTemplate: input.email.bodyTemplate,
          isActive: input.email.isActive,
        },
      });
    } else {
      await prisma.emailSettings.create({
        data: {
          smtpHost: input.email.host.trim(),
          smtpPort: input.email.port,
          smtpUser: input.email.user.trim(),
          smtpPass: password ? encrypt(password) : "",
          fromEmail: input.email.fromEmail.trim(),
          fromName: input.email.fromName.trim(),
          subjectTemplate: input.email.subjectTemplate.trim(),
          bodyTemplate: input.email.bodyTemplate,
          isActive: input.email.isActive,
        },
      });
    }
  }

  return getGlobalAppSettings();
}
