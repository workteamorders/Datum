"use client";

import { useId } from "react";
import { MAX_PREDICATES, PREDICATES, validateValue } from "@/lib/predicates";

/** Selected statements: key to value ("" when the statement takes none). */
export type Selection = Record<string, string>;

export function PredicatePicker({ value, onChange }: { value: Selection; onChange: (next: Selection) => void }) {
  const uid = useId();
  const count = Object.keys(value).length;
  const full = count >= MAX_PREDICATES;

  function toggle(key: string) {
    const next = { ...value };
    if (key in next) delete next[key];
    else next[key] = "";
    onChange(next);
  }

  return (
    <fieldset className="picker">
      <legend className="picker__legend">
        Statements to publish <span className="caption">({count} of {MAX_PREDICATES})</span>
      </legend>
      <p className="caption" id={`${uid}-help`}>
        Each statement is checked against the chain by anyone who opens the token. Choose up to {MAX_PREDICATES}.
      </p>
      <ul className="picker__list">
        {PREDICATES.map((p) => {
          const checked = p.key in value;
          const takes = p.kind !== "none";
          const v = value[p.key] ?? "";
          const err = checked && takes && v !== "" ? validateValue(p.kind, v) : null;
          const missing = checked && takes && v === "";
          const disabled = !checked && full;
          const iid = `${uid}-${p.key}`;
          return (
            <li key={p.key} className="picker__item" data-checked={checked}>
              <label className="picker__label" htmlFor={iid}>
                <input
                  id={iid}
                  type="checkbox"
                  className="picker__check"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(p.key)}
                />
                <span>
                  <span className="picker__title">{p.title}</span>
                  {p.note ? <span className="picker__note">{p.note}</span> : null}
                </span>
              </label>
              {checked && takes && (
                <div className="picker__value">
                  {p.kind === "program" ? (
                    <select
                      className="field"
                      aria-label={`${p.title}: value`}
                      value={v}
                      aria-invalid={missing || err ? true : undefined}
                      aria-describedby={err || missing ? `${iid}-err` : undefined}
                      onChange={(e) => onChange({ ...value, [p.key]: e.target.value })}
                    >
                      <option value="">Choose…</option>
                      <option value="spl-token">spl-token</option>
                      <option value="token-2022">token-2022</option>
                    </select>
                  ) : (
                    <input
                      className="field mono"
                      inputMode={p.kind === "address" ? "text" : "numeric"}
                      autoComplete="off"
                      spellCheck={false}
                      aria-label={`${p.title}: value`}
                      value={v}
                      aria-invalid={missing || err ? true : undefined}
                      aria-describedby={err || missing ? `${iid}-err` : undefined}
                      onChange={(e) => onChange({ ...value, [p.key]: e.target.value.trim() })}
                    />
                  )}
                  {(err || missing) && (
                    <p className="field-error" id={`${iid}-err`}>
                      {err ?? "This statement needs a value."}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {full && <p className="caption">That is the most one claim can hold. Clear one to choose another.</p>}
    </fieldset>
  );
}
