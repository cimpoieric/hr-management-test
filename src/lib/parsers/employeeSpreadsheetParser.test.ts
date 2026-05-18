import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseEmployeesFromSpreadsheet } from "./employeeSpreadsheetParser";

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
