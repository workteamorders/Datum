import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { TocRail } from "@/components/TocRail";

export const metadata: Metadata = { title: "Risk and terms" };

export default function Terms() {
  return (
    <>
    <PageHero eyebrow="Risk and terms" title="Risk and terms" lede="Read this before you rely on a result or publish a claim." sheet="05" variant={2} />
    <div className="band__in page-body page-body--toc">
    <TocRail />
    <article className="prose">
      <p className="notice notice--warn" role="note">
        <b>Draft, awaiting legal review.</b> This text is written in plain language and has not been reviewed by a lawyer. Treat it as a description of how Datum works, not as a final contract.
      </p>

      <h2 id="not-advice">Information only</h2>
      <p>Datum shows what a token’s accounts contain on the Solana chain at the moment they were read, next to statements that wallets have published. It is not financial, investment, legal or tax advice. It does not say whether a token is a good idea, who is behind it, whether liquidity can be pulled, or whether a claim was made in good faith.</p>

      <h2 id="claims">Claims are statements by wallets</h2>
      <p>Anyone with a wallet can publish a claim about any token. Datum does not review claims and does not know who stands behind a wallet. A result of “True now” means the statement held at the slot shown. It can stop being true later, which is why each result says whether it can change.</p>

      <h2 id="reading">Reading can fail</h2>
      <p>Datum reads the chain through a public RPC service. If that service is slow, busy or wrong, a result may show “Cannot check right now”. That is not the same as “not true”. Reload to read again. Datum cannot tell you about anything it did not read.</p>

      <h2 id="publishing">Publishing a claim</h2>
      <ul>
        <li>A published claim is a public transaction on the Solana chain. It cannot be edited or withdrawn. Publishing a newer claim for the same token replaces it in the list, and both stay on the chain.</li>
        <li>You pay the Solana network fee from your own wallet. The fee is shown before you sign. Datum charges nothing.</li>
        <li>Your wallet signs the transaction in its own window. Datum never sees or asks for a seed phrase or a private key, and sends nothing you did not sign.</li>
        <li>Check the memo and the fee in your wallet’s own window before you approve.</li>
        <li>A transaction that was sent but not yet seen may still land. Do not publish the same claim again until you have checked the token page.</li>
      </ul>

      <h2 id="regions">Regions</h2>
      <p>Publishing may be turned off in some regions. Reading is not affected.</p>

      <h2 id="privacy">Privacy</h2>
      <p>Datum has no accounts and stores nothing about you. Your browser sends the addresses you look up to Datum’s relay, which forwards the request to an RPC provider. Standard server logs and the provider’s logs may record your IP address and the request. Links to a block explorer leave this site.</p>

      <h2 id="availability">No promise of availability</h2>
      <p>Datum is offered as is, may change or stop without notice, and depends on third-party services. The claims themselves live on the Solana chain and do not depend on this site.</p>
    </article>
    </div>
    </>
  );
}
