/**
 * Copiaz? apoi ?terge foldere de rute (Windows: rename poate da EPERM).
 * Ruleaz? din r?d?cina proiectului: node scripts/rename-routes.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dash = path.join(__dirname, "..", "src", "app", "(dashboard)");

function moveDir(fromRel, toRel) {
  const from = path.join(dash, fromRel);
  const to = path.join(dash, toRel);
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

moveDir("documente", "documents");
moveDir("detasari", "deployments");
moveDir("importuri", "imports");

const imp = path.join(dash, "import");
const importsDir = path.join(dash, "imports");
if (fs.existsSync(imp)) {
  for (const sub of ["manual", "email"]) {
    const src = path.join(imp, sub);
    const dst = path.join(importsDir, sub);
    if (!fs.existsSync(src)) continue;
    if (fs.existsSync(dst)) {
      console.warn("imports/", sub, "exists, merging files");
      for (const f of fs.readdirSync(src)) {
        fs.cpSync(path.join(src, f), path.join(dst, f), { force: true });
      }
      fs.rmSync(src, { recursive: true, force: true });
    } else {
      fs.cpSync(src, dst, { recursive: true });
      fs.rmSync(src, { recursive: true, force: true });
    }
    console.log("moved import/", sub, "-> imports/", sub);
  }
  fs.rmSync(imp, { recursive: true, force: true });
}

moveDir("importuri-in-asteptare", path.join("imports", "pending"));
moveDir("panou-de-control", "dashboard");
moveDir("plata", "pay");
moveDir("rapoarte", "reports");
moveDir("setari", "settings");
moveDir("utilizatori", "users");
moveDir(path.join("settings", "firme"), path.join("settings", "companies"));
moveDir(path.join("settings", "tari"), path.join("settings", "countries"));

console.log("rename-routes done");
