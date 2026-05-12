#!/usr/bin/env node
/**
 * Curățare finală înainte de livrare/vânzare.
 *
 * Usage (din rădăcina proiectului): node scripts/final-cleanup.js
 * sau: npm run final-cleanup
 */

"use strict";

const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const SKIP_DIR_NAMES = new Set(["node_modules", ".git"]);

function humanBytes(n) {
  const x = Number(n) || 0;
  if (x < 1024) return `${x} B`;
  if (x < 1024 ** 2) return `${(x / 1024).toFixed(2)} KB`;
  if (x < 1024 ** 3) return `${(x / 1024 ** 2).toFixed(2)} MB`;
  return `${(x / 1024 ** 3).toFixed(2)} GB`;
}

function safeStat(p) {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}

function fileSize(p) {
  const st = safeStat(p);
  return st && st.isFile() ? st.size : 0;
}

function dirTreeSize(dirPath) {
  const st = safeStat(dirPath);
  if (!st) return 0;
  if (st.isFile()) return st.size;
  if (!st.isDirectory()) return 0;
  let total = 0;
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const child = path.join(dirPath, e.name);
    if (e.isDirectory()) total += dirTreeSize(child);
    else total += fileSize(child);
  }
  return total;
}

function walkLogFiles(dir, out) {
  if (!fs.existsSync(dir)) return;
  const base = path.basename(dir);
  if (SKIP_DIR_NAMES.has(base)) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkLogFiles(p, out);
    else if (e.isFile() && e.name.endsWith(".log")) out.push(p);
  }
}

function isPublicTempFile(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".tmp") || lower.endsWith(".temp")) return true;
  if (name.endsWith("~")) return true;
  if (name === ".DS_Store" || name === "Thumbs.db") return true;
  return false;
}

function walkPublicTempFiles(dir, out) {
  if (!fs.existsSync(dir)) return;
  const st = safeStat(dir);
  if (!st || !st.isDirectory()) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkPublicTempFiles(p, out);
    else if (e.isFile() && isPublicTempFile(e.name)) out.push(p);
  }
}

function rmPath(p, label) {
  if (!fs.existsSync(p)) return 0;
  const before = dirTreeSize(p);
  try {
    fs.rmSync(p, { recursive: true, force: true });
    console.log(`  șters: ${label} (${humanBytes(before)})`);
    return before;
  } catch (err) {
    console.error(`  eroare la ${label}:`, err.message);
    return 0;
  }
}

function unlinkFile(p, label) {
  if (!fs.existsSync(p)) return 0;
  const before = fileSize(p);
  try {
    fs.unlinkSync(p);
    console.log(`  șters: ${label} (${humanBytes(before)})`);
    return before;
  } catch (err) {
    console.error(`  eroare la ${label}:`, err.message);
    return 0;
  }
}

function main() {
  console.log("Curățare finală — HR Management\n");
  console.log(`Rădăcină proiect: ${projectRoot}\n`);

  let freed = 0;

  // 1) .next/
  const nextDir = path.join(projectRoot, ".next");
  console.log("[1] Director build Next.js (.next/)");
  freed += rmPath(nextDir, ".next/");

  // 2) *.log (în tot proiectul, fără node_modules / .git)
  console.log("\n[2] Fișiere *.log");
  const logs = [];
  walkLogFiles(projectRoot, logs);
  for (const p of logs) {
    const rel = path.relative(projectRoot, p);
    freed += unlinkFile(p, rel);
  }
  if (logs.length === 0) console.log("  (niciun fișier .log)");

  // 3) prisma/*.db-journal, prisma/*.backup
  console.log("\n[3] prisma/*.db-journal, prisma/*.backup");
  const prismaDir = path.join(projectRoot, "prisma");
  if (!fs.existsSync(prismaDir)) {
    console.log("  (director prisma/ lipsește)");
  } else {
    const names = fs.readdirSync(prismaDir);
    let n = 0;
    for (const name of names) {
      if (name.endsWith(".db-journal") || name.endsWith(".backup")) {
        const p = path.join(prismaDir, name);
        const st = safeStat(p);
        if (st && st.isFile()) {
          freed += unlinkFile(p, path.join("prisma", name));
          n++;
        }
      }
    }
    if (n === 0) console.log("  (niciun fișier .db-journal / .backup)");
  }

  // 4) Temporare în public/
  console.log("\n[4] Fișiere temporare în public/");
  const publicDir = path.join(projectRoot, "public");
  const pubTemps = [];
  walkPublicTempFiles(publicDir, pubTemps);
  for (const p of pubTemps) {
    const rel = path.relative(projectRoot, p);
    freed += unlinkFile(p, rel);
  }
  if (!fs.existsSync(publicDir)) {
    console.log("  (director public/ lipsește — nimic de șters)");
  } else if (pubTemps.length === 0) {
    console.log("  (niciun fișier temporar recunoscut)");
  }

  console.log(`\nSpațiu eliberat (estimat): ${humanBytes(freed)}`);
  console.log("\nGata.\n");
}

main();
