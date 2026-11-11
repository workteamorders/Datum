"use client";

import { StateArt } from "@/components/fx/BenchmarkArt";
import Link from "next/link";
import { Confirmed } from "@/components/fx/Confirmed";
import { PointerAccent } from "@/components/fx/PointerAccent";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { isPubkey, type Snapshot, type Status } from "@datum/protocol";
import { MemoPreview } from "@/components/MemoPreview";
import { PreflightStepper, type Step } from "@/components/PreflightStepper";
import { PredicatePicker, type Selection } from "@/components/PredicatePicker";
import { Ruler } from "@/components/Ruler";
import { SignerRelationLine } from "@/components/SignerRelationLine";
import { StatusMark } from "@/components/StatusMark";
import { PageHero } from "@/components/PageHero";
import { StepProgress } from "@/components/StepProgress";
import { CLUSTER_LABEL, clusterFromGenesis, type Cluster } from "@/lib/cluster";
import { formatSol } from "@/lib/format";
import { canPublish, fetchGeoStatus, type GeoStatus } from "@/lib/geo";
import { previewPicks } from "@/lib/preflight";
import { readStored, writeStored } from "@/lib/storage";
import { MEMO_MAX_BYTES, buildMemo, byteLength, validateLabel } from "@/lib/memo";
import { PREDICATES, validateValue } from "@/lib/predicates";
import { checkLanding, checkSigned, fromBase64, prepareClaim, sendSigned, simulate, type Landing, type Prepared } from "@/lib/publish";
import { RpcFailure, rpc } from "@/lib/rpc";
import { readSnapshot } from "@/lib/snapshot";
import { CHAIN_OF, WalletFailure, connect, disconnect, listWallets, signWithWallet, supportsChain, watchWallets, type WalletEntry } from "@/lib/wallet";
import { shortAddress } from "@/lib/view";

type Phase =
  | { kind: "edit" }
  | { kind: "preparing" }
  | { kind: "review"; prepared: Prepared }
  | { kind: "working"; prepared: Prepared; at: "sign" | "inspect" | "send" }
  | { kind: "sent"; prepared: Prepared; signature: string; landing: Landing; checking: boolean; extraPrograms: string[] }
  | { kind: "error"; at: "prepare" | "sign" | "inspect" | "send"; message: string; logs?: string[]; prepared?: Prepared };

const RISK_KEY = "datum.risk.v0";

const WOULD: Record<Status, string> = {
  true: "Would be true now",
  false: "Would not be true now",
  cannot_check: "Cannot check right now",
  unsupported: "Not supported by this version",
};

const failText = (e: unknown): string => {
  if (e instanceof WalletFailure) return e.message;
  if (e instanceof RpcFailure) return e.kind === "blocked" ? "Sending transactions is not available in your region." : e.kind === "rate_limit" ? "The RPC service is busy. Try again in a moment." : e.message;
  return "Something went wrong. Nothing was sent.";
};

