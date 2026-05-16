import { requireOrgAdmin } from "@/lib/auth";
import { getOrganizationPlanKey } from "@/lib/organizationPlan";
import { prisma } from "@/lib/prisma";
import { assertJwtOrganizationId } from "@/lib/stripeOrganization";
import { getStripe, getSubscriptionPeriodEndUnix } from "@/lib/stripe";
import { isStripeCheckoutEnabled } from "@/lib/stripePlanEnv";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
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

  const organizationId = request.nextUrl.searchParams.get("organizationId");
  const orgErr = assertJwtOrganizationId(user, organizationId);
  if (orgErr) return orgErr;

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: {
      id: true,
      subscriptionPlan: { select: { name: true } },
      subscriptionStatus: true,
      status: true,
      trialEndsAt: true,
      subscriptionGraceEndsAt: true,
      subscriptionCurrentPeriodEnd: true,
      stripeSubscriptionId: true,
      stripeCustomerId: true,
    },
  });
  if (!org) {
    return NextResponse.json(
      { error: "Organization not found." },
      { status: 404 },
    );
  }

  let stripePayload: {
    subscriptionStatus: string | null;
    cancelAtPeriodEnd: boolean | null;
    currentPeriodEnd: string | null;
    trialEnd: string | null;
  } | null = null;

  if (org.stripeSubscriptionId) {
    try {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
      const periodEndUnix = getSubscriptionPeriodEndUnix(sub);
      stripePayload = {
        subscriptionStatus: sub.status,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        currentPeriodEnd: periodEndUnix
          ? new Date(periodEndUnix * 1000).toISOString()
          : null,
        trialEnd: sub.trial_end
          ? new Date(sub.trial_end * 1000).toISOString()
          : null,
      };
    } catch {
      stripePayload = {
        subscriptionStatus: "unknown",
        cancelAtPeriodEnd: null,
        currentPeriodEnd: null,
        trialEnd: null,
      };
    }
  }

  return NextResponse.json({
    organizationId: org.id,
    plan: getOrganizationPlanKey(org),
    subscriptionStatus: org.subscriptionStatus,
    status: org.status,
    trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
    subscriptionGraceEndsAt: org.subscriptionGraceEndsAt?.toISOString() ?? null,
    subscriptionCurrentPeriodEnd:
      org.subscriptionCurrentPeriodEnd?.toISOString() ?? null,
    hasStripeCustomer: Boolean(org.stripeCustomerId),
    hasStripeSubscription: Boolean(org.stripeSubscriptionId),
    stripe: stripePayload,
  });
}
