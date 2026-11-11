import { describe, expect, it } from "vitest";
import { METAPLEX_METADATA_PROGRAM_ID, SPL_TOKEN_PROGRAM_ID, claimMintTag, decodeSnapshot, evaluateClaim, feedTag, metaplexMetadataAddress, buildMemo, type Claim } from "@datum/protocol";
import { RpcClient } from "../src/lib/rpc";
import { readSnapshot } from "../src/lib/snapshot";
import { mergeClaims, readFeedClaims, readMintClaims } from "../src/lib/claims";
import { BONK, FX, PUBLISHER, USDC, account, claimTx, fakeRelay, type Handler } from "./helpers";

const client = (h: Handler) => {
  const relay = fakeRelay(h);
  return { relay, rpc: new RpcClient({ url: "/api/rpc", fetchImpl: relay.f, sleep: async () => {}, retries: 0, ttlMs: 0 }) };
};
const err = (status: number, code: number) => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code, message: "x" } }), { status });

/** A chain with BONK and USDC and the SPL Token program, like mainnet (fixtures are real accounts). */
function chain(): Handler {
  const byAddr = new Map<string, string>([
    [USDC, "USDC"], [BONK, "BONK"],
    [FX.USDC_META!.address!, "USDC_META"], [FX.BONK_META!.address!, "BONK_META"],
    [SPL_TOKEN_PROGRAM_ID, "TOKENKEG"],
  ]);
  return (method, params) => {
    if (method !== "getMultipleAccounts") throw new Error(`unexpected ${method}`);
    const [addrs, cfg] = params as [string[], { dataSlice?: { offset: number; length: number } }];
    return {
      context: { slot: 467_830_001 },
      value: addrs.map((a) => {
        const key = byAddr.get(a) ?? (a === programDataOf() ? "TOKENKEG_PD" : null);
        return key ? account(key, cfg) : null;
      }),
    };
  };
}
// The program data address is read from the program account itself; compute it once from the fixture.
import { programDataAddress } from "@datum/protocol";
const programDataOf = () => programDataAddress(new Uint8Array(Buffer.from(FX.TOKENKEG!.data, "base64")));

describe("readSnapshot", () => {
  it("reads BONK: mint, Metaplex, pump slot and program upgrade status", async () => {
    const { rpc, relay } = client(chain());
    const r = await readSnapshot(rpc, BONK, () => 42);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = r.snapshot;
    expect(s.slot).toBe(467_830_001);
    expect(s.observedAt).toBe(42);
    expect(s.addresses.metaplex).toBe(await metaplexMetadataAddress(BONK, METAPLEX_METADATA_PROGRAM_ID));
    expect(s.mintAccount.state).toBe("ok");
    expect(s.metaplex.state).toBe("ok");
    expect(s.pumpCurve.state).toBe("not_found");
    expect(s.programUpgrade).toEqual({ state: "ok", value: { hasUpgradeAuthority: false } });
    // Program data is read as a 45-byte slice and the program account as 36 bytes.
    const slices = relay.calls.map((c) => (c.params[1] as { dataSlice?: { length: number } }).dataSlice?.length);
    expect(slices).toEqual([undefined, 36, 45]);
    // The read is evaluated end to end.
    const res = evaluateClaim(s, buildMemoValue(BONK, [{ k: "mint_authority_none" }, { k: "decimals_eq", v: "5" }]));
    expect(res.status).toBe("true");
  });
  it("uses confirmed commitment and base64", async () => {
    const { rpc, relay } = client(chain());
    await readSnapshot(rpc, USDC);
    for (const c of relay.calls) expect(c.params[1]).toMatchObject({ commitment: "confirmed", encoding: "base64" });
  });
  it("rejects a bad address without calling the relay", async () => {
    const { rpc, relay } = client(chain());
    expect(await readSnapshot(rpc, "not-an-address")).toMatchObject({ ok: false, reason: "bad_address" });
    expect(relay.calls).toHaveLength(0);
  });
  it("reports a missing mint as not_found, and the evaluator cannot check", async () => {
    const { rpc } = client(() => ({ context: { slot: 5 }, value: [null, null, null] }));
    const r = await readSnapshot(rpc, "So11111111111111111111111111111111111111112");
    expect(r.ok && r.snapshot.mintAccount.state).toBe("not_found");
    if (r.ok) expect(evaluateClaim(r.snapshot, buildMemoValue(r.snapshot.mint, [{ k: "mint_authority_none" }])).status).toBe("cannot_check");
  });
  it("fails as unreadable when the first read fails", async () => {
    const { rpc } = client(() => { throw err(503, -32002); });
    expect(await readSnapshot(rpc, BONK)).toMatchObject({ ok: false, reason: "unreadable" });
  });
  it("keeps the mint when only the program read fails: stability falls back and nothing is claimed permanent", async () => {
    let n = 0;
    const base = chain();
    const { rpc } = client((m, p) => { if (n++ >= 1) throw err(503, -32002); return base(m, p); });
    const r = await readSnapshot(rpc, BONK);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.snapshot.programUpgrade.state).toBe("error");
    const res = evaluateClaim(r.snapshot, buildMemoValue(BONK, [{ k: "mint_authority_none" }]));
    expect(res.predicates[0]?.status).toBe("true");
    expect(res.predicates[0]?.stability).toBe("can_change");
  });
  it("does not read program accounts for a mint owned by an unsupported program", async () => {
    const { rpc, relay } = client(() => ({ context: { slot: 9 }, value: [{ owner: "11111111111111111111111111111111", data: ["", "base64"] }, null, null] }));
    const r = await readSnapshot(rpc, BONK);
    expect(r.ok).toBe(true);
    expect(relay.calls).toHaveLength(1);
    if (r.ok) expect(evaluateClaim(r.snapshot, buildMemoValue(BONK, [{ k: "mint_authority_none" }])).status).toBe("cannot_check");
  });
});

