import { type NextRequest, NextResponse } from "next/server";

import { constructStripeWebhookEvent } from "@/lib/stripe";
import { processStripeWebhookEvent } from "@/lib/stripeWebhookHandler";

export const runtime = "nodejs";

/**
 * POST /api/stripe/webhook
 * Point Stripe Dashboard webhooks here; use STRIPE_WEBHOOK_SECRET from that endpoint.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header." },
      { status: 400 },
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  let event: ReturnType<typeof constructStripeWebhookEvent>;
  try {
    event = constructStripeWebhookEvent(rawBody, signature);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Webhook signature verification failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    await processStripeWebhookEvent(event);
  } catch (e) {
    console.error("[stripe webhook]", e);
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
