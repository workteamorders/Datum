// Fails when interface copy uses words Datum must never use (docs/DECISIONS.md, honesty rules).
// Scans source under src/ and public/. A line may opt out with "copy-ignore: <reason>".
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const base = new URL("..", import.meta.url).pathname;
const BANNED = /\b(safe|safer|safest|safety|verified|verify|verifies|secure|secured|securely|trusted|trustworthy|audited|audit|legit|legitimate|rug-?proof|guaranteed|guarantee|guarantees|score|scores|scored)\b/i;
const problems = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|css|html|md|txt)$/.test(name)) check(p);
  }
}

function check(file) {
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (line.includes("copy-ignore")) return;
    const m = line.match(BANNED);
    if (m) problems.push(`${relative(base, file)}:${i + 1}: "${m[0]}": ${line.trim()}`);
  });
}

for (const d of ["src", "public"]) {
  try { walk(join(base, d)); } catch { /* folder may not exist yet */ }
}
if (problems.length) {
  console.error("Banned wording:\n" + problems.join("\n"));
  process.exit(1);
}
console.log("copy:check ok");
