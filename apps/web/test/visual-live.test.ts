import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { addressMark } from "../src/art/benchmark";
import { FrameGovernor } from "../src/lib/motion";

test("the generator emits identical bytes on repeated runs", () => {
  function generate() {
    execFileSync(process.execPath, ["scripts/make-art.mjs"]);
    const files = readdirSync("public/art").sort().map((name) => `public/art/${name}`);
    files.push("src/art/benchmark.ts", "src/app/icon.svg", "public/favicon.ico");
    return files.map((path) => createHash("sha256").update(readFileSync(path)).digest("hex"));
  }
  expect(generate()).toEqual(generate());
});

test("address marks are stable and depend on the address", () => {
  const a = "DatumExamp1eMintA11111111111111111111111111";
  const b = "DatumExamp1eMintB11111111111111111111111111";
  expect(addressMark(a)).toBe(addressMark(a));
  expect(addressMark(a)).not.toBe(addressMark(b));
});

test("governor keeps smooth animation and steps down before stopping", () => {
  const governor = new FrameGovernor();
  for (let i = 0; i < 240; i++) governor.sample(1000 / 60);
  expect(governor.density).toBe(0);
  for (let i = 0; i < 80; i++) governor.sample(25);
  expect(governor.density).toBe(1);
  for (let i = 0; i < 50; i++) governor.sample(40);
  expect(governor.density).toBe(2);
  expect(governor.stopped).toBe(false);
  for (let i = 0; i < 50; i++) governor.sample(40);
  expect(governor.stopped).toBe(true);
});
