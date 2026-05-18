import { describe, expect, it } from "vitest";
import type { ParsedEmployeeSpreadsheetRow } from "./employeeSpreadsheetParser";
import { parseExcelDate } from "./employeeSpreadsheetParser";
import {
  buildObservatii,
  mapSpreadsheetRowToImportItem,
  parseCiDocument,
} from "./employeeSpreadsheetMap";

describe("mapSpreadsheetRowToImportItem", () => {
  const baseRow: ParsedEmployeeSpreadsheetRow = {
    rowIndex: 2,
    lastName: "DONOSE NECULAI",
    firstName: "",
    cnp: "1234567890123",
    sourceSheet: "HTC",
    position: "Instalator",
    salary: "12.5",
    address: "Str. Test 1",
    hiredAt: "2024-01-15",
    workNorm: "40",
    bsn: "BSN-1",
    a1: "DA",
    contract: "CIM",
    decision: "DEC-99",
    ciDocument: "AB 123456",
    fisaAppPsi: "OK",
    rowNumber: "1",
  };

  it("maps Excel columns to employee form fields", () => {
    const item = mapSpreadsheetRowToImportItem(baseRow, 1);

    expect(item).toMatchObject({
      cnp: "1234567890123",
      lastName: "DONOSE",
      firstName: "NECULAI",
      address: "Str. Test 1",
      position: "Instalator",
      workNorm: "40",
      companyId: 1,
      status: "ACTIVE",
      hiredAt: "2024-01-15",
      salaryType: "ORA",
      salaryAmount: 12.5,
      salaryCurrency: "EUR",
      paymentFrequency: "weekly",
      salaryStartDate: "2024-01-15",
      seriesCI: "AB",
      numberCI: "123456",
    });
    expect(item.observations).toContain("Foaie Excel: HTC");
    expect(item.observations).toContain("BSN: BSN-1");
  });

  it("sets TERMINATED when termination date is present", () => {
    const item = mapSpreadsheetRowToImportItem(
      { ...baseRow, terminationDate: "2025-06-01" },
      1,
    );
    expect(item.status).toBe("TERMINATED");
    expect(item.observations).toContain("Data incetare: 2025-06-01");
  });
});

describe("parseExcelDate", () => {
  it("converts Excel serial number", () => {
    expect(parseExcelDate(45306)).toBe("2024-01-15");
  });

  it("parses RO date format", () => {
    expect(parseExcelDate("15.01.2024")).toBe("2024-01-15");
  });
});

describe("parseCiDocument", () => {
  it("splits series and number", () => {
    expect(parseCiDocument("AB 123456")).toEqual({
      seriesCI: "AB",
      numberCI: "123456",
    });
  });
});

describe("buildObservatii", () => {
  it("joins metadata fields", () => {
    const obs = buildObservatii({
      bsn: "1",
      decision: "D",
      sourceSheet: "BAKKER",
    });
    expect(obs).toContain("BSN: 1");
    expect(obs).toContain("Decizie: D");
    expect(obs).toContain("Foaie Excel: BAKKER");
  });
});
