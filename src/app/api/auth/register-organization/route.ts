import { generateToken, hashPassword, setAuthCookie } from "@/lib/auth";
import { createDefaultOrganizationSettings } from "@/lib/organizationSettings";
import { resolveUniqueOrganizationSlug } from "@/lib/organizationSlug";
import { prismaBase as prisma } from "@/lib/prisma";
import type { PricingPlanId } from "@/lib/pricingPlans";
import { normalizePlanKey } from "@/lib/stripeOrganization";
import { type NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";

export const runtime = "nodejs";

const planEnum = z.enum(["starter", "business", "enterprise", "custom"]);

const bodySchema = z
  .object({
    companyName: z.string().min(1, "Company name is required").max(200),
    companyCui: z.string().max(64).optional().nullable(),
    companyAddress: z.string().max(500).optional().nullable(),
    companyPhone: z.string().max(64).optional().nullable(),
    companyEmail: z.string().email("Invalid company email"),
    adminName: z.string().min(1, "Admin name is required").max(200),
    adminEmail: z.string().email("Invalid admin email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8),
    planId: planEnum,
    agreedToTerms: z.literal(true, {
      errorMap: () => ({
        message: "You must accept the Terms and Privacy Policy",
      }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

function emptyToNull(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t === "" ? null : t;
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const d = parsed.data;
    const planId = d.planId as PricingPlanId;
    const adminEmail = d.adminEmail.toLowerCase().trim();
    const companyEmail = d.companyEmail.toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this admin email already exists." },
        { status: 409 },
      );
    }

    const slug = await resolveUniqueOrganizationSlug(d.companyName);
    const passwordHash = await hashPassword(d.password);
    const planKey = normalizePlanKey(planId);

    const org = await prisma.organization.create({
      data: {
        name: d.companyName.trim(),
        slug,
        cui: emptyToNull(d.companyCui),
        address: emptyToNull(d.companyAddress),
        phone: emptyToNull(d.companyPhone),
        email: companyEmail,
        plan: planKey,
        status: "trial",
      },
    });

    await createDefaultOrganizationSettings(org.id, prisma);

    let user;
    try {
      user = await prisma.user.create({
        data: {
          email: adminEmail,
          name: d.adminName.trim(),
          password: passwordHash,
          role: UserRole.ORG_ADMIN,
          organizationId: org.id,
          isActive: true,
          mustChangePassword: false,
        },
      });
    } catch (e) {
      await prisma.organization.delete({ where: { id: org.id } });
      throw e;
    }

    const token = await generateToken(
      user.id,
      user.email,
      user.role,
      user.organizationId,
    );

    const response = NextResponse.json(
      { success: true, redirectPath: "/onboarding" },
      { status: 200 },
    );
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error("[REGISTER_ORGANIZATION]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
