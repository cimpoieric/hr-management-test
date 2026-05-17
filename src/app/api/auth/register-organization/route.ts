import { generateToken, setAuthCookie } from "@/lib/auth";
import { createOrganizationWithAdminUser } from "@/lib/organizationCreate";
import { logAudit } from "@/lib/audit";
import type { PricingPlanId } from "@/lib/pricingPlans";
import { prismaBase as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
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
    agreedToDpa: z.literal(true, {
      errorMap: () => ({
        message: "You must accept the Data Processing Agreement (DPA)",
      }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

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
    const planKey = d.planId as PricingPlanId;
    const adminEmail = d.adminEmail.toLowerCase().trim();

    let created;
    try {
      created = await createOrganizationWithAdminUser({
        companyName: d.companyName,
        adminEmail,
        adminName: d.adminName,
        password: d.password,
        planKey,
        companyEmail: d.companyEmail,
        companyCui: d.companyCui,
        companyAddress: d.companyAddress,
        companyPhone: d.companyPhone,
        startAsActive: false,
        dpaAcceptedBy: adminEmail,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "EMAIL_EXISTS") {
        return NextResponse.json(
          { error: "An account with this admin email already exists." },
          { status: 409 },
        );
      }
      throw error;
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: created.userId },
    });

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

    void logAudit({
      userId: user.id,
      userEmail: user.email,
      action: "REGISTER_ORGANIZATION",
      resource: "Organization",
      resourceId: created.organizationId,
      firmId: created.organizationId,
      details: { companyName: d.companyName.trim(), planKey },
      req: request,
    });

    return response;
  } catch (error) {
    console.error("[REGISTER_ORGANIZATION]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
