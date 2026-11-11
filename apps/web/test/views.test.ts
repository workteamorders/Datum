import { afterEach, describe, expect, it, vi } from "vitest";
import { SPL_TOKEN_PROGRAM_ID, buildMemo, decodeSnapshot, type OrderedClaim, type Snapshot } from "@datum/protocol";
import { numericReading, rulerProps } from "../src/lib/readings";
import { previewPicks } from "../src/lib/preflight";
import { buildTokenView } from "../src/lib/token-view";
import { changesSince, loadVisit, recordOf, saveVisit } from "../src/lib/visit";
import { storageWorks } from "../src/lib/storage";
import { BONK, FX, PUBLISHER, USDC } from "./helpers";

const raw = (k: string) => ({ owner: FX[k]!.owner!, data: new Uint8Array(Buffer.from(FX[k]!.data, "base64")) });

function snapshotOf(mintKey: "USDC" | "BONK", metaKey: "USDC_META" | "BONK_META"): Snapshot {
  const mint = mintKey === "USDC" ? USDC : BONK;
  return {
    mint,
    slot: 467_830_001,
    observedAt: 1_000_000,
    addresses: { mint, metaplex: FX[metaKey]!.address!, pumpCurve: "11111111111111111111111111111111", tokenProgram: SPL_TOKEN_PROGRAM_ID },
    mintAccount: { state: "ok", value: raw(mintKey) },
    metaplex: { state: "ok", value: raw(metaKey) },
    pumpCurve: { state: "not_found" },
    programUpgrade: { state: "ok", value: { hasUpgradeAuthority: false } },
  };
}

function claim(mint: string, publisher: string, picks: { k: string; v?: string }[], over: Partial<OrderedClaim> = {}): OrderedClaim {
  const { text } = buildMemo(mint, picks, "Test");
  return { memo: JSON.parse(text), memoText: text, publisher, signature: `sig-${publisher.slice(0, 4)}-${picks.length}`, slot: 100, blockTime: null, current: true, ...over };
}

describe("rulerProps", () => {
  const reading = (limit: bigint, now: bigint | null) => rulerProps({ limit, now, unit: "base units", what: "Supply" });
  it("below the limit", () => {
    const r = reading(1000n, 800n);
    expect(r.now).toBe(800);
    expect(r.description).toContain("within the limit");
    expect(r.nowLabel).toBe("Now 800");
  });
  it("exactly at the limit counts as within it", () => {
    const r = reading(1000n, 1000n);
    expect(r.description).toContain("exactly at the limit");
    expect(r.nowLabel).toBe("Now 1,000");
  });
  it("past the limit says by how much", () => {
    const r = reading(1000n, 1204n);
    expect(r.description).toContain("over by 204");
    expect(r.nowLabel).toBe("Now 1,204, over by 204");
    expect(r.max).toBeGreaterThan(1204);
  });
  it("no reading", () => {
    const r = reading(1000n, null);
    expect(r.now).toBeNull();
    expect(r.description).toContain("could not be read");
  });
  it("a limit of zero does not break the scale", () => {
    const r = reading(0n, 0n);
    expect(r.max).toBeGreaterThan(0);
    expect(new Set(r.ticks.map((t) => t.at)).size).toBe(r.ticks.length);
  });
  it("very large values (u64) keep exact text and a finite scale", () => {
    const max = 18_446_744_073_709_551_615n;
    const r = reading(max, max - 1n);
    expect(r.limitLabel).toBe("Claim limit 18,446,744,073,709,551,615");
    expect(r.nowLabel).toBe("Now 18,446,744,073,709,551,614");
    expect(Number.isFinite(r.max)).toBe(true);
  });
});

describe("numericReading", () => {
  const d = decodeSnapshot(snapshotOf("USDC", "USDC_META"));
  it("reads the supply of a real mint", () => {
    const n = numericReading(d, "supply_max", "1000");
    expect(n?.now).not.toBeNull();
    expect(n?.limit).toBe(1000n);
  });
  it("is only for numeric predicates and rejects bad values", () => {
    expect(numericReading(d, "mint_authority_none")).toBeNull();
    expect(numericReading(d, "supply_max", "abc")).toBeNull();
    expect(numericReading(d, "t22_transfer_fee_max_bps", "-1")).toBeNull();
  });
  it("an SPL Token mint has a transfer fee of 0", () => {
    expect(numericReading(d, "t22_transfer_fee_max_bps", "50")?.now).toBe(0n);
  });
});

