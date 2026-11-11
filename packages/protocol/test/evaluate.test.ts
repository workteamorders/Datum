import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  METAPLEX_METADATA_PROGRAM_ID, MEMO_PROGRAM_ID, SYSTEM_PROGRAM_ID, ZERO_TRANSFER_DATA, b58encode, buildMemo, claimMintTag, feedTag,
  decodeSnapshot, decodeUpgradeStatus, evaluateClaim, evaluatePredicate, isFromAuthorities, markSupersession, metaplexMetadataAddress,
  overallStatus, parseClaimTransaction, signerRelations, type Claim, type Fetched, type RawAccount, type RpcTransaction, type Snapshot,
} from "../src";

type Fx = Record<string, { address?: string; owner?: string; data: string }>;
const F = JSON.parse(readFileSync(new URL("../fixtures/mainnet-accounts.json", import.meta.url), "utf8")) as Fx;
const raw = (k: string): RawAccount => ({ owner: (F[k] as { owner: string }).owner, data: new Uint8Array(Buffer.from((F[k] as { data: string }).data, "base64")) });
const plain = (k: string): Uint8Array => new Uint8Array(Buffer.from((F[k] as { data: string }).data, "base64"));
const ok = <T,>(value: T): Fetched<T> => ({ state: "ok", value });

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const PYUSD = "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo";

function upgrade(program: "TOKENKEG" | "TOKEN2022") {
  return ok(decodeUpgradeStatus(raw(program).owner, plain(program), plain(`${program}_PD`)));
}

async function snap(mint: string, mintKey: string, metaKey: string | null, program: "TOKENKEG" | "TOKEN2022", over: Partial<Snapshot> = {}): Promise<Snapshot> {
  return {
    mint, slot: 467_830_000, observedAt: 0,
    addresses: { mint, metaplex: await metaplexMetadataAddress(mint, METAPLEX_METADATA_PROGRAM_ID), pumpCurve: "x", tokenProgram: raw(mintKey).owner },
    mintAccount: ok(raw(mintKey)),
    metaplex: metaKey ? ok(raw(metaKey)) : { state: "not_found" },
    pumpCurve: { state: "not_found" },
    programUpgrade: upgrade(program),
    ...over,
  };
}

const ev = (s: Snapshot, key: string, value?: string) => evaluatePredicate(s, decodeSnapshot(s), key, value);

describe("BONK (SPL Token, both authorities none, program not upgradeable)", () => {
  it("mint authority none is true and Permanent", async () => {
    const r = ev(await snap(BONK, "BONK", "BONK_META", "TOKENKEG"), "mint_authority_none");
    expect(r.status).toBe("true");
    expect(r.stability).toBe("permanent");
    expect(r.measured).toBe("Mint authority: None.");
  });
  it("freeze authority none is true and Permanent", async () => {
    const r = ev(await snap(BONK, "BONK", "BONK_META", "TOKENKEG"), "freeze_authority_none");
    expect([r.status, r.stability]).toEqual(["true", "permanent"]);
  });
  it("supply_max with supply under the limit is true and Permanent (supply can only fall)", async () => {
    const r = ev(await snap(BONK, "BONK", "BONK_META", "TOKENKEG"), "supply_max", "18446744073709551615");
    expect([r.status, r.stability]).toEqual(["true", "permanent"]);
  });
  it("supply_max under the real supply is false, with the excess in words", async () => {
    const r = ev(await snap(BONK, "BONK", "BONK_META", "TOKENKEG"), "supply_max", "1000");
    expect(r.status).toBe("false");
    expect(r.measured).toMatch(/over the limit/);
    expect(r.stability).toBe("can_change");
  });
  it("decimals_eq is Permanent either way", async () => {
    const s = await snap(BONK, "BONK", "BONK_META", "TOKENKEG");
    expect([ev(s, "decimals_eq", "5").status, ev(s, "decimals_eq", "5").stability]).toEqual(["true", "permanent"]);
    expect([ev(s, "decimals_eq", "6").status, ev(s, "decimals_eq", "6").stability]).toEqual(["false", "permanent"]);
  });
  it("t22 predicates on an SPL mint are true with the stated note", async () => {
    const r = ev(await snap(BONK, "BONK", "BONK_META", "TOKENKEG"), "t22_no_transfer_hook");
    expect(r.status).toBe("true");
    expect(r.measured).toBe("Not a Token-2022 token.");
    expect(r.note).toBe("SPL Token has no extensions.");
  });
  it("metadata_immutable is false (Metaplex isMutable) and always Can change", async () => {
    const r = ev(await snap(BONK, "BONK", "BONK_META", "TOKENKEG"), "metadata_immutable");
    expect([r.status, r.stability]).toEqual(["false", "can_change"]);
  });
  it("no metadata at all is false with the stated measured text", async () => {
    const r = ev(await snap(BONK, "BONK", null, "TOKENKEG"), "metadata_immutable");
    expect([r.status, r.measured]).toEqual(["false", "No on-chain metadata found."]);
  });
  it("token_program true and false", async () => {
    const s = await snap(BONK, "BONK", null, "TOKENKEG");
    expect(ev(s, "token_program", "spl-token").status).toBe("true");
    expect(ev(s, "token_program", "token-2022").status).toBe("false");
  });
});

