import "dotenv/config";

import { PrismaClient, Prisma } from "@prisma/client";
import { encrypt, hashSha256 } from "../src/lib/encryption";

type PayslipRow = {
  fullName: string;
  emplId: number;
  position: string;
  hours: number;
  net: number;
};

const WEEK = 17;
const YEAR = 2026;
const PERIOD = "20.04-26.04";

const COMPANY_NAME = "Cedol Autocraft SRL";
const COUNTRY_NAME = "Romania";
const COUNTRY_CODE = "RO";

const rows: PayslipRow[] = [
  {
    fullName: "Baptista Ferreira Anselmo Andre",
    emplId: 931,
    position: "Operator la masini-unelte cu comanda numerica",
    hours: 38.5,
    net: 721.88,
  },
  {
    fullName: "Caraman Robert Lucian",
    emplId: 966,
    position: "Muncitor necalificat la asamblarea, montarea pieselor",
    hours: 40,
    net: 580,
  },
  {
    fullName: "Chemoshyryanov Artem",
    emplId: 890,
    position: "Operator la masini-unelte cu comanda numerica",
    hours: 36,
    net: 550,
  },
  {
    fullName: "Gomes Maia Ruben Miguel",
    emplId: 935,
    position: "Muncitor necalificat la asamblarea, montarea pieselor",
    hours: 40,
    net: 880,
  },
  {
    fullName: "Herbsts Kristaps",
    emplId: 948,
    position: "Muncitor necalificat la asamblarea, montarea pieselor",
    hours: 38.5,
    net: 553.44,
  },
  {
    fullName: "Jeler Ciprian Ilie",
    emplId: 903,
    position: "Operator la masini-unelte cu comanda numerica",
    hours: 40,
    net: 650,
  },
  {
    fullName: "Lewandowski Grzegorz Ireneusz",
    emplId: 984,
    position: "Muncitor necalificat la asamblarea, montarea pieselor",
    hours: 38,
    net: 617.5,
  },
  {
    fullName: "Lizurej Damian Piotr",
    emplId: 987,
    position: "Muncitor necalificat la asamblarea, montarea pieselor",
    hours: 38.75,
    net: 629.69,
  },
  {
    fullName: "Narewski Przemyslaw Pawel",
    emplId: 926,
    position: "Operator la masini-unelte cu comanda numerica",
    hours: 40,
    net: 630,
  },
  {
    fullName: "Oliveira Campos Tiago Filipe",
    emplId: 934,
    position: "Muncitor necalificat la asamblarea, montarea pieselor",
    hours: 40,
    net: 780,
  },
  {
    fullName: "Tatara Pawel",
    emplId: 939,
    position: "Muncitor necalificat la asamblarea, montarea pieselor",
    hours: 37.5,
    net: 562.5,
  },
  {
    fullName: "Varela Goncalves Carlos Daniel",
    emplId: 963,
    position: "Muncitor necalificat la asamblarea, montarea pieselor",
    hours: 38,
    net: 522.5,
  },
];

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/g).filter(Boolean);

  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1)
    return { firstName: parts[0] ?? "", lastName: parts[0] ?? "" };

  // În dataset-ul tău: primul cuvânt e de regulă numele de familie (ex: Caraman, Jeler, Lewandowski)
  const lastName = parts[0] ?? "";
  const firstName = parts.slice(1).join(" ").trim();
  return { firstName, lastName };
}

function hourlyRate(net: number, hours: number): Prisma.Decimal {
  // Folosim 2 zecimale pentru consistență în UI/rapoarte.
  const rate = hours > 0 ? net / hours : 0;
  return new Prisma.Decimal(rate.toFixed(2));
}

function tempCnp(emplId: number): string {
  // Pattern cerut: ID_EMPLOYEE + random, ex: "TEMP_931_2026"
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TEMP_${emplId}_${YEAR}_${rand}`;
}

async function main() {
  const prisma = new PrismaClient();

  let imported = 0;
  let existed = 0;

  try {
    console.info(
      `Bulk import employees from payslips — Week ${WEEK}/${YEAR} (${PERIOD}) — rows=${rows.length}`,
    );

    // Country: Romania (RO)
    const country = await prisma.country.upsert({
      where: { code: COUNTRY_CODE },
      create: { code: COUNTRY_CODE, name: COUNTRY_NAME },
      update: { name: COUNTRY_NAME },
    });

    const organization = await prisma.organization.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (!organization) {
      throw new Error("No Organization row — run seed or setup first.");
    }

    // Company: Cedol Autocraft SRL
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
      update: {
        countryId: country.id,
      },
    });

    console.info(`Using companyId=${company.id}, countryId=${country.id}`);

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx]!;
      const observation = `Empl.ID: ${row.emplId}`;
      const rate = hourlyRate(row.net, row.hours);

      console.info(
        `[${idx + 1}/${rows.length}] ${row.fullName} (${observation}) hours=${row.hours} net=${row.net} rate=${rate.toString()}`,
      );

      const existing = await prisma.employee.findFirst({
        where: {
          OR: [
            { observations: observation },
            { observations: { contains: observation } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          observations: true,
        },
      });

      if (existing) {
        existed++;
        console.info(
          `  - exists: employeeId=${existing.id} (${existing.lastName} ${existing.firstName})`,
        );
        continue;
      }

      const { firstName, lastName } = splitName(row.fullName);
      const cnp = tempCnp(row.emplId);
      const cnpEncrypted = encrypt(cnp);
      const cnpHash = hashSha256(cnp);

      await prisma.employee.create({
        data: {
          organizationId: organization.id,
          cnp,
          cnpEncrypted,
          cnpHash,
          firstName,
          lastName,
          position: row.position,
          salaryType: "ORA",
          salaryAmount: rate,
          salaryCurrency: "EUR",
          companyId: company.id,
          countryId: country.id,
          observations: observation,
          status: "ACTIVE",
        },
      });

      imported++;
      console.info(`  - created`);
    }

    await prisma.auditLog.create({
      data: {
        action: "BULK_IMPORT",
        entity: "System",
        entityId: null,
        oldValues: null,
        newValues: JSON.stringify({
          kind: "employees_from_payslips",
          companyName: COMPANY_NAME,
          week: WEEK,
          year: YEAR,
          period: PERIOD,
          totalRows: rows.length,
          imported,
          existed,
        }),
      },
    });

    console.info("----");
    console.info(
      `Done. Imported=${imported}, Already existed=${existed}, Total=${rows.length}`,
    );
  } catch (err) {
    console.error("[IMPORT_EMPLOYEES_FROM_PAYSLIP_ERROR]", err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
