// Turns a snapshot and the loaded claims into what the token page shows. No fetching here.
import {
  decodeSnapshot,
  evaluateClaim,
  isFromAuthorities,
  signerRelations,
  type Decoded,
  type OrderedClaim,
  type RelationKind,
  type Snapshot,
  type Status,
} from "@datum/protocol";
import type { ClaimView } from "@/components/types";
import { describePredicate, formulaOf } from "./predicates";
import { numericReading, rulerProps } from "./readings";
import { formatInt } from "./view";

export type ClaimGroup = {
  signature: string;
  publisher: string;
  claimSlot: number;
  label?: string;
  memo: string;
  /** Overall result of the claim (SPEC 8.3). */
  status: Status;
  /** Null when the mint could not be read, so the relation cannot be worked out. */
  relations: RelationKind[] | null;
  current: boolean;
  rows: ClaimView[];
};

export type Fact = { label: string; value: string; mono?: boolean; note?: string };

export type TokenView = {
  facts: Fact[] | null;
  /** Results of current claims from the token's authorities only. Claims from other wallets are not counted here. */
  counts: Record<Status, number>;
  /** How many current claims came from wallets that hold no authority. */
  othersCount: number;
  fromAuthorities: ClaimGroup[];
  fromOthers: ClaimGroup[];
  superseded: ClaimGroup[];
};

export function ageLabel(observedAt: number, now: number): string {
  const s = Math.max(0, Math.round((now - observedAt) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.floor(h / 24)} days ago`;
}

const pkText = (a: string | null): string => a ?? "None";

export function factsOf(s: Snapshot, d: Decoded): Fact[] | null {
  if (!d.mint.ok) return null;
  const m = d.mint.value;
  const facts: Fact[] = [
    { label: "Token program", value: m.program === "spl-token" ? "SPL Token" : "Token-2022" },
    { label: "Supply", value: `${formatInt(m.supply)} base units` },
    { label: "Decimals", value: String(m.decimals) },
    { label: "Mint authority", value: pkText(m.mintAuthority), mono: m.mintAuthority !== null },
    { label: "Freeze authority", value: pkText(m.freezeAuthority), mono: m.freezeAuthority !== null },
  ];
  if (d.metaplex.ok) {
    facts.push({ label: "Metadata update authority", value: d.metaplex.value.updateAuthority, mono: true, note: "Metaplex metadata account. It can change." });
    facts.push({ label: "Metadata mutable", value: d.metaplex.value.isMutable ? "Yes: the update authority can change it" : "No: marked as not changeable" });
  } else if (d.metaplex.kind === "not_found") {
    facts.push({ label: "Metaplex metadata", value: "No metadata account found" });
  } else {
    facts.push({ label: "Metaplex metadata", value: "Could not be read right now" });
  }
  const e = m.extensions;
  if (m.program === "token-2022") {
    const names: string[] = [];
    if (e.permanentDelegate) names.push(`Permanent delegate: ${pkText(e.permanentDelegate.delegate)}`);
    if (e.transferHook) names.push(`Transfer hook: ${e.transferHook.programId ?? "None"}`);
    if (e.transferFee) names.push(`Transfer fee: ${e.transferFee.newer.bps} basis points`);
    if (e.defaultAccountState) names.push(`Default account state: ${e.defaultAccountState.state === 2 ? "frozen" : e.defaultAccountState.state === 1 ? "initialized" : "unknown"}`);
    if (e.mintCloseAuthority) names.push(`Mint close authority: ${pkText(e.mintCloseAuthority.authority)}`);
    if (e.metadataPointer) names.push("Metadata pointer");
    if (e.tokenMetadata) names.push("Token metadata");
    if (e.confidentialMintBurn) names.push("Confidential mint and burn");
    if (e.unknownTypes.length) names.push(`Other extension types: ${e.unknownTypes.join(", ")}`);
    facts.push({ label: "Token-2022 extensions", value: names.length ? names.join("; ") : "None" });
  }
  void s;
  return facts;
}

export function buildTokenView(s: Snapshot, claims: readonly OrderedClaim[], now: number): TokenView {
  const d = decodeSnapshot(s);
  const age = ageLabel(s.observedAt, now);
  const counts: Record<Status, number> = { true: 0, false: 0, cannot_check: 0, unsupported: 0 };
  const view: TokenView = { facts: factsOf(s, d), counts, othersCount: 0, fromAuthorities: [], fromOthers: [], superseded: [] };

  for (const c of claims) {
    const result = evaluateClaim(s, c.memo, d);
    const relations = signerRelations(c.publisher, d);
    const rows: ClaimView[] = result.predicates.map((p, i) => ({
      id: `${c.signature}:${i}`,
      status: p.status,
      statement: describePredicate(p.key, p.value),
      formula: formulaOf(p.key, p.value),
      ruler: (() => {
        const n = numericReading(d, p.key, p.value);
        return n ? rulerProps(n) : undefined;
      })(),
      measured: p.measured,
      stability: p.stability,
      stabilityReason: p.stabilityReason,
      relations: relations ?? [],
      publisher: c.publisher,
      claimSlot: c.slot,
      signature: c.signature,
      memo: c.memoText,
      label: c.memo.n,
      measuredSlot: s.slot,
      measuredAge: age,
      accounts: p.accounts,
      note: p.note,
    }));
    const group: ClaimGroup = {
      signature: c.signature,
      publisher: c.publisher,
      claimSlot: c.slot,
      label: c.memo.n,
      memo: c.memoText,
      status: result.status,
      relations,
      current: c.current,
      rows,
    };
    if (!c.current) {
      view.superseded.push(group);
      continue;
    }
    if (isFromAuthorities(relations)) {
      counts[result.status]++;
      view.fromAuthorities.push(group);
    } else {
      view.othersCount++;
      view.fromOthers.push(group);
    }
  }
  return view;
}
