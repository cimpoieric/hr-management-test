/**
 * Import 12 angajati Detachering B.V. W18 pentru cmora@gmail.com
 *
 * Usage:
 *   npx tsx scripts/import-w18-detachering.ts
 *   npx tsx scripts/import-w18-detachering.ts --csv-salary path/to/Salary_Pay.csv --csv-transport path/to/Compen_Pay.csv
 */

import "dotenv/config";

import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import bcrypt from "bcryptjs";
import { encrypt, hashSha256 } from "../src/lib/encryption";
import { resolvePlanIdByKey, seedPlans } from "../src/lib/planCatalog";

const BCRYPT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

const ADMIN_EMAIL = "cmora@gmail.com";
const ORG_NAME = "Detachering B.V. W18";
const ORG_SLUG = "detachering-b-v-w18";
const COMPANY_NAME = "Detachering B.V. W18";
const COUNTRY_CODE = "NL";
const COUNTRY_NAME = "Olanda";

type EmployeeSeed = {
  fullName: string;
  iban: string;
  salary: number;
  transport?: number;
};

/** Lista din task (12 angajati unici; Tarciuc cu transport). */
const DEFAULT_EMPLOYEES: EmployeeSeed[] = [
  {
    fullName: "Amarandei Manuel George",
    iban: "RO52RNCB0114143362000012",
    salary: 582.75,
  },
  {
    fullName: "Anton Costel Mihai",
    iban: "RO21RNCB0267093619200014",
    salary: 874.0,
  },
  {
    fullName: "Borsa Emil Florian",
    iban: "RO54REVO0000112421098260",
    salary: 874.0,
  },
  {
    fullName: "Chirila Lulu Ginel",
    iban: "RO06REVO0000161302391089",
    salary: 724.0,
  },
  {
    fullName: "Cioroianu Silviu Alexandru Ionut",
    iban: "RO18BRDE030SV61984440300",
    salary: 769.5,
  },
  {
    fullName: "Croitoru Marian",
    iban: "RO06REVO0000118030219281",
    salary: 874.0,
  },
  {
    fullName: "Gavris Darius",
    iban: "GB67REVO00997034404188",
    salary: 383.52,
  },
  {
    fullName: "Geapar Tungeai",
    iban: "RO56REVO0000171572922073",
    salary: 920.0,
  },
  {
    fullName: "Greavu Dumitru",
    iban: "RO81BTRLEURCRT00B0170101",
    salary: 966.0,
  },
  {
    fullName: "Munteanu Octavian",
    iban: "RO16BTRLEURCRT0556298901",
    salary: 874.0,
  },
  {
    fullName: "Tarciuc Vasile Iulian",
    iban: "BG24INTF40012004620716",
    salary: 874.0,
    transport: 40,
  },
  {
    fullName: "Ungureanu Petrica Adrian",
    iban: "RO07RZBR0000060024218063",
    salary: 874.0,
  },
];

const IBAN_BANK_CODES: Record<string, string> = {
  RNCB: "BCR (Banca Comerciala Romana)",
  REVO: "Revolut",
  BRDE: "BRD - Groupe Societe Generale",
  BTRL: "Banca Transilvania",
  RZBR: "Raiffeisen Bank",
  INTF: "First Investment Bank (BG)",
  BACX: "UniCredit Bank",
  BRMA: "Banca Romaneasca",
  CECB: "CEC Bank",
  INGB: "ING Bank",
  OTPV: "OTP Bank",
  PIRB: "First Bank",
};

function parseArgs(): { salaryCsv?: string; transportCsv?: string } {
  const args = process.argv.slice(2);
  let salaryCsv: string | undefined;
  let transportCsv: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--csv-salary") salaryCsv = args[i + 1];
    if (args[i] === "--csv-transport") transportCsv = args[i + 1];
  }
  return { salaryCsv, transportCsv };
}

function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

function bankFromIban(iban: string): string {
  const normalized = normalizeIban(iban);
  const country = normalized.slice(0, 2);

  if (country === "RO" && normalized.length >= 8) {
    const code = normalized.slice(4, 8);
    if (IBAN_BANK_CODES[code]) return IBAN_BANK_CODES[code];
  }
  if (country === "GB" && normalized.includes("REVO")) return "Revolut (UK)";
  if (country === "BG" && normalized.length >= 8) {
    const code = normalized.slice(4, 8);
    if (IBAN_BANK_CODES[code]) return IBAN_BANK_CODES[code];
  }
  if (normalized.includes("BTRL")) return IBAN_BANK_CODES.BTRL;
  if (normalized.includes("BRDE")) return IBAN_BANK_CODES.BRDE;
  if (normalized.includes("REVO")) return IBAN_BANK_CODES.REVO;
  if (normalized.includes("RNCB")) return IBAN_BANK_CODES.RNCB;
  if (normalized.includes("RZBR")) return IBAN_BANK_CODES.RZBR;

  return `Banca (${country})`;
}

function removeDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function slugifyEmailPart(s: string): string {
  return removeDiacritics(s)
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function parseFullName(fullName: string): {
  lastName: string;
  firstName: string;
  middleName: string | null;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { lastName: "", firstName: "", middleName: null };
  }
  if (parts.length === 1) {
    return { lastName: parts[0]!, firstName: parts[0]!, middleName: null };
  }
  const lastName = parts[0]!;
  const firstName = parts[1]!;
  const middleName =
    parts.length > 2 ? parts.slice(2).join(" ").trim() || null : null;
  return { lastName, firstName, middleName };
}

export function buildEmployeeEmail(
  firstName: string,
  lastName: string,
): string {
  const first = slugifyEmailPart(firstName);
  const last = slugifyEmailPart(lastName);
  return `${first}.${last}@detachering.nl`;
}

function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Parseaza randuri CSV simple (nume + iban + suma). */
async function parseCsvFile(path: string): Promise<EmployeeSeed[]> {
  if (!existsSync(path)) {
    throw new Error(`CSV not found: ${path}`);
  }

  const rows: EmployeeSeed[] = [];
  const rl = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed || /^sep=/i.test(trimmed)) continue;
    const lower = trimmed.toLowerCase();
    if (
      lower.includes("name") &&
      (lower.includes("iban") || lower.includes("salary") || lower.includes("net"))
    ) {
      continue;
    }

    const cols = trimmed.split(/[;,|\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 2) continue;

    const ibanCol = cols.find((c) => /^[A-Z]{2}\d{2}/i.test(c.replace(/\s/g, "")));
    if (!ibanCol) continue;

    const iban = normalizeIban(ibanCol);
    const nameCol =
      cols.find(
        (c) =>
          c !== ibanCol &&
          /[A-Za-z-]/.test(c) &&
          c.split(/\s+/).length >= 2,
      ) ?? cols[0]!;
    const amountCols = cols
      .filter((c) => c !== ibanCol && c !== nameCol)
      .map(parseMoney)
      .filter((n): n is number => n != null);
    const salary = amountCols[amountCols.length - 1] ?? 0;

    rows.push({
      fullName: nameCol.replace(/,/g, " ").trim(),
      iban,
      salary,
    });
  }

  return rows;
}

function mergeEmployees(
  salaryRows: EmployeeSeed[],
  transportRows: EmployeeSeed[],
): EmployeeSeed[] {
  const byKey = new Map<string, EmployeeSeed>();

  for (const row of salaryRows) {
    const { lastName, firstName } = parseFullName(row.fullName);
    const key = `${lastName}|${firstName}`.toLowerCase();
    byKey.set(key, { ...row });
  }

  for (const row of transportRows) {
    const { lastName, firstName } = parseFullName(row.fullName);
    const key = `${lastName}|${firstName}`.toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      existing.transport = row.salary;
    } else {
      byKey.set(key, { ...row, transport: row.salary, salary: 0 });
    }
  }

  return [...byKey.values()].filter((e) => e.salary > 0 || (e.transport ?? 0) > 0);
}

const CNP_WEIGHTS = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];

function cnpChecksum(cnp12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number.parseInt(cnp12.charAt(i), 10) * (CNP_WEIGHTS[i] ?? 0);
  }
  const rest = sum % 11;
  return rest < 10 ? rest : 1;
}

function syntheticCnp(index: number): string {
  const sex = 5;
  const year = 90;
  const month = 1;
  const day = 1 + (index % 25);
  const county = 40;
  const seq = 100 + index;
  const yy = String(year).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const jj = String(county).padStart(2, "0");
  const nnn = String(seq).padStart(3, "0");
  const partial = `${sex}${yy}${mm}${dd}${jj}${nnn}`;
  return `${partial}${cnpChecksum(partial)}`;
}

