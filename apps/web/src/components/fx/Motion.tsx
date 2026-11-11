"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { readStored, writeStored } from "@/lib/storage";
import { LiveBackground } from "./LiveBackground";
import type { Motion } from "@/lib/motion";

const KEY = "datum.motion";
const Context = createContext({ mode: "full" as Motion, forced: false, cycle() {} });
const labels = { full: "Full", reduced: "Reduced", off: "Off" };

export function MotionControl({ className = "" }: { className?: string }) {
  const { mode, forced, cycle } = useContext(Context);
  return <button type="button" className={`btn motion-control ${className}`} disabled={forced} onClick={cycle}>Motion: {labels[mode]}</button>;
}

export function MotionRoot({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<Motion | null>(null);
  const [system, setSystem] = useState(false);
  const [visible, setVisible] = useState(true);
  const [saveData, setSaveData] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const path = usePathname();
  const [ready, setReady] = useState(false);
  const [changedPath, setChangedPath] = useState(false);
  const initialPath = useRef(path);

  useEffect(() => {
    const stored = readStored(KEY);
    if (stored === "full" || stored === "reduced" || stored === "off") setChoice(stored);
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    const sync = () => {
      setSystem(media.matches);
      setVisible(!document.hidden);
      setSaveData(Boolean(connection?.saveData));
    };
    sync();
    media.addEventListener("change", sync);
    connection?.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    setReady(true);
    return () => {
      media.removeEventListener("change", sync);
      connection?.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  useEffect(() => {
    const sync = () => setQuery(new URLSearchParams(location.search).get("motion"));
    sync();
    window.addEventListener("popstate", sync);
    if (path !== initialPath.current) setChangedPath(true);
    return () => window.removeEventListener("popstate", sync);
  }, [path]);

  const forced = query === "off";
  const mode = forced ? "off" : choice ?? (system ? "reduced" : "full");
  const active = ready && visible && !system && !saveData && mode === "full";
  const debug = query === "debug" || forced;
  useEffect(() => {
    if (debug) window.__fx ??= { frames: 0, x: -1, y: -1 };
    else delete window.__fx;
  }, [debug]);

  function cycle() {
    const next = mode === "full" ? "reduced" : mode === "reduced" ? "off" : "full";
    setChoice(next);
    writeStored(KEY, next);
  }

  return (
    <Context.Provider value={{ mode, forced, cycle }}>
      <div className="motion-root" data-motion={active ? "full" : "still"}>
        {ready && mode !== "off" && <LiveBackground active={active} debug={debug} />}
        {changedPath && <div key={path} className="route-wipe" aria-hidden="true" />}
        {children}
      </div>
    </Context.Provider>
  );
}
