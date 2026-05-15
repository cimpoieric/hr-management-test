#!/usr/bin/env node
/**
 * Script setup — pregătește aplicația HR Management pentru prima rulare.
 *
 * Ce face:
 *   1. Verifică Node.js >= 20
 *   2. Verifică existența .env (copiază din .env.example dacă lipsește)
 *   3. Generează ENCRYPTION_KEY și JWT_SECRET dacă sunt "CHANGE_ME" sau goale
 *   4. Creează structura de directoare
 *   5. Rulează Prisma generate + db push
 *   6. Rulează seed (opțional)
 *
 * Usage: npm run setup
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const CWD = process.cwd();
const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

function log(msg, color = "reset") {
  console.log(`${COLORS[color]}${msg}${COLORS.reset}`);
}

function logStep(n, msg) {
  console.log(
    `\n${COLORS.cyan}${COLORS.bold}[${n}/6]${COLORS.reset} ${COLORS.bold}${msg}${COLORS.reset}`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. Verifică Node.js >= 20
// ══════════════════════════════════════════════════════════════════════════════

logStep(1, "Verificare Node.js");
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0], 10);

if (majorVersion < 20) {
  log(`  Node.js ${nodeVersion} detectat. Este necesar >= 20.`, "red");
  process.exit(1);
}
log(`  Node.js ${nodeVersion} ✓`, "green");

// ══════════════════════════════════════════════════════════════════════════════
// 2. Verifică / Creează .env
// ══════════════════════════════════════════════════════════════════════════════

logStep(2, "Verificare fișier .env");

const envPath = path.join(CWD, ".env");
const envExamplePath = path.join(CWD, ".env.example");
let envContent = "";

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    log("  .env copiat din .env.example", "green");
  } else {
    log("  .env.example nu există. Creez .env de bază.", "yellow");
    fs.writeFileSync(envPath, "", "utf8");
  }
}

envContent = fs.readFileSync(envPath, "utf8");

// ══════════════════════════════════════════════════════════════════════════════
// 3. Generează chei secrete
// ══════════════════════════════════════════════════════════════════════════════

logStep(3, "Generare chei secrete");

let modified = false;

// ENCRYPTION_KEY (hex, 64 caractere = 32 bytes)
const placeholderKeys = [
  "CHANGE_ME",
  "genereaza_o_cheie_hex_de_64_caractere_aici",
  "schimba-acesta-cu-un-secret-puternic",
  "FALLBACK_SECRET",
];

function isPlaceholder(val) {
  if (!val) return true;
  const trimmed = val.trim().replace(/^["']|["']$/g, "");
  if (trimmed.length < 32) return true;
  return placeholderKeys.some((p) => trimmed.includes(p));
}

function setEnvVar(key, value) {
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${key}="${value}"`);
  } else {
    envContent += `\n${key}="${value}"\n`;
  }
  modified = true;
}

// ENCRYPTION_KEY
const currentEncKey = envContent.match(/^ENCRYPTION_KEY="(.+)"$/m)?.[1];
if (isPlaceholder(currentEncKey)) {
  const newKey = crypto.randomBytes(32).toString("hex");
  setEnvVar("ENCRYPTION_KEY", newKey);
  log("  ENCRYPTION_KEY generată (64 hex chars)", "green");
} else {
  log("  ENCRYPTION_KEY validă ✓", "green");
}

// JWT_SECRET
const currentJwtSecret = envContent.match(/^JWT_SECRET="(.+)"$/m)?.[1];
if (isPlaceholder(currentJwtSecret)) {
  const newSecret = crypto.randomBytes(64).toString("base64");
  setEnvVar("JWT_SECRET", newSecret);
  log("  JWT_SECRET generată (64 bytes base64)", "green");
} else {
  log("  JWT_SECRET validă ✓", "green");
}

// DATABASE_URL — SQLite: cale relativă la folderul prisma/ (schema.prisma)
if (!/^DATABASE_URL=/m.test(envContent)) {
  setEnvVar("DATABASE_URL", "file:../data/app.db");
}

// Salvează .env dacă a fost modificat
if (modified) {
  fs.writeFileSync(envPath, envContent, "utf8");
  log("  .env actualizat cu chei noi", "green");
  log("\n  ⚠️  IMPORTANT: Salvează .env într-un loc sigur!", "yellow");
  log(
    "  Dacă pierzi ENCRYPTION_KEY, datele criptate (CNP, IBAN) sunt pierdute definitiv.",
    "yellow",
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. Creează structura de directoare
// ══════════════════════════════════════════════════════════════════════════════

logStep(4, "Creare structură directoare");

const dirs = [
  path.join(CWD, "data"),
  path.join(CWD, "data", "documents"),
  path.join(CWD, "data", "backups"),
  path.join(CWD, "data", "reports"),
  path.join(CWD, "data", "settings"),
  path.join(CWD, "data", "imports"),
  path.join(CWD, "data", "temp"),
];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`  Creat: ${path.relative(CWD, dir)}`, "green");
  } else {
    log(`  Exista: ${path.relative(CWD, dir)}`, "dim");
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. Prisma generate + db push
// ══════════════════════════════════════════════════════════════════════════════

logStep(5, "Configurare bază de date (Prisma)");

try {
  log("  prisma generate...", "dim");
  execSync("npx prisma generate", { stdio: "inherit", cwd: CWD });

  log("  prisma db push...", "dim");
  execSync("npx prisma db push --accept-data-loss", {
    stdio: "inherit",
    cwd: CWD,
  });

  log("  Bază de date sincronizată ✓", "green");
} catch (error) {
  log("  Eroare la configurarea bazei de date:", "red");
  log(`  ${error.message}`, "red");
  process.exit(1);
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. Seed (opțional)
// ══════════════════════════════════════════════════════════════════════════════

logStep(6, "Seed date inițiale");

const dbPath = path.join(CWD, "data", "app.db");
if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0) {
  log("  Baza de date e goală. Se rulează seed...", "yellow");
  try {
    const preset = (process.env.SEED_ADMIN_PASSWORD ?? "").trim();
    const seedAdminPassword =
      preset.length >= 8
        ? preset
        : crypto.randomBytes(18).toString("base64url");
    execSync("npx tsx prisma/seed.ts", {
      stdio: "inherit",
      cwd: CWD,
      env: { ...process.env, SEED_ADMIN_PASSWORD: seedAdminPassword },
    });
    log("  Seed complet ✓", "green");
    if (preset.length >= 8) {
      log(
        "  Admin: admin@firma.local — folosit SEED_ADMIN_PASSWORD din mediu (parola nu e afișată).",
        "dim",
      );
    } else {
      log(
        "  Salvează parola admin (nu va mai fi afișată): admin@firma.local",
        "yellow",
      );
      log(`  → ${seedAdminPassword}`, "yellow");
    }
  } catch (error) {
    log("  Eroare la seed (poți rula manual: npm run db:seed)", "red");
  }
} else {
  log("  Baza de date există. Skip seed.", "dim");
}

// ══════════════════════════════════════════════════════════════════════════════
// Final
// ══════════════════════════════════════════════════════════════════════════════

log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "green");
log("  Setup complet! Aplicația e gata de pornire.", "green");
log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "green");
log("\nComenzi disponibile:", "bold");
log("  npm run dev      — mod dezvoltare (cu hot reload)");
log("  npm run build    — build de producție");
log("  npm start        — pornire producție");
log("\nCont admin (după seed):", "bold");
log("  Email: admin@firma.local");
log(
  "  Parola: cea afișată la pasul seed, sau setează SEED_ADMIN_PASSWORD înainte de npm run setup",
  "dim",
);
log("\n", "reset");