async function main() {
  const prisma = new PrismaClient();
  const { salaryCsv, transportCsv } = parseArgs();

  let employees = DEFAULT_EMPLOYEES;
  if (salaryCsv) {
    const salaryRows = await parseCsvFile(salaryCsv);
    const transportRows = transportCsv
      ? await parseCsvFile(transportCsv)
      : [];
    employees = mergeEmployees(salaryRows, transportRows);
    console.info(
      `Parsed CSV: ${salaryRows.length} salary + ${transportRows.length} transport => ${employees.length} merged`,
    );
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  try {
    console.info(`=== Import W18 Detachering (${employees.length} angajati) ===`);

    const country = await prisma.country.upsert({
      where: { code: COUNTRY_CODE },
      create: { code: COUNTRY_CODE, name: COUNTRY_NAME, phoneCode: "+31" },
      update: { name: COUNTRY_NAME },
    });

    let organization = await prisma.organization.findFirst({
      where: {
        OR: [{ slug: ORG_SLUG }, { name: ORG_NAME }],
      },
    });

    if (!organization) {
      await seedPlans(prisma);
      const businessPlanId = await resolvePlanIdByKey(prisma, "business");
      organization = await prisma.organization.create({
        data: {
          name: ORG_NAME,
          slug: ORG_SLUG,
          email: ADMIN_EMAIL,
          planId: businessPlanId,
          subscriptionStatus: "active",
          status: "active",
          employeeCount: 0,
        },
      });
      await prisma.settings.upsert({
        where: { organizationId: organization.id },
        create: { organizationId: organization.id, logoUrl: null, language: "en" },
        update: {},
      });
      console.info(`Created organization: ${organization.id}`);
    } else {
      console.info(`Using organization: ${organization.id} (${organization.name})`);
    }

    let adminUser = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
    });

    if (!adminUser) {
      const tempPassword =
        process.env.IMPORT_ADMIN_PASSWORD?.trim() ?? "ChangeMeW18!2026";
      adminUser = await prisma.user.create({
        data: {
          email: ADMIN_EMAIL,
          name: "C Mora",
          password: await hashPassword(tempPassword),
          role: UserRole.ORG_ADMIN,
          organizationId: organization.id,
          isActive: true,
          mustChangePassword: true,
        },
      });
      console.info(
        `Created user ${ADMIN_EMAIL} (ORG_ADMIN). Temp password: ${tempPassword}`,
      );
    } else {
      if (adminUser.organizationId !== organization.id) {
        adminUser = await prisma.user.update({
          where: { id: adminUser.id },
          data: {
            organizationId: organization.id,
            role: UserRole.ORG_ADMIN,
            isActive: true,
          },
        });
        console.info(`Linked existing user to organization ${organization.id}`);
      } else if (adminUser.role !== UserRole.ORG_ADMIN) {
        adminUser = await prisma.user.update({
          where: { id: adminUser.id },
          data: { role: UserRole.ORG_ADMIN },
        });
      }
      console.info(`Using user: ${adminUser.email} (${adminUser.role})`);
    }

    const company = await prisma.company.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name: COMPANY_NAME,
        },
      },
      create: {
        organizationId: organization.id,
        name: COMPANY_NAME,
        status: "Activ",
        countryId: country.id,
      },
      update: { countryId: country.id },
    });

    for (let i = 0; i < employees.length; i++) {
      const row = employees[i]!;
      const { lastName, firstName, middleName } = parseFullName(row.fullName);
      const iban = normalizeIban(row.iban);
      const bankName = bankFromIban(iban);
      const email = buildEmployeeEmail(firstName, lastName);
      const displayName = [firstName, middleName, lastName].filter(Boolean).join(" ");

      const observationParts = [
        "contractType=detasare",
        `import=W18_${new Date().getFullYear()}`,
      ];
      if (middleName) observationParts.push(`middleName=${middleName}`);
      if (row.transport != null && row.transport > 0) {
        observationParts.push(`transportEUR=${row.transport}`);
      }

      const existing = await prisma.employee.findFirst({
        where: {
          organizationId: organization.id,
          OR: [
            { email },
            { ibanHash: hashSha256(iban) },
            {
              AND: [
                { lastName: { equals: lastName, mode: "insensitive" } },
                { firstName: { equals: firstName, mode: "insensitive" } },
              ],
            },
          ],
        },
        select: { id: true, email: true },
      });

      const payload = {
        firstName,
        lastName,
        email,
        iban: encrypt(iban),
        ibanHash: hashSha256(iban),
        bankName,
        position: "Angajat detasat",
        salaryType: "LUNAR" as const,
        salaryAmount: new Prisma.Decimal(row.salary.toFixed(2)),
        salaryCurrency: "EUR",
        observations: observationParts.join("; "),
        workNorm: "detasare",
        status: "ACTIVE",
        companyId: company.id,
        countryId: country.id,
      };

      let employeeId: number;
      if (existing) {
        await prisma.employee.update({
          where: { id: existing.id },
          data: payload,
        });
        employeeId = existing.id;
        updated++;
        console.info(`[${i + 1}/${employees.length}] UPDATED ${displayName} (${email})`);
      } else {
        const cnp = syntheticCnp(i + 1);
        const createdEmp = await prisma.employee.create({
          data: {
            organizationId: organization.id,
            cnp,
            cnpEncrypted: encrypt(cnp),
            cnpHash: hashSha256(cnp),
            ...payload,
          },
        });
        employeeId = createdEmp.id;
        created++;
        console.info(`[${i + 1}/${employees.length}] CREATED ${displayName} (${email})`);
      }

      const hasActiveDeployment = await prisma.deployment.findFirst({
        where: { employeeId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!hasActiveDeployment) {
        await prisma.deployment.create({
          data: {
            employeeId,
            country: COUNTRY_CODE,
            startDate: new Date(),
            endDate: null,
            status: "ACTIVE",
            notes: "Import W18 detasare",
          },
        });
      }
    }

    const count = await prisma.employee.count({
      where: { organizationId: organization.id },
    });

    console.info("----");
    console.info(`Organization: ${organization.name} (${organization.id})`);
    console.info(`Admin: ${ADMIN_EMAIL}`);
    console.info(`Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
    console.info(`SELECT count(*) FROM Employee WHERE organizationId = '${organization.id}' => ${count}`);
  } catch (err) {
    console.error("[IMPORT_W18_ERROR]", err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
