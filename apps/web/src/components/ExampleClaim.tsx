"use client";

import { ClaimGroupCard } from "./ClaimGroupCard";
import { AddressMark, ArtSeal } from "./fx/BenchmarkArt";
import { EXAMPLE_MINT, EXAMPLE_GROUP } from "@/lib/example";

/** A made-up claim, so a first-time visitor can see what a result looks like. Always labelled. */
export function ExampleClaim() {
  return (
    <section className="example stack" aria-labelledby="example-h">
      <p className="example__art"><ArtSeal kind="example" id="example-h" /><AddressMark address={EXAMPLE_MINT} /></p>
      <p className="caption">Invented for this page. It is not a claim about a real token. Real results look like this, with the real account and slot.</p>
      <ClaimGroupCard group={EXAMPLE_GROUP} cluster="unknown" />
    </section>
  );
}
