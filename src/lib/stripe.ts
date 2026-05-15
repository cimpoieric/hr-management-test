import "server-only";

import { resolveAppBaseUrl } from "@/lib/appUrl";
import Stripe from "stripe";

type StripeClient = InstanceType<typeof Stripe>;
type CheckoutSessionCreateParams = NonNullable<
  Parameters<StripeClient["checkout"]["sessions"]["create"]>[0]
>;
type CheckoutSessionRetrieveParams = NonNullable<
  Parameters<StripeClient["checkout"]["sessions"]["retrieve"]>[1]
>;

let stripeSingleton: Stripe | null = null;

/** Server-side Stripe SDK (never import this file from Client Components). */
export function getStripe(): Stripe {
  if (!stripeSingleton) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error(
        "STRIPE_SECRET_KEY is missing. Add it to .env.local (see Stripe Dashboard > Developers > API keys).",
      );
    }
    stripeSingleton = new Stripe(key, {
      typescript: true,
    });
  }
  return stripeSingleton;
}

export function getAppBaseUrl(): string {
  return resolveAppBaseUrl();
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is missing. Use the signing secret from Stripe Dashboard > Developers > Webhooks.",
    );
  }
  return secret;
}

export type CreateSubscriptionCheckoutParams = {
  priceId: string;
  successPath?: string;
  cancelPath?: string;
  /** Prefer over `customerEmail` when the org already has a Stripe Customer. */
  customer?: string;
  customerEmail?: string;
  clientReferenceId?: string;
  metadata?: Record<string, string>;
  /** Defaults to subscription mode (SaaS plans). */
  mode?: CheckoutSessionCreateParams["mode"];
  /** When set, Stripe creates the subscription with a free trial (days). */
  subscriptionTrialPeriodDays?: number;
};

/**
 * Creates a Stripe Checkout Session (subscription by default).
 * Ensure `successPath` / `cancelPath` are paths like `/dashboard` or full URLs.
 */
export async function createSubscriptionCheckoutSession(
  params: CreateSubscriptionCheckoutParams,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const base = getAppBaseUrl();

  const successUrl = buildAbsoluteUrl(base, params.successPath ?? "/dashboard");
  const cancelUrl = buildAbsoluteUrl(base, params.cancelPath ?? "/");

  const trialDays = params.subscriptionTrialPeriodDays;
  const withTrial =
    typeof trialDays === "number" &&
    Number.isFinite(trialDays) &&
    trialDays > 0 &&
    trialDays <= 730;

  return stripe.checkout.sessions.create({
    mode: params.mode ?? "subscription",
    ...(params.customer
      ? { customer: params.customer }
      : { customer_email: params.customerEmail }),
    client_reference_id: params.clientReferenceId,
    metadata: params.metadata,
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: appendCheckoutSessionQuery(successUrl),
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    ...(withTrial
      ? {
          subscription_data: {
            trial_period_days: Math.floor(trialDays),
            metadata: params.metadata ?? {},
          },
        }
      : {}),
  });
}

/**
 * One-time payment Checkout (e.g. custom onboarding fee).
 */
export async function createPaymentCheckoutSession(params: {
  priceId: string;
  successPath?: string;
  cancelPath?: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const base = getAppBaseUrl();
  const successUrl = buildAbsoluteUrl(base, params.successPath ?? "/dashboard");
  const cancelUrl = buildAbsoluteUrl(base, params.cancelPath ?? "/");

  return stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: params.customerEmail,
    metadata: params.metadata,
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: appendCheckoutSessionQuery(successUrl),
    cancel_url: cancelUrl,
  });
}

export function constructStripeWebhookEvent(
  payload: string | Buffer,
  signature: string | string[],
): Stripe.Event {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    getStripeWebhookSecret(),
  );
}

export async function retrieveCheckoutSession(
  sessionId: string,
  params?: CheckoutSessionRetrieveParams,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId, params);
}

export async function createBillingPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
}

/** Billing period end (Unix seconds); uses subscription items in newer Stripe API shapes. */
export function getSubscriptionPeriodEndUnix(
  sub: Stripe.Subscription,
): number | null {
  const items = sub.items?.data;
  if (items && items.length > 0) {
    return Math.max(...items.map((item) => item.current_period_end));
  }
  const legacy = (sub as unknown as { current_period_end?: number })
    .current_period_end;
  return legacy ?? null;
}

function buildAbsoluteUrl(base: string, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}

/** Lets the success page read `{CHECKOUT_SESSION_ID}` from the redirect URL. */
function appendCheckoutSessionQuery(successUrl: string): string {
  const sep = successUrl.includes("?") ? "&" : "?";
  return `${successUrl}${sep}session_id={CHECKOUT_SESSION_ID}`;
}
