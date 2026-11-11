import { isPubkey } from "./base58";
import {
  KEY_MAX_BYTES,
  LABEL_MAX_BYTES,
  MAX_PREDICATES,
  MEMO_MAX_BYTES,
  SCHEMA,
  VALUE_MAX_BYTES,
} from "./constants";
import { predicateDef, validateValue } from "./predicates";

export type PredicateEntry = { k: string; v?: string };
export type Memo = { t: typeof SCHEMA; m: string; p: PredicateEntry[]; n?: string };
export type ParseResult = { ok: true; memo: Memo; bytes: number } | { ok: false; reason: string };

const KEY_RE = /^[a-z][a-z0-9_]{0,31}$/;
const VALUE_RE = /^[A-Za-z0-9._:-]{1,64}$/;
const LABEL_RE = /^[A-Za-z0-9 .,!?'-]{1,48}$/;

const enc = new TextEncoder();
export const byteLength = (s: string): number => enc.encode(s).length;

/** Canonical serialization: fixed key order, no whitespace, no escapes. Assumes a valid memo. */
export function serializeMemo(memo: Memo): string {
  const p = memo.p.map((e) => (e.v === undefined ? `{"k":"${e.k}"}` : `{"k":"${e.k}","v":"${e.v}"}`));
  const n = memo.n === undefined ? "" : `,"n":"${memo.n}"`;
  return `{"t":"${memo.t}","m":"${memo.m}","p":[${p.join(",")}]${n}}`;
}

export function validateLabel(label: string): string | null {
  if (label === "") return "Label is empty.";
  if (label !== label.trim()) return "No spaces at the start or end.";
  if (byteLength(label) > LABEL_MAX_BYTES) return "Label is too long.";
  return LABEL_RE.test(label) ? null : "Use letters, numbers, spaces and . , ! ? ' - only.";
}

const fail = (reason: string): ParseResult => ({ ok: false, reason });

/** Validates a parsed JSON value against section 5 (without the canonical-bytes check). */
export function validateMemoValue(raw: unknown): ParseResult {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return fail("Memo is not an object.");
  const o = raw as Record<string, unknown>;
  const keys = Object.keys(o);
  for (const k of keys) if (k !== "t" && k !== "m" && k !== "p" && k !== "n") return fail("Unknown top-level field.");
  if (o.t !== SCHEMA) return fail("Schema is not datum/0.");
  if (typeof o.m !== "string" || !isPubkey(o.m)) return fail("Mint is not a valid 32-byte address.");
  if (!Array.isArray(o.p)) return fail("Predicates are not a list.");
  if (o.p.length < 1) return fail("No predicates.");
  if (o.p.length > MAX_PREDICATES) return fail("More than 8 predicates.");
  const seen = new Set<string>();
  const p: PredicateEntry[] = [];
  for (const item of o.p as unknown[]) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return fail("Predicate is not an object.");
    const e = item as Record<string, unknown>;
    for (const k of Object.keys(e)) if (k !== "k" && k !== "v") return fail("Unknown field in a predicate.");
    if (typeof e.k !== "string" || !KEY_RE.test(e.k) || byteLength(e.k) > KEY_MAX_BYTES) return fail("Predicate key is not allowed.");
    if (seen.has(e.k)) return fail("Duplicate predicate key.");
    seen.add(e.k);
    if (e.v !== undefined) {
      if (typeof e.v !== "string") return fail("Predicate value is not a string.");
      if (!VALUE_RE.test(e.v) || byteLength(e.v) > VALUE_MAX_BYTES) return fail("Predicate value is not allowed.");
    }
    const def = predicateDef(e.k);
    if (def) {
      if (def.kind === "none") {
        if (e.v !== undefined) return fail("Known predicate takes no value.");
      } else {
        if (e.v === undefined) return fail("Known predicate needs a value.");
        if (validateValue(def.kind, e.v) !== null) return fail("Predicate value is out of range.");
      }
    }
    p.push(e.v === undefined ? { k: e.k } : { k: e.k, v: e.v });
  }
  const memo: Memo = { t: SCHEMA, m: o.m, p };
  if (o.n !== undefined) {
    if (typeof o.n !== "string") return fail("Label is not a string.");
    if (validateLabel(o.n) !== null) return fail("Label has forbidden characters.");
    memo.n = o.n;
  }
  return { ok: true, memo, bytes: 0 };
}

/** Parses memo bytes or text. Returns a claim or a reason. Never throws. */
export function parseMemo(input: Uint8Array | string): ParseResult {
  try {
    let text: string;
    if (typeof input === "string") text = input;
    else {
      if (input.length > MEMO_MAX_BYTES) return fail("Memo is too long.");
      text = new TextDecoder("utf-8", { fatal: true }).decode(input);
    }
    const bytes = byteLength(text);
    if (bytes > MEMO_MAX_BYTES) return fail("Memo is too long.");
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return fail("Memo is not valid JSON.");
    }
    const v = validateMemoValue(raw);
    if (!v.ok) return v;
    if (serializeMemo(v.memo) !== text) return fail("Memo is not in canonical form.");
    return { ok: true, memo: v.memo, bytes };
  } catch {
    return fail("Memo could not be read.");
  }
}

/** Builds a canonical memo for publishing. Throws a readable Error when the input is not allowed. */
export function buildMemo(mint: string, p: readonly PredicateEntry[], label?: string): { text: string; bytes: number } {
  const memo: Memo = { t: SCHEMA, m: mint, p: p.map((e) => (e.v === undefined ? { k: e.k } : { k: e.k, v: e.v })) };
  if (label !== undefined && label !== "") memo.n = label;
  const v = validateMemoValue(memo);
  if (!v.ok) throw new Error(v.reason);
  const text = serializeMemo(memo);
  const bytes = byteLength(text);
  if (bytes > MEMO_MAX_BYTES) throw new Error("Memo is too long.");
  return { text, bytes };
}
