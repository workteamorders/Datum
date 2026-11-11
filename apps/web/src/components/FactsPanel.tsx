import type { Fact } from "@/lib/token-view";

/** What the chain shows about the token right now, as plain facts. No claim is involved. */
export function FactsPanel({ facts }: { facts: readonly Fact[] }) {
  return (
    <section className="facts" aria-labelledby="facts-h">
      <h2 id="facts-h">On the chain now</h2>
      <dl className="facts__list">
        {facts.map((f) => (
          <div key={f.label} className="facts__row">
            <dt>{f.label}</dt>
            <dd>
              <span className={f.mono ? "mono" : undefined}>{f.value}</span>
              {f.note ? <span className="facts__note">{f.note}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
