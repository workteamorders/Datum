import { describe, expect, it } from "vitest";
import { address, getCompiledTransactionMessageDecoder, getCompiledTransactionMessageEncoder, getTransactionEncoder, getTransactionDecoder, type Transaction } from "@solana/kit";
import { b58decode, buildMemo, claimMintTag, feedTag, parseClaimTransaction, defaultTags } from "@datum/protocol";
import {
  BASE_FEE_LAMPORTS, CU_PRICE_MICROLAMPORTS, buildClaimTransaction, checkLanding, checkSigned, feeLamports, fromBase64, inspectWire, prepareClaim, sendSigned, simulate, toBase64,
} from "../src/lib/publish";
import { RpcClient } from "../src/lib/rpc";
import { BONK, PUBLISHER, fakeRelay, type Handler } from "./helpers";

const BH = { blockhash: "4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi", lastValidBlockHeight: 123 };
const memo = buildMemo(BONK, [{ k: "mint_authority_none" }, { k: "decimals_eq", v: "5" }], "Test").text;
const client = (h: Handler) => {
  const relay = fakeRelay(h);
  return { relay, rpc: new RpcClient({ url: "/api/rpc", fetchImpl: relay.f, sleep: async () => {}, retries: 0, ttlMs: 0 }) };
};

function sign(tx: Transaction, sigByte = 7): Uint8Array {
  const signatures = Object.fromEntries(Object.keys(tx.signatures).map((k) => [k, new Uint8Array(64).fill(sigByte)]));
  return new Uint8Array(getTransactionEncoder().encode({ ...tx, signatures } as Transaction));
}

describe("fee", () => {
  it("is the base fee plus the priority fee, rounded up (D-021)", () => {
    expect(feeLamports(200_000, 20_000)).toBe(9000); // measured on mainnet: 5000 + 4000
    expect(feeLamports(0)).toBe(BASE_FEE_LAMPORTS);
    expect(feeLamports(1, 1)).toBe(BASE_FEE_LAMPORTS + 1);
    expect(feeLamports(100_000)).toBe(BASE_FEE_LAMPORTS + (100_000 * CU_PRICE_MICROLAMPORTS) / 1_000_000);
  });
});

describe("buildClaimTransaction", () => {
  it("builds a transaction that the protocol parser accepts as a claim", async () => {
    const tx = await buildClaimTransaction({ publisher: PUBLISHER, memo, blockhash: BH, cuLimit: 60_000 });
    const info = inspectWire(fromBase64(toBase64(tx)));
    expect(info.feePayer).toBe(PUBLISHER);
    expect(info.signed).toBe(false);
    expect(info.extraPrograms).toEqual([]);
    const parsed = await parseClaimTransaction(info.tx, "x", await defaultTags(await feedTag()));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.claim.memoText).toBe(memo);
      expect(parsed.claim.publisher).toBe(PUBLISHER);
    }
  });
  it("puts the tags last as read-only static accounts and gives the memo no accounts", async () => {
    const tx = await buildClaimTransaction({ publisher: PUBLISHER, memo, blockhash: BH, cuLimit: 60_000 });
    const { tx: rpc } = inspectWire(fromBase64(toBase64(tx)));
    const keys = rpc.transaction.message.accountKeys;
    expect(keys[0]).toBe(PUBLISHER);
    const first = keys.length - rpc.transaction.message.header.numReadonlyUnsignedAccounts;
    expect(keys.slice(first)).toContain(await claimMintTag(BONK));
    expect(keys.slice(first)).toContain(await feedTag());
    const memoIx = rpc.transaction.message.instructions.find((i) => keys[i.programIdIndex]?.startsWith("MemoSq4"));
    expect(memoIx?.accounts).toEqual([]);
    expect(new TextDecoder().decode(b58decode(memoIx!.data)!)).toBe(memo);
  });
  it("sets the limit and, by default, a price", async () => {
    const tx = await buildClaimTransaction({ publisher: PUBLISHER, memo, blockhash: BH, cuLimit: 12_345 });
    const ix = inspectWire(fromBase64(toBase64(tx))).tx.transaction.message.instructions;
    const cb = ix.filter((i) => i.data.length > 0 && b58decode(i.data)![0] === 2 && inspectWire(fromBase64(toBase64(tx))).tx.transaction.message.accountKeys[i.programIdIndex]?.startsWith("ComputeBudget"));
    expect(cb).toHaveLength(1);
    const d = b58decode(cb[0]!.data)!;
    expect(new DataView(d.buffer, d.byteOffset).getUint32(1, true)).toBe(12_345);
    const noPrice = inspectWire(fromBase64(toBase64(await buildClaimTransaction({ publisher: PUBLISHER, memo, blockhash: BH, cuLimit: 1, cuPrice: 0 })))).tx.transaction.message.instructions;
    expect(noPrice.length).toBe(ix.length - 1);
  });
  it("stays well under the 1232-byte limit with the largest valid memo", async () => {
    const big = buildMemo(BONK, [{ k: "mint_authority_none" }, { k: "freeze_authority_none" }, { k: "supply_max", v: "18446744073709551615" }, { k: "decimals_eq", v: "5" }, { k: "token_program", v: "token-2022" }, { k: "metadata_immutable" }, { k: "update_authority_eq", v: BONK }, { k: "t22_transfer_fee_max_bps", v: "10000" }], "A label with forty-eight characters of text ok").text;
    const tx = await buildClaimTransaction({ publisher: PUBLISHER, memo: big, blockhash: BH, cuLimit: 200_000 });
    expect(fromBase64(toBase64(tx)).length).toBe(784); // measured and simulated on mainnet (docs/DECISIONS.md D-045)
  });
  it("refuses a memo or publisher that is not valid", async () => {
    await expect(buildClaimTransaction({ publisher: PUBLISHER, memo: "{}", blockhash: BH, cuLimit: 1 })).rejects.toThrow();
    await expect(buildClaimTransaction({ publisher: "nope", memo, blockhash: BH, cuLimit: 1 })).rejects.toThrow();
  });
});

