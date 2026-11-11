// A small fake Solana RPC for tests and screenshots. It serves real mainnet account fixtures, synthetic claims,
// and records "sent" transactions in memory. It never touches a network.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getTransactionDecoder } from "@solana/kit";
import {
  MEMO_PROGRAM_ID, SYSTEM_PROGRAM_ID, ZERO_TRANSFER_DATA, b58encode, buildMemo, claimMintTag, decodeMetaplex, decodeMint, defaultTags, feedTag,
  metaplexMetadataAddress, METAPLEX_METADATA_PROGRAM_ID, parseClaimTransaction, programDataAddress, SPL_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
  type RpcTransaction,
} from "@datum/protocol";
import { inspectWire, fromBase64 } from "../src/lib/publish";
import { GENESIS } from "../src/lib/cluster";

type Fx = Record<string, { address?: string; owner?: string; data: string }>;
const FX = JSON.parse(readFileSync(join(process.cwd(), "../../packages/protocol/fixtures/mainnet-accounts.json"), "utf8")) as Fx;

export const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
export const PYUSD = "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo";
/** A valid address for which every read fails (503), and one that does not exist. */
export const MINT_BROKEN = "So11111111111111111111111111111111111111112";
export const MINT_MISSING = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
/** A mint whose claim history cannot be read, while the mint itself can. */
export const OTHER_WALLET = "7p9vKmJgcGiFsPEEoPvVevREc4MGsKRVTh4n7FJPLwCm";
export const SECOND_WALLET = "3Kzh9qAqVWQhnxFKgtKtqLHMk8PA3vVYfPMtfvX3Lrqq";

const b64 = (k: string) => (FX[k] as { data: string }).data;
const bytes = (k: string) => new Uint8Array(Buffer.from(b64(k), "base64"));
const owner = (k: string) => (FX[k] as { owner: string }).owner;

export type Account = { owner: string; data: Uint8Array };
type Row = { signature: string; slot: number; err: unknown; memo: string | null; blockTime: number };

export class MockChain {
  slot = 467_900_000;
  /** Seeded claims count down from here, so a claim sent during a test always lands newer than every seeded one. */
  private seedSlot = 467_900_000;
  cluster: keyof typeof GENESIS = "mainnet";
  accounts = new Map<string, Account>();
  rows = new Map<string, Row[]>(); // newest first, keyed by tag address
  txs = new Map<string, RpcTransaction | "fail">();
  sent: string[] = [];
  statuses = new Map<string, unknown>();
  sigCounter = 0;
  /** When set, simulateTransaction reports this error. */
  simError: string | null = null;
  /** Number of getSignaturesForAddress calls to fail before answering. */
  failHistoryFor = new Set<string>();
  /** The next sendTransaction is accepted but never lands. */
  holdNext = false;

  async init(): Promise<this> {
    this.accounts.set(USDC, { owner: owner("USDC"), data: bytes("USDC") });
    this.accounts.set(BONK, { owner: owner("BONK"), data: bytes("BONK") });
    this.accounts.set(PYUSD, { owner: owner("PYUSD"), data: bytes("PYUSD") });
    this.accounts.set(await metaplexMetadataAddress(USDC, METAPLEX_METADATA_PROGRAM_ID), { owner: owner("USDC_META"), data: bytes("USDC_META") });
    this.accounts.set(await metaplexMetadataAddress(BONK, METAPLEX_METADATA_PROGRAM_ID), { owner: owner("BONK_META"), data: bytes("BONK_META") });
    this.accounts.set(SPL_TOKEN_PROGRAM_ID, { owner: owner("TOKENKEG"), data: bytes("TOKENKEG") });
    this.accounts.set(programDataAddress(bytes("TOKENKEG")), { owner: owner("TOKENKEG"), data: bytes("TOKENKEG_PD") });
    this.accounts.set(TOKEN_2022_PROGRAM_ID, { owner: owner("TOKEN2022"), data: bytes("TOKEN2022") });
    this.accounts.set(programDataAddress(bytes("TOKEN2022")), { owner: owner("TOKEN2022"), data: bytes("TOKEN2022_PD") });
    return this;
  }

  usdcMintAuthority(): string {
    const m = decodeMint(owner("USDC"), bytes("USDC"));
    return m.mintAuthority as string;
  }
  bonkUpdateAuthority(): string {
    return decodeMetaplex(bytes("BONK_META")).updateAuthority;
  }

