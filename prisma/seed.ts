/**
 * Seed script — date inițiale pentru HR Management.
 *
 * Creează:
 *   1. Utilizator admin default
 *   2. 3 firme de test
 *   3. 3 angajați români cu CNP-uri valide, IBAN-uri RO, date criptate
 *   4. Documente per angajat (CONTRACT, ID)
 *   5. Detașări per angajat (Olanda, Germania, Italia)
 *
 * Idempotent: folosește upsert (CNP unique) și findFirst → create (documente/detașări).
 * Usage: npm run seed
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { encrypt, hashSha256 } from "../src/lib/encryption";

const prisma = new PrismaClient();

// ─── CNP Validator & Generator ───────────────────────────────────────────────

const CNP_WEIGHTS = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];

function cnpChecksum(cnp12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = cnp12.charAt(i);
    if (!digit) throw new Error("Invalid CNP length");
    sum += parseInt(digit, 10) * (CNP_WEIGHTS[i] ?? 0);
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
  seq: number
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

// ─── IBAN Generator ──────────────────────────────────────────────────────────

const IBAN_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateIbanRo(): string {
  let body = "";
  for (let i = 0; i < 20; i++) {
    body += IBAN_CHARS[Math.floor(Math.random() * IBAN_CHARS.length)];
  }
  return `RO49${body}`;
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

const ADMIN_EMAIL = "admin@firma.local";
const ADMIN_PASSWORD = "AdminTemp123!";

const SEED_COMPANIES = [
  { name: "RomForce Detașări SRL", cui: "RO12345678", city: "București", address: "Str. Victoriei nr. 10, Sector 1" },
  { name: "EuroWork HR Solutions", cui: "RO87654321", city: "Cluj-Napoca", address: "Str. Memorandumului nr. 45" },
  { name: "BuildTeam Internațional", cui: "RO55443322", city: "Timișoara", address: "Bld. Republicii nr. 22" },
];

interface SeedEmployee {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bankName: string;
  address: string;
  city: string;
  country: string;
  cnp: string;
  companyIndex: number;
  documents: { type: string; fileName: string; filePath: string }[];
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
      country: "RO",
      cnp: generateCnp(1, 1985, 3, 15, 40, 123),
      companyIndex: 0,
      documents: [
        { type: "CONTRACT", fileName: "contract_ion_popescu_2024.pdf", filePath: "uploads/contracts/contract_ion_popescu_2024.pdf" },
        { type: "ID", fileName: "ci_ion_popescu_fata.jpg", filePath: "uploads/ids/ci_ion_popescu_fata.jpg" },
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
      country: "RO",
      cnp: generateCnp(2, 1990, 7, 22, 12, 456),
      companyIndex: 1,
      documents: [
        { type: "CONTRACT", fileName: "contract_maria_ionescu_2024.pdf", filePath: "uploads/contracts/contract_maria_ionescu_2024.pdf" },
        { type: "ID", fileName: "ci_maria_ionescu_fata.jpg", filePath: "uploads/ids/ci_maria_ionescu_fata.jpg" },
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
      country: "RO",
      cnp: generateCnp(1, 1988, 11, 3, 35, 789),
      companyIndex: 2,
      documents: [
        { type: "CONTRACT", fileName: "contract_andrei_georgescu_2024.pdf", filePath: "uploads/contracts/contract_andrei_georgescu_2024.pdf" },
        { type: "ID", fileName: "ci_andrei_georgescu_fata.jpg", filePath: "uploads/ids/ci_andrei_georgescu_fata.jpg" },
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

// ─── Main Seed ───────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding database...\n");

  // ─── 1. Admin User ──────────────────────────────────────────────────
  console.log("[1/4] Utilizator admin...");

  const hashedPassword = await hashPassword(ADMIN_PASSWORD);

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: "Administrator",
      password: hashedPassword,
      role: "ADMIN",
      isActive: true,
    },
    create: {
      name: "Administrator",
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log(`   ✓ ${ADMIN_EMAIL}`);

  // ─── 2. Companies ───────────────────────────────────────────────────
  console.log("\n[2/4] Firme...");

  const companies: { id: number; name: string }[] = [];

  for (const company of SEED_COMPANIES) {
    const upserted = await prisma.company.upsert({
      where: { cui: company.cui },
      update: company,
      create: company,
    });
    companies.push(upserted);
    console.log(`   ✓ ${upserted.name}`);
  }

  // ─── 3. Employees ───────────────────────────────────────────────────
  console.log("\n[3/4] Angajați (CNP criptat + IBAN criptat)...");

  const seedEmployees = buildSeedEmployees();

  for (const emp of seedEmployees) {
    if (!emp) continue;

    // Generare IBAN
    const iban = generateIbanRo();

    // Criptare + hash date sensibile
    const cnpEncrypted = encrypt(emp.cnp);
    const cnpHash      = hashSha256(emp.cnp);
    const ibanEncrypted = encrypt(iban);
    const ibanHash     = hashSha256(iban);

    // Upsert angajat (CNP este unique → idempotent)
    const company = companies[emp.companyIndex];
    if (!company) {
      console.error(`   ✗ ${emp.firstName} ${emp.lastName} — Company not found at index ${emp.companyIndex}`);
      continue;
    }

    const employee = await prisma.employee.upsert({
      where: { cnp: emp.cnp },
      update: {
        firstName: emp.firstName,
        lastName:  emp.lastName,
        email:     emp.email,
        phone:     emp.phone,
        iban:      ibanEncrypted,
        ibanHash,
        bankName:  emp.bankName,
        address:   emp.address,
        city:      emp.city,
        country:   emp.country,
        companyId: company.id,
      },
      create: {
        cnp:           emp.cnp,
        cnpEncrypted,
        cnpHash,
        firstName:     emp.firstName,
        lastName:      emp.lastName,
        email:         emp.email,
        phone:         emp.phone,
        iban:          ibanEncrypted,
        ibanHash,
        bankName:      emp.bankName,
        address:       emp.address,
        city:          emp.city,
        country:       emp.country,
        companyId:     company.id,
      },
    });

    console.log(`   ✓ ${emp.firstName} ${emp.lastName}`);
    console.log(`     CNP:  ${emp.cnp} (valid)`);
    console.log(`     IBAN: ${iban}`);

    // ─── 4. Documente (idempotent via findFirst) ──────────────────────
    if (emp.documents && Array.isArray(emp.documents)) {
      for (const doc of emp.documents) {
        if (!doc) continue;
        const existing = await prisma.document.findFirst({
          where: { employeeId: employee.id, type: doc.type },
        });
        if (!existing) {
          await prisma.document.create({
            data: {
              type: doc.type,
              fileName: doc.fileName,
              employeeId: employee.id,
              storagePath: `/documents/${doc.type}_${employee.id}.pdf`,
              fileSize: 1024,
              mimeType: "application/pdf",
              status: "VALID",
            },
          });
        }
      }
      console.log(`     📄 ${emp.documents.map((d) => d.type).join(", ")}`);
    }

    // ─── 5. Deployment (idempotent via findFirst) ─────────────────────
    if (emp.deployment) {
      const existingDep = await prisma.deployment.findFirst({
        where: { employeeId: employee.id, country: emp.deployment.country },
      });
      if (!existingDep) {
        await prisma.deployment.create({
          data: {
            employeeId: employee.id,
            country:    emp.deployment.country,
            city:       emp.deployment.city,
            startDate:  emp.deployment.startDate,
            endDate:    emp.deployment.endDate,
            status:     emp.deployment.status,
            notes:      emp.deployment.notes,
          },
        });
      }
      console.log(`     🌍 ${emp.deployment.country} — ${emp.deployment.city}`);
    }
  }

  // ─── Summary ────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Seeding complet!\n");
  console.log(`   Utilizatori: ${await prisma.user.count()}`);
  console.log(`   Firme:       ${await prisma.company.count()}`);
  console.log(`   Angajați:    ${await prisma.employee.count()}`);
  console.log(`   Documente:   ${await prisma.document.count()}`);
  console.log(`   Detașări:    ${await prisma.deployment.count()}`);
  console.log(`\n🔐 Login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log("\n⚠️  Schimbă parola admin după primul login!");
  console.log("\n💡 Verificare:");
  console.log("   npx prisma studio     → GUI vizual");
  console.log("   sqlite3 data/app.db   → CLI direct");
}

main()
  .catch((error) => {
    console.error("\n❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

