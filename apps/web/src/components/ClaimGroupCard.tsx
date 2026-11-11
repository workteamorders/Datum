import { ArtSeal } from "./fx/BenchmarkArt";
import { ClaimRow } from "./ClaimRow";
import { SignerRelationLine } from "./SignerRelationLine";
import { StatusMark } from "./StatusMark";
import type { ClaimGroup } from "@/lib/token-view";
import type { Cluster } from "@/lib/cluster";
import { formatInt } from "@/lib/view";

/** One published claim: who published it, how they relate to the token, and each statement with its result. */
export function ClaimGroupCard({ group, cluster, changed }: { group: ClaimGroup; cluster: Cluster; changed?: ReadonlyMap<string, number> }) {
  return (
    <article className="cgroup" data-current={group.current}>
      <header className="cgroup__head">
        <p className="cgroup__overall">
          <StatusMark status={group.status} withLabel /> <span className="sr-only">Overall result of this claim. </span>
        </p>
        {!group.current && <ArtSeal kind="superseded" />}
        <SignerRelationLine publisher={group.publisher} relations={group.relations ?? []} />
        {group.relations === null && <p className="caption">The mint could not be read, so the relation of this wallet to the token is not checked.</p>}
        <p className="caption">
          Published in slot <span className="mono num">{formatInt(group.claimSlot)}</span>
          {group.label ? <>. Label: “{group.label}”</> : null}
          {group.current ? "" : ". Superseded: this wallet published a newer claim for this token."}
        </p>
      </header>
      <ul className="claims">
        {group.rows.map((r) => (
          <ClaimRow key={r.id} claim={r} changed={changed?.get(r.id)} showRelation={false} cluster={cluster} />
        ))}
      </ul>
    </article>
  );
}
