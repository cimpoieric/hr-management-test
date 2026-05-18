import { describe, expect, it } from "vitest";
import {
  formatCompanyNameFromSheet,
  isValidCompanySheetName,
  normalizeCompanySheetKey,
  resolveCompanyIdForImportRow,
} from "./companyFromSheet";

describe("companyFromSheet", () => {
  it("normalizes sheet keys for matching", () => {
    expect(normalizeCompanySheetKey("  htc  ")).toBe("HTC");
    expect(normalizeCompanySheetKey("MONT. MAN.")).toBe("MONT. MAN.");
  });

  it("rejects generic sheet names", () => {
    expect(isValidCompanySheetName("Sheet1")).toBe(false);
    expect(isValidCompanySheetName("HTC")).toBe(true);
  });

  it("formats display company name", () => {
    expect(formatCompanyNameFromSheet("  BAKKER  ")).toBe("BAKKER");
  });

  it("resolves company id from sheet map", () => {
    const map = new Map([["HTC", 42]]);
    expect(resolveCompanyIdForImportRow("HTC", 1, map)).toBe(42);
    expect(resolveCompanyIdForImportRow(null, 1, map)).toBe(1);
    expect(resolveCompanyIdForImportRow("UNKNOWN", 1, map)).toBe(1);
  });
});
