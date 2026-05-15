import "server-only";

import Stripe from "stripe";

import { prismaBase } from "@/lib/prisma";
import { getStripe, getSubscriptionPeriodEndUnix } from "@/lib/stripe";
import { resolvePlanIdByKey } from "@/lib/organizationPlan";
import { normalizePlanKey } from "@/lib/stripeOrganization";

function gracePeriodMs(): number {
  const days = Number(process.env.STRIPE_GRACE_PERIOD_DAYS ?? 7);
  const n = Number.isFinite(days) && days > 0 ? days : 7;
  return n * 86_400_000;
}

function asId(
  ref: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null {
  if (ref == null) return null;
  return typeof ref === "string" ? ref : ref.id;
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.mode !== "subscription") return;

  const organizationId = session.metadata?.organizationId?.trim();
  if (!organizationId) {
    console.warn(
      "[stripe webhook] checkout.session.completed: missing metadata.organizationId",
    );
    return;
  }

  const customerId = asId(session.customer);
  const subscriptionRef = session.subscription;
  const subscriptionId =
    typeof subscriptionRef === "string"
      ? subscriptionRef
      : subscriptionRef &&
          typeof subscriptionRef === "object" &&
          "id" in subscriptionRef
        ? subscriptionRef.id
        : null;

  if (!subscriptionId) {
    console.warn(
      "[stripe webhook] checkout.session.completed: no subscription on session",
    );
    return;
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const planKey = normalizePlanKey(session.metadata?.plan);
  const planId = await resolvePlanIdByKey(prismaBase, planKey);
  const trialEnd =
    subscription.trial_end != null
      ? new Date(subscription.trial_end * 1000)
      : null;
  const periodEndUnix = getSubscriptionPeriodEndUnix(subscription);
  const periodEnd =
    periodEndUnix != null ? new Date(periodEndUnix * 1000) : null;

  await prismaBase.organization.update({
    where: { id: organizationId },
    data: {
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      stripeSubscriptionId: subscriptionId,
      planId,
      status: "active",
      subscriptionStatus: "active",
      trialEndsAt: trialEnd,
      subscriptionCurrentPeriodEnd: periodEnd,
      subscriptionGraceEndsAt: null,
    },
  });
}

function extractSubscriptionIdFromInvoice(
  invoice: Stripe.Invoice,
): string | null {
  const parent = invoice.parent;
  if (
    parent &&
    parent.type === "subscription_details" &&
    parent.subscription_details?.subscription
  ) {
    const s = parent.subscription_details.subscription;
    return typeof s === "string" ? s : s.id;
  }
  const legacy = (
    invoice as unknown as { subscription?: string | { id: string } }
  ).subscription;
  if (!legacy) return null;
  return typeof legacy === "string" ? legacy : legacy.id;
}

async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
): Promise<void> {
  const customerId = asId(invoice.customer);
  if (!customerId) return;

  const org = await prismaBase.organization.findFirst({
    where: { stripeCustomerId: customerId },
  });
  if (!org) return;

  let periodEnd: Date | null = null;
  const subRef = extractSubscriptionIdFromInvoice(invoice);

  const stripe = getStripe();
  const subId = subRef ?? org.stripeSubscriptionId;

  if (subId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      const endUnix = getSubscriptionPeriodEndUnix(sub);
      if (endUnix != null) {
        periodEnd = new Date(endUnix * 1000);
      }
    } catch {
      // ignore
    }
  }

  await prismaBase.organization.update({
    where: { id: org.id },
    data: {
      ...(periodEnd ? { subscriptionCurrentPeriodEnd: periodEnd } : {}),
      status: "active",
      subscriptionStatus: "active",
      subscriptionGraceEndsAt: null,
    },
  });
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
): Promise<void> {
  const customerId = asId(invoice.customer);
  if (!customerId) return;

  const org = await prismaBase.organization.findFirst({
    where: { stripeCustomerId: customerId },
  });
  if (!org) return;

  const until = new Date(Date.now() + gracePeriodMs());

  await prismaBase.organization.update({
    where: { id: org.id },
    data: {
      status: "grace",
      subscriptionGraceEndsAt: until,
    },
  });

  console.warn(
    `[stripe webhook] invoice.payment_failed for org ${org.id}; grace until ${until.toISOString()} (add email notification if needed).`,
  );
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  const org = await prismaBase.organization.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (!org) return;

  await prismaBase.organization.update({
    where: { id: org.id },
    data: {
      status: "suspended",
      stripeSubscriptionId: null,
      subscriptionGraceEndsAt: null,
    },
  });
}

export async function processStripeWebhookEvent(
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(
        event.data.object as Stripe.Checkout.Session,
      );
      break;
    case "invoice.payment_succeeded":
      await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    default:
      break;
  }
}
