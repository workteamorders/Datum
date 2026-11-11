// Reads claims (docs/SPEC.md section 6): per mint and from the feed. Reads only; sends nothing.
import {
  CLAIMS_PER_LOAD,
  SIGNATURES_PER_PAGE,
  claimMintTag,
  defaultTags,
  feedTag,
  markSupersession,
  parseClaimTransaction,
  type Claim,
  type OrderedClaim,
  type RpcTransaction,
  type TagResolver,
} from "@datum/protocol";
import { RpcFailure, type RpcClient } from "./rpc";

type SigRow = { signature: string; slot: number; err: unknown; memo: string | null; blockTime?: number | null };

export type ClaimPage = {
  /** Valid claims of this load, newest first, with supersession marked within this load plus earlier loads. */
  claims: Claim[];
  malformed: number;
  /** Pass as `before` to continue. Null when the history is exhausted. */
  next: string | null;
  /** Transactions that could not be read (RPC failure). They are not counted as malformed. */
  unreadable: number;
};

const MEMO_FILTER = '"t":"datum/0"';
const CONCURRENCY = 4;

async function mapLimit<T, R>(items: readonly T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k] as T);
      }
    }),
  );
  return out;
}

/**
 * Reads up to CLAIMS_PER_LOAD valid claims from the history of `address`.
 * `accept` is the extra rule of each reader (per mint: memo.m must equal the mint; feed: the tags are checked by the parser).
 */
async function readPage(rpc: RpcClient, address: string, tags: TagResolver, before: string | undefined, accept: (c: Claim) => boolean): Promise<ClaimPage> {
  const claims: Claim[] = [];
  let malformed = 0;
  let unreadable = 0;
  let cursor = before;
  for (;;) {
    const config: Record<string, unknown> = { limit: SIGNATURES_PER_PAGE, commitment: "confirmed" };
    if (cursor) config.before = cursor;
    const rows = await rpc.call<SigRow[]>("getSignaturesForAddress", [address, config]);
    if (!Array.isArray(rows)) throw new RpcFailure("bad_response", "The RPC answer could not be read.");
    if (rows.length === 0) return { claims, malformed, next: null, unreadable };

    // Step 2 and 3 of the read: skip failed transactions, then pre-filter on the memo field.
    const candidates = rows.map((r, idx) => ({ r, idx })).filter(({ r }) => r.err === null && typeof r.memo === "string" && r.memo.includes(MEMO_FILTER));
    const txs = await mapLimit(candidates, CONCURRENCY, async ({ r }) => {
      try {
        return { r, tx: await rpc.call<RpcTransaction | null>("getTransaction", [r.signature, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]) };
      } catch {
        return { r, tx: undefined };
      }
    });

    let stoppedAt = -1;
    for (let k = 0; k < candidates.length; k++) {
      const item = txs[k];
      const cand = candidates[k];
      if (!item || !cand) continue;
      if (item.tx === undefined) {
        unreadable++;
        continue;
      }
      // Give the page a turn between transactions so a long page of claims never freezes typing or scrolling.
      await new Promise<void>((done) => setTimeout(done, 0));
      const parsed = await parseClaimTransaction(item.tx, item.r.signature, tags);
      if (!parsed.ok || !accept(parsed.claim)) {
        malformed++;
        continue;
      }
      claims.push(parsed.claim);
      if (claims.length >= CLAIMS_PER_LOAD) {
        stoppedAt = cand.idx;
        break;
      }
    }
    if (stoppedAt >= 0) {
      const last = rows[stoppedAt];
      // More may remain in this page or later pages: continue after the last signature read.
      return { claims, malformed, next: last ? last.signature : null, unreadable };
    }
    const lastRow = rows[rows.length - 1];
    if (rows.length < SIGNATURES_PER_PAGE || !lastRow) return { claims, malformed, next: null, unreadable };
    cursor = lastRow.signature;
  }
}

export async function readMintClaims(rpc: RpcClient, mint: string, before?: string): Promise<ClaimPage> {
  const [tag, feed] = await Promise.all([claimMintTag(mint), feedTag()]);
  const tags = await defaultTags(feed);
  return readPage(rpc, tag, tags, before, (c) => c.memo.m === mint);
}

export async function readFeedClaims(rpc: RpcClient, before?: string): Promise<ClaimPage> {
  const feed = await feedTag();
  const tags = await defaultTags(feed);
  return readPage(rpc, feed, tags, before, () => true);
}

/** Merges loads (newest first) and marks which claim of each (publisher, mint) is current. */
export function mergeClaims(loads: readonly Claim[][]): OrderedClaim[] {
  const seen = new Set<string>();
  const all: Claim[] = [];
  for (const load of loads) for (const c of load) if (!seen.has(c.signature)) (seen.add(c.signature), all.push(c));
  return markSupersession(all);
}
