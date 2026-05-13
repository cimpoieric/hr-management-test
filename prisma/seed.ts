/**
 * Seed script — date inițiale pentru HR Management.
 *
 * Usage: npm run seed
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { calculateStatus } from "../src/lib/documentStatus";
import { encrypt, hashSha256 } from "../src/lib/encryption";

const prisma = new PrismaClient();

const CNP_WEIGHTS = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];

function cnpChecksum(cnp12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = cnp12.charAt(i);
    if (!digit) throw new Error("Invalid CNP length");
    sum += Number.parseInt(digit, 10) * (CNP_WEIGHTS[i] ?? 0);
  }
  const rest = sum % 11;
  return rest < 10 ? rest : 1;
}

function generateCnp(
  sex: 1 | 2 | 5 | 6,
  year: number,
  month: number,
  day: number,
  county: number,
  seq: number,
): string {
  const yy = String(year).slice(-2).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const jj = String(county).padStart(2, "0");
  const nnn = String(seq).padStart(3, "0");
  const partial = `${sex}${yy}${mm}${dd}${jj}${nnn}`;
  const checksum = cnpChecksum(partial);
  return `${partial}${checksum}`;
}

const IBAN_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateIbanRo(): string {
  let body = "";
  for (let i = 0; i < 20; i++) {
    body += IBAN_CHARS[Math.floor(Math.random() * IBAN_CHARS.length)];
  }
  return `RO49${body}`;
}

const ADMIN_EMAIL = "admin@firma.local";
const rawSeedPassword = process.env.SEED_ADMIN_PASSWORD?.trim() ?? "";
if (rawSeedPassword.length < 8) {
  throw new Error(
    "SEED_ADMIN_PASSWORD trebuie setat în mediu (minim 8 caractere) înainte de seed. Exemplu: SEED_ADMIN_PASSWORD='...' npm run db:seed",
  );
}
const ADMIN_PASSWORD: string = rawSeedPassword;

const SEED_COUNTRIES = [
  { name: "România", code: "RO", phoneCode: "+40" },
  { name: "Germania", code: "DE", phoneCode: "+49" },
  { name: "Olanda", code: "NL", phoneCode: "+31" },
  { name: "Italia", code: "IT", phoneCode: "+39" },
];

/** Firme inițiale — legate de România */
const SEED_COMPANIES: {
  name: string;
  taxCode: string;
  address: string;
  countryCode: string;
}[] = [
  {
    name: "RomForce Detașări SRL",
    taxCode: "RO12345678",
    address: "Str. Victoriei nr. 10, Sector 1, București",
    countryCode: "RO",
  },
  {
    name: "EuroWork HR Solutions",
    taxCode: "RO87654321",
    address: "Str. Memorandumului nr. 45, Cluj-Napoca",
    countryCode: "RO",
  },
  {
    name: "BuildTeam Internațional",
    taxCode: "RO55443322",
    address: "Bld. Republicii nr. 22, Timișoara",
    countryCode: "RO",
  },
];

interface SeedEmployee {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bankName: string;
  address: string;
  city: string;
  countryCode: string;
  cnp: string;
  companyIndex: number;
  documents: {
    type: string;
    fileName: string;
    filePath: string;
    number: string;
    issueDate: Date;
    expiryDate: Date;
  }[];
  deployment: {
    country: string;
    city: string;
    startDate: Date;
    endDate: Date | null;
    status: string;
    notes: string;
  };
}