function buildMemoValue(mint: string, p: { k: string; v?: string }[]) {
  const text = buildMemo(mint, p).text;
  return JSON.parse(text) as Parameters<typeof evaluateClaim>[1];
}

// ---------- claims ----------

type Row = { signature: string; slot: number; err: unknown; memo: string | null };
async function claimChain(rows: Row[], txs: Record<string, unknown>) {
  const handler: Handler = (method, params) => {
    if (method === "getSignaturesForAddress") {
      const cfg = (params[1] ?? {}) as { before?: string; limit?: number };
      let start = 0;
      if (cfg.before) start = rows.findIndex((r) => r.signature === cfg.before) + 1;
      return rows.slice(start, start + (cfg.limit ?? 1000));
    }
    if (method === "getTransaction") {
      const t = txs[params[0] as string];
      if (t === "fail") throw err(503, -32002);
      return t ?? null;
    }
    throw new Error(`unexpected ${method}`);
  };
  return client(handler);
}
const memoFor = (mint: string) => `[80] ${buildMemo(mint, [{ k: "mint_authority_none" }], "Test").text}`;
const row = (i: number, memo: string | null, e: unknown = null): Row => ({ signature: `sig${String(i).padStart(3, "0")}`, slot: 1000 - i, err: e, memo });

describe("readMintClaims", () => {
  it("returns 10 claims per load and continues with `before`", async () => {
    const rows: Row[] = [];
    const txs: Record<string, unknown> = {};
    for (let i = 0; i < 14; i++) {
      rows.push(row(i, memoFor(BONK)));
      txs[`sig${String(i).padStart(3, "0")}`] = await claimTx({ slot: 1000 - i, publisher: i % 2 ? PUBLISHER : "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM" });
    }
    const { rpc } = await claimChain(rows, txs);
    const a = await readMintClaims(rpc, BONK);
    expect(a.claims).toHaveLength(10);
    expect(a.claims[0]?.signature).toBe("sig000");
    expect(a.next).toBe("sig009");
    const b = await readMintClaims(rpc, BONK, a.next ?? undefined);
    expect(b.claims.map((c) => c.signature)).toEqual(["sig010", "sig011", "sig012", "sig013"]);
    expect(b.next).toBeNull();
    const merged = mergeClaims([a.claims, b.claims]);
    expect(merged).toHaveLength(14);
    expect(merged.filter((c) => c.current)).toHaveLength(2);
    expect(merged.filter((c) => c.current).map((c) => c.signature).sort()).toEqual(["sig000", "sig001"]);
  });
  it("skips failed transactions and entries without the datum memo, without fetching them", async () => {
    const rows = [row(0, memoFor(BONK), { InstructionError: [0, "x"] }), row(1, null), row(2, "[5] hello"), row(3, memoFor(BONK))];
    const txs = { sig003: await claimTx({ slot: 997 }) };
    const { rpc, relay } = await claimChain(rows, txs);
    const r = await readMintClaims(rpc, BONK);
    expect(r.claims).toHaveLength(1);
    expect(r.malformed).toBe(0);
    expect(relay.calls.filter((c) => c.method === "getTransaction")).toHaveLength(1);
  });
  it("counts malformed claims: invalid memo, wrong mint, wrong shape", async () => {
    const bad = await claimTx({ memo: '{"t":"datum/0","m":"nope","p":[]}' });
    const other = await claimTx({ mint: USDC });
    const noMemoShape = { ...(await claimTx()), transaction: { message: { ...(await claimTx()).transaction.message, instructions: [] } } };
    const rows = [row(0, memoFor(BONK)), row(1, memoFor(BONK)), row(2, memoFor(BONK)), row(3, memoFor(BONK))];
    const txs = { sig000: bad, sig001: other, sig002: noMemoShape, sig003: await claimTx() };
    const { rpc } = await claimChain(rows, txs);
    const r = await readMintClaims(rpc, BONK);
    expect(r.claims).toHaveLength(1);
    expect(r.malformed).toBe(3);
  });
  it("counts transactions that could not be read separately from malformed", async () => {
    const rows = [row(0, memoFor(BONK)), row(1, memoFor(BONK))];
    const { rpc } = await claimChain(rows, { sig000: "fail", sig001: await claimTx() });
    const r = await readMintClaims(rpc, BONK);
    expect(r.claims).toHaveLength(1);
    expect(r.unreadable).toBe(1);
    expect(r.malformed).toBe(0);
  });
  it("returns nothing for an empty history and throws when the signature call fails", async () => {
    const { rpc } = await claimChain([], {});
    expect(await readMintClaims(rpc, BONK)).toEqual({ claims: [], malformed: 0, next: null, unreadable: 0 });
    const failing = client(() => { throw err(503, -32002); });
    await expect(readMintClaims(failing.rpc, BONK)).rejects.toMatchObject({ kind: "unavailable" });
  });
  it("asks for the CLAIM_MINT tag with limit 50 and confirmed commitment", async () => {
    const { rpc, relay } = await claimChain([], {});
    await readMintClaims(rpc, BONK);
    expect(relay.calls[0]).toEqual({ method: "getSignaturesForAddress", params: [await claimMintTag(BONK), { limit: 50, commitment: "confirmed" }] });
  });
  it("walks past a page with no valid claims to the next page", async () => {
    const rows: Row[] = [];
    for (let i = 0; i < 50; i++) rows.push(row(i, "[5] hello"));
    rows.push(row(50, memoFor(BONK)));
    const { rpc, relay } = await claimChain(rows, { sig050: await claimTx() });
    const r = await readMintClaims(rpc, BONK);
    expect(r.claims).toHaveLength(1);
    expect(relay.calls.filter((c) => c.method === "getSignaturesForAddress")).toHaveLength(2);
  });
});

describe("readFeedClaims", () => {
  it("reads from the FEED tag and accepts claims for any mint", async () => {
    const rows = [row(0, memoFor(BONK)), row(1, memoFor(USDC))];
    const { rpc, relay } = await claimChain(rows, { sig000: await claimTx(), sig001: await claimTx({ mint: USDC }) });
    const r = await readFeedClaims(rpc);
    expect(r.claims.map((c) => c.memo.m)).toEqual([BONK, USDC]);
    expect(relay.calls[0]?.params[0]).toBe(await feedTag());
  });
});

describe("mergeClaims", () => {
  it("drops repeats across loads", () => {
    const c: Claim = { memo: { t: "datum/0", m: BONK, p: [{ k: "mint_authority_none" }] }, memoText: "", publisher: PUBLISHER, signature: "s", slot: 1, blockTime: null };
    expect(mergeClaims([[c], [c]])).toHaveLength(1);
  });
});
