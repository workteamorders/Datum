"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Claim } from "@datum/protocol";
import { readFeedClaims } from "@/lib/claims";
import { rpc } from "@/lib/rpc";

/** What the home page shows from the chain. Nothing here is estimated: a value is either read or absent. */
export type HomeReading =
  | { s: "waiting" }
  | { s: "failed" }
  | { s: "ready"; slot: number | null; claims: Claim[] | null };

const Context = createContext<HomeReading>({ s: "waiting" });
export const useHomeReading = () => useContext(Context);

const SLOT_METHOD = "getLatestBlockhash";
/** How often the slot is read again while the page is open and visible. */
const SLOT_REFRESH_MS = 15_000;

export async function readSlot(): Promise<number | null> {
  try {
    const r = await rpc.call<{ context?: { slot?: number } }>(SLOT_METHOD, [{ commitment: "confirmed" }]);
    return typeof r?.context?.slot === "number" ? r.context.slot : null;
  } catch {
    return null;
  }
}

/**
 * Reads the latest slot and the newest claims once, after the page has settled,
 * so the first paint never waits for the network.
 */
export function HomeData({ children }: { children: ReactNode }) {
  const [reading, setReading] = useState<HomeReading>({ s: "waiting" });

  useEffect(() => {
    let alive = true;
    let idle: number | undefined;
    let timer: number | undefined;
    const run = async () => {
      const [slot, feedResult] = await Promise.all([readSlot(), readFeedClaims(rpc).then((v) => ({ ok: true as const, v }), () => ({ ok: false as const }))]);
      if (!alive) return;
      if (feedResult.ok) setReading({ s: "ready", slot, claims: feedResult.v.claims });
      else if (slot !== null) setReading({ s: "ready", slot, claims: null });
      else setReading({ s: "failed" });
    };
    // The slot moves about twice a second on mainnet; reading it again keeps the stamp honest. Only while the page is visible.
    const refresh = window.setInterval(async () => {
      if (document.hidden) return;
      const slot = await readSlot();
      if (!alive || slot === null) return;
      setReading((cur) => (cur.s === "ready" ? { ...cur, slot } : { s: "ready", slot, claims: null }));
    }, SLOT_REFRESH_MS);
    const start = () => {
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(() => void run(), { timeout: 2000 });
      else timer = window.setTimeout(() => void run(), 300);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      alive = false;
      window.clearInterval(refresh);
      window.removeEventListener("load", start);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);

  return <Context.Provider value={reading}>{children}</Context.Provider>;
}
