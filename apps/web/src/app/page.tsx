import Link from "next/link";
import { MintLookup } from "@/components/MintLookup";
import { ExampleClaim } from "@/components/ExampleClaim";
import { NotTold } from "@/components/NotTold";
import { StatusMark } from "@/components/StatusMark";
import { HomeData } from "@/components/home/HomeData";
import { HeroField } from "@/components/home/HeroField";
import { Ticker } from "@/components/home/Ticker";
import { StatTiles } from "@/components/home/StatTiles";
import { STATUS_LABEL, type Status } from "@/lib/view";

const KINDS: { status: Status; line: string }[] = [
  { status: "true", line: "The account shows it now." },
  { status: "false", line: "The account shows something else now." },
  { status: "cannot_check", line: "The chain could not be read for it just now." },
  { status: "unsupported", line: "This version has no rule for that statement." },
];

export default function Home() {
  return (
    <HomeData>
      <div className="home">
        <section className="band on-night hero" aria-labelledby="home-h">
          <div className="band__in hero__grid">
            <div className="hero__copy stack">
              <p className="caps">Datum · Solana</p>
              <h1 id="home-h">What is true about this token, right now?</h1>
              <p className="lede">
                Paste a token address. Datum reads the chain in your browser and checks each claim wallets have published about it, then shows what holds now and what could still change.
              </p>
              <MintLookup autoFocus />
              <p className="hero__links">
                <a href="#reading-3">See the four results</a>
                <Link href="/recent">Newest claims</Link>
              </p>
            </div>
            <HeroField />
          </div>
          <span className="ruler-edge" aria-hidden="true" />
        </section>

        <Ticker />

        <div className="band__in stack home__body">
          <StatTiles />

          <section className="reading" aria-labelledby="reading-1-h">
            <p className="reading__no mono" aria-hidden="true">01</p>
            <div className="reading__body stack">
              <p className="caps">Reading 01</p>
              <h2 id="reading-1-h">What the chain says</h2>
              <p>
                Supply, decimals, the mint authority, the freeze authority and the metadata are read from the token’s own accounts. Each fact names the account and the slot it was read at, so it can be checked by anyone with an RPC endpoint.
              </p>
            </div>
          </section>

          <section className="reading" aria-labelledby="reading-2-h">
            <p className="reading__no mono" aria-hidden="true">02</p>
            <div className="reading__body stack">
              <p className="caps">Reading 02</p>
              <h2 id="reading-2-h">What people claim</h2>
              <p>
                A wallet signs a short statement about a token, such as “the mint authority is revoked”, and publishes it on the Solana chain. Datum lists every claim it can read, with the wallet that published it.
              </p>
            </div>
          </section>

          <ExampleClaim />

          <section className="reading" id="reading-3" aria-labelledby="reading-3-h">
            <p className="reading__no mono" aria-hidden="true">03</p>
            <div className="reading__body stack">
              <p className="caps">Reading 03</p>
              <h2 id="reading-3-h">What is true right now</h2>
              <p>
                When you open a token, your browser reads the accounts again and checks every statement. “Permanent” means the chain’s own rules keep it that way. “Can change” says why it might. Each statement ends in one of four results, and they are never merged.
              </p>
              <ul className="kinds">
                {KINDS.map((k) => (
                  <li key={k.status} className="kind" data-status={k.status}>
                    <span className="kind__mark"><StatusMark status={k.status} /></span>
                    <span className="kind__name">{STATUS_LABEL[k.status]}</span>
                    <span className="kind__line">{k.line}</span>
                  </li>
                ))}
              </ul>
              <p>
                Holding a token you made? <Link href="/publish">Publish a claim</Link>. Want the exact rules? Read the <Link href="/methodology">methodology</Link> or the <Link href="/spec">specification</Link>.
              </p>
            </div>
          </section>
        </div>

        <div className="band on-night band--end">
          <span className="ruler-edge ruler-edge--top" aria-hidden="true" />
          <div className="band__in reading reading--night">
            <p className="reading__no mono" aria-hidden="true">04</p>
            <div className="reading__body stack">
              <p className="caps">Reading 04</p>
              <NotTold />
            </div>
          </div>
        </div>
      </div>
    </HomeData>
  );
}
