import "server-only";

import { type AuthContext } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

const PLAN_KEYS = new Set(["starter", "business", "enterprise", "custom"]);

/**
 * Ensures `organizationId` from the body/query matches the tenant in the JWT.
 */
export function assertJwtOrganizationId(
  user: AuthContext,
  organizationId: unknown,
): NextResponse | null {
  const id = typeof organizationId === "string" ? organizationId.trim() : "";
  if (!id) {
    return NextResponse.json(
      { error: "organizationId is missing or invalid." },
      { status: 400 },
    );
  }
  if (id !== user.organizationId) {
    return NextResponse.json(
      { error: "organizationId does not match the signed-in organization." },
      { status: 403 },
    );
  }
  return null;
}

export function normalizePlanKey(raw: string | undefined | null): string {
  const p = (raw ?? "starter").toLowerCase().trim();
  return PLAN_KEYS.has(p) ? p : "starter";
}

export async function inferPlanKeyFromPriceId(
  priceId: string,
): Promise<string> {
  const stripe = getStripe();
  const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
  const product = price.product;
  if (typeof product === "string" || !product || "deleted" in product) {
    return "starter";
  }
  const metaPlan = product.metadata?.plan;
  if (metaPlan && PLAN_KEYS.has(metaPlan.toLowerCase())) {
    return metaPlan.toLowerCase();
  }
  const name = (product.name ?? "").toLowerCase();
  if (name.includes("enterprise")) return "enterprise";
  if (name.includes("business")) return "business";
  if (name.includes("custom")) return "custom";
  if (name.includes("starter")) return "starter";
  return "starter";
}