  private newSig(): string {
    const b = new Uint8Array(64);
    let n = ++this.sigCounter;
    for (let i = 0; i < 8; i++) { b[i] = n & 255; n >>= 8; }
    for (let i = 8; i < 64; i++) b[i] = (i * 37 + this.sigCounter * 11) & 255;
    return b58encode(b);
  }

  /** Adds a published claim to the history of its mint tag and of the feed. */
  async addClaim(o: { mint: string; publisher: string; predicates: { k: string; v?: string }[]; label?: string; slot?: number; raw?: { memo: string; tx?: Partial<RpcTransaction> } }): Promise<string> {
    const slot = o.slot ?? (this.seedSlot -= 100);
    const memo = o.raw?.memo ?? buildMemo(o.mint, o.predicates, o.label).text;
    const signature = this.newSig();
    const tag = await claimMintTag(o.mint);
    const feed = await feedTag();
    const keys = [o.publisher, tag, feed, SYSTEM_PROGRAM_ID, MEMO_PROGRAM_ID];
    const enc = new TextEncoder();
    const tx: RpcTransaction = {
      slot, blockTime: 1_762_000_000 + slot - 467_000_000, meta: { err: null },
      transaction: { message: { header: { numRequiredSignatures: 1, numReadonlyUnsignedAccounts: 4 }, accountKeys: keys, instructions: [
        { programIdIndex: 4, accounts: [], data: b58encode(enc.encode(memo)) },
        { programIdIndex: 3, accounts: [0, 0, 1, 2], data: b58encode(ZERO_TRANSFER_DATA) },
      ] } },
      ...(o.raw?.tx ?? {}),
    };
    this.txs.set(signature, tx);
    const row: Row = { signature, slot, err: null, memo: `[${memo.length}] ${memo}`, blockTime: tx.blockTime ?? 0 };
    for (const k of [tag, feed]) {
      const list = this.rows.get(k) ?? [];
      list.push(row);
      list.sort((a, b) => b.slot - a.slot);
      this.rows.set(k, list);
    }
    return signature;
  }

  async handle(method: string, params: unknown[]): Promise<unknown> {
    const ctx = { slot: this.slot };
    switch (method) {
      case "getGenesisHash":
        return GENESIS[this.cluster];
      case "getMultipleAccounts": {
        const [addrs, cfg] = params as [string[], { dataSlice?: { offset: number; length: number } }?];
        if (addrs.includes(MINT_BROKEN)) throw Object.assign(new Error("upstream"), { http: 503 });
        return { context: ctx, value: addrs.map((a) => this.view(a, cfg?.dataSlice)) };
      }
      case "getAccountInfo": {
        const [a, cfg] = params as [string, { dataSlice?: { offset: number; length: number } }?];
        return { context: ctx, value: this.view(a, cfg?.dataSlice) };
      }
      case "getSignaturesForAddress": {
        const [addr, cfg] = params as [string, { before?: string; limit?: number }];
        if (this.failHistoryFor.has(addr)) throw Object.assign(new Error("upstream"), { http: 503 });
        const list = this.rows.get(addr) ?? [];
        let start = 0;
        if (cfg.before) start = list.findIndex((r) => r.signature === cfg.before) + 1;
        return list.slice(start, start + (cfg.limit ?? 50)).map((r) => ({ ...r, confirmationStatus: "confirmed" }));
      }
      case "getTransaction": {
        const t = this.txs.get(params[0] as string);
        if (t === "fail") throw Object.assign(new Error("upstream"), { http: 503 });
        return t ?? null;
      }
      case "getLatestBlockhash":
        return { context: ctx, value: { blockhash: "4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi", lastValidBlockHeight: this.slot + 150 } };
      case "simulateTransaction": {
        const [b64tx, cfg] = params as [string, { sigVerify?: boolean }];
        if (this.simError) return { context: ctx, value: { err: this.simError, logs: ["Program log: mock failure"] } };
        const wire = fromBase64(b64tx);
        const info = inspectWire(wire);
        if (cfg.sigVerify && !info.signed) return { context: ctx, value: { err: "SignatureFailure", logs: [] } };
        const memoLen = info.tx.transaction.message.instructions.map((i) => i.data.length).reduce((a, b) => Math.max(a, b), 0);
        return { context: ctx, value: { err: null, logs: [], unitsConsumed: 450 + Math.round(memoLen * 0.9 * 300) } };
      }
      case "sendTransaction": {
        const wire = fromBase64(params[0] as string);
        const info = inspectWire(wire);
        const parsed = await parseClaimTransaction(info.tx, "x", await defaultTags(await feedTag()));
        if (!info.signed) throw Object.assign(new Error("unsigned"), { rpc: -32002, message: "Transaction signature verification failure" });
        const sig = b58encode(new Uint8Array(getTransactionDecoder().decode(wire).signatures[info.feePayer as never] as Uint8Array));
        this.sent.push(sig);
        if (this.holdNext) { this.holdNext = false; this.statuses.set(sig, null); return sig; }
        const landed = this.slot - 3;
        this.statuses.set(sig, { slot: landed, err: null, confirmationStatus: "confirmed" });
        if (parsed.ok) await this.addClaim({ mint: parsed.claim.memo.m, publisher: parsed.claim.publisher, predicates: parsed.claim.memo.p, label: parsed.claim.memo.n, slot: landed });
        return sig;
      }
      case "getSignatureStatuses": {
        const sigs = params[0] as string[];
        return { context: ctx, value: sigs.map((s) => (this.statuses.get(s) as unknown) ?? null) };
      }
      default:
        throw Object.assign(new Error("unsupported"), { rpc: -32601, message: `Method ${method} is not mocked.` });
    }
  }

