"use client";

import { useId, useState } from "react";
import { StatusMark } from "./StatusMark";
import { StabilityTag } from "./StabilityTag";
import { SignerRelationLine } from "./SignerRelationLine";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { Sheet } from "./Sheet";
import { useNarrow } from "@/hooks/useNarrow";
import { STATUS_LABEL } from "@/lib/view";
import type { ClaimView } from "./types";
import type { Cluster } from "@/lib/cluster";

/** One claim: result, statement, relation of the publisher, stability, and an evidence drawer. */
export function ClaimRow({ claim, defaultOpen = false, showRelation = true, cluster, changed }: { claim: ClaimView; defaultOpen?: boolean; showRelation?: boolean; cluster?: Cluster; changed?: number }) {
  const [open, setOpen] = useState(defaultOpen);
  const drawerId = useId();
  const narrow = useNarrow();
  return (
    <li className="claim" data-status={claim.status} data-changed={changed !== undefined}>
      <div className="claim__mark">
        <StatusMark status={claim.status} />
      </div>
      <div className="claim__body">
        <p className="claim__statement">
          <span className="sr-only">{STATUS_LABEL[claim.status]}. </span>
          {claim.statement}
        </p>
        <p className="claim__status-word">
          {STATUS_LABEL[claim.status]} <StabilityTag stability={claim.stability} reason={claim.stabilityReason} />
        </p>
        {changed !== undefined && <span key={changed} className="claim__changed">Changed just now</span>}
        {showRelation && <SignerRelationLine publisher={claim.publisher} relations={claim.relations} />}
        <button
          type="button"
          className="claim__toggle"
          {...(narrow ? { "aria-haspopup": "dialog" as const } : { "aria-expanded": open, "aria-controls": drawerId })}
          onClick={() => setOpen((o) => !o)}
        >
          {open && !narrow ? "Hide evidence" : "Show evidence"}
        </button>
        {narrow ? (
          <Sheet open={open} onClose={() => setOpen(false)} title="Evidence">
            <p className="sheet__claim">{claim.statement}</p>
            <EvidenceDrawer claim={claim} id={drawerId} cluster={cluster} />
          </Sheet>
        ) : (
          <div hidden={!open}>{open && <EvidenceDrawer claim={claim} id={drawerId} cluster={cluster} />}</div>
        )}
      </div>
    </li>
  );
}