describe("USDC (authorities exist)", () => {
  it("mint authority none is false and Can change", async () => {
    const r = ev(await snap(USDC, "USDC", "USDC_META", "TOKENKEG"), "mint_authority_none");
    expect([r.status, r.stability]).toEqual(["false", "can_change"]);
  });
  it("update_authority_eq with the real update authority is true, with another address false", async () => {
    const s = await snap(USDC, "USDC", "USDC_META", "TOKENKEG");
    const d = decodeSnapshot(s);
    const ua = d.metaplex.ok ? d.metaplex.value.updateAuthority : "";
    expect(evaluatePredicate(s, d, "update_authority_eq", ua).status).toBe("true");
    expect(evaluatePredicate(s, d, "update_authority_eq", BONK).status).toBe("false");
  });
});

describe("PYUSD (Token-2022): upgradeable program means Can change", () => {
  it("every result is Can change with the stated reason", async () => {
    const s = await snap(PYUSD, "PYUSD", null, "TOKEN2022");
    for (const [k, v] of [["mint_authority_none"], ["freeze_authority_none"], ["decimals_eq", "6"], ["token_program", "token-2022"], ["t22_no_transfer_hook"], ["t22_no_permanent_delegate"], ["t22_transfer_fee_max_bps", "10000"]] as const) {
      const r = ev(s, k, v);
      expect(r.stability, k).toBe("can_change");
    }
    expect(ev(s, "decimals_eq", "6").stabilityReason).toBe("Token-2022 can be upgraded by its upgrade authority; under its current code this cannot change.");
  });
  it("permanent delegate and fee statuses follow the decoded data", async () => {
    const s = await snap(PYUSD, "PYUSD", null, "TOKEN2022");
    const d = decodeSnapshot(s);
    if (!d.mint.ok) throw new Error("decode");
    const x = d.mint.value.extensions;
    expect(ev(s, "t22_no_permanent_delegate").status).toBe(x.permanentDelegate?.delegate === null ? "true" : "false");
    const larger = Math.max(x.transferFee?.older.bps ?? 0, x.transferFee?.newer.bps ?? 0);
    expect(ev(s, "t22_transfer_fee_max_bps", String(larger)).status).toBe("true");
    if (larger > 0) expect(ev(s, "t22_transfer_fee_max_bps", String(larger - 1)).status).toBe("false");
  });
  it("metadata pointer to the mint itself is understood", async () => {
    const r = ev(await snap(PYUSD, "PYUSD", null, "TOKEN2022"), "metadata_immutable");
    expect(["true", "false"]).toContain(r.status);
  });
});

