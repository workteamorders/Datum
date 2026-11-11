import {
  DecodeError,
  decodeMetaplex,
  decodeMint,
  decodePumpCurve,
  decodeUpgradeStatus,
  type MetaplexInfo,
  type MintInfo,
} from "./decode";
import { SPL_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "./constants";
import { predicateDef } from "./predicates";
import type { Memo } from "./memo";

// ---------- inputs ----------

export type Fetched<T> = { state: "ok"; value: T } | { state: "not_found" } | { state: "error"; message: string };
export type RawAccount = { owner: string; data: Uint8Array };

/** Everything one evaluation needs, read once per mint (docs/SPEC.md section 8.1). */
export type Snapshot = {
  mint: string;
  /** Slot of the mint read, from the RPC response context. */
  slot: number;
  /** Device time (ms) when the response arrived. */
  observedAt: number;
  addresses: { mint: string; metaplex: string; pumpCurve: string; tokenProgram: string };
  mintAccount: Fetched<RawAccount>;
  metaplex: Fetched<RawAccount>;
  pumpCurve: Fetched<RawAccount>;
  /** Result of reading the token program's upgrade status, or an error. */
  programUpgrade: Fetched<{ hasUpgradeAuthority: boolean }>;
};

// ---------- outputs ----------

export type Status = "true" | "false" | "cannot_check" | "unsupported";
export type Stability = "permanent" | "can_change";
export type RelationKind =
  | "mint_authority"
  | "freeze_authority"
  | "metadata_update_authority"
  | "pump_creator"
  | "revoked"
  | "unrelated";

export type PredicateResult = {
  key: string;
  value?: string;
  status: Status;
  /** What was read, as text. */
  measured: string;
  /** Plain-language note, for example why a check could not be done. */
  note?: string;
  stability: Stability;
  stabilityReason: string;
  /** Accounts that were read for this result. */
  accounts: { name: string; address: string }[];
};

export type ClaimResult = { status: Status; predicates: PredicateResult[] };

// ---------- decoding the snapshot once ----------

type Part<T> = { ok: true; value: T } | { ok: false; kind: "error" | "not_found" | "undecodable"; message: string };

export type Decoded = {
  mint: Part<MintInfo>;
  /** Metaplex metadata: not_found is a normal result (no such account). */
  metaplex: Part<MetaplexInfo>;
  pump: { creator: string } | null;
  programUpgrade: Part<{ hasUpgradeAuthority: boolean }>;
};

function decodePart<T>(f: Fetched<RawAccount>, fn: (a: RawAccount) => T): Part<T> {
  if (f.state === "error") return { ok: false, kind: "error", message: f.message };
  if (f.state === "not_found") return { ok: false, kind: "not_found", message: "Account not found." };
  try {
    return { ok: true, value: fn(f.value) };
  } catch (e) {
    return { ok: false, kind: "undecodable", message: e instanceof DecodeError ? e.message : "Could not decode." };
  }
}

export function decodeSnapshot(s: Snapshot): Decoded {
  const mint = decodePart(s.mintAccount, (a) => decodeMint(a.owner, a.data));
  const metaplex = decodePart(s.metaplex, (a) => {
    const m = decodeMetaplex(a.data);
    if (m.mint !== s.mint) throw new DecodeError("metadata names a different mint");
    return m;
  });
  let pump: Decoded["pump"] = null;
  if (s.pumpCurve.state === "ok") {
    try {
      pump = decodePumpCurve(s.pumpCurve.value.owner, s.pumpCurve.value.data);
    } catch {
      pump = null;
    }
  }
  const programUpgrade: Part<{ hasUpgradeAuthority: boolean }> =
    s.programUpgrade.state === "ok"
      ? { ok: true, value: s.programUpgrade.value }
      : { ok: false, kind: s.programUpgrade.state === "error" ? "error" : "not_found", message: "Program status unavailable." };
  return { mint, metaplex, pump, programUpgrade };
}

// ---------- metadata sources ----------

type MetaSource = { name: string; updateAuthority: string | null; fixed: boolean };
type MetaSources = { state: "ok"; sources: MetaSource[] } | { state: "cannot_check"; why: string };

function metadataSources(s: Snapshot, d: Decoded, mint: MintInfo): MetaSources {
  const sources: MetaSource[] = [];
  // Metaplex account
  if (!d.metaplex.ok) {
    if (d.metaplex.kind !== "not_found") return { state: "cannot_check", why: "The Metaplex metadata account could not be read." };
  } else {
    sources.push({ name: "Metaplex metadata", updateAuthority: d.metaplex.value.updateAuthority, fixed: !d.metaplex.value.isMutable });
  }
  // Token-2022 pointer and embedded metadata
  const ptr = mint.extensions.metadataPointer;
  if (ptr) {
    const target = ptr.metadataAddress;
    if (target !== null && target !== s.mint && target !== s.addresses.metaplex) {
      return { state: "cannot_check", why: "The metadata pointer names an account Datum does not read." };
    }
    sources.push({ name: "Token-2022 metadata pointer", updateAuthority: null, fixed: ptr.authority === null });
  }
  const tm = mint.extensions.tokenMetadata;
  if (tm) sources.push({ name: "Token-2022 token metadata", updateAuthority: tm.updateAuthority, fixed: tm.updateAuthority === null });
  return { state: "ok", sources };
}

// ---------- helpers ----------

const fmtPk = (a: string | null): string => a ?? "None";
const fmtInt = (n: bigint | number): string => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function programName(m: MintInfo): string {
  return m.program === "spl-token" ? "SPL Token" : "Token-2022";
}

function accountsFor(s: Snapshot, which: ("mint" | "metaplex" | "program")[]): { name: string; address: string }[] {
  const out: { name: string; address: string }[] = [];
  if (which.includes("mint")) out.push({ name: "Mint account", address: s.addresses.mint });
  if (which.includes("metaplex")) out.push({ name: "Metaplex metadata account", address: s.addresses.metaplex });
  if (which.includes("program")) out.push({ name: "Token program", address: s.addresses.tokenProgram });
  return out;
}

const NOT_CHECKED = "Not checked, so no claim is made about whether it can change.";

function cannot(
  key: string,
  value: string | undefined,
  s: Snapshot,
  note: string,
  which: ("mint" | "metaplex" | "program")[] = ["mint"],
): PredicateResult {
  return { key, value, status: "cannot_check", measured: "Not read.", note, stability: "can_change", stabilityReason: NOT_CHECKED, accounts: accountsFor(s, which) };
}

function mintProblem(key: string, value: string | undefined, s: Snapshot, d: Decoded): PredicateResult | null {
  if (d.mint.ok) return null;
  const note =
    d.mint.kind === "error"
      ? "The RPC did not answer for the mint account. Check again in a moment."
      : d.mint.kind === "not_found"
        ? "The mint account was not found on this cluster."
        : d.mint.message === "unsupported owner"
          ? "The account is not owned by SPL Token or Token-2022."
          : "The mint account could not be decoded.";
  return cannot(key, value, s, note);
}

// ---------- stability (docs/SPEC.md section 11) ----------

type Stab = { stability: Stability; reason: string };

function closable(m: MintInfo): boolean {
  return m.program === "token-2022" && m.extensions.mintCloseAuthority !== undefined && m.extensions.mintCloseAuthority.authority !== null;
}

/** Applies P2 and P3 to a property whose P1 result is already known. */
function stabilize(d: Decoded, m: MintInfo, p1: boolean, p1Reason: string): Stab {
  if (!p1) return { stability: "can_change", reason: p1Reason };
  if (!d.programUpgrade.ok) {
    return { stability: "can_change", reason: "Whether the token program can be upgraded could not be read, so this is shown as Can change." };
  }
  if (d.programUpgrade.value.hasUpgradeAuthority) {
    return { stability: "can_change", reason: `${programName(m)} can be upgraded by its upgrade authority; under its current code this cannot change.` };
  }
  if (closable(m)) return { stability: "can_change", reason: "The mint can be closed by its close authority." };
  return { stability: "permanent", reason: `${programName(m)} cannot be upgraded, the mint cannot be closed, and its code gives no way to change this.` };
}

// ---------- evaluation ----------

function res(
  s: Snapshot,
  key: string,
  value: string | undefined,
  status: Status,
  measured: string,
  stab: Stab,
  which: ("mint" | "metaplex" | "program")[],
  note?: string,
): PredicateResult {
  return { key, value, status, measured, note, stability: stab.stability, stabilityReason: stab.reason, accounts: accountsFor(s, which) };
}

export function evaluatePredicate(s: Snapshot, d: Decoded, key: string, value?: string): PredicateResult {
  const def = predicateDef(key);
  if (!def) {
    return {
      key, value, status: "unsupported", measured: "Not read.",
      note: "This version of Datum does not know this statement.",
      stability: "can_change", stabilityReason: "This version of Datum does not know this statement, so it makes no claim about its stability.",
      accounts: [],
    };
  }
  const problem = mintProblem(key, value, s, d);
  if (problem) return problem;
  if (!d.mint.ok) throw new Error("unreachable");
  const m = d.mint.value;
  const which: ("mint" | "metaplex" | "program")[] = d.programUpgrade.ok ? ["mint", "program"] : ["mint"];

  switch (key) {
    case "mint_authority_none": {
      const ok = m.mintAuthority === null;
      const st = stabilize(d, m, ok, "A mint authority exists and can change the supply.");
      return res(s, key, value, ok ? "true" : "false", `Mint authority: ${fmtPk(m.mintAuthority)}.`, st, which);
    }
    case "freeze_authority_none": {
      const ok = m.freezeAuthority === null;
      const st = stabilize(d, m, ok, "A freeze authority exists and can freeze token accounts.");
      return res(s, key, value, ok ? "true" : "false", `Freeze authority: ${fmtPk(m.freezeAuthority)}.`, st, which);
    }
    case "supply_max": {
      if (m.extensions.confidentialMintBurn) {
        return cannot(key, value, s, "This mint has the confidential mint and burn extension, so part of its supply cannot be read.");
      }
      const limit = BigInt(value ?? "0");
      const ok = m.supply <= limit;
      const st = stabilize(d, m, ok && m.mintAuthority === null, m.mintAuthority !== null ? "Supply can change while a mint authority exists." : "Supply is above the limit and can only fall.");
      const diff = ok ? "" : `, which is ${fmtInt(m.supply - limit)} over the limit`;
      return res(s, key, value, ok ? "true" : "false", `Raw supply: ${fmtInt(m.supply)} base units${diff}.`, st, which);
    }
    case "decimals_eq": {
      const ok = String(m.decimals) === value;
      const st = stabilize(d, m, true, "");
      return res(s, key, value, ok ? "true" : "false", `Decimals: ${m.decimals}.`, st, which);
    }
    case "token_program": {
      const ok = m.program === value;
      const st = stabilize(d, m, true, "");
      return res(s, key, value, ok ? "true" : "false", `Token program: ${m.program}.`, st, which);
    }
    case "metadata_immutable":
    case "update_authority_eq": {
      const src = metadataSources(s, d, m);
      if (src.state === "cannot_check") return cannot(key, value, s, src.why, ["mint", "metaplex"]);
      const list = src.sources;
      const reason = "Metadata can change through its update authority or an upgrade, so this result is always shown as Can change in v0.";
      const st: Stab = { stability: "can_change", reason };
      const accts: ("mint" | "metaplex" | "program")[] = ["mint", "metaplex"];
      if (list.length === 0) {
        return res(s, key, value, "false", "No on-chain metadata found.", st, accts);
      }
      if (key === "metadata_immutable") {
        const ok = list.every((x) => x.fixed);
        const text = list.map((x) => `${x.name}: ${x.fixed ? "fixed" : "can be changed"}`).join("; ") + ".";
        return res(s, key, value, ok ? "true" : "false", text, st, accts);
      }
      const withAuth = list.filter((x) => x.name !== "Token-2022 metadata pointer");
      if (withAuth.length === 0) return res(s, key, value, "false", "No metadata source has an update authority.", st, accts);
      const ok = withAuth.every((x) => x.updateAuthority !== null && x.updateAuthority === value);
      const text = withAuth.map((x) => `${x.name}: ${fmtPk(x.updateAuthority)}`).join("; ") + ".";
      return res(s, key, value, ok ? "true" : "false", text, st, accts);
    }
    case "t22_no_permanent_delegate": {
      if (m.program === "spl-token") return res(s, key, value, "true", "Not a Token-2022 token.", stabilize(d, m, true, ""), which, "SPL Token has no extensions.");
      const delegate = m.extensions.permanentDelegate?.delegate ?? null;
      const ok = delegate === null;
      return res(s, key, value, ok ? "true" : "false", `Permanent delegate: ${fmtPk(delegate)}.`, stabilize(d, m, ok, "A permanent delegate exists."), which);
    }
    case "t22_no_transfer_hook": {
      if (m.program === "spl-token") return res(s, key, value, "true", "Not a Token-2022 token.", stabilize(d, m, true, ""), which, "SPL Token has no extensions.");
      const hook = m.extensions.transferHook;
      const ok = !hook || hook.programId === null;
      const fixed = !hook || hook.authority === null;
      return res(s, key, value, ok ? "true" : "false", `Transfer hook program: ${fmtPk(hook?.programId ?? null)}.`, stabilize(d, m, ok && fixed, ok ? "A hook authority exists and can set a hook program." : "A transfer hook program is set."), which);
    }
    case "t22_no_default_frozen": {
      if (m.program === "spl-token") return res(s, key, value, "true", "Not a Token-2022 token.", stabilize(d, m, true, ""), which, "SPL Token has no extensions.");
      const st = m.extensions.defaultAccountState?.state;
      const ok = st !== 2;
      const label = st === undefined ? "None" : st === 2 ? "Frozen" : "Initialized";
      return res(s, key, value, ok ? "true" : "false", `Default account state: ${label}.`, stabilize(d, m, ok && (st === undefined || m.freezeAuthority === null), ok ? "A freeze authority exists and can change the default state." : "New accounts start frozen."), which);
    }
    case "t22_transfer_fee_max_bps": {
      if (m.program === "spl-token") return res(s, key, value, "true", "Not a Token-2022 token.", stabilize(d, m, true, ""), which, "SPL Token has no extensions.");
      const fee = m.extensions.transferFee;
      const limit = Number(value ?? "0");
      const larger = fee ? Math.max(fee.older.bps, fee.newer.bps) : 0;
      const ok = larger <= limit;
      const text = fee
        ? `Transfer fee: ${fee.older.bps} basis points (from epoch ${fee.older.epoch}) and ${fee.newer.bps} basis points (from epoch ${fee.newer.epoch}).`
        : "No transfer fee extension (0 basis points).";
      return res(s, key, value, ok ? "true" : "false", text, stabilize(d, m, ok && (!fee || fee.authority === null), ok ? "A fee authority exists and can schedule a new fee." : "The fee is above the limit."), which);
    }
    default:
      throw new Error("unreachable");
  }
}

/** A claim is false if any predicate is false; else cannot_check; else unsupported; else true (section 8.3). */
export function overallStatus(results: readonly { status: Status }[]): Status {
  if (results.some((r) => r.status === "false")) return "false";
  if (results.some((r) => r.status === "cannot_check")) return "cannot_check";
  if (results.some((r) => r.status === "unsupported")) return "unsupported";
  return "true";
}

export function evaluateClaim(s: Snapshot, memo: Memo, d: Decoded = decodeSnapshot(s)): ClaimResult {
  const predicates = memo.p.map((p) => evaluatePredicate(s, d, p.k, p.v));
  return { status: overallStatus(predicates), predicates };
}

// ---------- signer relation (docs/SPEC.md section 10) ----------

/** Relations of `publisher` to the token as the chain shows now, or null when the mint could not be read. */
export function signerRelations(publisher: string, d: Decoded): RelationKind[] | null {
  if (!d.mint.ok) return null;
  const m = d.mint.value;
  const rel: RelationKind[] = [];
  if (m.mintAuthority === publisher) rel.push("mint_authority");
  if (m.freezeAuthority === publisher) rel.push("freeze_authority");
  const updateAuths: (string | null)[] = [];
  if (d.metaplex.ok) updateAuths.push(d.metaplex.value.updateAuthority);
  if (m.extensions.tokenMetadata) updateAuths.push(m.extensions.tokenMetadata.updateAuthority);
  if (updateAuths.includes(publisher)) rel.push("metadata_update_authority");
  if (d.pump && d.pump.creator === publisher) rel.push("pump_creator");
  if (rel.length > 0) return rel;
  const relevant: (string | null)[] = [m.mintAuthority, m.freezeAuthority, ...updateAuths];
  return relevant.some((a) => a === null) ? ["revoked"] : ["unrelated"];
}

export const AUTHORITY_RELATIONS: readonly RelationKind[] = ["mint_authority", "freeze_authority", "metadata_update_authority", "pump_creator"];

/** "From the token's authorities" when one of the first four relations holds. */
export function isFromAuthorities(rel: readonly RelationKind[] | null): boolean {
  return rel !== null && rel.some((r) => AUTHORITY_RELATIONS.includes(r));
}

export { SPL_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, decodeUpgradeStatus };
