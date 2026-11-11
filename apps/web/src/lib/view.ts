// View-level vocabulary shared by components. The protocol package owns the
// canonical Status, Stability and RelationKind types (docs/SPEC.md sections 8, 10, 11).
import type { RelationKind, Stability, Status } from "@datum/protocol";

export type { RelationKind, Stability, Status };

export const STATUS_LABEL: Record<Status, string> = {
  true: "True now",
  false: "Not true now",
  cannot_check: "Cannot check right now",
  unsupported: "Not supported by this version",
};

export const STABILITY_LABEL: Record<Stability, string> = {
  permanent: "Permanent",
  can_change: "Can change",
};

export const RELATION_LABEL: Record<RelationKind, string> = {
  mint_authority: "Holds the mint authority",
  freeze_authority: "Holds the freeze authority",
  metadata_update_authority: "Holds the metadata update authority",
  pump_creator: "Is the pump.fun creator of this coin",
  revoked: "Authority revoked; cannot establish who signed",
  unrelated: "Unrelated wallet",
};

export { AUTHORITY_RELATIONS } from "@datum/protocol";

export function shortAddress(a: string): string {
  return a.length <= 12 ? a : `${a.slice(0, 4)}…${a.slice(-4)}`;
}

export function formatInt(n: number | bigint | string): string {
  const s = typeof n === "string" ? n : n.toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
