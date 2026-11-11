import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
const tokens = new Map([...css.matchAll(/(--[\w-]+):\s*(#[\da-f]{6}|var\(--[\w-]+\));/gi)]
  .map(([, name, value]) => [name, value]));

function channels(name) {
  const value = tokens.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  if (value.startsWith("var(")) return channels(value.slice(4, -1));
  return value.slice(1).match(/../g).map((v) => parseInt(v, 16) / 255);
}
function luminance(rgb) {
  const weights = [.2126, .7152, .0722];
  return rgb.reduce((total, c, i) =>
    total + weights[i] * (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4), 0);
}
function check(name, foreground, background, minimum = 4.5) {
  const pair = [luminance(foreground), luminance(background)];
  const ratio = (Math.max(...pair) + .05) / (Math.min(...pair) + .05);
  console.log(`${name}: ${ratio.toFixed(2)}`);
  if (ratio < minimum) process.exitCode = 1;
}
for (const background of ["--color-bg", "--color-surface"]) {
  for (const foreground of ["--color-ink", "--color-ink-dim", "--color-accent", "--color-negative"]) {
    check(`${foreground} on ${background}`, channels(foreground), channels(background));
  }
  check(`Control edge on ${background}`, channels("--color-edge"), channels(background), 3);
}
check("Primary button label", channels("--color-on-accent"), channels("--color-accent"));
const field = channels("--fx-field");
const fieldGround = channels("--color-bg").map((v, i) => v * .83 + field[i] * .17);
check("Decorative field and main text", channels("--color-ink"), fieldGround);
const readout = fieldGround.map((v, i) => v * .12 + field[i] * .88);
check("Coordinate readout on the field", readout, fieldGround);
