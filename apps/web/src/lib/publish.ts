// Builds, simulates, checks and sends a claim transaction (docs/SPEC.md section 4).
// This module never signs: signing happens inside the person's own wallet (wallet.ts).
import {
  AccountRole,
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  address,
  type Instruction,
  type Transaction,
} from "@solana/kit";
import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget";
import {
  MEMO_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  ZERO_TRANSFER_DATA,
  b58encode,
  claimMintTag,
  defaultTags,
  feedTag,
  isPubkey,
  parseClaimTransaction,
  parseMemo,
  type RpcTransaction,
} from "@datum/protocol";
import { RpcFailure, type RpcClient } from "./rpc";

/** Base fee per signature, in lamports (docs/DECISIONS.md D-021). */
export const BASE_FEE_LAMPORTS = 5000;
/** Compute unit price in micro-lamports per CU. Fixed in v0 (D-045). */
export const CU_PRICE_MICROLAMPORTS = 1000;
/** Limit used only while simulating, to measure the real usage. */
export const SIMULATION_CU_LIMIT = 1_400_000;
/** Headroom over the simulated usage, in percent (D-045). */
export const CU_HEADROOM_PERCENT = 15;

/** Fee in lamports: base fee plus the priority fee, rounded up, exactly as the network charges it (D-021). */
export function feeLamports(cuLimit: number, microLamportsPerCu: number = CU_PRICE_MICROLAMPORTS): number {
  return BASE_FEE_LAMPORTS + Math.ceil((cuLimit * microLamportsPerCu) / 1_000_000);
}

export type Blockhash = { blockhash: string; lastValidBlockHeight: number };

export type DraftInput = { publisher: string; memo: string; blockhash: Blockhash; cuLimit: number; cuPrice?: number };

const enc = new TextEncoder();

/** The unsigned claim transaction: compute budget, memo, zero transfer with the two tags. Legacy format (D-045). */
export async function buildClaimTransaction(input: DraftInput): Promise<Transaction> {
  const parsed = parseMemo(input.memo);
  if (!parsed.ok) throw new Error(parsed.reason);
  if (!isPubkey(input.publisher)) throw new Error("Not a wallet address.");
  const publisher = address(input.publisher);
  const tag = address(await claimMintTag(parsed.memo.m));
  const feed = address(await feedTag());
  const price = input.cuPrice ?? CU_PRICE_MICROLAMPORTS;

  const instructions: Instruction[] = [getSetComputeUnitLimitInstruction({ units: input.cuLimit })];
  if (price > 0) instructions.push(getSetComputeUnitPriceInstruction({ microLamports: price }));
  instructions.push(
    // The Memo program takes no accounts here: it requires every account passed to it to be a signer (SPEC section 4).
    { programAddress: address(MEMO_PROGRAM_ID), data: enc.encode(input.memo) },
    {
      programAddress: address(SYSTEM_PROGRAM_ID),
      accounts: [
        { address: publisher, role: AccountRole.WRITABLE_SIGNER },
        { address: publisher, role: AccountRole.WRITABLE_SIGNER },
        { address: tag, role: AccountRole.READONLY },
        { address: feed, role: AccountRole.READONLY },
      ],
      data: ZERO_TRANSFER_DATA,
    },
  );

  return pipe(
    createTransactionMessage({ version: "legacy" }),
    (m) => setTransactionMessageFeePayer(publisher, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: input.blockhash.blockhash as never, lastValidBlockHeight: BigInt(input.blockhash.lastValidBlockHeight) }, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
    (m) => compileTransaction(m),
  );
}

export const toBase64 = (tx: Transaction): string => getBase64EncodedWireTransaction(tx);

