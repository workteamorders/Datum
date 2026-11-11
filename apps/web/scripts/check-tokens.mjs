// Fails when a raw colour appears outside src/styles/tokens.css.
// A line may opt out with "tokens-ignore: <reason>".
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../src", import.meta.url).pathname;
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const FN = /\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(/;
const NAMED = /:\s*(?:white|black|red|green|blue|gray|grey|orange|yellow|purple|teal|magenta)\b/i;
const problems = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(css|tsx?)$/.test(name)) check(p);
  }
}

function check(file) {
  const rel = relative(root, file);
  if (rel === "styles/tokens.css") return;
  // Palette documentation in the styleguide prints hex values as text on purpose.
  const docs = rel.startsWith("app/styleguide/");
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (line.includes("tokens-ignore")) return;
    const isCss = file.endsWith(".css");
    const hit = (HEX.test(line) || FN.test(line) || (isCss && NAMED.test(line)));
    if (!hit) return;
    if (docs && !/(style=|fill=|stroke=)/.test(line)) return;
    problems.push(`${rel}:${i + 1}: ${line.trim()}`);
  });
}

walk(root);
if (problems.length) {
  console.error("Raw colour outside tokens.css:\n" + problems.join("\n"));
  process.exit(1);
}
console.log("check:tokens ok");
