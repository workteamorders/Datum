"use client";

import { PREDICATES } from "@datum/protocol";
import { useHomeReading } from "./HomeData";
import { formatInt } from "@/lib/view";

/** Four figures. Three come from the latest read and show a dash when that part failed; one is fixed by this version. */
export function StatTiles() {
  const reading = useHomeReading();
  const claims = reading.s === "ready" ? reading.claims : null;
  const tiles = [
    { label: "Claims in the latest read", value: claims ? formatInt(claims.length) : "—" },
    { label: "Tokens those claims name", value: claims ? formatInt(new Set(claims.map((c) => c.memo.m)).size) : "—" },
    { label: "Latest slot read", value: reading.s === "ready" && reading.slot !== null ? formatInt(reading.slot) : "—" },
    { label: "Statement kinds this version reads", value: formatInt(PREDICATES.length) },
  ];
  return (
    <ul className="tiles" aria-label="Figures from the latest read">
      {tiles.map((t) => (
        <li key={t.label} className="tile">
          <span className="tile__value num">{t.value}</span>
          <span className="tile__label caps">{t.label}</span>
        </li>
      ))}
    </ul>
  );
}
