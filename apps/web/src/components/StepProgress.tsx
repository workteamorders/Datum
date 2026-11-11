import type { CSSProperties } from "react";

const TITLES = ["Token and statements", "Wallet and check", "Review and sign"] as const;

/** Where the person is in the three publishing steps. The current step is said in words, not only marked. */
export function StepProgress({ stage }: { stage: 1 | 2 | 3 }) {
  return (
    <ol className="progress" aria-label="Publishing progress" style={{ "--step-fill": stage / 3 } as CSSProperties}>
      {TITLES.map((t, i) => {
        const n = i + 1;
        const state = n < stage ? "done" : n === stage ? "current" : "todo";
        return (
          <li key={t} className="progress__item" data-state={state} aria-current={state === "current" ? "step" : undefined}>
            <span className="progress__num" aria-hidden="true">{state === "done" ? "✓" : n}</span>
            <span className="progress__text">
              <span className="progress__title">{t}</span>
              <span className="progress__state">{state === "done" ? "Done" : state === "current" ? `Step ${n} of 3` : "Next"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
