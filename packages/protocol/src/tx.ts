import { claimMintTag } from "./address";
import { b58decode } from "./base58";
import { MEMO_PROGRAM_ID, SYSTEM_PROGRAM_ID } from "./constants";
import { parseMemo, type Memo } from "./memo";

/** The parts of a `getTransaction` (encoding "json") response that Datum reads. */
export type RpcTransaction = {
  slot: number;
  blockTime?: number | null;
  meta: { err: unknown } | null;
  transaction: {
    message: {
      header: { numRequiredSignatures: number; numReadonlyUnsignedAccounts: number };
      accountKeys: string[];
      instructions: { programIdIndex: number; accounts: number[]; data: string }[];
    };
  };
};

export type Claim = {
  memo: Memo;
  memoText: string;
  publisher: string;
  signature: string;
  slot: number;
  blockTime: number | null;
};

export type ClaimParse = { ok: true; claim: Claim } | { ok: false; reason: string };

/** System Program Transfer of 0 lamports: u32 LE 2, then u64 LE 0. */
export function isZeroTransferData(d: Uint8Array): boolean {
  if (d.length !== 12) return false;
  if (d[0] !== 2 || d[1] !== 0 || d[2] !== 0 || d[3] !== 0) return false;
  for (let i = 4; i < 12; i++) if (d[i] !== 0) return false;
  return true;
}

export const ZERO_TRANSFER_DATA = new Uint8Array([2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

export type TagResolver = { feed: string; claimMint: (mint: string) => Promise<string> };

export async function defaultTags(feed: string): Promise<TagResolver> {
  return { feed, claimMint: claimMintTag };
}

const MEMO_PREFIX = '{"t":"datum/0"';
const startsWith = (b: Uint8Array, prefix: string): boolean => {
  if (b.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) if (b[i] !== prefix.charCodeAt(i)) return false;
  return true;
};

/**
 * Validates a transaction as a claim (docs/SPEC.md section 4) and parses its memo (section 5).
 * `tags.feed` is the FEED address; `tags.claimMint` derives CLAIM_MINT for the memo's mint.
 * Never throws.
 */
export async function parseClaimTransaction(tx: RpcTransaction | null, signature: string, tags: TagResolver): Promise<ClaimParse> {
  try {
    if (tx === null) return { ok: false, reason: "Transaction not found." };
    if (tx.meta === null || tx.meta.err !== null) return { ok: false, reason: "Transaction failed." };
    const msg = tx.transaction.message;
    const keys = msg.accountKeys;
    const publisher = keys[0];
    if (publisher === undefined) return { ok: false, reason: "No fee payer." };
    const memos: Uint8Array[] = [];
    for (const ix of msg.instructions) {
      if (keys[ix.programIdIndex] !== MEMO_PROGRAM_ID) continue;
      const data = b58decode(ix.data);
      if (data !== null && startsWith(data, MEMO_PREFIX)) memos.push(data);
    }
    if (memos.length !== 1) return { ok: false, reason: memos.length === 0 ? "No datum/0 memo instruction." : "More than one datum/0 memo instruction." };
    const memoBytes = memos[0] as Uint8Array;
    const parsed = parseMemo(memoBytes);
    if (!parsed.ok) return { ok: false, reason: parsed.reason };
    const claimTag = await tags.claimMint(parsed.memo.m);
    let transfers = 0;
    for (const ix of msg.instructions) {
      if (keys[ix.programIdIndex] !== SYSTEM_PROGRAM_ID) continue;
      const data = b58decode(ix.data);
      if (data === null || !isZeroTransferData(data)) continue;
      const a = ix.accounts;
      if (a.length !== 4) continue;
      if (!a.every((i) => Number.isInteger(i) && i >= 0 && i < keys.length)) continue;
      if (keys[a[0] as number] !== publisher || keys[a[1] as number] !== publisher) continue;
      if (keys[a[2] as number] !== claimTag || keys[a[3] as number] !== tags.feed) continue;
      // Both tags must be read-only, not signers: signers are the first numRequiredSignatures keys.
      const firstReadonly = keys.length - msg.header.numReadonlyUnsignedAccounts;
      const tagIndexes = [a[2] as number, a[3] as number];
      if (tagIndexes.some((i) => i < msg.header.numRequiredSignatures || i < firstReadonly)) continue;
      transfers++;
    }
    if (transfers !== 1) return { ok: false, reason: transfers === 0 ? "No matching tag transfer." : "More than one tag transfer." };
    return {
      ok: true,
      claim: {
        memo: parsed.memo,
        memoText: new TextDecoder().decode(memoBytes),
        publisher,
        signature,
        slot: tx.slot,
        blockTime: tx.blockTime ?? null,
      },
    };
  } catch {
    return { ok: false, reason: "Transaction could not be read." };
  }
}

// ---------- supersession (docs/SPEC.md section 7) ----------

export type OrderedClaim = Claim & { current: boolean };

/**
 * Marks the newest claim of each (publisher, mint) as current. `claims` must be in the order returned by
 * getSignaturesForAddress (newest first); within the same slot that order decides. Returns slot-descending order.
 */
export function markSupersession(claims: readonly Claim[]): OrderedClaim[] {
  const indexed = claims.map((c, i) => ({ c, i }));
  indexed.sort((a, b) => b.c.slot - a.c.slot || a.i - b.i);
  const seen = new Set<string>();
  return indexed.map(({ c }) => {
    const key = `${c.publisher}:${c.memo.m}`;
    const current = !seen.has(key);
    seen.add(key);
    return { ...c, current };
  });
}
