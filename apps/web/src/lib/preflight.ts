// Before signing: what each statement would show if it were published right now.
import { decodeSnapshot, evaluatePredicate, signerRelations, type RelationKind, type Snapshot, type Stability, type Status } from "@datum/protocol";
import type { RulerProps } from "@/components/Ruler";
import { describePredicate } from "./predicates";
import { numericReading, rulerProps } from "./readings";

export type PickPreview = {
  key: string;
  statement: string;
  status: Status;
  measured: string;
  note?: string;
  stability: Stability;
  ruler?: RulerProps;
};

export type Preview = {
  picks: PickPreview[];
  /** Statements that would show "Not true now". */
  notTrue: number;
  /** Statements Datum cannot check at the moment. */
  cannotCheck: number;
  relationsOf: (publisher: string) => RelationKind[] | null;
};

export function previewPicks(s: Snapshot, picks: readonly { key: string; value?: string }[]): Preview {
  const d = decodeSnapshot(s);
  const out: PickPreview[] = picks.map(({ key, value }) => {
    const statement = describePredicate(key, value);
    const n = numericReading(d, key, value);
    const ruler = n ? rulerProps(n) : undefined;
    try {
      const r = evaluatePredicate(s, d, key, value);
      return { key, statement, status: r.status, measured: r.measured, note: r.note, stability: r.stability, ruler };
    } catch {
      return { key, statement, status: "cannot_check", measured: "Not read.", note: "This statement could not be checked.", stability: "can_change", ruler };
    }
  });
  return {
    picks: out,
    notTrue: out.filter((p) => p.status === "false").length,
    cannotCheck: out.filter((p) => p.status === "cannot_check").length,
    relationsOf: (publisher) => signerRelations(publisher, d),
  };
}