export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Reads wire bytes (signed or not) into the shape the protocol parser takes, plus what is outside the claim. */
export function inspectWire(bytes: Uint8Array): { tx: RpcTransaction; signatures: number; extraPrograms: string[]; feePayer: string; signed: boolean; sizeBytes: number; blockhash: string } {
  const decoded = getTransactionDecoder().decode(bytes);
  const message = getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);
  if (message.version !== "legacy") throw new Error("Only legacy transactions are supported.");
  const keys = message.staticAccounts.map(String);
  const instructions = message.instructions.map((ix) => ({
    programIdIndex: ix.programAddressIndex,
    accounts: [...(ix.accountIndices ?? [])],
    data: b58encode(new Uint8Array(ix.data ?? [])),
  }));
  const allowed = new Set([MEMO_PROGRAM_ID, SYSTEM_PROGRAM_ID, "ComputeBudget111111111111111111111111111111"]);
  const extraPrograms = [...new Set(instructions.map((ix) => keys[ix.programIdIndex] ?? "?").filter((p) => !allowed.has(p)))];
  const sigs = Object.values(decoded.signatures);
  return {
    tx: {
      slot: 0,
      blockTime: null,
      meta: { err: null },
      transaction: {
        message: {
          header: { numRequiredSignatures: message.header.numSignerAccounts, numReadonlyUnsignedAccounts: message.header.numReadonlyNonSignerAccounts },
          accountKeys: keys,
          instructions,
        },
      },
    },
    signatures: sigs.length,
    extraPrograms,
    feePayer: keys[0] ?? "",
    signed: sigs.length > 0 && sigs.every((s) => s !== null),
    sizeBytes: bytes.length,
    blockhash: String((message as { lifetimeToken?: string }).lifetimeToken ?? ""),
  };
}

export type SigningCheck = { ok: true; extraPrograms: string[]; signature: string } | { ok: false; reason: string };

/**
 * After the wallet signed: the bytes must still be exactly the claim that was shown.
 * It must parse as a valid claim for the same mint, publisher and memo text, be signed by the fee payer,
 * and keep the same blockhash. Extra instructions added by the wallet (guards) are reported, not hidden.
 */
export async function checkSigned(signed: Uint8Array, expect: { publisher: string; memo: string; blockhash: string }): Promise<SigningCheck> {
  let info: ReturnType<typeof inspectWire>;
  try {
    info = inspectWire(signed);
  } catch {
    return { ok: false, reason: "The wallet returned something that is not a readable transaction." };
  }
  if (info.feePayer !== expect.publisher) return { ok: false, reason: "The wallet changed the fee payer." };
  if (!info.signed) return { ok: false, reason: "The transaction is not signed." };
  if (info.blockhash !== expect.blockhash) return { ok: false, reason: "The wallet changed the blockhash." };
  const parsedMemo = parseMemo(expect.memo);
  if (!parsedMemo.ok) return { ok: false, reason: "The memo is not valid." };
  const parsed = await parseClaimTransaction(info.tx, "pending", await defaultTags(await feedTag()));
  if (!parsed.ok) return { ok: false, reason: `The signed transaction is not the claim that was shown: ${parsed.reason}` };
  if (parsed.claim.memoText !== expect.memo) return { ok: false, reason: "The memo in the signed transaction is different from the one shown." };
  if (parsed.claim.publisher !== expect.publisher) return { ok: false, reason: "The publisher changed." };
  const first = Object.values(getTransactionDecoder().decode(signed).signatures)[0];
  return { ok: true, extraPrograms: info.extraPrograms, signature: first ? b58encode(new Uint8Array(first)) : "" };
}

// ---------- simulation ----------

type SimValue = { err: unknown; logs: string[] | null; unitsConsumed?: number };
export type Simulation = { ok: true; unitsConsumed: number } | { ok: false; reason: string; logs: string[] };

function simFailure(err: unknown): string {
  if (typeof err === "string") return err === "BlockhashNotFound" ? "The blockhash expired. Start again." : err === "AccountNotFound" || err === "InsufficientFundsForFee" ? "This wallet does not have enough SOL for the network fee." : `The network refused it: ${err}.`;
  return "The network refused it.";
}

