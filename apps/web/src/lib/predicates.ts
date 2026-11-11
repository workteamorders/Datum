// UI dictionary for the predicates of datum/0 (docs/SPEC.md section 9).
// Keys, kinds and value rules come from @datum/protocol; titles and notes are display text.
import { MAX_PREDICATES, PREDICATES as PROTOCOL_PREDICATES, validateValue, type PredicateDef as ProtocolDef, type ValueKind } from "@datum/protocol";

export { MAX_PREDICATES, validateValue };
export type { ValueKind };

export type PredicateDef = ProtocolDef & {
  title: string; // shown in the picker
  note?: string; // one line under the title
};

const TEXT: Record<string, { title: string; note?: string }> = {
  mint_authority_none: { title: "Mint authority is revoked", note: "No one can create more of this token." },
  freeze_authority_none: { title: "Freeze authority is revoked", note: "No one can freeze token accounts." },
  supply_max: { title: "Supply is at most a limit", note: "Raw supply in base units, not adjusted for decimals." },
  decimals_eq: { title: "Decimals equal a value", note: "A whole number from 0 to 255." },
  token_program: { title: "Token program is", note: "spl-token or token-2022." },
  metadata_immutable: { title: "Metadata cannot be changed", note: "Always shown as “Can change” in v0." },
  update_authority_eq: { title: "Metadata update authority is", note: "A wallet address." },
  t22_no_permanent_delegate: { title: "No permanent delegate", note: "Token-2022 only." },
  t22_no_transfer_hook: { title: "No transfer hook", note: "Token-2022 only." },
  t22_no_default_frozen: { title: "New accounts are not frozen by default", note: "Token-2022 only." },
  t22_transfer_fee_max_bps: { title: "Transfer fee is at most", note: "Basis points, 0 to 10000. Token-2022 only." },
};

export const PREDICATES: readonly PredicateDef[] = PROTOCOL_PREDICATES.map((d) => ({
  ...d,
  title: TEXT[d.key]?.title ?? d.key,
  note: TEXT[d.key]?.note,
}));

const commas = (v: string) => v.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Plain-English statement for a predicate, used in claim rows. */
export function describePredicate(key: string, v?: string): string {
  switch (key) {
    case "mint_authority_none": return "Mint authority is revoked";
    case "freeze_authority_none": return "Freeze authority is revoked";
    case "supply_max": return `Supply is at most ${commas(v ?? "")} base units`;
    case "decimals_eq": return `Decimals equal ${v}`;
    case "token_program": return `Token program is ${v}`;
    case "metadata_immutable": return "Metadata cannot be changed";
    case "update_authority_eq": return `Metadata update authority is ${v ? `${v.slice(0, 4)}…${v.slice(-4)}` : ""}`;
    case "t22_no_permanent_delegate": return "No permanent delegate (Token-2022)";
    case "t22_no_transfer_hook": return "No transfer hook (Token-2022)";
    case "t22_no_default_frozen": return "New accounts are not frozen by default (Token-2022)";
    case "t22_transfer_fee_max_bps": return `Transfer fee is at most ${v} basis points`;
    default: return `Statement “${key}”${v ? ` with value ${v}` : ""}`;
  }
}

/** The check behind a statement, in plain words. Shown in the evidence drawer. */
export function formulaOf(key: string, v?: string): string {
  switch (key) {
    case "mint_authority_none": return "True when the mint account has no mint authority set.";
    case "freeze_authority_none": return "True when the mint account has no freeze authority set.";
    case "supply_max": return `True when the raw supply, the whole number stored on the chain before decimals are applied, is less than or equal to ${commas(v ?? "")}.`;
    case "decimals_eq": return `True when the decimals field of the mint equals ${v}.`;
    case "token_program": return `True when the mint account is owned by the ${v} program.`;
    case "metadata_immutable": return "True when every metadata source found for this token is marked as not changeable. It is shown as Can change in this version.";
    case "update_authority_eq": return "True when every metadata source that has an update authority names exactly the address in the claim.";
    case "t22_no_permanent_delegate": return "True when the mint has no permanent delegate. A mint from the SPL Token program has no extensions, so it counts as true.";
    case "t22_no_transfer_hook": return "True when the mint has no transfer hook program set. A mint from the SPL Token program has no extensions, so it counts as true.";
    case "t22_no_default_frozen": return "True when new token accounts do not start frozen. A mint from the SPL Token program has no extensions, so it counts as true.";
    case "t22_transfer_fee_max_bps": return `True when the larger of the two scheduled transfer fees is at most ${v} basis points. No fee extension counts as 0.`;
    default: return "This version of Datum does not know this statement, so it does not check it.";
  }
}
