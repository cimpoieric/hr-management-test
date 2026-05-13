import { requireOrgAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  assertJwtOrganizationId,
  inferPlanKeyFromPriceId,
} from "@/lib/stripeOrganization";
import { createSubscriptionCheckoutSession, getStripe } from "@/lib/stripe";
import { isStripeCheckoutEnabled } from "@/lib/stripePlanEnv";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = {
  priceId?: string;
  organizationId?: string;
  /** Free trial length for the subscription in Stripe Checkout (default 14). Use 0 to disable. */
  trialPeriodDays?: number;
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

  const priceId = typeof body.priceId === "string" ? body.priceId.trim() : "";
  if (!priceId) {
    return NextResponse.json(
      { error: "priceId is required." },
      { status: 400 },
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: {
      id: true,
      name: true,
      stripeCustomerId: true,
    },
  });
  if (!org) {
    return NextResponse.json(
      { error: "Organization not found." },
      { status: 404 },
    );
  }

  const stripe = getStripe();
  let stripeCustomerId = org.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: org.name,
      metadata: { organizationId: org.id },
    });
    stripeCustomerId = customer.id;
    await prisma.organization.update({
      where: { id: org.id },
      data: { stripeCustomerId: customer.id },
    });
  }

  const plan = await inferPlanKeyFromPriceId(priceId);

  const rawTrial = body.trialPeriodDays;
  let subscriptionTrialPeriodDays: number | undefined;
  if (rawTrial === 0) {
    subscriptionTrialPeriodDays = undefined;
  } else if (typeof rawTrial === "number" && Number.isFinite(rawTrial)) {
    subscriptionTrialPeriodDays = Math.min(
      730,
      Math.max(1, Math.floor(rawTrial)),
    );
  } else {
    const fromEnv = Number(process.env.STRIPE_TRIAL_PERIOD_DAYS ?? 14);
    subscriptionTrialPeriodDays =
      Number.isFinite(fromEnv) && fromEnv > 0
        ? Math.min(730, Math.floor(fromEnv))
        : 14;
  }

  try {
    const session = await createSubscriptionCheckoutSession({
      priceId,
      customer: stripeCustomerId,
      metadata: {
        organizationId: org.id,
        plan,
      },
      successPath: "/dashboard",
      cancelPath: "/pricing",
      subscriptionTrialPeriodDays,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Checkout session has no URL. Check Stripe configuration." },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe Checkout error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