export async function simulate(rpc: RpcClient, wire: Uint8Array | Transaction, opts: { signed: boolean }): Promise<Simulation> {
  const b64 = wire instanceof Uint8Array ? btoa(String.fromCharCode(...wire)) : toBase64(wire);
  const config = opts.signed
    ? { encoding: "base64", commitment: "confirmed", sigVerify: true }
    : { encoding: "base64", commitment: "confirmed", sigVerify: false, replaceRecentBlockhash: true };
  const r = await rpc.call<{ value: SimValue }>("simulateTransaction", [b64, config]);
  const v = r?.value;
  if (!v || typeof v !== "object") throw new RpcFailure("bad_response", "The RPC answer could not be read.");
  if (v.err !== null) return { ok: false, reason: simFailure(v.err), logs: v.logs ?? [] };
  if (typeof v.unitsConsumed !== "number") throw new RpcFailure("bad_response", "The simulation did not report compute units.");
  return { ok: true, unitsConsumed: v.unitsConsumed };
}

export type Prepared = {
  tx: Transaction;
  base64: string;
  memo: string;
  publisher: string;
  blockhash: Blockhash;
  cuLimit: number;
  feeLamports: number;
  sizeBytes: number;
};

/**
 * Builds the claim, measures its compute use with a simulation, rebuilds it with a limit that fits,
 * and returns it with the fee to show before signing. Sends nothing.
 */
export async function prepareClaim(rpc: RpcClient, publisher: string, memo: string): Promise<{ ok: true; prepared: Prepared } | { ok: false; reason: string; logs: string[] }> {
  rpc.clear();
  const bh = await rpc.call<{ value: Blockhash }>("getLatestBlockhash", [{ commitment: "confirmed" }]);
  const blockhash = bh?.value;
  if (!blockhash || typeof blockhash.blockhash !== "string" || typeof blockhash.lastValidBlockHeight !== "number") throw new RpcFailure("bad_response", "The RPC answer could not be read.");
  const draft = await buildClaimTransaction({ publisher, memo, blockhash, cuLimit: SIMULATION_CU_LIMIT });
  const sim = await simulate(rpc, draft, { signed: false });
  if (!sim.ok) return sim;
  const cuLimit = Math.min(SIMULATION_CU_LIMIT, Math.ceil((sim.unitsConsumed * (100 + CU_HEADROOM_PERCENT)) / 100));
  const tx = await buildClaimTransaction({ publisher, memo, blockhash, cuLimit });
  const base64 = toBase64(tx);
  return { ok: true, prepared: { tx, base64, memo, publisher, blockhash, cuLimit, feeLamports: feeLamports(cuLimit), sizeBytes: fromBase64(base64).length } };
}

// ---------- send and follow ----------

export type Landing = { state: "confirmed"; slot: number } | { state: "failed"; reason: string } | { state: "pending" };

/** Sends signed bytes through the relay. The same bytes always carry the same signature, so a retry cannot double-publish. */
export async function sendSigned(rpc: RpcClient, signed: Uint8Array): Promise<string> {
  const sig = await rpc.call<string>("sendTransaction", [btoa(String.fromCharCode(...signed)), { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed" }]);
  if (typeof sig !== "string" || sig.length < 60) throw new RpcFailure("bad_response", "The RPC answer could not be read.");
  return sig;
}

export async function checkLanding(rpc: RpcClient, signature: string): Promise<Landing> {
  rpc.clear();
  const r = await rpc.call<{ value: ({ slot: number; err: unknown; confirmationStatus?: string } | null)[] }>("getSignatureStatuses", [[signature]]);
  const s = r?.value?.[0];
  if (!s) return { state: "pending" };
  if (s.err !== null) return { state: "failed", reason: "The network recorded the transaction as failed. Nothing was published." };
  if (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized") return { state: "confirmed", slot: s.slot };
  return { state: "pending" };
}
