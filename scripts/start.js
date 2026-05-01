#!/usr/bin/env node
/**
 * Script pornire producție — HR Management.
 *
 * Ce face:
 *   1. Verifică pre-requisuri: Node.js >= 20, folder data/ există
 *   2. Verifică .env — cheile ENCRYPTION_KEY și JWT_SECRET
 *   3. Creează foldere lipsă
 *   4. Verifică baza de date există
 *   5. Pornește aplicația Next.js
 *
 * Usage:
 *   npm start              — producție (next start)
 *   npm start -- --dev     — dezvoltare (next dev)
 *
 * Backup automat:
 *   Dacă BACKUP_AUTO=true în .env, creează backup la fiecare BACKUP_INTERVAL_MS
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

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

function logHeader(msg) {
  log(`\n${COLORS.cyan}${COLORS.bold}▶ ${msg}${COLORS.reset}`);
}

function logOK(msg) {
  log(`  ✓ ${msg}`, "green");
}

function logWARN(msg) {
  log(`  ⚠ ${msg}`, "yellow");
}

function logERR(msg) {
  log(`  ✗ ${msg}`, "red");
}

const isDev = process.argv.includes("--dev");

// ══════════════════════════════════════════════════════════════════════════════
// Banner
// ══════════════════════════════════════════════════════════════════════════════

log(`
${COLORS.cyan}${COLORS.bold}
  ╔═══════════════════════════════════════════════════╗
  ║          HR MANAGEMENT — Sistem Local             ║
  ║                                                   ║
  ║  Gestionează angajați, documente și detașări    ║
  ║  Datele rămân în rețeaua companiei               ║
  ╚═══════════════════════════════════════════════════╝
${COLORS.reset}`);

// ══════════════════════════════════════════════════════════════════════════════
// 1. Verifică Node.js >= 20
// ══════════════════════════════════════════════════════════════════════════════

logHeader("Verificare mediu");

const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0], 10);

if (majorVersion < 20) {
  logERR(`Node.js ${nodeVersion} — necesar >= 20`);
  process.exit(1);
}
logOK(`Node.js ${nodeVersion}`);

// ══════════════════════════════════════════════════════════════════════════════
// 2. Verifică .env
// ══════════════════════════════════════════════════════════════════════════════

const envPath = path.join(CWD, ".env");
if (!fs.existsSync(envPath)) {
  logERR("Fișier .env lipsește!");
  log("  Rulează mai întâi: npm run setup");
  process.exit(1);
}

require("dotenv").config({ path: envPath });

// Verifică chei
const encKey = process.env.ENCRYPTION_KEY;
const jwtSecret = process.env.JWT_SECRET;

if (!encKey || encKey.length !== 64) {
  logERR("ENCRYPTION_KEY invalidă (trebuie 64 caractere hex)");
  log("  Rulează: npm run setup");
  process.exit(1);
}
logOK("ENCRYPTION_KEY validă");

if (!jwtSecret || jwtSecret.length < 32) {
  logERR("JWT_SECRET prea scurt (min 32 caractere)");
  log("  Rulează: npm run setup");
  process.exit(1);
}
logOK("JWT_SECRET valid");

// ══════════════════════════════════════════════════════════════════════════════
// 3. Creare foldere
// ══════════════════════════════════════════════════════════════════════════════

logHeader("Verificare structură directoare");

const dirs = [
  path.join(CWD, "data"),
  path.join(CWD, "data", "documents"),
  path.join(CWD, "data", "backups"),
  path.join(CWD, "data", "reports"),
  path.join(CWD, "data", "settings"),
  path.join(CWD, "data", "imports"),
  path.join(CWD, "data", "temp"),
];

let created = 0;
for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    created++;
  }
}
logOK(`${dirs.length} directoare (${created} create)`);

// ══════════════════════════════════════════════════════════════════════════════
// 4. Verificare bază de date
// ══════════════════════════════════════════════════════════════════════════════

logHeader("Verificare bază de date");

const dbPath = path.join(CWD, "data", "app.db");
if (!fs.existsSync(dbPath)) {
  logWARN("Baza de date nu există. Este necesar un setup.");
  log("  Rulează: npm run setup");
  process.exit(1);
}

const dbSize = fs.statSync(dbPath).size;
logOK(`SQLite: data/app.db (${formatBytes(dbSize)})`);

// ══════════════════════════════════════════════════════════════════════════════
// 5. Pornire aplicație
// ══════════════════════════════════════════════════════════════════════════════

logHeader("Pornire aplicație");

const port = process.env.PORT || "3000";
const host = process.env.HOST || "0.0.0.0";
const mode = isDev ? "dezvoltare" : "producție";

log(`  Mod: ${COLORS.bold}${mode}${COLORS.reset}`);
log(`  Host: ${host}:${port}`);

// Comandă Next.js
const cmd = isDev ? "next" : "next";
const args = isDev ? ["dev", "-p", port, "-H", host] : ["start", "-p", port, "-H", host];

// Backup automat (opțional) — via cron / Task Scheduler
const backupAuto = process.env.BACKUP_AUTO === "true";
if (!isDev && backupAuto) {
  logWARN("Backup automat activat — configurează cron sau Task Scheduler");
  log("  Exemplu: 0 2 * * * curl -X POST http://localhost:3000/api/backup/create");
}

log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
log(`  Aplicația rulează la:`, "bold");
log(`  http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// Pornește Next.js
const child = spawn(cmd, args, {
  cwd: CWD,
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

// ══════════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════════

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDuration(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h${minutes > 0 ? ` ${minutes}m` : ""}`;
  return `${minutes}m`;
}
