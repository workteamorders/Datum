import { formatInt, shortAddress } from "@/lib/view";
import { Ruler } from "./Ruler";
import type { ClaimView } from "./types";
import type { Cluster } from "@/lib/cluster";

const EXPLORER = "https://explorer.solana.com";

/** Everything behind one result: what was read, where, when, and who published it. */
/** Explorer link for the cluster that was read. An unknown cluster gets no link. */
function explorerUrl(kind: "address" | "tx", id: string, cluster: Cluster): string | null {
  if (cluster === "unknown") return null;
  return `${EXPLORER}/${kind}/${id}${cluster === "mainnet" ? "" : `?cluster=${cluster}`}`;
}

function Ref({ kind, id, cluster }: { kind: "address" | "tx"; id: string; cluster: Cluster }) {
  const href = explorerUrl(kind, id, cluster);
  return href ? (
    <a className="mono" href={href} target="_blank" rel="noopener noreferrer">{shortAddress(id)}</a>
  ) : (
    <span className="mono">{shortAddress(id)}</span>
  );
}

export function EvidenceDrawer({ claim, id, cluster = "mainnet" }: { claim: ClaimView; id: string; cluster?: Cluster }) {
  return (
    <div className="drawer" id={id} role="region" aria-label="Evidence">
      <dl className="drawer__grid">
        <div>
          <dt>What was read</dt>
          <dd>
            <ul className="drawer__list">
              {claim.accounts.map((a) => (
                <li key={a.address + a.name}>
                  {a.name}:{" "}
                  <Ref kind="address" id={a.address} cluster={cluster} />
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt>How it is checked</dt>
          <dd>{claim.formula}</dd>
        </div>
        <div>
          <dt>What it showed</dt>
          <dd>
            {claim.measured}
            {claim.ruler && <Ruler {...claim.ruler} />}
          </dd>
        </div>
        <div>
          <dt>Measured at</dt>
          <dd>
            Slot <span className="mono num">{formatInt(claim.measuredSlot)}</span>, {claim.measuredAge}, confirmed commitment.
            <span className="drawer__fine"> The slot comes from the RPC response. The time is this device’s clock when the answer arrived.</span>
          </dd>
        </div>
        <div>
          <dt>How stable</dt>
          <dd>
            {claim.stability === "permanent" ? "Permanent" : "Can change"}. {claim.stabilityReason}
          </dd>
        </div>
        <div>
          <dt>The claim</dt>
          <dd>
            Published by <span className="mono">{shortAddress(claim.publisher)}</span> in slot{" "}
            <span className="mono num">{formatInt(claim.claimSlot)}</span>
            {claim.label ? <>. Label: “{claim.label}”</> : null}.{" "}
            <Ref kind="tx" id={claim.signature} cluster={cluster} />
          </dd>
        </div>
        {claim.note ? (
          <div>
            <dt>Note</dt>
            <dd>{claim.note}</dd>
          </div>
        ) : null}
      </dl>
      <details className="drawer__memo">
        <summary>Memo as published</summary>
        <pre className="mono">{claim.memo}</pre>
      </details>
    </div>
  );
}
