"use client";
import { useEffect, useState } from "react";

/** The device clock, refreshed every `ms`. Used only for "12 s ago" labels. */
export function useNow(ms = 10_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
