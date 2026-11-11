"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { decodeSnapshot, evaluateClaim, signerRelations, type Claim, type Snapshot, type Status } from "@datum/protocol";
import { SignerRelationLine } from "@/components/SignerRelationLine";
import { StatusMark } from "@/components/StatusMark";
import { readFeedClaims } from "@/lib/claims";
import { CLUSTER_LABEL, clusterFromGenesis, type Cluster } from "@/lib/cluster";
import { describePredicate } from "@/lib/predicates";
import { RpcFailure, rpc } from "@/lib/rpc";
import { readSnapshot } from "@/lib/snapshot";
import { ageLabel } from "@/lib/token-view";
import { useNow } from "@/hooks/useNow";
import { STATUS_LABEL, formatInt, shortAddress } from "@/lib/view";

type State =
  | { s: "loading" }
  | { s: "failed"; message: string }
  | { s: "ready"; claims: Claim[]; malformed: number; next: string | null };

const failText = (e: unknown): string => (e instanceof RpcFailure ? (e.kind === "rate_limit" ? "The RPC service is busy. Try again in a moment." : e.message) : "The chain could not be read right now.");

type Snap = { s: "loading" } | { s: "failed"; message: string } | { s: "ready"; snapshot: Snapshot };

/** Reads at most this many tokens at once, so the feed never floods the relay. */
const SNAPSHOT_CONCURRENCY = 3;

function FeedItem({ claim, snap, now }: { claim: Claim; snap: Snap | undefined; now: number }) {
  const ready = snap && snap.s === "ready" ? snap.snapshot : null;
  const result = ready ? evaluateClaim(ready, claim.memo) : null;
  const relations = ready ? signerRelations(claim.publisher, decodeSnapshot(ready)) : null;
  const overall: Status = result ? result.status : "cannot_check";
  return (
    <li className="feed__item" data-status={result ? overall : "pending"}>
      <p className="feed__mint">
        <Link href={`/t?m=${encodeURIComponent(claim.memo.m)}`} className="mono">{claim.memo.m}</Link>
      </p>
      <div className="feed__check status-slot">
        {!snap || snap.s === "loading" ? (
          <p className="dim" role="status">Checking against the chain…</p>
        ) : snap.s === "failed" ? (
          <p><StatusMark status="cannot_check" withLabel /> <span className="caption">{snap.message}</span></p>
        ) : (
          <>
            <p><StatusMark status={overall} withLabel /></p>
            <ul className="feed__statements">
              {result?.predicates.map((p, i) => (
                <li key={i}><StatusMark status={p.status} label={STATUS_LABEL[p.status]} /> <span><span className="sr-only">{STATUS_LABEL[p.status]}. </span>{describePredicate(p.key, p.value)}</span></li>
              ))}
            </ul>
            <p className="caption">Measured at slot <span className="mono num">{formatInt(snap.snapshot.slot)}</span>, {ageLabel(snap.snapshot.observedAt, now)}.</p>
          </>
        )}
      </div>
      {relations && <SignerRelationLine publisher={claim.publisher} relations={relations} />}
      <p className="caption">
        Published in slot <span className="mono num">{formatInt(claim.slot)}</span> by <span className="mono">{shortAddress(claim.publisher)}</span>
        {claim.memo.n ? <>. Label: “{claim.memo.n}”</> : null}
      </p>
    </li>
  );
}

export function RecentPage() {
  const [state, setState] = useState<State>({ s: "loading" });
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [more, setMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [snaps, setSnaps] = useState<Record<string, Snap>>({});
  const asked = useRef(new Set<string>());
  const now = useNow();
  const alive = useRef(true);

  // Check each token the feed mentions, a few at a time. A token is read once per page view.
  const feedMints = state.s === "ready" ? Array.from(new Set(state.claims.map((c) => c.memo.m))) : [];
  const mintKey = feedMints.join(",");
  useEffect(() => {
    const todo = mintKey ? mintKey.split(",").filter((m) => !asked.current.has(m)) : [];
    if (todo.length === 0) return;
    todo.forEach((m) => asked.current.add(m));
    setSnaps((cur) => ({ ...cur, ...Object.fromEntries(todo.map((m) => [m, { s: "loading" } as Snap])) }));
    let next = 0;
    const worker = async () => {
      while (next < todo.length) {
        const m = todo[next++] as string;
        let value: Snap;
        try {
          const r = await readSnapshot(rpc, m);
          value = r.ok ? { s: "ready", snapshot: r.snapshot } : { s: "failed", message: r.message };
        } catch (e) {
          value = { s: "failed", message: failText(e) };
        }
        if (alive.current) setSnaps((cur) => ({ ...cur, [m]: value }));
      }
    };
    for (let i = 0; i < SNAPSHOT_CONCURRENCY; i++) void worker();
  }, [mintKey]);

  useEffect(() => {
    alive.current = true;
    asked.current = new Set();
    setSnaps({});
    setState({ s: "loading" });
    rpc.call<string>("getGenesisHash").then((h) => alive.current && setCluster(clusterFromGenesis(h))).catch(() => alive.current && setCluster("unknown"));
    readFeedClaims(rpc).then(
      (p) => alive.current && setState({ s: "ready", claims: p.claims, malformed: p.malformed, next: p.next }),
      (e) => alive.current && setState({ s: "failed", message: failText(e) }),
    );
    return () => {
      alive.current = false;
    };
  }, [round]);

  const loadMore = useCallback(async () => {
    if (state.s !== "ready" || !state.next) return;
    setMore(true);
    setMoreError(null);
    try {
      const p = await readFeedClaims(rpc, state.next);
      if (alive.current) setState({ s: "ready", claims: [...state.claims, ...p.claims], malformed: state.malformed + p.malformed, next: p.next });
    } catch (e) {
      if (alive.current) setMoreError(failText(e));
    } finally {
      if (alive.current) setMore(false);
    }
  }, [state]);

  return (
    <div className="stack page-reserve">
      <p className="caps">Recent</p>
      <h1>Recent claims</h1>
      <p className="lede">The newest claims published to Datum, for any token. Each statement is checked against the chain when you open this page. Anyone can publish, so this is a list of what was published, newest first. It is not ranked and says nothing about which tokens to pick. A wallet may have published a newer claim since: open the token to see its current list.</p>
      {cluster && <p className="chip" data-cluster={cluster}>{CLUSTER_LABEL[cluster]}</p>}

      {state.s === "loading" && <p role="status" className="dim">Reading the feed…</p>}
      {state.s === "failed" && (
        <div className="notice" role="alert">
          <h2>The feed could not be read</h2>
          <p>{state.message}</p>
          <p className="caption">This is not the same as “nothing published”.</p>
          <button type="button" className="btn" onClick={() => setRound((n) => n + 1)}>Try again</button>
        </div>
      )}
      {state.s === "ready" && (
        <>
          {state.claims.length === 0 ? (
            <p>No claims have been published here yet.</p>
          ) : (
            <ul className="feed">
              {state.claims.map((c) => <FeedItem key={c.signature} claim={c} snap={snaps[c.memo.m]} now={now} />)}
            </ul>
          )}
          {state.malformed > 0 && <p className="caption">{state.malformed} malformed {state.malformed === 1 ? "memo" : "memos"} ignored.</p>}
          {moreError && <p className="field-error" role="alert">{moreError}</p>}
          {state.next && <p><button type="button" className="btn" onClick={loadMore} disabled={more}>{more ? "Loading…" : "Load more claims"}</button></p>}
        </>
      )}
    </div>
  );
}