describe("cannot_check is never merged with false", () => {
  it("RPC error for the mint", async () => {
    const s = await snap(BONK, "BONK", null, "TOKENKEG", { mintAccount: { state: "error", message: "429" } });
    const r = ev(s, "mint_authority_none");
    expect(r.status).toBe("cannot_check");
    expect(r.note).toMatch(/did not answer/);
  });
  it("mint not found", async () => {
    const s = await snap(BONK, "BONK", null, "TOKENKEG", { mintAccount: { state: "not_found" } });
    expect(ev(s, "decimals_eq", "5").status).toBe("cannot_check");
  });
  it("owner is not a token program", async () => {
    const s = await snap(BONK, "BONK", null, "TOKENKEG", { mintAccount: ok({ owner: SYSTEM_PROGRAM_ID, data: plain("BONK") }) });
    expect(ev(s, "decimals_eq", "5").note).toMatch(/not owned by SPL Token or Token-2022/);
  });
  it("undecodable data", async () => {
    const s = await snap(BONK, "BONK", null, "TOKENKEG", { mintAccount: ok({ owner: raw("BONK").owner, data: new Uint8Array(5) }) });
    expect(ev(s, "decimals_eq", "5").status).toBe("cannot_check");
  });
  it("Metaplex read error makes the metadata predicates cannot_check", async () => {
    const s = await snap(BONK, "BONK", null, "TOKENKEG", { metaplex: { state: "error", message: "timeout" } });
    expect(ev(s, "metadata_immutable").status).toBe("cannot_check");
  });
  it("program status unreadable leaves the result and drops Permanent", async () => {
    const s = await snap(BONK, "BONK", null, "TOKENKEG", { programUpgrade: { state: "error", message: "x" } });
    const r = ev(s, "mint_authority_none");
    expect([r.status, r.stability]).toEqual(["true", "can_change"]);
  });
  it("confidential mint burn makes supply_max cannot_check", async () => {
    const m = new Uint8Array(plain("PYUSD"));
    // append a ConfidentialMintBurn TLV (type 24, length 2) to the real mint
    const extra = new Uint8Array([24, 0, 2, 0, 0, 0]);
    const data = new Uint8Array(m.length + extra.length); data.set(m); data.set(extra, m.length);
    const s = await snap(PYUSD, "PYUSD", null, "TOKEN2022", { mintAccount: ok({ owner: raw("PYUSD").owner, data }) });
    expect(ev(s, "supply_max", "1").status).toBe("cannot_check");
  });
  it("overall status order: false > cannot_check > unsupported > true", () => {
    expect(overallStatus([{ status: "true" }, { status: "cannot_check" }, { status: "false" }])).toBe("false");
    expect(overallStatus([{ status: "true" }, { status: "unsupported" }, { status: "cannot_check" }])).toBe("cannot_check");
    expect(overallStatus([{ status: "true" }, { status: "unsupported" }])).toBe("unsupported");
    expect(overallStatus([{ status: "true" }])).toBe("true");
  });
  it("unknown key is unsupported and never an error", async () => {
    const s = await snap(BONK, "BONK", null, "TOKENKEG");
    expect(ev(s, "future_predicate", "42").status).toBe("unsupported");
  });
  it("a claim with decimals true and an unknown key is unsupported overall (SPEC 12.1)", async () => {
    const s = await snap(BONK, "BONK", null, "TOKENKEG");
    const memo = { t: "datum/0" as const, m: BONK, p: [{ k: "decimals_eq", v: "5" }, { k: "future_predicate", v: "42" }] };
    expect(evaluateClaim(s, memo).status).toBe("unsupported");
  });
});

