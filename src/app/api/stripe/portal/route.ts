import { requireOrgAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertJwtOrganizationId } from "@/lib/stripeOrganization";
import { createBillingPortalSession, getAppBaseUrl } from "@/lib/stripe";
import { isStripeCheckoutEnabled } from "@/lib/stripePlanEnv";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = {
  organizationId?: string;
  returnPath?: string;
};

export async function POST(request: NextRequest) {
  if (!isStripeCheckoutEnabled()) {
    return NextResponse.json(
      { error: "Stripe payments are disabled." },
      { status: 503 },
    );
  }

  const { user, response: authError } = await requireOrgAdmin(request);
  if (authError || !user) {
    return (
      authError ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const orgErr = assertJwtOrganizationId(user, body.organizationId);
  if (orgErr) return orgErr;

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { stripeCustomerId: true },
  });
  if (!org?.stripeCustomerId) {
    return NextResponse.json(
      {
        error:
          "No Stripe customer for this organization yet. Complete checkout first.",
      },
      { status: 400 },
    );
  }

  const base = getAppBaseUrl();
  const raw =
    typeof body.returnPath === "string" && body.returnPath.trim() !== ""
      ? body.returnPath.trim()
      : "/dashboard";
  const returnUrl = /^https?:\/\//i.test(raw)
    ? raw
    : `${base}${raw.startsWith("/") ? raw : `/${raw}`}`;

  try {
    const session = await createBillingPortalSession({
      customerId: org.stripeCustomerId,
      returnUrl,
    });
    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe Customer Portal did not return a URL." },
        { status: 502 },
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Stripe Customer Portal error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
