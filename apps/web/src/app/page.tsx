import Link from "next/link";
import { MintLookup } from "@/components/MintLookup";
import { Disc } from "@/components/Disc";
import { ExampleClaim } from "@/components/ExampleClaim";

export default function Home() {
  return (
    <div className="stack home">
      <section className="hero stack" aria-labelledby="home-h">
        <p className="caps">Datum · Solana</p>
        <h1 id="home-h">What is true about this token, right now?</h1>
        <p className="lede">
          Paste a token address. Datum reads the chain in your browser and checks each claim wallets have published about it, then shows what holds now and what could still change.
        </p>
        <MintLookup autoFocus />
      </section>

      <ExampleClaim />

      <section aria-labelledby="how-h" className="stack">
        <h2 id="how-h">How it works</h2>
        <ol className="how">
          <li>
            <Disc size={28} />
            <div>
              <h3>Claims are published</h3>
              <p>A wallet signs a short statement about a token, such as “the mint authority is revoked”, and publishes it on the Solana chain.</p>
            </div>
          </li>
          <li>
            <Disc size={28} />
            <div>
              <h3>Datum measures again</h3>
              <p>When you open a token, your browser reads the accounts now and checks every statement. Each result shows the account and the slot it was read at.</p>
            </div>
          </li>
          <li>
            <Disc size={28} />
            <div>
              <h3>Results say how long they hold</h3>
              <p>“Permanent” means the chain’s own rules keep it that way. “Can change” says why it might.</p>
            </div>
          </li>
        </ol>
        <p>
          Holding a token you made? <Link href="/publish">Publish a claim</Link>. Want the exact rules? Read the <Link href="/methodology">methodology</Link> or the <Link href="/spec">specification</Link>.
        </p>
      </section>
    </div>
  );
}
