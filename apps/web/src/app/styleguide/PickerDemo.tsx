"use client";

import { useState } from "react";
import { MemoPreview } from "@/components/MemoPreview";
import { PredicatePicker, type Selection } from "@/components/PredicatePicker";
import { MEMO_MAX_BYTES, buildMemo, byteLength, validateLabel } from "@/lib/memo";
import { PREDICATES, validateValue } from "@/lib/predicates";

const MINT = "DatumExamp1eMintA11111111111111111111111111";

export function PickerDemo() {
  const [sel, setSel] = useState<Selection>({
    mint_authority_none: "",
    freeze_authority_none: "",
    supply_max: "1000000000000000",
    token_program: "token-2022",
  });
  const [label, setLabel] = useState("Launch terms");

  const picks = PREDICATES.filter((p) => p.key in sel).map((p) => ({ def: p, v: sel[p.key] ?? "" }));
  const valueProblem = picks.some((x) => x.def.kind !== "none" && (x.v === "" || validateValue(x.def.kind, x.v) !== null));
  const labelProblem = validateLabel(label);
  const ready = picks.length > 0 && !valueProblem && !labelProblem;
  const memo = ready
    ? buildMemo(MINT, picks.map((x) => (x.def.kind === "none" ? { k: x.def.key } : { k: x.def.key, v: x.v })), label)
    : "";
  const bytes = byteLength(memo);

  return (
    <div className="sg-grid sg-grid--2">
      <div>
        <PredicatePicker value={sel} onChange={setSel} />
        <div style={{ marginTop: "var(--space-4)" }}>
          <label className="label" htmlFor="sg-label">Label (optional)</label>
          <input
            id="sg-label"
            className="field"
            value={label}
            maxLength={60}
            aria-invalid={labelProblem ? true : undefined}
            aria-describedby={labelProblem ? "sg-label-err" : undefined}
            onChange={(e) => setLabel(e.target.value)}
          />
          {labelProblem && <p className="field-error" id="sg-label-err">{labelProblem}</p>}
        </div>
      </div>
      <div>
        {ready ? (
          <MemoPreview memo={memo} bytes={bytes} />
        ) : (
          <div className="sg-panel" role="status">
            <p>
              {picks.length === 0
                ? "Choose at least one statement to see the memo."
                : "Fix the marked fields to see the memo."}
            </p>
            <p className="caption">The memo can be up to {MEMO_MAX_BYTES} bytes.</p>
          </div>
        )}
      </div>
    </div>
  );
}
