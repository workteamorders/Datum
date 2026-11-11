import { DISC_ART, REGISTRATION_ART, SEAL_ART, STATE_ART } from "@/art/benchmark";
import { AddressMark, ArtSeal, StateArt } from "@/components/fx/BenchmarkArt";
import { MotionControl } from "@/components/fx/Motion";
import { EXAMPLE_MINT } from "@/lib/example";
import type { Metadata } from "next";
import { ClaimRow } from "@/components/ClaimRow";
import { Disc } from "@/components/Disc";
import { MeasurementLine, MeasurementStamp } from "@/components/MeasurementStamp";
import { NotTold } from "@/components/NotTold";
import { ExampleClaim } from "@/components/ExampleClaim";
import { PreflightStepper } from "@/components/PreflightStepper";
import { StepProgress } from "@/components/StepProgress";
import { rulerProps } from "@/lib/readings";
import { Ruler } from "@/components/Ruler";
import { SignerRelationLine } from "@/components/SignerRelationLine";
import { StabilityTag } from "@/components/StabilityTag";
import { StatusMark } from "@/components/StatusMark";
import { VerdictStrip } from "@/components/VerdictStrip";
import type { ClaimView } from "@/components/types";
import { buildMemo } from "@/lib/memo";
import { describePredicate, formulaOf } from "@/lib/predicates";
import { RELATION_LABEL, type RelationKind, type Status } from "@/lib/view";
import { PickerDemo } from "./PickerDemo";

export const metadata: Metadata = {
  title: "Styleguide",
  robots: { index: false, follow: false },
};

const MINT = EXAMPLE_MINT;
const PUBLISHER = "7p9vKmJgcGiFsPEEoPvVevREc4MGsKRVTh4n7FJPLwCm";
const SIG = "ExampLe1SignaTure1111111111111111111111111111111111111111111111111111111111111111";

const COLORS: { token: string; name: string; hex: string; role: string; contrast?: string }[] = [
  { token: "--color-bg", name: "Concrete", hex: "#E2E4E1", role: "Page background" },
  { token: "--color-surface", name: "Cured", hex: "#D2D5D1", role: "Set-in panels" },
  { token: "--color-ink", name: "Stamp", hex: "#1B1C1A", role: "Text, marks", contrast: "13.4 : 1" },
  { token: "--color-ink-dim", name: "Aggregate", hex: "#4F534D", role: "Secondary text", contrast: "6.1 : 1" },
  { token: "--color-accent", name: "Bronze", hex: "#7E4C1E", role: "Links, primary action", contrast: "5.6 : 1" },
  { token: "--color-negative", name: "Oxide", hex: "#8F3520", role: "Past the limit, Not true now", contrast: "6.1 : 1" },
  { token: "--color-disc", name: "Cast", hex: "#B98A55", role: "Survey disc face, decoration only" },
  { token: "--color-edge", name: "Edge", hex: "#62665F", role: "Control borders, dashed ring" },
  { token: "--color-line", name: "Seam", hex: "#9EA39B", role: "Row separators, decoration only" },
];

const SPACES = [
  ["--space-1", "4"], ["--space-2", "8"], ["--space-3", "12"], ["--space-4", "16"],
  ["--space-5", "24"], ["--space-6", "32"], ["--space-7", "48"], ["--space-8", "64"],
] as const;

const RELATIONS: RelationKind[] = [
  "mint_authority", "freeze_authority", "metadata_update_authority", "pump_creator", "revoked", "unrelated",
];

const mk = (picks: { k: string; v?: string }[], n?: string) => buildMemo(MINT, picks, n ?? "");

