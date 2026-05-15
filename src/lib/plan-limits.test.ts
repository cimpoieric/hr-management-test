import { describe, expect, it } from "vitest";
import { FEATURES } from "@/lib/plan-features";
import {
  isSubscriptionUsable,
  resolveEffectiveFeatures,
} from "@/lib/plan-limits";

describe("resolveEffectiveFeatures", () => {
  it("returns plan features when no override", () => {
    expect(
      resolveEffectiveFeatures(["basic_reports", "export_excel"], null),
    ).toEqual(["basic_reports", "export_excel"]);
  });

  it("parses override JSON array", () => {
    expect(
      resolveEffectiveFeatures(
        ["basic_reports"],
        JSON.stringify(["export_pdf", "all"]),
      ),
    ).toEqual(["export_pdf", "all"]);
  });
});

describe("isSubscriptionUsable", () => {
  it("allows active subscription", () => {
    expect(
      isSubscriptionUsable({
        subscriptionStatus: "active",
        trialEndsAt: null,
        status: "active",
      }),
    ).toBe(true);
  });

  it("blocks expired trial", () => {
    expect(
      isSubscriptionUsable({
        subscriptionStatus: "trial",
        trialEndsAt: new Date("2020-01-01"),
        status: "trial",
      }),
    ).toBe(false);
  });

  it("allows valid trial", () => {
    expect(
      isSubscriptionUsable({
        subscriptionStatus: "trial",
        trialEndsAt: new Date(Date.now() + 86_400_000),
        status: "trial",
      }),
    ).toBe(true);
  });
});

describe("FEATURES", () => {
  it("exports stable keys", () => {
    expect(FEATURES.EXPORT_PDF).toBe("export_pdf");
    expect(FEATURES.UNLIMITED).toBe("all");
  });
});