  private view(a: string, slice?: { offset: number; length: number }) {
    const acc = this.accounts.get(a);
    if (!acc) return null;
    let d = acc.data;
    if (slice) d = d.slice(slice.offset, slice.offset + slice.length);
    return { owner: acc.owner, lamports: 1_000_000, executable: false, rentEpoch: 0, data: [Buffer.from(d).toString("base64"), "base64"] };
  }
}

/** Standard test world: claims for BONK, USDC, PYUSD and the feed. */
export async function seededChain(): Promise<MockChain> {
  const c = await new MockChain().init();
  const usdcAuth = c.usdcMintAuthority();
  const bonkMeta = c.bonkUpdateAuthority();
  // USDC: its mint authority publishes two statements; a stranger publishes a false and an unsupported one.
  await c.addClaim({ mint: USDC, publisher: usdcAuth, predicates: [{ k: "decimals_eq", v: "6" }, { k: "token_program", v: "spl-token" }], label: "Issuer facts" });
  await c.addClaim({ mint: USDC, publisher: OTHER_WALLET, predicates: [{ k: "mint_authority_none" }, { k: "freeze_authority_none" }], label: "Hopeful" });
  await c.addClaim({ mint: USDC, publisher: SECOND_WALLET, predicates: [{ k: "future_statement", v: "42" }] });
  // BONK: twelve claims so that "Load more" appears; one is superseded.
  await c.addClaim({ mint: BONK, publisher: OTHER_WALLET, predicates: [{ k: "mint_authority_none" }], label: "Later look" });
  await c.addClaim({ mint: BONK, publisher: OTHER_WALLET, predicates: [{ k: "mint_authority_none" }, { k: "decimals_eq", v: "5" }], label: "Earlier look" });
  await c.addClaim({ mint: BONK, publisher: bonkMeta, predicates: [{ k: "metadata_immutable" }, { k: "update_authority_eq", v: bonkMeta }] });
  const others = [OTHER_WALLET, SECOND_WALLET, PYUSD]; // any valid 32-byte address works as a wallet here
  for (let i = 0; i < 9; i++) {
    await c.addClaim({ mint: BONK, publisher: others[i % 3] as string, predicates: [{ k: "supply_max", v: `${88_000_000_000_000 + i}` }], label: `Cap ${i + 1}` });
  }
  // One malformed memo on BONK: the tag is present, the memo is not valid.
  await c.addClaim({ mint: BONK, publisher: OTHER_WALLET, predicates: [], raw: { memo: '{"t":"datum/0","m":"' + BONK + '","p":[]}' } });
  // PYUSD (Token-2022).
  await c.addClaim({ mint: PYUSD, publisher: OTHER_WALLET, predicates: [{ k: "t22_no_transfer_hook" }, { k: "t22_no_permanent_delegate" }, { k: "t22_transfer_fee_max_bps", v: "0" }], label: "T22 checks" });
  return c;
}