const CLAIMS: ClaimView[] = [
  {
    id: "c1", status: "true", statement: describePredicate("mint_authority_none"), formula: formulaOf("mint_authority_none"),
    measured: "Mint authority: None.", stability: "permanent",
    stabilityReason: "SPL Token has no way to set a mint authority again, and the token program cannot be upgraded.",
    relations: ["revoked"], publisher: PUBLISHER, claimSlot: 467_800_112, signature: SIG,
    memo: mk([{ k: "mint_authority_none" }], "Launch terms"), label: "Launch terms",
    measuredSlot: 467_813_648, measuredAge: "12 s ago",
    accounts: [{ name: "Mint account", address: MINT }],
  },
  {
    id: "c2", status: "false", statement: describePredicate("supply_max", "1000000000"), formula: formulaOf("supply_max", "1000000000"),
    measured: "Raw supply: 1,204,000,000 base units, which is 204,000,000 over the limit.", stability: "can_change",
    stabilityReason: "Supply can change while a mint authority exists.",
    relations: ["mint_authority"], publisher: PUBLISHER, claimSlot: 467_790_004, signature: SIG,
    memo: mk([{ k: "supply_max", v: "1000000000" }]),
    ruler: rulerProps({ limit: 1_000_000_000n, now: 1_204_000_000n, unit: "base units", what: "Supply" }),
    measuredSlot: 467_813_648, measuredAge: "12 s ago",
    accounts: [{ name: "Mint account", address: MINT }],
  },
  {
    id: "c3", status: "cannot_check", statement: describePredicate("metadata_immutable"), formula: formulaOf("metadata_immutable"),
    measured: "Not read.", stability: "can_change",
    stabilityReason: "Metadata can change through its update authority, so this result is always “Can change” in v0.",
    relations: ["pump_creator"], publisher: PUBLISHER, claimSlot: 467_700_900, signature: SIG,
    memo: mk([{ k: "metadata_immutable" }]),
    measuredSlot: 467_813_648, measuredAge: "12 s ago",
    accounts: [{ name: "Metadata account", address: MINT }],
    note: "The RPC did not answer for the metadata account. Check again in a moment.",
  },
  {
    id: "c4", status: "unsupported", statement: describePredicate("future_predicate", "42"), formula: formulaOf("future_predicate"),
    measured: "Not read.", stability: "can_change",
    stabilityReason: "This version of Datum does not know this statement, so it makes no claim about its stability.",
    relations: ["unrelated"], publisher: PUBLISHER, claimSlot: 467_650_321, signature: SIG,
    memo: mk([{ k: "future_predicate", v: "42" }]),
    measuredSlot: 467_813_648, measuredAge: "12 s ago",
    accounts: [],
  },
];

const STATUSES: Status[] = ["true", "false", "cannot_check", "unsupported"];

const rulerTicks = [
  { at: 0, label: "0" },
  { at: 500_000_000, label: "500M" },
  { at: 1_000_000_000, label: "1B" },
  { at: 1_500_000_000, label: "1.5B" },
];