describe("checkSigned", () => {
  async function signedFor(m = memo) {
    const tx = await buildClaimTransaction({ publisher: PUBLISHER, memo: m, blockhash: BH, cuLimit: 60_000 });
    return { tx, signed: sign(tx) };
  }
  it("accepts the claim the wallet signed and returns its signature", async () => {
    const { signed } = await signedFor();
    const r = await checkSigned(signed, { publisher: PUBLISHER, memo, blockhash: BH.blockhash });
    expect(r.ok).toBe(true);
    if (r.ok) expect(b58decode(r.signature)?.length).toBe(64);
  });
  it("rejects unsigned bytes", async () => {
    const tx = await buildClaimTransaction({ publisher: PUBLISHER, memo, blockhash: BH, cuLimit: 60_000 });
    expect(await checkSigned(fromBase64(toBase64(tx)), { publisher: PUBLISHER, memo, blockhash: BH.blockhash })).toMatchObject({ ok: false });
  });
  it("rejects a different memo, publisher or blockhash", async () => {
    const { signed } = await signedFor();
    const other = buildMemo(BONK, [{ k: "freeze_authority_none" }], "Test").text;
    expect(await checkSigned(signed, { publisher: PUBLISHER, memo: other, blockhash: BH.blockhash })).toMatchObject({ ok: false });
    expect(await checkSigned(signed, { publisher: BONK, memo, blockhash: BH.blockhash })).toMatchObject({ ok: false });
    expect(await checkSigned(signed, { publisher: PUBLISHER, memo, blockhash: "11111111111111111111111111111111" })).toMatchObject({ ok: false });
  });
  it("rejects bytes that are not a transaction", async () => {
    expect(await checkSigned(new Uint8Array([1, 2, 3]), { publisher: PUBLISHER, memo, blockhash: BH.blockhash })).toMatchObject({ ok: false });
  });
  it("rejects a transaction whose claim shape was altered (a tag swapped)", async () => {
    const { tx } = await signedFor();
    const wire = fromBase64(toBase64(tx));
    // Replace the FEED key bytes inside the message with CLAIM_MINT of another mint.
    const feed = b58decode(await feedTag())!;
    const alt = b58decode(await claimMintTag("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"))!;
    const at = wire.findIndex((_, i) => feed.every((b, j) => wire[i + j] === b));
    expect(at).toBeGreaterThan(0);
    wire.set(alt, at);
    const decoded = getTransactionDecoder().decode(wire);
    const signed = sign(decoded as Transaction);
    expect(await checkSigned(signed, { publisher: PUBLISHER, memo, blockhash: BH.blockhash })).toMatchObject({ ok: false });
  });
  it("lists programs the wallet added without hiding them", async () => {
    // The wallet appends a guard instruction from another program: the claim stays valid and the program is reported.
    const base = await buildClaimTransaction({ publisher: PUBLISHER, memo, blockhash: BH, cuLimit: 60_000 });
    const decoded = getCompiledTransactionMessageDecoder().decode(base.messageBytes);
    if (decoded.version !== "legacy") throw new Error("expected legacy");
    const guard = address(BONK); // any other program address stands in for a wallet guard program
    const msg = { ...decoded, staticAccounts: [...decoded.staticAccounts, guard], instructions: [...decoded.instructions, { programAddressIndex: decoded.staticAccounts.length, data: new Uint8Array([1]) }] };
    const messageBytes = getCompiledTransactionMessageEncoder().encode(msg as never);
    const tx = { ...base, messageBytes } as Transaction;
    const r = await checkSigned(sign(tx), { publisher: PUBLISHER, memo, blockhash: BH.blockhash });
    expect(r).toMatchObject({ ok: true, extraPrograms: [BONK] });
  });
});

