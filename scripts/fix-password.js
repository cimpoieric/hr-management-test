#!/usr/bin/env node
/**
 * Resetează parola unui utilizator după email (utilitar local, fără valori hardcodate).
 *
 * Usage (PowerShell):
 *   $env:FIX_USER_EMAIL="admin@firma.local"
 *   $env:FIX_NEW_PASSWORD="ParolaTaSigura!"
 *   node scripts/fix-password.js
 */
"use strict";

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const email = (process.env.FIX_USER_EMAIL ?? "").trim().toLowerCase();
const plain = process.env.FIX_NEW_PASSWORD ?? "";
const requireChange =
  (process.env.FIX_REQUIRE_CHANGE ?? "true").trim().toLowerCase() !== "false";

if (!email || !plain || plain.length < 6) {
  console.error(
    "Setează FIX_USER_EMAIL și FIX_NEW_PASSWORD (minim 6 caractere), apoi rulează din nou.",
  );
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash(plain, 12);
  const result = await prisma.user.updateMany({
    where: { email },
    data: {
      password: hash,
      mustChangePassword: requireChange,
    },
  });
  if (result.count === 0) {
    console.error(`Nu există utilizator cu email: ${email}`);
    process.exit(1);
  }
  console.log(`Parolă actualizată pentru: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
