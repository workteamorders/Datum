import type { RulerProps } from "./Ruler";
import type { RelationKind, Stability, Status } from "@/lib/view";

export type ClaimView = {
  id: string;
  status: Status;
  /** Plain-English statement, from describePredicate. */
  statement: string;
  /** The check in plain words. */
  formula: string;
  /** Set for numeric statements: the limit against the reading. */
  ruler?: RulerProps;
  /** What was read, as text. For example "Mint authority: None". */
  measured: string;
  stability: Stability;
  stabilityReason: string;
  relations: readonly RelationKind[];
  publisher: string;
  /** Slot in which the claim was published. */
  claimSlot: number;
  signature: string;
  memo: string;
  label?: string;
  /** Slot of this reading, and how long ago on the device clock. */
  measuredSlot: number;
  measuredAge: string;
  accounts: readonly { name: string; address: string }[];
  /** Why the result could not be checked, or other plain-language note. */
  note?: string;
};
