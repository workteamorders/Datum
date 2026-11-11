"use client";

import { AddressMark, StateArt } from "@/components/fx/BenchmarkArt";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { isPubkey, type Claim, type Snapshot } from "@datum/protocol";
import { ClaimGroupCard } from "@/components/ClaimGroupCard";
import { FactsPanel } from "@/components/FactsPanel";
import { MeasurementStamp } from "@/components/MeasurementStamp";
import { MintLookup } from "@/components/MintLookup";
import { NotTold } from "@/components/NotTold";
import { VerdictStrip } from "@/components/VerdictStrip";
import { useNow } from "@/hooks/useNow";
import { CLUSTER_LABEL, clusterFromGenesis, type Cluster } from "@/lib/cluster";
import { mergeClaims, readMintClaims } from "@/lib/claims";
import { RpcFailure, rpc } from "@/lib/rpc";
import { readSnapshot } from "@/lib/snapshot";
import { ageLabel, buildTokenView } from "@/lib/token-view";
import { changesSince, loadVisit, recordOf, saveVisit, type Change, type VisitRecord } from "@/lib/visit";
import { shortAddress } from "@/lib/view";

type Load =
  | { state: "loading" }
  | { state: "failed"; message: string }
  | { state: "ready"; snapshot: Snapshot };
type Claims = { state: "loading" } | { state: "failed"; message: string } | { state: "ready"; loads: Claim[][]; malformed: number; unreadable: number; next: string | null };

const failText = (e: unknown): string =>
  e instanceof RpcFailure && e.kind === "rate_limit" ? "The RPC service is busy. Try again in a moment." : e instanceof RpcFailure ? e.message : "The chain could not be read right now.";

export function TokenPage() {
  const mint = useSearchParams().get("m")?.trim() ?? "";
  if (!mint) {
    return (
      <div className="stack">
        <h1>Look up a token</h1>
        <MintLookup autoFocus />
      </div>
    );
  }
  if (!isPubkey(mint)) {
    return (
      <div className="stack">
        <h1>Not a token address</h1>
        <p>“{mint.slice(0, 60)}” does not look like a Solana address. Check it and try again.</p>
        <MintLookup initial={mint.slice(0, 60)} />
      </div>
    );
  }
  return <Token mint={mint} key={mint} />;
}

