import { isPubkey } from "./base58";

// Predicate dictionary v0 (docs/SPEC.md section 9). The wording shown to people lives in the web app.

export type ValueKind = "none" | "u64" | "u8" | "bps" | "program" | "address";

export type PredicateDef = { key: string; kind: ValueKind; t22: boolean };

export const PREDICATES: readonly PredicateDef[] = [
  { key: "mint_authority_none", kind: "none", t22: false },
  { key: "freeze_authority_none", kind: "none", t22: false },
  { key: "supply_max", kind: "u64", t22: false },
  { key: "decimals_eq", kind: "u8", t22: false },
  { key: "token_program", kind: "program", t22: false },
  { key: "metadata_immutable", kind: "none", t22: false },
  { key: "update_authority_eq", kind: "address", t22: false },
  { key: "t22_no_permanent_delegate", kind: "none", t22: true },
  { key: "t22_no_transfer_hook", kind: "none", t22: true },
  { key: "t22_no_default_frozen", kind: "none", t22: true },
  { key: "t22_transfer_fee_max_bps", kind: "bps", t22: true },
];

const BY_KEY = new Map(PREDICATES.map((p) => [p.key, p]));
export function predicateDef(key: string): PredicateDef | undefined {
  return BY_KEY.get(key);
}

export const U64_MAX = BigInt("18446744073709551615");

/** Error message, or null when `v` is valid for the kind. */
export function validateValue(kind: ValueKind, v: string): string | null {
  switch (kind) {
    case "none":
      return v === "" ? null : "This statement takes no value.";
    case "u64":
      if (!/^(0|[1-9][0-9]{0,19})$/.test(v)) return "Use a whole number with no commas.";
      return BigInt(v) > U64_MAX ? "That is larger than the largest allowed supply." : null;
    case "u8":
      return /^(0|[1-9][0-9]{0,2})$/.test(v) && Number(v) <= 255 ? null : "Use a whole number from 0 to 255.";
    case "bps":
      return /^(0|[1-9][0-9]{0,4})$/.test(v) && Number(v) <= 10000 ? null : "Use a whole number from 0 to 10000.";
    case "program":
      return v === "spl-token" || v === "token-2022" ? null : "Choose spl-token or token-2022.";
    case "address":
      return isPubkey(v) ? null : "That does not look like a wallet address.";
  }
}
