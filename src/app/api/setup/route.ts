import { encrypt } from "@/lib/encryption";
import { buildNewOrganizationPlanData } from "@/lib/organizationPlan";
import { createDefaultOrganizationSettingsInTx } from "@/lib/organizationSettings";
import { prismaBase } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

function getCountryName(code: string): string {
  const countries: Record<string, string> = {
    RO: "România",
    DE: "Germania",
    NL: "Olanda",
    FR: "Franța",
    IT: "Italia",
    ES: "Spania",
    UK: "Regatul Unit",
    US: "Statele Unite",
  };
  return countries[code] || code;
}

function slugifyOrg(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base.length > 0 ? base : "organization";
}

const setupSchema = z.object({
  // Pas 1: Admin
  adminName: z.string().trim().min(2, "Numele e prea scurt"),
  adminEmail: z.string().trim().email("Email invalid"),
  adminPassword: z.string().min(6, "Parola trebuie să aibă minim 6 caractere"),

  // Pas 2: Firmă
  companyName: z.string().trim().min(2, "Numele firmei e prea scurt"),
  companyTaxCode: z.string().trim().optional(),
  companyAddress: z.string().trim().optional(),
  companyCountry: z.string().trim().min(2).max(3).default("RO"),

  // Pas 3: SMTP
  smtpHost: z.string().trim().min(1, "Host-ul SMTP e obligatoriu"),
  smtpPort: z.coerce.number().int().min(1).max(65535).default(587),
  smtpUser: z.string().trim().min(1, "Utilizatorul SMTP e obligatoriu"),
  smtpPass: z.string().min(1, "Parola SMTP e obligatorie"),
  smtpFromEmail: z.string().trim().email("From email invalid"),
  smtpFromName: z.string().trim().default("HR Management"),
  smtpSecure: z.coerce.boolean().default(false),
});

const SYS_KEYS = {
  setupCompleted: "setup.completed",
  setupCompletedAt: "setup.completedAt",
  smtpHost: "smtp.host",
  smtpPort: "smtp.port",
  smtpUser: "smtp.user",
  smtpPass: "smtp.pass",
  smtpFromEmail: "smtp.fromEmail",
  smtpFromName: "smtp.fromName",
  smtpSecure: "smtp.secure",
} as const;

export async function GET() {
  const userCount = await prismaBase.user.count();
  return NextResponse.json({ needsSetup: userCount === 0 });
}

export async function POST(req: NextRequest) {
  try {
    const userCount = await prismaBase.user.count();
    if (userCount > 0) {
      return NextResponse.json(
        { error: "Setup-ul a fost deja completat" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);
    const data = setupSchema.parse(body);

    const companyCountryCode = data.companyCountry.toUpperCase();

    const result = await prismaBase.$transaction(async (tx) => {
      let country = await tx.country.findFirst({
        where: { code: companyCountryCode },
        select: { id: true, code: true, name: true },
      });
      if (!country) {
        country = await tx.country.create({
          data: {
            code: companyCountryCode,
            name: getCountryName(companyCountryCode),
          },
          select: { id: true, code: true, name: true },
        });
      }

      let slug = slugifyOrg(data.companyName);
      const slugTaken = await tx.organization.findUnique({ where: { slug } });
      if (slugTaken) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }

      const planData = await buildNewOrganizationPlanData(tx, "starter", {
        trial: true,
      });

      const organization = await tx.organization.create({
        data: {
          name: data.companyName,
          slug,
          defaultLanguage: "ro",
          ...planData,
        },
        select: { id: true, name: true, slug: true },
      });

      await createDefaultOrganizationSettingsInTx(tx, organization.id);

      const company = await tx.company.create({
        data: {
          name: data.companyName,
          taxCode: data.companyTaxCode?.trim() || null,
          address: data.companyAddress?.trim() || null,
          countryId: country.id,
          organizationId: organization.id,
        },
        select: { id: true, name: true },
      });

      const hashedPassword = await bcrypt.hash(data.adminPassword, 10);
      const admin = await tx.user.create({
        data: {
          name: data.adminName,
          email: data.adminEmail.toLowerCase(),
          password: hashedPassword,
          role: "ORG_ADMIN",
          organizationId: organization.id,
          isActive: true,
          mustChangePassword: false,
        },
        select: { id: true, email: true },
      });

      const sysEntries: Array<{ key: string; value: string }> = [
        { key: SYS_KEYS.smtpHost, value: data.smtpHost },
        { key: SYS_KEYS.smtpPort, value: String(data.smtpPort) },
        { key: SYS_KEYS.smtpUser, value: data.smtpUser },
        { key: SYS_KEYS.smtpPass, value: encrypt(data.smtpPass) },
        { key: SYS_KEYS.smtpFromEmail, value: data.smtpFromEmail },
        {
          key: SYS_KEYS.smtpFromName,
          value: data.smtpFromName || "HR Management",
        },
        { key: SYS_KEYS.smtpSecure, value: String(Boolean(data.smtpSecure)) },
        { key: SYS_KEYS.setupCompleted, value: "true" },
        { key: SYS_KEYS.setupCompletedAt, value: new Date().toISOString() },
      ];

      for (const entry of sysEntries) {
        await tx.systemConfig.upsert({
          where: { key: entry.key },
          update: { value: entry.value },
          create: { key: entry.key, value: entry.value },
        });
      }

      return { admin, company, organization };
    });

    return NextResponse.json({
      success: true,
      message: "Setup complet cu succes",
      admin: result.admin,
      company: result.company,
      organization: result.organization,
    });
  } catch (error) {
    console.error("[SETUP_POST]", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: error.issues
            .map((e) => `${e.path.join(".")}: ${e.message}`)
            .join(", "),
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Eroare la setup" },
      { status: 500 },
    );
  }
}