function Token({ mint }: { mint: string }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [claims, setClaims] = useState<Claims>({ state: "loading" });
  const [cluster, setCluster] = useState<Cluster>("unknown");
  const [clusterKnown, setClusterKnown] = useState(false);
  const [more, setMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [recentChanges, setRecentChanges] = useState<{ at: number; ids: ReadonlyMap<string, number>; items: Change[] } | null>(null);
  const compared = useRef(0);
  const beforeRead = useRef<VisitRecord | null>(null);
  const [round, setRound] = useState(0);
  const now = useNow();
  const alive = useRef(true);
  const baseline = useRef<{ taken: boolean; prev: VisitRecord | null }>({ taken: false, prev: null });
  const [since, setSince] = useState<{ at: number; changes: Change[] } | null>(null);

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    (async () => {
      rpc.call<string>("getGenesisHash")
        .then((h) => !cancelled && (setCluster(clusterFromGenesis(h)), setClusterKnown(true)))
        .catch(() => !cancelled && setClusterKnown(true));
      const snap = readSnapshot(rpc, mint).then(
        (r) => (r.ok ? ({ state: "ready", snapshot: r.snapshot } as Load) : ({ state: "failed", message: r.message } as Load)),
        (e) => ({ state: "failed", message: failText(e) }) as Load,
      );
      const cl = readMintClaims(rpc, mint).then(
        (p) => ({ state: "ready", loads: [p.claims], malformed: p.malformed, unreadable: p.unreadable, next: p.next }) as Claims,
        (e) => ({ state: "failed", message: failText(e) }) as Claims,
      );
      const [s, c] = await Promise.all([snap, cl]);
      if (cancelled) return;
      setLoad(s);
      setClaims(c);
      setReading(false);
    })();
    return () => {
      cancelled = true;
      alive.current = false;
    };
  }, [mint, round]);

  const loadMore = useCallback(async () => {
    if (claims.state !== "ready" || !claims.next) return;
    setMore(true);
    setMoreError(null);
    try {
      const p = await readMintClaims(rpc, mint, claims.next);
      if (!alive.current) return;
      setClaims({ state: "ready", loads: [...claims.loads, p.claims], malformed: claims.malformed + p.malformed, unreadable: claims.unreadable + p.unreadable, next: p.next });
    } catch (e) {
      if (alive.current) setMoreError(failText(e));
    } finally {
      if (alive.current) setMore(false);
    }
  }, [claims, mint]);

  const view = useMemo(() => {
    if (load.state !== "ready" || claims.state !== "ready") return null;
    return buildTokenView(load.snapshot, mergeClaims(claims.loads), now);
  }, [load, claims, now]);

  // "Since your last visit": compare with what this browser stored last time, then store what is shown now.
  // When storage is unavailable, nothing is shown and nothing breaks.
  const shownCluster = clusterKnown ? cluster : null;
  const unreadable = claims.state === "ready" ? claims.unreadable : 0;
  useEffect(() => {
    if (!view || reading || shownCluster === null || shownCluster === "unknown") return;
    const rec = recordOf([...view.fromAuthorities, ...view.fromOthers], Date.now());
    if (!baseline.current.taken) {
      baseline.current = { taken: true, prev: loadVisit(shownCluster, mint) };
    }
    const prev = baseline.current.prev;
    if (prev) setSince({ at: prev.at, changes: changesSince(prev, rec) });
    if (round > compared.current) {
      compared.current = round;
      const before = beforeRead.current;
      if (before) {
        const items = changesSince(before, rec).filter(({ id }) => before.rows[id] !== undefined);
        if (items.length) setRecentChanges({ at: rec.at, ids: new Map(items.map(({ id }) => [id, round])), items });
      }
    }
    if (unreadable === 0) saveVisit(shownCluster, mint, rec);
  }, [view, shownCluster, mint, unreadable, round, reading]);

  const reread = () => {
    if (reading || more) return;
    beforeRead.current = view ? recordOf([...view.fromAuthorities, ...view.fromOthers], Date.now()) : null;
    setRecentChanges(null);
    setReading(true);
    setMoreError(null);
    rpc.clear();
    setRound((n) => n + 1);
  };

  return (
    <div className="token stack">
      <header className="tokenhead">
        <div className="tokenhead__text">
          <p className="caps">Token</p>
          <div className="tokenhead__address">
            <h1 className="tokenhead__mint mono" aria-label={`Token address ${mint}`}>{mint}</h1>
            <AddressMark address={mint} />
          </div>
          <p className="chip" data-cluster={cluster}>
            {clusterKnown ? CLUSTER_LABEL[cluster] : "Reading cluster…"}
          </p>
          {clusterKnown && cluster !== "mainnet" && (
            <p className="caption">This is not Solana mainnet. Tokens and claims here are separate from mainnet.</p>
          )}
        </div>
        {load.state === "ready" && (
          <div className="tokenhead__stamp hide-narrow">
            <MeasurementStamp slot={load.snapshot.slot} ageLabel={ageLabel(load.snapshot.observedAt, now)} size={150} />
          </div>
        )}
      </header>

      {load.state === "loading" && <p role="status" className="dim status-slot measure-loading">Reading the chain…</p>}

      {load.state === "failed" && (
        <div className="notice" role="alert">
          <StateArt kind="no-network" />
          <h2>Could not read this token</h2>
          <p>{load.message}</p>
          <p className="caption">This does not mean the token is missing or that any claim is false.</p>
          <button type="button" className="btn" onClick={reread} disabled={reading}>Try again</button>
        </div>
      )}

      {load.state === "ready" && (
        <>
          {view?.facts ? <FactsPanel facts={view.facts} /> : view ? (
            <div className="notice">
              <StateArt kind="other-cluster" />
              <h2>On the chain now</h2>
              <p>The mint account could not be read as an SPL Token or Token-2022 mint on this cluster. Claims below will show “Cannot check right now”.</p>
            </div>
          ) : null}

          {claims.state === "failed" && (
            <div className="notice" role="alert">
              <h2>Published claims could not be loaded</h2>
              <p>{claims.message}</p>
              <p className="caption">This is not the same as “no claims”. Nothing is shown as true or false until the claims are read.</p>
              <button type="button" className="btn" onClick={reread} disabled={reading}>Try again</button>
            </div>
          )}

          {view && claims.state === "ready" && (
            <>
              <VerdictStrip counts={view.counts} othersCount={view.othersCount} slot={load.snapshot.slot} ageLabel={ageLabel(load.snapshot.observedAt, now)} />

              {(since || recentChanges) && (
                <section aria-labelledby="since-h" className="notice since">
                  <h2 id="since-h">{since ? "Since your last visit" : "Since the previous read"}</h2>
                  {since && <p className="caption">Last shown in this browser {ageLabel(since.at, now)}. This is kept on this device only.</p>}
                  {!since?.changes.length && !recentChanges?.items.length ? (
                    <p>Nothing changed in the claims shown below.</p>
                  ) : (
                    <ul className="since__list">
                      {[...new Map([...(since?.changes ?? []), ...(recentChanges?.items ?? [])].map((c) => [c.id, c])).values()].map((c) => <li key={c.id}>{c.text}</li>)}
                    </ul>
                  )}
                </section>
              )}

              {view.fromAuthorities.length === 0 && <StateArt kind="no-claims" />}
              {view.fromAuthorities.length > 0 && (
                <section aria-labelledby="auth-h" className="stack">
                  <h2 id="auth-h">From the token’s authorities</h2>
                  <p className="caption">Wallets that hold an authority over this token right now, or created the pump.fun coin. Read live; authorities can change hands.</p>
                  {view.fromAuthorities.map((g) => <ClaimGroupCard key={g.signature} group={g} cluster={cluster} changed={recentChanges && now - recentChanges.at < 30_000 ? recentChanges.ids : undefined} />)}
                </section>
              )}

              {view.fromOthers.length > 0 && (
                <details className="superseded others">
                  <summary>From other wallets ({view.fromOthers.length})</summary>
                  <div className="stack">
                    <p className="notice notice--warn" role="note">
                      Anyone can publish a claim about any token, including a wallet that has nothing to do with it. These wallets are not shown to hold an authority over this token. Read each one as what that wallet says, not as what the token’s creators promise.
                    </p>
                    {view.fromOthers.map((g) => <ClaimGroupCard key={g.signature} group={g} cluster={cluster} changed={recentChanges && now - recentChanges.at < 30_000 ? recentChanges.ids : undefined} />)}
                  </div>
                </details>
              )}

              {view.superseded.length > 0 && (
                <details className="superseded">
                  <summary>Superseded claims ({view.superseded.length})</summary>
                  <div className="stack">
                    {view.superseded.map((g) => <ClaimGroupCard key={g.signature} group={g} cluster={cluster} changed={recentChanges && now - recentChanges.at < 30_000 ? recentChanges.ids : undefined} />)}
                  </div>
                </details>
              )}

              {claims.malformed > 0 && (
                <p className="caption">{claims.malformed} malformed {claims.malformed === 1 ? "memo" : "memos"} ignored.</p>
              )}
              {claims.unreadable > 0 && (
                <p className="caption">{claims.unreadable} {claims.unreadable === 1 ? "transaction" : "transactions"} could not be read right now and {claims.unreadable === 1 ? "is" : "are"} not shown. Read again to retry.</p>
              )}
              {moreError && <p className="field-error" role="alert">{moreError}</p>}
              {claims.next && (
                <p>
                  <button type="button" className="btn" onClick={loadMore} disabled={more || reading}>{more ? "Loading…" : "Load more claims"}</button>
                </p>
              )}
            </>
          )}

          <p className="actions">
            <button type="button" className="btn" onClick={reread} disabled={reading || more}>Read again</button>
            <span className={reading ? "caption measure-loading" : "sr-only"} role="status">{reading ? "Checking against the chain…" : ""}</span>
            <Link className="btn btn--primary" href={`/publish?m=${encodeURIComponent(mint)}`}>Publish a claim about {shortAddress(mint)}</Link>
          </p>
        </>
      )}

      {load.state !== "loading" && <NotTold />}
    </div>
  );
}