export function PublishPage() {
  const initial = useSearchParams().get("m")?.trim() ?? "";
  const [mint, setMint] = useState(initial);
  const [sel, setSel] = useState<Selection>({});
  const [label, setLabel] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "edit" });
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [geo, setGeo] = useState<GeoStatus | null>(null);
  const [wallets, setWallets] = useState<WalletEntry[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [accounts, setAccounts] = useState<readonly WalletAccount[]>([]);
  const [accountIx, setAccountIx] = useState(0);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [mintNote, setMintNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [ack, setAck] = useState(false);
  const [ackFalse, setAckFalse] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [riskSeen, setRiskSeen] = useState(true);
  const [riskAck, setRiskAck] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    rpc.call<string>("getGenesisHash").then((h) => alive.current && setCluster(clusterFromGenesis(h))).catch(() => alive.current && setCluster("unknown"));
    fetchGeoStatus().then((g) => alive.current && setGeo(g));
    setWallets(listWallets());
    setRiskSeen(readStored(RISK_KEY) === "1");
    const off = watchWallets(() => setWallets(listWallets()));
    return () => {
      alive.current = false;
      off();
    };
  }, []);

  const mintOk = isPubkey(mint);
  useEffect(() => {
    setMintNote(null);
    setSnap(null);
    if (!isPubkey(mint)) return;
    let cancelled = false;
    readSnapshot(rpc, mint).then((r) => {
      if (cancelled) return;
      if (r.ok) setSnap(r.snapshot);
      if (!r.ok) return setMintNote({ ok: false, text: "The token could not be read right now. You can still publish, but check the address." });
      const m = r.snapshot.mintAccount;
      if (m.state === "not_found") return setMintNote({ ok: false, text: "No account with this address was found on this cluster. A claim about it would show “Cannot check right now”." });
      if (m.state === "ok" && r.snapshot.addresses.tokenProgram !== m.value.owner) return setMintNote({ ok: false, text: "This account is not an SPL Token or Token-2022 mint." });
      setMintNote({ ok: true, text: "A mint account was found at this address." });
    });
    return () => {
      cancelled = true;
    };
  }, [mint]);

  const picks = useMemo(() => PREDICATES.filter((p) => p.key in sel).map((p) => ({ def: p, v: sel[p.key] ?? "" })), [sel]);
  const valueProblem = picks.some((x) => x.def.kind !== "none" && (x.v === "" || validateValue(x.def.kind, x.v) !== null));
  const labelProblem = validateLabel(label);
  const ready = mintOk && picks.length > 0 && !valueProblem && !labelProblem;
  const memo = ready ? buildMemo(mint, picks.map((x) => (x.def.kind === "none" ? { k: x.def.key } : { k: x.def.key, v: x.v })), label) : "";
  const bytes = byteLength(memo);

  const preview = useMemo(
    () => (snap && ready ? previewPicks(snap, picks.map((x) => ({ key: x.def.key, value: x.def.kind === "none" ? undefined : x.v }))) : null),
    [snap, ready, picks],
  );

  const account = accounts[accountIx] ?? null;
  const chain = cluster && cluster !== "unknown" ? CHAIN_OF[cluster] : null;
  const accountOnChain = wallet && account && chain ? supportsChain(wallet, account, chain) : false;
  const regionOk = geo !== null && canPublish(geo);
  const riskOk = riskSeen || riskAck;
  const canReview = ready && memo !== "" && bytes <= MEMO_MAX_BYTES && !!account && accountOnChain && regionOk && cluster !== null && cluster !== "unknown" && riskOk;

  async function doConnect(entry: WalletEntry) {
    setWalletError(null);
    setConnecting(true);
    try {
      const accs = await connect(entry.wallet);
      if (!alive.current) return;
      setWallet(entry.wallet);
      setAccounts(accs);
      setAccountIx(0);
    } catch (e) {
      if (alive.current) setWalletError(failText(e));
    } finally {
      if (alive.current) setConnecting(false);
    }
  }

  async function doDisconnect() {
    if (wallet) await disconnect(wallet);
    setWallet(null);
    setAccounts([]);
    setPhase({ kind: "edit" });
  }

  async function review() {
    if (!account) return;
    setPhase({ kind: "preparing" });
    try {
      // Read the token again so the "not true now" check below is as fresh as the fee.
      rpc.clear();
      const fresh = await readSnapshot(rpc, mint).catch(() => null);
      if (!alive.current) return;
      if (fresh && fresh.ok) setSnap(fresh.snapshot);
      const r = await prepareClaim(rpc, account.address, memo);
      if (!alive.current) return;
      setAck(false);
      setAckFalse(false);
      setPhase(r.ok ? { kind: "review", prepared: r.prepared } : { kind: "error", at: "prepare", message: r.reason, logs: r.logs });
    } catch (e) {
      if (alive.current) setPhase({ kind: "error", at: "prepare", message: failText(e) });
    }
  }

  async function signAndSend(prepared: Prepared) {
    if (!wallet || !account || !chain) return;
    setPhase({ kind: "working", prepared, at: "sign" });
    let signed: Uint8Array;
    try {
      signed = await signWithWallet(wallet, account, chain, fromBase64(prepared.base64));
    } catch (e) {
      if (alive.current) setPhase({ kind: "error", at: "sign", message: failText(e), prepared });
      return;
    }
    if (!alive.current) return;
    setPhase({ kind: "working", prepared, at: "inspect" });
    let extra: string[] = [];
    try {
      const chk = await checkSigned(signed, { publisher: prepared.publisher, memo: prepared.memo, blockhash: prepared.blockhash.blockhash });
      if (!chk.ok) return void (alive.current && setPhase({ kind: "error", at: "inspect", message: chk.reason, prepared }));
      extra = chk.extraPrograms;
      const sim = await simulate(rpc, signed, { signed: true });
      if (!sim.ok) return void (alive.current && setPhase({ kind: "error", at: "inspect", message: sim.reason, logs: sim.logs, prepared }));
    } catch (e) {
      return void (alive.current && setPhase({ kind: "error", at: "inspect", message: failText(e), prepared }));
    }
    if (!alive.current) return;
    setPhase({ kind: "working", prepared, at: "send" });
    try {
      const signature = await sendSigned(rpc, signed);
      if (!alive.current) return;
      if (riskAck) writeStored(RISK_KEY, "1");
      setPhase({ kind: "sent", prepared, signature, landing: { state: "pending" }, checking: false, extraPrograms: extra });
    } catch (e) {
      if (alive.current) setPhase({ kind: "error", at: "send", message: failText(e), prepared });
    }
  }

  // Follow a sent transaction until it lands, for a limited time.
  const sentSig = phase.kind === "sent" ? phase.signature : null;
  const landed = phase.kind === "sent" && phase.landing.state !== "pending";
  useEffect(() => {
    if (!sentSig || landed) return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      try {
        const l = await checkLanding(rpc, sentSig);
        if (!alive.current) return;
        setPhase((p) => (p.kind === "sent" && p.signature === sentSig ? { ...p, landing: l } : p));
        if (l.state !== "pending") clearInterval(t);
      } catch {
        /* keep trying until the limit */
      }
      if (tries >= 15) clearInterval(t);
    }, 4000);
    return () => clearInterval(t);
  }, [sentSig, landed]);

  async function checkAgain() {
    if (phase.kind !== "sent") return;
    const sig = phase.signature;
    setPhase({ ...phase, checking: true });
    try {
      const l = await checkLanding(rpc, sig);
      setPhase((p) => (p.kind === "sent" ? { ...p, landing: l, checking: false } : p));
    } catch {
      setPhase((p) => (p.kind === "sent" ? { ...p, checking: false } : p));
    }
  }

  const steps: Step[] | null = useMemo(() => {
    const kind = phase.kind;
    if (kind === "edit") return null;
    const at = kind === "error" ? phase.at : kind === "working" ? phase.at : kind === "preparing" ? "prepare" : kind === "review" ? "review" : "done";
    const order = ["prepare", "review", "sign", "inspect", "send", "confirm"] as const;
    const titles: Record<(typeof order)[number], string> = {
      prepare: "Build and check the claim",
      review: "Review the fee",
      sign: "Sign in your wallet",
      inspect: "Check what was signed",
      send: "Send",
      confirm: "Wait for the network",
    };
    const cur = at === "done" ? 5 : order.indexOf(at as (typeof order)[number]);
    return order.map((id, i) => {
      let state: Step["state"] = i < cur ? "done" : i === cur ? "current" : "todo";
      let detail: string | undefined;
      if (kind === "error" && i === cur) {
        state = "failed";
        detail = phase.message;
      }
      if (kind === "sent") {
        if (id === "confirm") {
          state = phase.landing.state === "confirmed" ? "done" : phase.landing.state === "failed" ? "failed" : "current";
          detail = phase.landing.state === "confirmed" ? `Confirmed in slot ${phase.landing.slot}.` : phase.landing.state === "failed" ? phase.landing.reason : "Sent. Waiting for the network to confirm.";
        } else state = "done";
      }
      if (kind === "review" && id === "prepare") state = "done";
      return { id, title: titles[id], state, detail };
    });
  }, [phase]);

  const stage: 1 | 2 | 3 = phase.kind === "edit" || (phase.kind === "error" && phase.at === "prepare") || phase.kind === "preparing" ? step : 3;
  const editing = phase.kind === "edit" || (phase.kind === "error" && phase.at === "prepare");
  const busy = phase.kind === "preparing" || phase.kind === "working";

  return (
    <div className="publish pointer-area">
      <PointerAccent />
      <PageHero
        eyebrow="Publish"
        title="Publish a claim"
        lede="A claim is a public statement from your wallet about a token. Anyone can check it against the chain at any time. It cannot be withdrawn. Publishing a newer claim for the same token replaces it in the list, and both stay on the chain."
        sheet="06"
        variant={0}
      >
        <div className="status-slot">
          <p className="chip" data-cluster={cluster ?? "unknown"}>{cluster ? CLUSTER_LABEL[cluster] : "Reading cluster…"}</p>
          {cluster === "mainnet" && <p className="caption">This is mainnet. Publishing costs a real network fee, shown before you sign.</p>}
          {cluster && cluster !== "mainnet" && cluster !== "unknown" && <p className="caption">This is not mainnet. A claim published here is not visible on mainnet.</p>}
          {cluster === "unknown" && <p className="field-error" role="alert">Datum could not tell which Solana cluster this site reads, so publishing is turned off.</p>}
          {geo && !regionOk && (
            <p className="field-error" role="alert">
              {geo.state === "ok" ? "Publishing is not available in your region. You can still read tokens and claims." : "Datum could not check your region, so publishing is paused. You can still read tokens and claims."}
            </p>
          )}
        </div>
      </PageHero>

      <div className="band__in stack page-body">
      <StepProgress stage={stage} />

      {editing && step === 1 && (
        <>
          <section className="stack" aria-labelledby="pub-token-h">
            <h2 id="pub-token-h">Token</h2>
            <div>
              <label className="label" htmlFor="pub-mint">Token address</label>
              <input id="pub-mint" className="field mono" value={mint} onChange={(e) => setMint(e.target.value.trim())} spellCheck={false} autoComplete="off" aria-invalid={mint !== "" && !mintOk ? true : undefined} aria-describedby="pub-mint-note" />
              <div id="pub-mint-note" className="note-slot">
                {mint !== "" && !mintOk && <p className="field-error">That does not look like a token address.</p>}
                {mintNote && <p className={mintNote.ok ? "caption" : "field-error"}>{mintNote.text}</p>}
              </div>
            </div>
          </section>

          <section className="stack" aria-labelledby="pub-st-h">
            <h2 id="pub-st-h">Statements</h2>
            <PredicatePicker value={sel} onChange={setSel} />
            <div>
              <label className="label" htmlFor="pub-label">Label (optional)</label>
              <input id="pub-label" className="field" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} aria-invalid={labelProblem ? true : undefined} aria-describedby={labelProblem ? "pub-label-err" : undefined} />
              {labelProblem && <p className="field-error" id="pub-label-err">{labelProblem}</p>}
            </div>
          </section>

          <p className="actions">
            <button type="button" className="btn btn--primary" disabled={!ready} onClick={() => setStep(2)}>Next: wallet and check</button>
            {!ready && <span className="caption">{!mintOk ? "Enter a token address." : picks.length === 0 ? "Choose at least one statement." : "Fix the marked fields."}</span>}
          </p>
        </>
      )}

      {editing && step === 2 && (
        <>
          <section className="stack" aria-labelledby="pub-check-h">
            <h2 id="pub-check-h">Would these statements be true now?</h2>
            <p className="caption">Checked against the chain just now, as if the claim were already published. Nothing is sent by this check.</p>
            {preview ? (
              <ul className="claims preview">
                {preview.picks.map((p) => (
                  <li key={p.key} className="claim" data-status={p.status}>
                    <div className="claim__mark">
                      <StatusMark status={p.status} label={WOULD[p.status]} />
                    </div>
                    <div className="claim__body">
                      <p className="claim__statement">{p.statement}</p>
                      <p className="claim__status-word">{WOULD[p.status]}</p>
                      <p className="caption">{p.measured}</p>
                      {p.note && <p className="caption">{p.note}</p>}
                      {p.ruler && <Ruler {...p.ruler} />}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="notice" role="status">
                <p>{snap === null && mintOk ? "The token could not be read yet, so Datum cannot say whether these statements would be true now." : "Complete the token and statements to see this check."}</p>
              </div>
            )}
            {preview && preview.notTrue > 0 && (
              <div className="notice notice--warn" role="alert">
                <h3>{preview.notTrue === 1 ? "One statement is not true now" : `${preview.notTrue} statements are not true now`}</h3>
                <p>If you publish this claim as it is, the token page will show it as “Not true now” from the first moment. You will be asked to confirm that before signing.</p>
              </div>
            )}
          </section>

          {ready ? (
            <MemoPreview memo={memo} bytes={bytes} />
          ) : (
            <div className="notice" role="status">
              <p>Go back and complete the token and statements to see the memo.</p>
            </div>
          )}

          <section className="stack" aria-labelledby="pub-wallet-h">
            <h2 id="pub-wallet-h">Wallet</h2>
            {!wallet ? (
              <>
                {wallets.length === 0 ? (
                  <div className="notice" role="status">
                    <StateArt kind="no-wallet" />
                    <p>No Solana wallet was found in this browser.</p>
                    <p className="caption">Datum works with wallets that follow the Wallet Standard. Install or unlock one, then reload this page. Datum never asks for a seed phrase or a private key.</p>
                  </div>
                ) : (
                  <ul className="wallets">
                    {wallets.map((w) => (
                      <li key={w.name}>
                        <button type="button" className="btn wallets__btn" onClick={() => doConnect(w)} disabled={connecting}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={w.icon} alt="" width="24" height="24" />
                          <span>{connecting ? "Connecting…" : `Connect ${w.name}`}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {walletError && <p className="field-error" role="alert">{walletError}</p>}
              </>
            ) : (
              <div className="stack">
                <p>
                  Connected with {wallet.name}:{" "}
                  {accounts.length > 1 ? (
                    <select className="field mono" aria-label="Account" value={accountIx} onChange={(e) => setAccountIx(Number(e.target.value))}>
                      {accounts.map((a, i) => <option key={a.address} value={i}>{shortAddress(a.address)}</option>)}
                    </select>
                  ) : (
                    <span className="mono" title={account?.address}>{account ? shortAddress(account.address) : ""}</span>
                  )}
                </p>
                {account && preview && <SignerRelationLine publisher={account.address} relations={preview.relationsOf(account.address) ?? []} />}
                {account && preview && preview.relationsOf(account.address) === null && <p className="caption">The mint could not be read, so the relation of this wallet to the token is not checked.</p>}
                {account && chain && !accountOnChain && (
                  <p className="field-error" role="alert">This wallet account is not set up for {CLUSTER_LABEL[cluster as Cluster]}. Switch the network in your wallet and connect again.</p>
                )}
                <p><button type="button" className="btn" onClick={doDisconnect}>Disconnect</button></p>
              </div>
            )}
          </section>

          {!riskSeen && (
            <section className="notice notice--warn" aria-labelledby="pub-risk-h">
              <h2 id="pub-risk-h">Before your first claim</h2>
              <ul className="bullets">
                <li>A claim is public and stays on Solana. You can publish a newer claim that replaces it in the list, but you cannot delete the old one.</li>
                <li>Anyone can compare it with the chain at any time. If it stops being true, the token page will say so.</li>
                <li>The network fee is paid to the network and is not returned.</li>
                <li>Datum does not review claims and does not say whether a token is good or bad. Read <Link href="/terms">Risk and terms</Link>.</li>
              </ul>
              <label className="check">
                <input type="checkbox" checked={riskAck} onChange={(e) => setRiskAck(e.target.checked)} />
                <span>I have read this.</span>
              </label>
            </section>
          )}

          {phase.kind === "error" && (
            <div className="notice" role="alert">
              <h2>Could not prepare the claim</h2>
              <p>{phase.message}</p>
              {phase.logs && phase.logs.length > 0 && <details><summary>Network log</summary><pre className="mono">{phase.logs.join("\n")}</pre></details>}
              <p className="caption">Nothing was sent.</p>
            </div>
          )}

          <p className="actions">
            <button type="button" className="btn btn--primary" disabled={!canReview || busy} onClick={review}>Review and check the fee</button>
            <button type="button" className="btn" onClick={() => setStep(1)}>Back</button>
          </p>
          {!canReview && <p className="caption">{!ready ? "Go back and complete the first step." : !account ? "Connect a wallet." : !accountOnChain ? "Switch your wallet’s network." : !regionOk ? "Publishing is not available." : !riskOk ? "Confirm that you have read the notice above." : ""}</p>}
        </>
      )}

      {phase.kind === "preparing" && <p role="status" className="dim">Building the claim and checking it with the network…</p>}

      {(phase.kind === "review" || phase.kind === "working" || phase.kind === "sent" || (phase.kind === "error" && phase.at !== "prepare")) && (() => {
        const prepared = phase.prepared;
        if (!prepared) return null;
        return (
          <section className="stack" aria-labelledby="pub-review-h">
            <h2 id="pub-review-h">Review</h2>
            <dl className="facts__list">
              <div className="facts__row"><dt>Network</dt><dd>{cluster ? CLUSTER_LABEL[cluster] : ""}</dd></div>
              <div className="facts__row"><dt>Published by</dt><dd className="mono">{prepared.publisher}</dd></div>
              <div className="facts__row"><dt>Wallet and token</dt><dd><SignerRelationLine publisher={prepared.publisher} relations={preview?.relationsOf(prepared.publisher) ?? []} /></dd></div>
              <div className="facts__row"><dt>About token</dt><dd className="mono">{mint}</dd></div>
              <div className="facts__row"><dt>Network fee</dt><dd><b className="num">{formatSol(prepared.feeLamports)} SOL</b> <span className="caption">({prepared.feeLamports.toLocaleString("en-US")} lamports). The base fee is 5,000 lamports per signature, plus a small priority fee. Datum charges nothing.</span></dd></div>
              <div className="facts__row"><dt>Size</dt><dd>{prepared.sizeBytes} bytes of 1,232 allowed. Compute limit {prepared.cuLimit.toLocaleString("en-US")}.</dd></div>
            </dl>
            <MemoPreview memo={prepared.memo} bytes={byteLength(prepared.memo)} />
            <p className="notice">This will stay public on Solana. You can publish a newer claim that replaces it in the list, but you cannot delete it.</p>
            {(phase.kind === "review" || phase.kind === "working") && preview && preview.notTrue > 0 && (
              <div className="notice notice--warn" role="alert">
                <h3>{preview.notTrue === 1 ? "One statement is not true now" : `${preview.notTrue} statements are not true now`}</h3>
                <ul className="bullets">
                  {preview.picks.filter((p) => p.status === "false").map((p) => <li key={p.key}>{p.statement}. {p.measured}</li>)}
                </ul>
                <p>This claim will show as “Not true now” as soon as it is published.</p>
              </div>
            )}
            {steps && <PreflightStepper steps={steps} />}
            {phase.kind === "error" && phase.logs && phase.logs.length > 0 && <details><summary>Network log</summary><pre className="mono">{phase.logs.join("\n")}</pre></details>}
            {phase.kind === "sent" && phase.extraPrograms.length > 0 && (
              <p className="caption">Your wallet added instructions from {phase.extraPrograms.map(shortAddress).join(", ")}. They are part of the transaction that was sent.</p>
            )}
            {phase.kind === "review" && (
              <>
                <label className="check">
                  <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                  <span>I understand this claim will be public and cannot be withdrawn.</span>
                </label>
                {preview && preview.notTrue > 0 && (
                  <label className="check">
                    <input type="checkbox" checked={ackFalse} onChange={(e) => setAckFalse(e.target.checked)} />
                    <span>I understand this claim will show as Not true now.</span>
                  </label>
                )}
                <p className="actions">
                  <button type="button" className="btn btn--primary" disabled={!ack || (!!preview && preview.notTrue > 0 && !ackFalse)} onClick={() => signAndSend(phase.prepared)}>Sign in my wallet</button>
                  <button type="button" className="btn" onClick={() => setPhase({ kind: "edit" })}>Back</button>
                </p>
              </>
            )}
            {phase.kind === "error" && (
              <p className="actions">
                <button type="button" className="btn" onClick={() => setPhase({ kind: "edit" })}>Start again</button>
                <span className="caption">{phase.at === "send" ? "If you tried to send, check the token page before publishing again: the claim may already be there." : "Nothing was sent."}</span>
              </p>
            )}
            {phase.kind === "sent" && (
              <div className="stack">
                {phase.landing.state === "confirmed" && <Confirmed key={phase.signature} />}
                <p>
                  Signature <code className="mono">{phase.signature}</code>
                </p>
                <p className="actions">
                  {phase.landing.state === "pending" && <button type="button" className="btn" disabled={phase.checking} onClick={checkAgain}>{phase.checking ? "Checking…" : "Check again"}</button>}
                  <Link className="btn btn--primary" href={`/t?m=${encodeURIComponent(mint)}`}>Open the token page</Link>
                </p>
                {phase.landing.state === "pending" && <p className="caption">Not confirmed yet. Do not publish again: the same signed transaction cannot be published twice. Check again in a moment.</p>}
              </div>
            )}
          </section>
        );
      })()}
      </div>
    </div>
  );
}
