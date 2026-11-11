// Numeric predicates drawn on a Ruler: the claim's limit against the value read now.
import type { Decoded } from "@datum/protocol";
import type { RulerProps } from "@/components/Ruler";
import { formatInt } from "./view";

export type NumericReading = { limit: bigint; now: bigint | null; unit: string; what: string };

/** The limit and the reading for predicates that compare a number. Null for every other predicate. */
export function numericReading(d: Decoded, key: string, value?: string): NumericReading | null {
  if (key === "supply_max") {
    let limit: bigint;
    try {
      limit = BigInt(value ?? "");
    } catch {
      return null;
    }
    const m = d.mint.ok ? d.mint.value : null;
    const now = m && !m.extensions.confidentialMintBurn ? m.supply : null;
    return { limit, now, unit: "base units", what: "Supply" };
  }
  if (key === "t22_transfer_fee_max_bps") {
    if (!/^\d{1,5}$/.test(value ?? "")) return null;
    const limit = BigInt(value as string);
    if (!d.mint.ok) return { limit, now: null, unit: "basis points", what: "Transfer fee" };
    const fee = d.mint.value.extensions.transferFee;
    const now = d.mint.value.program === "spl-token" || !fee ? 0n : BigInt(Math.max(fee.older.bps, fee.newer.bps));
    return { limit, now, unit: "basis points", what: "Transfer fee" };
  }
  return null;
}

/** Short tick text such as 1.5B. Used only for scale labels; the exact numbers are always shown in full too. */
export function compact(n: number): string {
  const steps: [number, string][] = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [size, tag] of steps) {
    if (n >= size) return `${Number((n / size).toFixed(2))}${tag}`;
  }
  return String(Math.round(n));
}

export function rulerProps(r: NumericReading): RulerProps {
  const limit = Number(r.limit);
  const now = r.now === null ? null : Number(r.now);
  const over = r.now !== null && r.now > r.limit;
  let max = over ? (now as number) * 1.15 : limit * 1.5;
  if (!(max > 0)) max = 1;
  const seen = new Set<number>();
  const ticks = [0, limit, max].filter((at) => (seen.has(at) ? false : (seen.add(at), true))).map((at) => ({ at, label: compact(at) }));
  const limitText = `${formatInt(r.limit)} ${r.unit}`;
  return {
    limit,
    max,
    now,
    limitLabel: `Claim limit ${formatInt(r.limit)}`,
    nowLabel: r.now === null ? undefined : over ? `Now ${formatInt(r.now)}, over by ${formatInt(r.now - r.limit)}` : `Now ${formatInt(r.now)}`,
    ticks,
    missingLabel: "No reading: it could not be read right now",
    description:
      r.now === null
        ? `${r.what}: claim limit ${limitText}; it could not be read right now.`
        : over
          ? `${r.what} now ${formatInt(r.now)} ${r.unit}; claim limit ${limitText}; over by ${formatInt(r.now - r.limit)}.`
          : r.now === r.limit
            ? `${r.what} now ${formatInt(r.now)} ${r.unit}; claim limit ${limitText}; exactly at the limit, which counts as within it.`
            : `${r.what} now ${formatInt(r.now)} ${r.unit}; claim limit ${limitText}; within the limit.`,
  };
}
