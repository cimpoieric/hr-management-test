/**
 * Subset Roboto TTFs pentru jsPDF: p?streaz? latin + extins (RO) + punctua?ie frecvent?.
 * Ruleaz?: node scripts/subset-pdf-fonts.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const fontsDir = path.join(root, "assets", "fonts");

function rangeChars(start, end) {
  let s = "";
  for (let cp = start; cp <= end; cp++) s += String.fromCodePoint(cp);
  return s;
}

/** Glyphs folosite �n PDF-uri HR (RO + EU + tabele). */
const subsetText = [
  rangeChars(0x0020, 0x007e),
  rangeChars(0x00a0, 0x00ff),
  rangeChars(0x0100, 0x017f),
  "�?��",
  "���",
  "�������",
  "�???",
  "????",
].join("");

const files = ["Roboto-Regular.ttf", "Roboto-Bold.ttf", "Roboto-Italic.ttf"];

for (const name of files) {
  const fp = path.join(fontsDir, name);
  if (!fs.existsSync(fp)) {
    console.warn("[subset-pdf-fonts] Missing:", fp);
    continue;
  }
  const input = fs.readFileSync(fp);
  const out = await subsetFont(input, subsetText, { targetFormat: "truetype" });
  const backup = `${fp}.pre-subset.bak`;
  if (!fs.existsSync(backup)) fs.copyFileSync(fp, backup);
  fs.writeFileSync(fp, out);
  const before = input.length;
  const after = out.length;
  console.log(
    `[subset-pdf-fonts] ${name}: ${(before / 1024).toFixed(1)} KB ? ${(after / 1024).toFixed(1)} KB`,
  );
}