function buildSeedEmployees(): SeedEmployee[] {
  return [
    {
      firstName: "Ion",
      lastName: "Popescu",
      email: "ion.popescu@example.ro",
      phone: "0722123456",
      bankName: "Banca Transilvania",
      address: "Str. Lalelelor nr. 5, Bl. 3, Ap. 12",
      city: "București",
      countryCode: "RO",
      cnp: generateCnp(1, 1985, 3, 15, 40, 123),
      companyIndex: 0,
      documents: [
        {
          type: "CONTRACT",
          fileName: "contract_ion_popescu_2024.pdf",
          filePath: "uploads/contracts/contract_ion_popescu_2024.pdf",
          number: "CTR-RO-POP-2024-001",
          issueDate: new Date("2024-02-01"),
          expiryDate: new Date("2026-05-01"),
        },
        {
          type: "ID",
          fileName: "ci_ion_popescu_fata.jpg",
          filePath: "uploads/ids/ci_ion_popescu_fata.jpg",
          number: "CI-RX 123456",
          issueDate: new Date("2019-03-15"),
          expiryDate: new Date("2029-03-15"),
        },
      ],
      deployment: {
        country: "NL",
        city: "Amsterdam",
        startDate: new Date("2024-01-15"),
        endDate: new Date("2024-12-15"),
        status: "ACTIVE",
        notes: "Detașare construcții — proiect rezidențial Zuidas",
      },
    },
    {
      firstName: "Maria",
      lastName: "Ionescu",
      email: "maria.ionescu@example.ro",
      phone: "0733987654",
      bankName: "ING Bank",
      address: "Str. Trandafirilor nr. 12",
      city: "Cluj-Napoca",
      countryCode: "RO",
      cnp: generateCnp(2, 1990, 7, 22, 12, 456),
      companyIndex: 1,
      documents: [
        {
          type: "CONTRACT",
          fileName: "contract_maria_ionescu_2024.pdf",
          filePath: "uploads/contracts/contract_maria_ionescu_2024.pdf",
          number: "CTR-DE-ION-2024-88",
          issueDate: new Date("2024-03-10"),
          expiryDate: new Date("2026-12-31"),
        },
        {
          type: "ID",
          fileName: "ci_maria_ionescu_fata.jpg",
          filePath: "uploads/ids/ci_maria_ionescu_fata.jpg",
          number: "CI-RX 987654",
          issueDate: new Date("2021-06-01"),
          expiryDate: new Date("2031-06-01"),
        },
      ],
      deployment: {
        country: "DE",
        city: "München",
        startDate: new Date("2024-03-01"),
        endDate: null,
        status: "ACTIVE",
        notes: "Detașare logistică — depozit Amazon MUC3",
      },
    },
    {
      firstName: "Andrei",
      lastName: "Georgescu",
      email: "andrei.georgescu@example.ro",
      phone: "0744555777",
      bankName: "BRD — Groupe Société Générale",
      address: "Bld. Unirii nr. 8, Et. 4",
      city: "Timișoara",
      countryCode: "RO",
      cnp: generateCnp(1, 1988, 11, 3, 35, 789),
      companyIndex: 2,
      documents: [
        {
          type: "CONTRACT",
          fileName: "contract_andrei_georgescu_2024.pdf",
          filePath: "uploads/contracts/contract_andrei_georgescu_2024.pdf",
          number: "CTR-NL-GEO-2024-12",
          issueDate: new Date("2024-01-20"),
          expiryDate: new Date("2027-01-19"),
        },
        {
          type: "ID",
          fileName: "ci_andrei_georgescu_fata.jpg",
          filePath: "uploads/ids/ci_andrei_georgescu_fata.jpg",
          number: "CI-RX 456789",
          issueDate: new Date("2020-11-10"),
          expiryDate: new Date("2030-11-10"),
        },
      ],
      deployment: {
        country: "IT",
        city: "Milano",
        startDate: new Date("2024-06-10"),
        endDate: new Date("2025-06-10"),
        status: "ACTIVE",
        notes: "Detașare industrie textilă — zona Navigli",
      },
    },
  ];
}

