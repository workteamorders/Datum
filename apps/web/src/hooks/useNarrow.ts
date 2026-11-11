"use client";
import { useEffect, useState } from "react";

/** True on a narrow screen. False until the browser has said otherwise, so the first paint matches the server. */
export function useNarrow(query = "(max-width: 40rem)"): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setNarrow(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return narrow;
}
