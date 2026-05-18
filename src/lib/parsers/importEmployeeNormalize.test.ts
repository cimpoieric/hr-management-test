import { describe, expect, it, vi } from "vitest";
import * as validation from "@/lib/validation";
import {
  appendImportMetadataToObservations,
  getSpreadsheetPreviewMissingFields,
  normalizeImportEmployeeRow,
} from "./importEmployeeNormalize";

describe("normalizeImportEmployeeRow", () => {
  it("accepts missing firstName", () => {
    const row = normalizeImportEmployeeRow(
      {
        cnp: "1234567890123",
        firstName: "",
        lastName: "POPESCU",
        companyId: 1,
      },
      0,
      "org-1",
    );

    expect(row.firstName).toBe("");
    expect(row.lastName).toBe("POPESCU");
    expect(row.importStatus).toBe("incomplet");
    expect(row.missingFields).toContain("Prenume");
  });

  it("allows missing CNP with placeholder for storage", () => {
    const row = normalizeImportEmployeeRow(
      {
        cnp: "",
        firstName: "Ion",
        lastName: "Popescu",
        companyId: 1,
      },
      3,
      "org-abc",
    );

    expect(row.cnpIsValid).toBe(false);
    expect(row.cnpForStorage).toHaveLength(13);
    expect(row.importStatus).toBe("incomplet");
    expect(row.missingFields).toContain("CNP");
  });
});

describe("getSpreadsheetPreviewMissingFields", () => {
  it("lists missing prenume, adresa and salariu", () => {
    expect(
      getSpreadsheetPreviewMissingFields({
        firstName: "",
        lastName: "Popescu",
        cnp: "1234567890123",
        address: "",
        salary: "\u2014",
      }),
    ).toEqual(expect.arrayContaining(["Prenume", "Adresa", "Salariu"]));
  });

  it("returns empty when all required preview fields are present", () => {
    vi.spyOn(validation, "validateCNP").mockReturnValue(true);
    expect(
      getSpreadsheetPreviewMissingFields({
        firstName: "Ion",
        lastName: "Popescu",
        cnp: "1234567890123",
        address: "Str. Test 1",
        salary: "3500",
      }),
    ).toEqual([]);
    vi.restoreAllMocks();
  });
});

describe("appendImportMetadataToObservations", () => {
  it("adds incomplete import note", () => {
    const obs = appendImportMetadataToObservations(null, "incomplet", [
      "Prenume",
      "CNP",
    ]);
    expect(obs).toContain("[Import incomplet]");
    expect(obs).toContain("Prenume");
  });
});
