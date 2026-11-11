"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Claim } from "@datum/protocol";
import { readFeedClaims } from "@/lib/claims";
import { rpc } from "@/lib/rpc";

/** What the home page shows from the chain. Nothing here is estimated: a value is either read or absent. */
export type HomeReading =
  | { s: "waiting" }
  | { s: "failed" }
  | { s: "ready"; slot: number | null; claims: Claim[] };

const Context = createContext<HomeReading>({ s: "waiting" });
export const useHomeReading = () => useContext(Context);

const SLOT_METHOD = "getLatestBlockhash";

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
      const [slotResult, feedResult] = await Promise.allSettled([
        rpc.call<{ context?: { slot?: number } }>(SLOT_METHOD, [{ commitment: "confirmed" }]),
        readFeedClaims(rpc),
      ]);
      if (!alive) return;
      const slot = slotResult.status === "fulfilled" && typeof slotResult.value?.context?.slot === "number" ? slotResult.value.context.slot : null;
      if (feedResult.status === "fulfilled") setReading({ s: "ready", slot, claims: feedResult.value.claims });
      else if (slot !== null) setReading({ s: "ready", slot, claims: [] });
      else setReading({ s: "failed" });
    };
    const start = () => {
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(() => void run(), { timeout: 2000 });
      else timer = window.setTimeout(() => void run(), 300);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      alive = false;
      window.removeEventListener("load", start);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);

  return <Context.Provider value={reading}>{children}</Context.Provider>;
}
