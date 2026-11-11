import type { Metadata } from "next";

export const metadata: Metadata = { title: "Methodology" };

export default function Methodology() {
  return (
    <article className="prose">
      <p className="caps">Methodology</p>
      <h1>How Datum reads a claim</h1>
      <p className="lede">Datum checks each published claim against the chain again, in your browser, every time you open a token. Nothing is cached on a server and no result is stored.</p>

      <h2 id="what-is-read">What is read</h2>
      <p>For each token Datum reads, in one pass: the mint account, the Metaplex metadata account, the pump.fun curve account (used only to work out who created a pump.fun coin), and the account of the token program together with its program data account. Every answer carries the slot it was read at. The slot comes from the RPC response. The “12 s ago” label uses this device’s clock.</p>

      <h2 id="results">The four results</h2>
      <ul>
        <li><b>True now</b>: every statement in the claim was checked and holds on the chain right now.</li>
        <li><b>Not true now</b>: at least one statement was checked and does not hold.</li>
        <li><b>Cannot check right now</b>: the chain could not be read, the account was missing, or the statement cannot be read for this token. This is never counted as “not true”.</li>
        <li><b>Not supported by this version</b>: the claim uses a statement this version of Datum does not know.</li>
      </ul>
      <p>A claim with several statements is “Not true now” if any statement is false. Otherwise it is “Cannot check right now” if any could not be checked, then “Not supported by this version” if any is unknown. It is “True now” only when every statement was checked and holds.</p>

      <h2 id="fresh">How fresh a result is</h2>
      <p>Every read uses the <b>confirmed</b> level, not <b>finalized</b>. Confirmed is fast and is almost always right, but in rare cases a confirmed slot can still be dropped. The slot on each result tells you exactly what was read. Datum reads through a free RPC service with limits: it asks for at most 50 transactions per page and shows at most 10 valid claims per load. When the service is busy or refuses a request, the result says “Cannot check right now” and says why. It never turns that into “Not true now”.</p>

      <h2 id="stability">Permanent and Can change</h2>
      <p>Each result says whether the thing it measured can change later. A result is marked <b>Permanent</b> only when all three of these were established: the property cannot change under the token program’s current code, the token program has no upgrade authority (read live), and the mint cannot be closed. Everything else is <b>Can change</b>, with a one-sentence reason.</p>
      <p>Today that means results about SPL Token mints can be Permanent, and results about Token-2022 mints are shown as “Can change”, because Token-2022 has an upgrade authority. Metadata statements are always “Can change” in this version: the metadata account is controlled by an update authority, and Datum has not established that it can never be closed or replaced.</p>

      <p>This rests on what the token programs’ accounts show now: the SPL Token program’s data account has no upgrade authority, and the Token-2022 program’s data account has one. Datum reads the program data account live every time, so a change there changes the label the same day.</p>

      <h2 id="signers">Who published a claim</h2>
      <p>Anyone can publish a claim about any token. For each claim Datum shows how the publishing wallet relates to the token, as it is on the chain now: holds the mint authority, holds the freeze authority, holds the metadata update authority, is the pump.fun creator recorded on the coin’s curve account, “Authority revoked; cannot establish who signed”, or “Unrelated wallet”. These are facts about the present. Authorities can change hands, so a relation can be different tomorrow.</p>
      <p>Claims from wallets that hold an authority over the token are listed first. That is a grouping, not a ranking and not an endorsement.</p>

      <h2 id="newer">Newer claims</h2>
      <p>Claims are grouped by publishing wallet and token. The newest claim in a group, by slot, is current. Older ones stay visible under “Superseded claims”. A claim cannot be withdrawn.</p>

      <h2 id="limits">What Datum does not do</h2>
      <ul>
        <li>It does not rank or grade tokens, or label a token with a verdict.</li>
        <li>It does not read prices, liquidity, holder lists or off-chain promises.</li>
        <li>It does not say when a claim stopped being true. That needs an indexer.</li>
        <li>It reads up to 10 claims per load. “Load more claims” continues from where the last load stopped.</li>
        <li>Memos that do not follow the format are left out of the lists and counted. Each token page reports the count as “N malformed memos ignored”. A transaction that could not be read because the RPC failed is counted separately, as it is not malformed.</li>
      </ul>
      <p>The exact rules are in the <a href="/spec">specification</a>.</p>
    </article>
  );
}
