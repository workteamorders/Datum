import { useId } from "react";
import { MeasurementLine } from "./MeasurementStamp";
import { StatusMark } from "./StatusMark";
import type { Status } from "@/lib/view";
import { STATUS_LABEL } from "@/lib/view";

export type Counts = Record<Status, number>;

const ORDER: readonly Status[] = ["true", "false", "cannot_check", "unsupported"];

/**
 * The summary sentence at the top of a token page. It counts only claims from the token's authorities,
 * and says so. Counts are never merged.
 */
export function VerdictStrip({ counts, othersCount = 0, slot, ageLabel }: { counts: Counts; othersCount?: number; slot: number; ageLabel: string }) {
  const hid = `verdict-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const total = ORDER.reduce((n, s) => n + counts[s], 0);
  const sentence =
    total === 0
      ? "No claims from this token’s authorities yet."
      : `${counts.true} of ${total} ${total === 1 ? "claim" : "claims"} by this token’s authorities ${total === 1 ? "is" : "are"} true now.`;
  return (
    <section className="verdict" aria-labelledby={hid}>
      <h2 id={hid} className="verdict__sentence">{sentence}</h2>
      {total > 0 && (
        <ul className="verdict__counts">
          {ORDER.filter((s) => counts[s] > 0).map((s) => (
            <li key={s}>
              <StatusMark status={s} />
              <span>
                <b className="num">{counts[s]}</b> {STATUS_LABEL[s].toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      )}
      {total === 0 && othersCount > 0 && (
        <p className="caption">
          {othersCount} {othersCount === 1 ? "claim was" : "claims were"} published by other wallets. They are not counted here.
        </p>
      )}
      <MeasurementLine slot={slot} ageLabel={ageLabel} />
    </section>
  );
}