export default function Styleguide() {
  return (
    <>
      <header className="sg-hero">
        <ArtSeal kind="example" />
        <h1>Styleguide</h1>
        <p>
          Every component Datum uses, with made-up data. Nothing on this page is a real claim about a real token.
        </p>
        <ul className="sg-toc">
          {[
            ["colour", "Colour"], ["type", "Type"], ["shape", "Space and shape"], ["controls", "Controls"],
            ["stamp", "Disc and stamp"], ["status", "StatusMark"], ["relation", "Relation and stability"],
            ["ruler", "Ruler"], ["verdict", "VerdictStrip"], ["claims", "ClaimRow and evidence"],
            ["picker", "Publish"], ["stepper", "Steps"], ["example", "Example"], ["motion-art", "Motion and artwork"],
          ].map(([id, label]) => (
            <li key={id}><a href={`#${id}`}>{label}</a></li>
          ))}
        </ul>
      </header>

      <section className="sg-section" id="colour">
        <h2>Colour</h2>
        <p className="lede">
          Light only for v0. Text pairs are at least 4.5 : 1. Cast and Seam are decoration and never carry text. Status is
          never carried by colour alone: each status has its own shape and its own words.
        </p>
        <div className="sg-grid sg-grid--2">
          {COLORS.map((c) => (
            <div className="swatch" key={c.token}>
              <i className="swatch__chip" style={{ background: `var(${c.token})` }} />
              <div>
                <b>{c.name}</b> <span className="mono">{c.hex}</span>
                <span>{c.role}{c.contrast ? `, ${c.contrast} on Concrete` : ""}</span>
                <span className="mono">{c.token}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="sg-section" id="type">
        <h2>Type</h2>
        <p className="lede">One family. Chivo for display and text, Chivo Mono for slots, amounts and addresses. Self-hosted.</p>
        <div className="sg-type">
          <p className="display">3 of 4 published claims are true now.</p>
          <h2>Heading 2, Chivo 800</h2>
          <h3>Heading 3, Chivo 800</h3>
          <p>
            Body text is Chivo 400 at 16 px with a line height of 1.5. Datum checks claims against the chain as it is now,
            and every result shows the account that was read and the slot it was read at.
          </p>
          <p className="mono">7p9vKmJgcGiFsPEEoPvVevREc4MGsKRVTh4n7FJPLwCm</p>
          <p className="mono num">1,000,000,000.000000 · slot 467,813,648</p>
          <p className="caption">Caption, 13 px. Tick labels are 12 px and appear on rulers only.</p>
        </div>
      </section>

      <section className="sg-section" id="shape">
        <h2>Space and shape</h2>
        <p className="lede">A 4 px base. Panels have a 4 px radius and sit set in, with no drop shadow. Markers are circles.</p>
        <div className="sg-grid sg-grid--2">
          <div className="sg-spaces">
            {SPACES.map(([t, px]) => (
              <div className="sg-space" key={t}>
                <span className="mono">{px} px</span>
                <i style={{ width: `var(${t})` }} />
              </div>
            ))}
          </div>
          <div className="sg-panel">
            <p><b>Set-in panel.</b> A slightly darker surface with a light inner top edge, like a cast recess.</p>
            <p className="caption">Touch targets are at least 44 px tall. Lines are 1 px or 2 px.</p>
          </div>
        </div>
      </section>

      <section className="sg-section" id="controls">
        <h2>Controls</h2>
        <div className="sg-controls">
          <button className="btn btn--primary" type="button">Publish claim</button>
          <button className="btn" type="button">Look up</button>
          <button className="btn btn--primary" type="button" disabled>Publish claim</button>
          <a href="#controls">A link in text</a>
        </div>
        <div className="sg-grid sg-grid--2" style={{ marginTop: "var(--space-5)" }}>
          <div>
            <label className="label" htmlFor="sg-mint">Token address</label>
            <input id="sg-mint" className="field mono" defaultValue={MINT} spellCheck={false} autoComplete="off" />
          </div>
          <div>
            <label className="label" htmlFor="sg-bad">Token address with a problem</label>
            <input id="sg-bad" className="field mono" defaultValue="7p9vKm" aria-invalid="true" aria-describedby="sg-bad-err" spellCheck={false} />
            <p className="field-error" id="sg-bad-err">That is too short to be an address.</p>
          </div>
        </div>
        <p className="caption" style={{ marginTop: "var(--space-3)" }}>Focus ring: press Tab on any control. It is a 3 px bronze outline with a 2 px offset.</p>
      </section>

      <section className="sg-section" id="stamp">
        <h2>Disc and MeasurementStamp</h2>
        <p className="lede">
          The survey disc is the mark. The stamp says when a reading was taken. On phones and for screen readers the same
          fact is a plain sentence.
        </p>
        <div className="sg-stamp">
          <MeasurementStamp slot={467_813_648} ageLabel="12 s ago" />
          <div className="stack">
            <MeasurementLine slot={467_813_648} ageLabel="12 s ago" />
            <p className="caption">Short form, used inside rows and on narrow screens.</p>
            <Disc size={56} />
          </div>
        </div>
      </section>

      <section className="sg-section" id="status">
        <h2>StatusMark</h2>
        <p className="lede">
          Four results, four shapes. Filled disc with a cross, ring with an X, dashed ring, ring with a dot. The second row
          is the same marks in grayscale.
        </p>
        <div className="sg-grid sg-grid--2">
          <div className="sg-marks">
            {STATUSES.map((s) => <StatusMark key={s} status={s} withLabel />)}
          </div>
          <div className="sg-marks gray" aria-hidden="true">
            {STATUSES.map((s) => <StatusMark key={s} status={s} withLabel />)}
          </div>
        </div>
        <p className="caption" style={{ marginTop: "var(--space-3)" }}>
          “Cannot check right now” is never merged with “Not true now”.
        </p>
      </section>

      <section className="sg-section" id="relation">
        <h2>SignerRelationLine and StabilityTag</h2>
        <p className="lede">
          The line says how the publishing wallet relates to the token, as the chain shows it now. It never says who owns
          a wallet. Stability is a separate tag.
        </p>
        <div className="sg-grid sg-grid--2">
          <div className="stack">
            {RELATIONS.map((r) => (
              <SignerRelationLine key={r} publisher={PUBLISHER} relations={[r]} />
            ))}
            <SignerRelationLine publisher={PUBLISHER} relations={["mint_authority", "freeze_authority"]} />
          </div>
          <div className="stack">
            <p><StabilityTag stability="permanent" reason="Example reason." /> <span className="caption">holds only when nothing can change it</span></p>
            <p><StabilityTag stability="can_change" reason="Example reason." /> <span className="caption">everything else, with a reason in the evidence</span></p>
            <p className="caption">Relations on this page: {RELATIONS.map((r) => RELATION_LABEL[r]).length} kinds.</p>
          </div>
        </div>
      </section>

      <section className="sg-section" id="ruler">
        <h2>Ruler</h2>
        <p className="lede">
          A value against a claim limit. The limit is a disc set on the scale. The reading is a dot. Past the limit, the
          excess is marked and said in words. With no reading, the scale is dashed and says why.
        </p>
        <div className="sg-grid sg-grid--2">
          <div className="sg-state">
            <p className="caption">Within the limit</p>
            <Ruler
              limit={1_000_000_000} max={1_500_000_000} now={812_400_000}
              limitLabel="Claim limit 1,000,000,000" nowLabel="Now 812,400,000"
              ticks={rulerTicks}
              description="Supply now 812,400,000; claim limit 1,000,000,000; within the limit."
            />
          </div>
          <div className="sg-state">
            <p className="caption">Past the limit</p>
            <Ruler
              limit={1_000_000_000} max={1_500_000_000} now={1_204_000_000}
              limitLabel="Claim limit 1,000,000,000" nowLabel="Now 1,204,000,000, over by 204,000,000"
              ticks={rulerTicks}
              description="Supply now 1,204,000,000; claim limit 1,000,000,000; over by 204,000,000."
            />
          </div>
          <div className="sg-state">
            <p className="caption">No reading</p>
            <Ruler
              limit={1_000_000_000} max={1_500_000_000} now={null}
              limitLabel="Claim limit 1,000,000,000" missingLabel="No reading: the RPC did not answer"
              ticks={rulerTicks}
              description="Claim limit 1,000,000,000; supply could not be read right now."
            />
          </div>
          <div className="sg-state">
            <p className="caption">Same ruler in grayscale</p>
            <div className="gray">
              <Ruler
                limit={1_000_000_000} max={1_500_000_000} now={1_204_000_000}
                limitLabel="Claim limit 1,000,000,000" nowLabel="Now 1,204,000,000, over by 204,000,000"
                ticks={rulerTicks}
                description="Supply now 1,204,000,000; claim limit 1,000,000,000; over by 204,000,000."
              />
            </div>
          </div>
        </div>
      </section>

      <section className="sg-section" id="verdict">
        <h2>VerdictStrip</h2>
        <p className="lede">The summary at the top of a token page. It counts only claims published by the token’s own authorities, and says so. Each count is shown on its own and none is folded into another.</p>
        <div className="sg-grid sg-grid--2">
          <VerdictStrip counts={{ true: 3, false: 1, cannot_check: 0, unsupported: 0 }} othersCount={2} slot={467_813_648} ageLabel="12 s ago" />
          <VerdictStrip counts={{ true: 1, false: 1, cannot_check: 1, unsupported: 1 }} slot={467_813_648} ageLabel="12 s ago" />
          <VerdictStrip counts={{ true: 0, false: 0, cannot_check: 2, unsupported: 0 }} slot={467_813_648} ageLabel="12 s ago" />
          <VerdictStrip counts={{ true: 0, false: 0, cannot_check: 0, unsupported: 0 }} othersCount={3} slot={467_813_648} ageLabel="12 s ago" />
        </div>
      </section>

      <section className="sg-section" id="claims">
        <h2>ClaimRow and EvidenceDrawer</h2>
        <p className="lede">
          One row per claim statement. The first row is open to show the evidence behind a result: the account read, the
          slot, who published, and why the stability is what it is.
        </p>
        <ul className="claims">
          {CLAIMS.map((c, i) => (
            <ClaimRow key={c.id} claim={c} defaultOpen={i === 0} />
          ))}
        </ul>
        <div style={{ marginTop: "var(--space-6)" }}>
          <NotTold />
        </div>
      </section>

      <section className="sg-section" id="picker">
        <h2>PredicatePicker and MemoPreview</h2>
        <p className="lede">
          Choose statements, give them values, and see the exact memo that will be written, with how much room is left.
          This demo is live: try a value that is too long or a label with a symbol.
        </p>
        <PickerDemo />
      </section>

      <section className="sg-section" id="stepper">
        <h2>PreflightStepper</h2>
        <p className="lede">What happens before and after you sign. State is written out, not only drawn.</p>
        <div className="sg-grid sg-grid--2">
          <PreflightStepper
            steps={[
              { id: "b", title: "Build the transaction", state: "done" },
              { id: "s", title: "Test it on the network", state: "done", detail: "The test passed. Nothing moves except the network fee." },
              { id: "w", title: "Sign in your wallet", state: "current", detail: "Your wallet will ask you to approve. Datum never sees your keys." },
              { id: "t", title: "Send", state: "todo" },
              { id: "c", title: "Confirmed", state: "todo" },
            ]}
          />
          <PreflightStepper
            steps={[
              { id: "b", title: "Build the transaction", state: "done" },
              { id: "s", title: "Test it on the network", state: "failed", detail: "The test failed, so nothing was sent. The network said the account has too little SOL for the fee." },
              { id: "w", title: "Sign in your wallet", state: "todo" },
              { id: "t", title: "Send", state: "todo" },
              { id: "c", title: "Confirmed", state: "todo" },
            ]}
          />
        </div>
      </section>

      <section className="sg-section stack" id="motion-art">
        <h2>Motion and artwork</h2>
        <MotionControl />
        <div className="sg-controls">
          <AddressMark address={MINT} />
          {DISC_ART.map((kind) => <img key={kind} src={`/art/disc-${kind}.svg`} alt={kind} width="48" height="48" />)}
          {REGISTRATION_ART.map((kind) => <img key={kind} src={`/art/registration-${kind}.svg`} alt={`Registration ${kind}`} width="32" height="32" />)}
          <img src="/art/halftone.svg" alt="Halftone" width="48" height="48" />
        </div>
        <div className="sg-controls">
          {Object.entries(SEAL_ART).map(([kind, label]) => <img key={kind} src={`/art/seal-${kind}.svg`} alt={label} height="25" />)}
        </div>
        <div className="sg-controls">
          {STATE_ART.map((kind) => <figure key={kind}><StateArt kind={kind} /><figcaption>{kind.replaceAll("-", " ")}</figcaption></figure>)}
        </div>
        <p className="status-slot measure-loading">Checking against the chain…</p>
        <div className="measure-tape" aria-hidden="true"><span /></div>
        <ul className="claims">{CLAIMS.slice(0, 1).map((claim) => <ClaimRow key={claim.id} claim={claim} changed={1} />)}</ul>
        <p className="caption">Hover or press a button to see its offset. Tab shows its focus ring. Set Motion to Off for the still presentation.</p>
      </section>

      <section className="sg-section" id="example">
        <h2>StepProgress and ExampleClaim</h2>
        <p className="lede">The three publishing steps, and the labelled made-up claim shown on the Home page.</p>
        <div className="sg-grid">
          <StepProgress stage={1} />
          <StepProgress stage={2} />
          <StepProgress stage={3} />
          <ExampleClaim />
        </div>
      </section>
    </>
  );
}
