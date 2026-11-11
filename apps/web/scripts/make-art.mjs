import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const web = fileURLToPath(new URL("../", import.meta.url));
const css = readFileSync(join(web, "src/styles/tokens.css"), "utf8");
const palette = (name) => {
  const match = css.match(new RegExp(`--palette-${name}: (#\\w{6});`));
  if (!match) throw new Error(`Missing palette token ${name}`);
  return match[1];
};
const ink = palette("stamp");
const ground = palette("concrete");
const seam = palette("seam");
const cast = palette("cast");

function write(path, data) {
  const target = join(web, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
}
const art = (name, data) => write(`public/art/${name}`, data);
const svg = (width, height, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>\n`;
const path = (d) => `<path d="${d}"/>`;
const circle = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const cross = (x, y, arm) => path(`M${x-arm} ${y}h${2*arm}M${x} ${y-arm}v${2*arm}`);
const outline = (body) => `<g fill="none" stroke="${ink}" stroke-width="2">${body}</g>`;
const ticks = path("M32 7v7m0 36v7M7 32h7m36 0h7M14 14l5 5m26 26 5 5M14 50l5-5m26-26 5-5");
const discs = {
  crosshair: cross(32, 32, 15),
  ticks,
  "double-ring": circle(32, 32, 19) + cross(32, 32, 8),
  stake: path("M18 32h28M32 18v28M28 28h8v8h-8Z"),
  index: path("M20 41l12-22 12 22M26 32h12"),
  "split-ring": path("M17 27a16 16 0 0 1 30 0m-30 10a16 16 0 0 0 30 0") + cross(32, 32, 7),
};
for (const [name, figure] of Object.entries(discs)) {
  art(`disc-${name}.svg`, svg(64, 64, outline(circle(32, 32, 25) + figure)));
}
const marks = { cross: cross(16, 16, 8), point: circle(16, 16, 2), corner: path("M9 23V9h14M16 16h4") };
for (const [name, figure] of Object.entries(marks)) art(`registration-${name}.svg`, svg(32, 32, outline(figure)));
const seals = {
  measured: "MEASURED", example: "EXAMPLE", confirmed: "CONFIRMED",
  changed: "CHANGED", superseded: "SUPERSEDED", draft: "Draft",
};
for (const [name, label] of Object.entries(seals)) {
  const w = label.length * 9 + 22;
  art(`seal-${name}.svg`, svg(w, 25, `<rect x="1" y="1" width="${w-2}" height="23" fill="${ground}" stroke="${ink}"/><text x="${w/2}" y="17" text-anchor="middle" fill="${ink}" font-family="monospace" font-size="13">${label}</text>`));
}
const illustrations = {
  "no-claims": path("M23 30h68m-68 10h68m-68 10h68M34 24v32m44-32v32") + circle(56, 40, 21),
  "no-wallet": path("M32 22h49v36H32zM40 30h33m-33 20h33M50 41h12"),
  "no-network": path("M16 40h22m8 0h10m9 0h29m-8-8v16m-62-16v16") + circle(56, 40, 20),
  "not-found": path("M19 52h76M19 45v7m12-4v4m12-7v7m12-4v4m12-7v7m12-4v4m16-7v7") + cross(57, 30, 11),
  "other-cluster": circle(43, 40, 17) + circle(72, 40, 17) + cross(72, 40, 8),
};
for (const [name, figure] of Object.entries(illustrations)) {
  art(`${name}.svg`, svg(112, 80, outline(path("M6 20V6h14m72 0h14v14M6 60v14h14m72 0h14V60") + figure)));
}

let seed = 62062;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
let dots = "";
for (let y = 4; y < 64; y += 8) for (let x = 4; x < 64; x += 8) {
  dots += circle(x, y, (1 + random()).toFixed(2));
}
art("halftone.svg", svg(64, 64, `<g fill="${seam}">${dots}</g>`));

const icon = svg(64, 64, `<rect width="64" height="64" fill="${ground}"/><circle cx="32" cy="32" r="24" fill="${cast}"/>${outline(circle(32, 32, 24) + circle(32, 32, 18) + cross(32, 32, 12))}`);
write("src/app/icon.svg", icon);
art("icon.svg", icon);

const toChannels = (hex) => hex.slice(1).match(/../g).map((part) => parseInt(part, 16));
function chunk(type, data) {
  const payload = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of payload) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const head = Buffer.alloc(4);
  const tail = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  tail.writeUInt32BE((~crc) >>> 0);
  return Buffer.concat([head, payload, tail]);
}
function png(width, height, pixel) {
  const raw = Buffer.alloc(height * (width * 3 + 1));
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    raw.set(pixel(x, y), y * (width * 3 + 1) + x * 3 + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}
const rgb = [ground, ink, cast, seam].map(toChannels);
function discPixel(x, y, s) {
  const radius = Math.hypot(x, y) / s;
  const ring = Math.abs(radius - 24) < 1 || Math.abs(radius - 18) < 1;
  const hair = (Math.abs(x) < s && Math.abs(y) < 12 * s) || (Math.abs(y) < s && Math.abs(x) < 12 * s);
  return ring || hair ? 1 : radius < 24 ? 2 : 0;
}
function iconPng(size) {
  return png(size, size, (x, y) => rgb[discPixel(x - (size-1)/2, y - (size-1)/2, size/64)]);
}
art("apple-touch-icon.png", iconPng(180));
const icoPng = iconPng(32);
const icoHead = Buffer.alloc(22);
icoHead.writeUInt16LE(1, 2);
icoHead.writeUInt16LE(1, 4);
icoHead[6] = icoHead[7] = 32;
icoHead.writeUInt16LE(1, 10);
icoHead.writeUInt16LE(24, 12);
icoHead.writeUInt32LE(icoPng.length, 14);
icoHead.writeUInt32LE(22, 18);
write("public/favicon.ico", Buffer.concat([icoHead, icoPng]));

const letterforms = [
  ["1110","1001","1001","1001","1001","1001","1110"],
  ["0110","1001","1001","1111","1001","1001","1001"],
  ["11111","00100","00100","00100","00100","00100","00100"],
  ["1001","1001","1001","1001","1001","1001","0110"],
  ["10001","11011","10101","10001","10001","10001","10001"],
];
const word = letterforms[0].map((_, row) => letterforms.map((letter) => letter[row]).join("0"));
art("datum-card.png", png(1200, 630, (x, y) => {
  if (x >= 600 && y >= 204 && y < 386 && word[Math.floor((y - 204) / 26)]?.[Math.floor((x - 600) / 19)] === "1") return rgb[1];
  if (x > 600 && x < 1096 && y > 426 && (y < 430 || (x % 24 < 3 && y < 447))) return rgb[1];
  const index = discPixel(x - 305, y - 315, 9);
  if (index) return rgb[index];
  return rgb[x % 36 < 2 && y % 36 < 2 ? 3 : 0];
}));

const generated = `// Generated by scripts/make-art.mjs.
export const DISC_ART = ${JSON.stringify(Object.keys(discs))} as const;
export const REGISTRATION_ART = ${JSON.stringify(Object.keys(marks))} as const;
export const SEAL_ART = ${JSON.stringify(seals)} as const;
export const STATE_ART = ${JSON.stringify(Object.keys(illustrations))} as const;

const palette = ["--color-bg", "--color-ink", "--color-disc", "--color-line", "--color-sunk-light", "--color-disc-face"];

export function addressMark(address: string): string {
  let hash = 2166136261;
  for (const character of address) {
    hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), 16777619) >>> 0;
  }
  let offset = 0;
  const bands = palette.map((token, i) => {
    const width = 3 + ((hash >>> (i * 4)) & 3);
    const shape = '<path fill="var(' + token + ')" d="M' + offset + ' 0h' + width + 'v32h-' + width + 'z"/>';
    offset += width;
    return shape;
  });
  const line = hash % 19 + 6;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + offset + ' 32">' + bands.join("") +
    '<path d="M0 ' + line + 'h' + offset + '" stroke="var(--color-ink)" stroke-width="2"/></svg>';
}
`;
write("src/art/benchmark.ts", generated);
