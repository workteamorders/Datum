"use client";

import Link from "next/link";
import { useHomeReading } from "./HomeData";
import { formatInt, shortAddress } from "@/lib/view";

const MAX_ITEMS = 8;

/**
 * A strip of the newest published claims, read from the chain. When nothing was read, it says so in one fixed line.
 * It scrolls only while motion is on; otherwise it is a plain row that can be scrolled by hand.
 */
export function Ticker() {
  const reading = useHomeReading();
  const claims = reading.s === "ready" && reading.claims ? reading.claims.slice(0, MAX_ITEMS) : [];

  if (claims.length === 0) {
    return (
      <div className="ticker-wrap">
        <div className="ticker" role="region" aria-label="Newest claims">
          <p className="ticker__empty mono">
            {reading.s === "waiting" ? "Reading the newest claims…" : "No recent claims read right now."}
          </p>
        </div>
      </div>
    );
  }

  const items = (hidden: boolean) =>
    claims.map((c) => (
      <li key={`${hidden ? "b" : "a"}-${c.signature}`} className="ticker__item">
        <Link href={`/t?m=${encodeURIComponent(c.memo.m)}`} tabIndex={hidden ? -1 : undefined} className="ticker__link mono">
          {shortAddress(c.memo.m)}
        </Link>
        <span className="ticker__facts">
          {c.memo.p.length} {c.memo.p.length === 1 ? "statement" : "statements"}
        </span>
        <span className="ticker__slot mono">slot {formatInt(c.slot)}</span>
      </li>
    ));

  return (
    <div className="ticker-wrap">
      <div className="ticker" role="region" aria-label="Newest claims" tabIndex={0}>
        <div className="ticker__track">
          <ul className="ticker__list">{items(false)}</ul>
          <ul className="ticker__list ticker__list--copy" aria-hidden="true">{items(true)}</ul>
        </div>
      </div>
    </div>
  );
}