async function main() {
  console.info("🌱 Seeding database...\n");

  const hashedPassword = await hashPassword(ADMIN_PASSWORD);

  const organization = await prisma.organization.upsert({
    where: { slug: "seed-demo-org" },
    update: { name: "Seed Organization" },
    create: {
      name: "Seed Organization",
      slug: "seed-demo-org",
      defaultLanguage: "ro",
    },
  });

  await prisma.settings.upsert({
    where: { organizationId: organization.id },
    create: {
      organizationId: organization.id,
      logoUrl: null,
      language: "en",
    },
    update: {},
  });

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: "Administrator",
      password: hashedPassword,
      role: "ORG_ADMIN",
      organizationId: organization.id,
      isActive: true,
    },
    create: {
      name: "Administrator",
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: "ORG_ADMIN",
      organizationId: organization.id,
      isActive: true,
    },
  });

  console.info(`[1/5] Admin: ${ADMIN_EMAIL}`);

  const countryByCode = new Map<string, { id: number; code: string }>();
  for (const c of SEED_COUNTRIES) {
    const row = await prisma.country.upsert({
      where: { code: c.code },
      update: { name: c.name, phoneCode: c.phoneCode },
      create: { name: c.name, code: c.code, phoneCode: c.phoneCode ?? null },
    });
    countryByCode.set(c.code, row);
    console.info(`[2/5] Țară: ${row.name} (${row.code})`);
  }

  const companies: { id: number; name: string }[] = [];
  for (const company of SEED_COMPANIES) {
    const cid = countryByCode.get(company.countryCode)?.id ?? null;
    const upserted = await prisma.company.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name: company.name,
        },
      },
      update: {
        taxCode: company.taxCode,
        address: company.address,
        countryId: cid,
        status: "Activ",
      },
      create: {
        organizationId: organization.id,
        name: company.name,
        taxCode: company.taxCode,
        address: company.address,
        countryId: cid,
        status: "Activ",
      },
    });
    companies.push(upserted);
    console.info(`[3/5] Firmă: ${upserted.name}`);
  }

  const seedEmployees = buildSeedEmployees();
  const defaultRoId = countryByCode.get("RO")?.id;

  for (const emp of seedEmployees) {
    const iban = generateIbanRo();
    const cnpEncrypted = encrypt(emp.cnp);
    const cnpHash = hashSha256(emp.cnp);
    const ibanEncrypted = encrypt(iban);
    const ibanHash = hashSha256(iban);

    const company = companies[emp.companyIndex];
    if (!company) continue;

    const countryId =
      countryByCode.get(emp.countryCode)?.id ?? defaultRoId ?? null;

    const employee = await prisma.employee.upsert({
      where: {
        organizationId_cnp: {
          organizationId: organization.id,
          cnp: emp.cnp,
        },
      },
      update: {
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone,
        iban: ibanEncrypted,
        ibanHash,
        bankName: emp.bankName,
        address: emp.address,
        city: emp.city,
        countryId,
        companyId: company.id,
      },
      create: {
        organizationId: organization.id,
        cnp: emp.cnp,
        cnpEncrypted,
        cnpHash,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone,
        iban: ibanEncrypted,
        ibanHash,
        bankName: emp.bankName,
        address: emp.address,
        city: emp.city,
        countryId,
        companyId: company.id,
      },
    });

    console.info(`[4/5] Angajat: ${emp.firstName} ${emp.lastName}`);

    if (emp.documents?.length) {
      for (const doc of emp.documents) {
        const existing = await prisma.document.findFirst({
          where: { employeeId: employee.id, type: doc.type },
        });
        if (!existing) {
          const status = calculateStatus(doc.expiryDate);
          await prisma.document.create({
            data: {
              organizationId: organization.id,
              type: doc.type,
              fileName: doc.fileName,
              employeeId: employee.id,
              storagePath: `/documents/${doc.type}_${employee.id}.pdf`,
              fileSize: doc.type === "ID" ? 2048 : 102400,
              mimeType: doc.type === "ID" ? "image/jpeg" : "application/pdf",
              status,
              number: doc.number,
              issueDate: doc.issueDate,
              expiryDate: doc.expiryDate,
            },
          });
        }
      }
    }

    if (emp.deployment) {
      const existingDep = await prisma.deployment.findFirst({
        where: { employeeId: employee.id, country: emp.deployment.country },
      });
      if (!existingDep) {
        await prisma.deployment.create({
          data: {
            employeeId: employee.id,
            country: emp.deployment.country,
            city: emp.deployment.city,
            startDate: emp.deployment.startDate,
            endDate: emp.deployment.endDate,
            status: emp.deployment.status,
            notes: emp.deployment.notes,
          },
        });
      }
    }
  }

  console.info("\n✅ Seeding complet!");
  console.info(`   Login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
