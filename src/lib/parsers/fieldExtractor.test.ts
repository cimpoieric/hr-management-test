import { describe, expect, it } from "vitest";
import { FIXTURE_VALID_CNP, MOCK_CIM_TEXT } from "./__fixtures__/cim-sample";
import {
  NOT_COMPLETED_SALARY_LABEL,
  NOT_FOUND_LABEL,
  extractFields,
} from "./fieldExtractor.logic";

describe("extractFields (CIM fixture)", () => {
  it("ignores legal representative domnul/doamna before salariat block", () => {
    const text = `
Angajatorul X reprezentat legal prin domnul Eduard-Ioan Oloeru, cu sediul la Bucure\u0219ti.
salariatul \u2013 domnul Dan Marian, cu domiciliul \u00een Mun. Test,
posesor al c\u0103r\u021bii de identitate seria PX, num\u0103rul 719135, av\u00e2nd CNP ${FIXTURE_VALID_CNP}.
Obiectul contractului
`;
    const { fields } = extractFields(text);
    expect(fields.firstName?.value).toBe("Dan");
    expect(fields.lastName?.value).toBe("Marian");
    expect(fields.lastName?.value.includes("Oloeru")).toBe(false);
  });

  it("drops frac\u021biune when norm\u0103 \u00eentreag\u0103 and 8 ore/zi", () => {
    const text = `
salariatul \u2013 domnul A B, CNP 1880518123456
DURATA TIMPULUI DE MUNC\u0102
Norm\u0103 \u00eentreag\u0103. Se men\u021bine frac\u021biune de norm\u0103 \u00een sens tehnic. Durata este de 8 ore/zi \u0219i 40 ore/s\u0103pt\u0103m\u00e2n\u0103.
`;
    const { fields } = extractFields(text);
    expect(
      fields.workNorm?.value.includes("norm\u0103 \u00eentreag\u0103"),
    ).toBe(true);
    expect(fields.workNorm?.value.includes("frac\u021biune")).toBe(false);
    expect(fields.workNorm?.value.includes("8 ore/zi")).toBe(true);
  });

  it("parses CNP, RO name split, serie CI and numar CI (not firm CUI)", () => {
    const { fields } = extractFields(MOCK_CIM_TEXT);

    expect(fields.cnp?.value).toBe(FIXTURE_VALID_CNP);
    expect(fields.cnp?.confidence ?? 0).toBeGreaterThanOrEqual(0.99);

    expect(fields.firstName?.value).toBe("Dan");
    expect(fields.lastName?.value).toBe("Marian");

    expect(fields.seriesCI?.value).toBe("PX");
    expect(fields.seriesCI?.confidence ?? 0).toBeGreaterThanOrEqual(0.9);

    expect(fields.numberCI?.value).toBe("719135");
    expect(fields.numberCI?.confidence ?? 0).toBeGreaterThanOrEqual(0.9);
    expect(fields.numberCI?.value).not.toBe("37260123");
  });

  it("does not use company phone as employee phone when absent", () => {
    const { fields } = extractFields(MOCK_CIM_TEXT);
    expect(fields.phone?.value).toBe(NOT_FOUND_LABEL);
    expect(fields.phone?.value).not.toBe("0790725042");
  });

  it("extracts full address between domiciliu and posesor", () => {
    const { fields } = extractFields(MOCK_CIM_TEXT);
    expect(fields.address?.value.includes("Mun.")).toBe(true);
    expect(fields.address?.value.includes("C\u00e2mpina")).toBe(true);
    expect(fields.address?.value.includes("Ana Ip\u0103tescu")).toBe(true);
    expect(fields.address?.value.includes("Prahova")).toBe(true);
  });

  it("parses job title without COR code", () => {
    const { fields } = extractFields(MOCK_CIM_TEXT);
    expect(fields.position?.value.includes("Instalator")).toBe(true);
    expect(
      fields.position?.value.includes(
        "instala\u021bii tehnico sanitare \u0219i de gaze",
      ),
    ).toBe(true);
    expect(fields.position?.value.includes("712609")).toBe(false);
  });

  it("parses activity start date", () => {
    const { fields } = extractFields(MOCK_CIM_TEXT);
    expect(fields.contractStartDate?.value).toBe("05.05.2026");
  });

  it("parses norm and weekly hours", () => {
    const { fields } = extractFields(MOCK_CIM_TEXT);
    expect(
      fields.workNorm?.value.includes("norm\u0103 \u00eentreag\u0103"),
    ).toBe(true);
    expect(fields.workNorm?.value.includes("8 ore/zi")).toBe(true);
    expect(
      fields.workNorm?.value.includes("40 ore/s\u0103pt\u0103m\u00e2n\u0103"),
    ).toBe(true);
  });

  it("marks blank gross salary in document", () => {
    const { fields } = extractFields(MOCK_CIM_TEXT);
    expect(fields.grossSalary?.value).toBe(NOT_COMPLETED_SALARY_LABEL);
  });

  it("parses salary currency (euro)", () => {
    const { fields } = extractFields(MOCK_CIM_TEXT);
    expect(fields.salaryCurrency?.value).toBe("euro");
  });

  it("parses deployment country", () => {
    const { fields } = extractFields(MOCK_CIM_TEXT);
    expect(fields.deploymentCountry?.value.includes("Olanda")).toBe(true);
  });
});