describe("signer relation", () => {
  it("authority holders, revoked, unrelated and unreadable", async () => {
    const usdc = decodeSnapshot(await snap(USDC, "USDC", "USDC_META", "TOKENKEG"));
    if (!usdc.mint.ok || !usdc.metaplex.ok) throw new Error("decode");
    expect(signerRelations(usdc.mint.value.mintAuthority as string, usdc)).toContain("mint_authority");
    expect(signerRelations(usdc.metaplex.value.updateAuthority, usdc)).toContain("metadata_update_authority");
    expect(signerRelations(BONK, usdc)).toEqual(["unrelated"]);
    const bonk = decodeSnapshot(await snap(BONK, "BONK", "BONK_META", "TOKENKEG"));
    expect(signerRelations(USDC, bonk)).toEqual(["revoked"]);
    const bad = decodeSnapshot(await snap(BONK, "BONK", null, "TOKENKEG", { mintAccount: { state: "error", message: "x" } }));
    expect(signerRelations(USDC, bad)).toBeNull();
  });
  it("the pump.fun creator relation", async () => {
    const creator = b58encode(new Uint8Array(32).map((_, i) => 40 + i));
    const curve = new Uint8Array(166); curve.set([23, 183, 248, 55, 96, 216, 172, 96], 0); curve.set(new Uint8Array(32).map((_, i) => 40 + i), 49);
    const d = decodeSnapshot(await snap(BONK, "BONK", null, "TOKENKEG", { pumpCurve: ok({ owner: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", data: curve }) }));
    expect(signerRelations(creator, d)).toEqual(["pump_creator"]);
    expect(isFromAuthorities(["pump_creator"])).toBe(true);
    expect(isFromAuthorities(["revoked"])).toBe(false);
    expect(isFromAuthorities(["unrelated"])).toBe(false);
    expect(isFromAuthorities(null)).toBe(false);
  });
});

// ---------- transactions ----------

const PUBLISHER = "7p9vKmJgcGiFsPEEoPvVevREc4MGsKRVTh4n7FJPLwCm";
const enc = new TextEncoder();

async function claimTx(over: { memo?: string; tag?: string; feed?: string; tagWritable?: boolean; extraMemo?: boolean; noTransfer?: boolean; err?: unknown; accounts?: number[]; transferData?: Uint8Array } = {}): Promise<RpcTransaction> {
  const memo = over.memo ?? buildMemo(BONK, [{ k: "mint_authority_none" }], "Test").text;
  const tag = over.tag ?? (await claimMintTag(BONK));
  const feed = over.feed ?? (await feedTag());
  // order: publisher (signer, writable), [writable unsigned none], readonly unsigned: tag, feed, system, memo
  const keys = [PUBLISHER, tag, feed, SYSTEM_PROGRAM_ID, MEMO_PROGRAM_ID];
  const ixs = [{ programIdIndex: 4, accounts: [] as number[], data: b58encode(enc.encode(memo)) }];
  if (over.extraMemo) ixs.push({ programIdIndex: 4, accounts: [], data: b58encode(enc.encode(memo)) });
  if (!over.noTransfer) ixs.push({ programIdIndex: 3, accounts: over.accounts ?? [0, 0, 1, 2], data: b58encode(over.transferData ?? ZERO_TRANSFER_DATA) });
  return {
    slot: 100, blockTime: 1_700_000_000, meta: { err: over.err ?? null },
    transaction: { message: { header: { numRequiredSignatures: 1, numReadonlyUnsignedAccounts: over.tagWritable ? 2 : 4 }, accountKeys: keys, instructions: ixs } },
  };
}
const FEED = await feedTag();
const TAG_BONK = await claimMintTag(BONK);
const tags = async () => ({ feed: await feedTag(), claimMint: claimMintTag });

describe("claim transactions (SPEC section 4)", () => {
  it("accepts a valid claim", async () => {
    const r = await parseClaimTransaction(await claimTx(), "sig1", await tags());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.claim.publisher).toBe(PUBLISHER);
      expect(r.claim.memo.m).toBe(BONK);
      expect(r.claim.slot).toBe(100);
    }
  });
  const bad: [string, Parameters<typeof claimTx>[0]][] = [
    ["failed transaction", { err: { InstructionError: [0, "x"] } }],
    ["wrong claim tag", { tag: FEED }],
    ["wrong feed", { feed: TAG_BONK }],
    ["tags are writable", { tagWritable: true }],
    ["two memo instructions", { extraMemo: true }],
    ["no transfer", { noTransfer: true }],
    ["transfer with three accounts", { accounts: [0, 0, 1] }],
    ["account index out of range", { accounts: [0, 0, 1, 9] }],
    ["sender is not the publisher", { accounts: [1, 0, 1, 2] }],
    ["non-zero transfer", { transferData: new Uint8Array([2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]) }],
    ["memo for another mint than the tag", { memo: buildMemo(USDC, [{ k: "mint_authority_none" }]).text }],
    ["malformed memo", { memo: '{"t":"datum/0","m":"x"}' }],
  ];
  for (const [name, o] of bad) {
    it(`rejects: ${name}`, async () => {
      const r = await parseClaimTransaction(await claimTx(o), "sig", await tags());
      expect(r.ok).toBe(false);
    });
  }
  it("null and garbage never throw", async () => {
    expect((await parseClaimTransaction(null, "s", await tags())).ok).toBe(false);
    expect((await parseClaimTransaction({} as RpcTransaction, "s", await tags())).ok).toBe(false);
  });
});

describe("supersession (SPEC section 7)", () => {
  const mk = (slot: number, publisher: string, sig: string): Claim => ({
    memo: { t: "datum/0", m: BONK, p: [{ k: "mint_authority_none" }] }, memoText: "", publisher, signature: sig, slot, blockTime: null,
  });
  it("newest by slot per (publisher, mint) is current; others superseded", () => {
    const r = markSupersession([mk(10, "A", "a2"), mk(5, "A", "a1"), mk(7, "B", "b1")]);
    expect(r.map((c) => [c.signature, c.current])).toEqual([["a2", true], ["b1", true], ["a1", false]]);
  });
  it("same slot: the order returned by the RPC decides", () => {
    const r = markSupersession([mk(10, "A", "first"), mk(10, "A", "second")]);
    expect(r.map((c) => [c.signature, c.current])).toEqual([["first", true], ["second", false]]);
  });
  it("ignores blockTime", () => {
    const a = { ...mk(10, "A", "new"), blockTime: 1 };
    const b = { ...mk(5, "A", "old"), blockTime: 999 };
    expect(markSupersession([a, b])[0]?.signature).toBe("new");
  });
});
