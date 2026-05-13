/**
 * Mut? foldere API (Windows-safe: copy + rm).
 * Ruleaz?: node scripts/restructure-api.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const api = path.join(__dirname, "..", "src", "app", "api");

function moveDir(fromRel, toRel) {
  const from = path.join(api, fromRel);
  const to = path.join(api, toRel);
  if (!fs.existsSync(from)) {
    console.warn("skip missing:", fromRel);
    return;
  }
  if (fs.existsSync(to)) {
    console.warn("skip target exists:", toRel);
    return;
  }
  fs.cpSync(from, to, { recursive: true });
  fs.rmSync(from, { recursive: true, force: true });
  console.log("moved", fromRel, "->", toRel);
}

moveDir("timesheets", "attendance");
moveDir("payslips", "payroll");

const org = path.join(api, "organization");
if (!fs.existsSync(org)) fs.mkdirSync(org, { recursive: true });
moveDir("companies", path.join("organization", "companies"));
moveDir("countries", path.join("organization", "countries"));

const flSend = path.join(api, "fluturasi", "send-email");
const paySend = path.join(api, "payroll", "send-email");
if (fs.existsSync(flSend) && !fs.existsSync(paySend)) {
  fs.cpSync(flSend, paySend, { recursive: true });
  fs.rmSync(path.join(api, "fluturasi"), { recursive: true, force: true });
  console.log("moved fluturasi/send-email -> payroll/send-email");
} else if (fs.existsSync(path.join(api, "fluturasi"))) {
  fs.rmSync(path.join(api, "fluturasi"), { recursive: true, force: true });
  console.log("removed empty fluturasi (send-email skipped)");
}

console.log("api restructure done");
