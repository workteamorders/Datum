import type { CSSProperties } from "react";

export type RulerProps = {
  /** Value of the claim's limit. */
  limit: number;
  /** Right end of the scale. */
  max: number;
  /** Value measured now, or null when it could not be read. */
  now: number | null;
  limitLabel: string;
  nowLabel?: string;
  /** Labels under the major ticks, as positions in [0, max]. */
  ticks: readonly { at: number; label: string }[];
  /** What a screen reader hears. The graphic itself is hidden from it. */
  description: string;
  /** Shown under the track when there is no reading. */
  missingLabel?: string;
};

const MINOR = 30; // minor intervals across the scale
const MAJOR_EVERY = 5;

function pct(v: number, max: number): number {
  return Math.min(100, Math.max(0, (v / max) * 100));
}

function anchor(p: number, edge: string): CSSProperties {
  if (p >= 50) {
    return { marginLeft: "auto", marginRight: `calc(${100 - p}% - ${edge})`, maxWidth: `calc(${p}% + ${edge})`, textAlign: "right" };
  }
  return { marginLeft: `calc(${p}% - ${edge})`, maxWidth: `calc(${100 - p}% + ${edge})`, textAlign: "left" };
}

/**
 * Value against a claim limit, drawn like a measuring scale.
 * States: within the limit, past the limit, no reading.
 */
export function Ruler({ limit, max, now, limitLabel, nowLabel, ticks, description, missingLabel }: RulerProps) {
  const state = now === null ? "none" : now > limit ? "over" : "within";
  const pl = pct(limit, max);
  const pn = now === null ? 0 : pct(now, max);
  return (
    <figure className="ruler" data-state={state} role="img" aria-label={description}>
      <div className="ruler__limit-label" style={anchor(pl, "12px")} aria-hidden="true">
        {limitLabel}
      </div>

      <div className="ruler__track" aria-hidden="true">
        <span className="ruler__line" />
        {Array.from({ length: MINOR + 1 }, (_, i) => (
          <i
            key={i}
            className={i % MAJOR_EVERY === 0 ? "ruler__tick ruler__tick--major" : "ruler__tick"}
            style={{ left: `${(i / MINOR) * 100}%` }}
          />
        ))}
        {state === "over" && <span className="ruler__excess" style={{ left: `${pl}%`, width: `${pn - pl}%` }} />}
        <span className="ruler__disc" style={{ left: `${pl}%` }} />
        {now !== null && <span className="ruler__dot" style={{ left: `${pn}%` }} />}
        {now !== null && <span className="ruler__leader" style={{ left: `${pn}%` }} />}
      </div>

      <div className="ruler__scale" aria-hidden="true">
        {ticks.map((t) => {
          const p = pct(t.at, max);
          const style: CSSProperties =
            p <= 0 ? { left: 0 } : p >= 100 ? { right: 0 } : { left: `${p}%`, transform: "translateX(-50%)" };
          return (
            <span key={t.at} className="ruler__tick-label" style={style}>
              {t.label}
            </span>
          );
        })}
      </div>

      <div className="ruler__now" aria-hidden="true">
        {now === null ? (
          <span className="ruler__missing">{missingLabel ?? "No reading"}</span>
        ) : (
          <span className="ruler__now-label" style={anchor(pn, "0px")}>
            {nowLabel}
          </span>
        )}
      </div>
    </figure>
  );
}
