import { STABILITY_LABEL, type Stability } from "@/lib/view";

/** Permanent / Can change. The reason is always available as text. */
export function StabilityTag({ stability, reason }: { stability: Stability; reason?: string }) {
  return (
    <span className={`stability stability--${stability}`}>
      {STABILITY_LABEL[stability]}
      {reason ? <span className="sr-only">. {reason}</span> : null}
    </span>
  );
}
