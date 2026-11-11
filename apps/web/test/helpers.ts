import { readFileSync } from "node:fs";
import { MEMO_PROGRAM_ID, SYSTEM_PROGRAM_ID, ZERO_TRANSFER_DATA, b58encode, buildMemo, claimMintTag, feedTag, type RpcTransaction } from "@datum/protocol";

type Fx = Record<string, { address?: string; owner?: string; data: string }>;
export const FX = JSON.parse(readFileSync(new URL("../../../packages/protocol/fixtures/mainnet-accounts.json", import.meta.url), "utf8")) as Fx;
export const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
export const PUBLISHER = "7p9vKmJgcGiFsPEEoPvVevREc4MGsKRVTh4n7FJPLwCm";
const enc = new TextEncoder();

export type Json = Record<string, unknown>;
export type Handler = (method: string, params: unknown[]) => unknown | Promise<unknown>;

/** A fetch that behaves like the relay: calls `handler`; a thrown Response is returned as is. */
export function fakeRelay(handler: Handler) {
  const calls: { method: string; params: unknown[] }[] = [];
  const f = (async (_url: unknown, init?: RequestInit) => {
    const req = JSON.parse(String(init?.body)) as { id: number; method: string; params: unknown[] };
    calls.push({ method: req.method, params: req.params });
    try {
      const result = await handler(req.method, req.params);
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: req.id, result }), { status: 200 });
    } catch (e) {
      if (e instanceof Response) return e;
      throw e;
    }
  }) as unknown as typeof fetch;
  return { f, calls };
}

export const b64 = (fx: string): string => (FX[fx] as { data: string }).data;

/** Slices base64 data like the RPC does for dataSlice. */
export function account(fx: string, config: { dataSlice?: { offset: number; length: number } } = {}) {
  const e = FX[fx] as { owner: string; data: string };
  let bytes = new Uint8Array(Buffer.from(e.data, "base64"));
  if (config.dataSlice) bytes = bytes.slice(config.dataSlice.offset, config.dataSlice.offset + config.dataSlice.length);
  return { owner: e.owner, lamports: 1, executable: false, rentEpoch: 0, data: [Buffer.from(bytes).toString("base64"), "base64"] };
}

export async function claimTx(over: { mint?: string; memo?: string; slot?: number; publisher?: string; predicates?: { k: string; v?: string }[] } = {}): Promise<RpcTransaction> {
  const mint = over.mint ?? BONK;
  const memo = over.memo ?? buildMemo(mint, over.predicates ?? [{ k: "mint_authority_none" }], "Test").text;
  const tag = await claimMintTag(mint);
  const feed = await feedTag();
  const keys = [over.publisher ?? PUBLISHER, tag, feed, SYSTEM_PROGRAM_ID, MEMO_PROGRAM_ID];
  return {
    slot: over.slot ?? 100,
    blockTime: 1_700_000_000,
    meta: { err: null },
    transaction: {
      message: {
        header: { numRequiredSignatures: 1, numReadonlyUnsignedAccounts: 4 },
        accountKeys: keys,
        instructions: [
          { programIdIndex: 4, accounts: [], data: b58encode(enc.encode(memo)) },
          { programIdIndex: 3, accounts: [0, 0, 1, 2], data: b58encode(ZERO_TRANSFER_DATA) },
        ],
      },
    },
  };
}