describe("previewPicks (before signing)", () => {
  const s = snapshotOf("BONK", "BONK_META");
  it("says which statements would not be true now", () => {
    const p = previewPicks(s, [{ key: "mint_authority_none" }, { key: "supply_max", value: "1" }, { key: "decimals_eq", value: "5" }]);
    expect(p.picks.map((x) => x.status)).toEqual(["true", "false", "true"]);
    expect(p.notTrue).toBe(1);
    expect(p.picks[1]?.ruler?.description).toContain("over by");
  });
  it("an unknown mint account is cannot_check, never not true", () => {
    const missing: Snapshot = { ...s, mintAccount: { state: "not_found" } };
    const p = previewPicks(missing, [{ key: "mint_authority_none" }]);
    expect(p.picks[0]?.status).toBe("cannot_check");
    expect(p.notTrue).toBe(0);
    expect(p.cannotCheck).toBe(1);
  });
});

describe("buildTokenView counts only claims from authorities", () => {
  const s = snapshotOf("USDC", "USDC_META");
  const d = decodeSnapshot(s);
  const authority = d.mint.ok ? d.mint.value.mintAuthority : null;
  it("USDC has a mint authority to use as the publisher", () => expect(authority).not.toBeNull());
  const view = buildTokenView(
    s,
    [
      claim(USDC, authority as string, [{ k: "decimals_eq", v: "6" }]),
      claim(USDC, PUBLISHER, [{ k: "decimals_eq", v: "9" }, { k: "mint_authority_none" }]),
    ],
    1_010_000,
  );
  it("keeps the other wallet's claim out of the summary", () => {
    expect(view.fromAuthorities).toHaveLength(1);
    expect(view.fromOthers).toHaveLength(1);
    expect(view.counts).toEqual({ true: 1, false: 0, cannot_check: 0, unsupported: 0 });
    expect(view.othersCount).toBe(1);
  });
  it("every row carries its check in words", () => {
    for (const g of [...view.fromAuthorities, ...view.fromOthers]) for (const r of g.rows) expect(r.formula.length).toBeGreaterThan(10);
  });
});

describe("Since your last visit", () => {
  const s = snapshotOf("USDC", "USDC_META");
  const g = (picks: { k: string; v?: string }[]) => buildTokenView(s, [claim(USDC, PUBLISHER, picks)], 1_010_000).fromOthers;
  it("lists new statements and changed results, and skips unchanged ones", () => {
    const before = recordOf(g([{ k: "decimals_eq", v: "6" }]), 1);
    const same = recordOf(g([{ k: "decimals_eq", v: "6" }]), 2);
    expect(changesSince(before, same)).toEqual([]);
    const flipped = { ...same, rows: Object.fromEntries(Object.entries(same.rows).map(([k]) => [k, "false" as const])) };
    expect(changesSince(before, flipped)[0]?.text).toContain("was True now, now Not true now");
    const grown = recordOf(g([{ k: "decimals_eq", v: "6" }, { k: "mint_authority_none" }]), 3);
    expect(changesSince(before, grown).some((c) => c.text.startsWith("New: "))).toBe(true);
  });
});

describe("storage that is not there", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("without a window nothing throws and nothing is shown", () => {
    expect(loadVisit("mainnet", USDC)).toBeNull();
    expect(saveVisit("mainnet", USDC, { at: 1, rows: {}, statements: {} })).toBe(false);
    expect(storageWorks()).toBe(false);
  });
  it("a localStorage that throws is the same", () => {
    vi.stubGlobal("window", { get localStorage(): never { throw new Error("blocked"); } });
    expect(loadVisit("mainnet", USDC)).toBeNull();
    expect(storageWorks()).toBe(false);
  });
  it("a damaged record is ignored", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => "{not json", setItem: () => undefined, removeItem: () => undefined } });
    expect(loadVisit("mainnet", USDC)).toBeNull();
    vi.stubGlobal("window", { localStorage: { getItem: () => JSON.stringify({ at: "x" }), setItem: () => undefined, removeItem: () => undefined } });
    expect(loadVisit("mainnet", USDC)).toBeNull();
  });
  it("a stored record round-trips", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } });
    const rec = { at: 5, rows: { a: "true" as const }, statements: { a: "x" } };
    expect(saveVisit("mainnet", USDC, rec)).toBe(true);
    expect(loadVisit("mainnet", USDC)).toEqual(rec);
  });
});
