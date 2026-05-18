import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  parseEmployeesFromSpreadsheet,
  parseNumeComplet,
} from "./employeeSpreadsheetParser";

function buildTestWorkbookBuffer(): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Nume", "Prenume", "CNP", "Functie", "Salariu"],
    ["Popescu", "Ion", "1234567890123", "Instalator", 5000],
    ["Ionescu", "Maria", "9876543210987", "Contabil", 6000],
    ["Georgescu", "Andrei", "4567891234567", "?ofer", 4500],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Angajati");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parseNumeComplet", () => {
  it("splits full name into last and first name", () => {
    expect(parseNumeComplet("DONOSE NECULAI")).toEqual({
      nume: "DONOSE",
      prenume: "NECULAI",
    });
  });

  it("handles single-word name", () => {
    expect(parseNumeComplet("POPESCU")).toEqual({
      nume: "POPESCU",
      prenume: "",
    });
  });

  it("handles multiple first names", () => {
    expect(parseNumeComplet("IONESCU MARIA ELENA")).toEqual({
      nume: "IONESCU",
      prenume: "MARIA ELENA",
    });
  });
});

describe("parseEmployeesFromSpreadsheet", () => {
  it("parses Romanian headers and three data rows", () => {
    const buf = buildTestWorkbookBuffer();
    const { employees, warnings } = parseEmployeesFromSpreadsheet(
      buf,
      "test.xlsx",
    );

    expect(warnings).toEqual([]);
    expect(employees).toHaveLength(3);
    expect(employees[0]).toMatchObject({
      lastName: "Popescu",
      firstName: "Ion",
      cnp: "1234567890123",
      position: "Instalator",
    });
    expect(employees[1]?.lastName).toBe("Ionescu");
    expect(employees[2]?.firstName).toBe("Andrei");
  });

  it("splits full name from single NUME column", () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["NUME", "CNP", "Functie"],
      ["DONOSE NECULAI", "1234567890123", "Instalator"],
      ["POPESCU", "9876543210987", "Contabil"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Angajati");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const { employees, warnings } = parseEmployeesFromSpreadsheet(
      buf,
      "nume-complet.xlsx",
    );

    expect(warnings).toEqual([]);
    expect(employees).toHaveLength(2);
    expect(employees[0]).toMatchObject({
      lastName: "DONOSE",
      firstName: "NECULAI",
      cnp: "1234567890123",
    });
    expect(employees[1]).toMatchObject({
      lastName: "POPESCU",
      firstName: "\u2014",
    });
  });

  it("parses employees from all Excel worksheets", () => {
    const wb = XLSX.utils.book_new();
    const wsHtc = XLSX.utils.aoa_to_sheet([
      ["NR.CRT.", "NUME", "CNP"],
      [1, "DONOSE NECULAI", "1111111111111"],
      [2, "POPESCU ION", "2222222222222"],
    ]);
    const wsBakker = XLSX.utils.aoa_to_sheet([
      ["NUME", "CNP"],
      ["IONESCU MARIA", "3333333333333"],
    ]);
    const wsEmpty = XLSX.utils.aoa_to_sheet([["A"], ["1"]]);
    XLSX.utils.book_append_sheet(wb, wsHtc, "HTC");
    XLSX.utils.book_append_sheet(wb, wsBakker, "BAKKER");
    XLSX.utils.book_append_sheet(wb, wsEmpty, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const { employees, warnings, sheetsParsed, sheetCount } =
      parseEmployeesFromSpreadsheet(buf, "multi.xlsx");

    expect(sheetCount).toBe(3);
    expect(sheetsParsed).toBe(2);
    expect(employees).toHaveLength(3);
    expect(employees[0]).toMatchObject({
      lastName: "DONOSE",
      firstName: "NECULAI",
      sourceSheet: "HTC",
    });
    expect(employees[2]).toMatchObject({
      lastName: "IONESCU",
      firstName: "MARIA",
      sourceSheet: "BAKKER",
    });
    expect(warnings[0]).toMatch(/2 foi cu angajati din 3 foi/);
  });

  it("returns empty with warning when sheet has no header", () => {
    const ws = XLSX.utils.aoa_to_sheet([["A", "B"], ["1", "2"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const { employees, warnings } = parseEmployeesFromSpreadsheet(buf, "x.xlsx");
    expect(employees).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