describe("simulation and preparation", () => {
  it("measures compute units and sets a limit with headroom, then reports the fee", async () => {
    const { rpc, relay } = client((method, params) => {
      if (method === "getLatestBlockhash") return { context: { slot: 1 }, value: BH };
      if (method === "simulateTransaction") return { context: { slot: 1 }, value: { err: null, logs: [], unitsConsumed: 41_144 } };
      throw new Error(`${method} ${JSON.stringify(params)}`);
    });
    const r = await prepareClaim(rpc, PUBLISHER, memo);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.prepared.cuLimit).toBe(Math.ceil(41_144 * 1.15));
    expect(r.prepared.feeLamports).toBe(BASE_FEE_LAMPORTS + Math.ceil((r.prepared.cuLimit * CU_PRICE_MICROLAMPORTS) / 1_000_000));
    expect(r.prepared.sizeBytes).toBeLessThan(1232);
    const sim = relay.calls.find((c) => c.method === "simulateTransaction")!;
    expect(sim.params[1]).toMatchObject({ sigVerify: false, replaceRecentBlockhash: true, commitment: "confirmed", encoding: "base64" });
    // Only reads and a simulation: nothing was sent.
    expect(relay.calls.map((c) => c.method)).not.toContain("sendTransaction");
  });
  it("never asks for more than the simulation limit", async () => {
    const { rpc } = client((m) => (m === "getLatestBlockhash" ? { context: { slot: 1 }, value: BH } : { context: { slot: 1 }, value: { err: null, logs: [], unitsConsumed: 1_399_999 } }));
    const r = await prepareClaim(rpc, PUBLISHER, memo);
    expect(r.ok && r.prepared.cuLimit).toBe(1_400_000);
  });
  it("turns a failed simulation into a plain reason with the logs", async () => {
    const { rpc } = client((m) => (m === "getLatestBlockhash" ? { context: { slot: 1 }, value: BH } : { context: { slot: 1 }, value: { err: "AccountNotFound", logs: ["x"] } }));
    const r = await prepareClaim(rpc, PUBLISHER, memo);
    expect(r).toMatchObject({ ok: false, logs: ["x"] });
    if (!r.ok) expect(r.reason).toMatch(/enough SOL/);
  });
  it("re-simulates signed bytes with signature verification", async () => {
    const tx = await buildClaimTransaction({ publisher: PUBLISHER, memo, blockhash: BH, cuLimit: 60_000 });
    const { rpc, relay } = client(() => ({ context: { slot: 1 }, value: { err: null, logs: [], unitsConsumed: 1 } }));
    await simulate(rpc, sign(tx), { signed: true });
    expect(relay.calls[0]?.params[1]).toEqual({ encoding: "base64", commitment: "confirmed", sigVerify: true });
  });
  it("reports a rate-limited simulation as a failure to throw, not as a result", async () => {
    const { rpc } = client(() => { throw new Response(JSON.stringify({ error: { code: -32005, message: "x" } }), { status: 429 }); });
    await expect(simulate(rpc, new Uint8Array(3), { signed: true })).rejects.toMatchObject({ kind: "rate_limit" });
  });
});

describe("send and follow", () => {
  const SIG = "5".repeat(88);
  it("sends base64 with preflight on, through the relay only", async () => {
    const { rpc, relay } = client(() => SIG);
    expect(await sendSigned(rpc, new Uint8Array([1, 2, 3]))).toBe(SIG);
    expect(relay.calls[0]).toEqual({ method: "sendTransaction", params: ["AQID", { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed" }] });
  });
  it("follows the signature to confirmed, pending and failed", async () => {
    const r = (v: unknown) => client(() => ({ context: { slot: 1 }, value: [v] })).rpc;
    expect(await checkLanding(r({ slot: 9, err: null, confirmationStatus: "confirmed" }), SIG)).toEqual({ state: "confirmed", slot: 9 });
    expect(await checkLanding(r({ slot: 9, err: null, confirmationStatus: "processed" }), SIG)).toEqual({ state: "pending" });
    expect(await checkLanding(r(null), SIG)).toEqual({ state: "pending" });
    expect(await checkLanding(r({ slot: 9, err: { InstructionError: [0, "x"] } }), SIG)).toMatchObject({ state: "failed" });
  });
});
