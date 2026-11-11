export type StepState = "done" | "current" | "todo" | "failed";

export type Step = { id: string; title: string; detail?: string; state: StepState };

const WORD: Record<StepState, string> = { done: "Done", current: "In progress", todo: "Waiting", failed: "Failed" };

/** The steps before and after signing. State is always said in words, never colour alone. */
export function PreflightStepper({ steps }: { steps: readonly Step[] }) {
  return (
    <ol className="stepper" aria-label="Publishing steps">
      {steps.map((s, i) => (
        <li key={s.id} className="step" data-state={s.state} aria-current={s.state === "current" ? "step" : undefined}>
          <span className="step__marker" aria-hidden="true">
            {s.state === "done" ? "✓" : s.state === "failed" ? "×" : i + 1}
          </span>
          <div className="step__text">
            <p className="step__title">
              {s.title} <span className="step__state">{WORD[s.state]}</span>
            </p>
            {s.detail ? <p className="step__detail">{s.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
