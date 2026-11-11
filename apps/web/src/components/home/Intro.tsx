"use client";

import { useEffect, useRef, useState } from "react";
import { DIAL_CX as CX, DIAL_CY as CY, DIAL_TICKS } from "@/lib/dial";
import { INTRO_END_MS, INTRO_SKIP_MS, INTRO_SPLIT_MS } from "@/lib/intro";
import { formatInt } from "@/lib/view";
import { readSlot, useHomeReading } from "./HomeData";

/** Milliseconds since the page first painted, which is when the overlay's own animations start. */
function sincePaint(): number {
  const paint = performance.getEntriesByName("first-contentful-paint")[0];
  return performance.now() - (paint?.startTime ?? 0);
}

/**
 * The first visit to the home page in a tab opens with a survey disc: a measuring line crosses, the dial settles and locks,
 * the slot it was read at is stamped, then the night overlay splits along a ruler edge and the disc moves into the hero disc.
 * The overlay is drawn by CSS and ends itself after INTRO_END_MS even if this component never runs; this component only
 * adds the real slot number, the skip, and the clean-up. The page underneath is already in the document the whole time.
 */
export function Intro() {
  const reading = useHomeReading();
  const [gone, setGone] = useState(false);
  const [own, setOwn] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const html = document.documentElement;
    if (html.dataset.intro !== "lock") {
      setGone(true);
      return;
    }
    let alive = true;
    let split = false;
    const timers: number[] = [];

    void readSlot().then((v) => {
      if (alive && v !== null) setOwn(v);
    });

    const aim = () => {
      const el = root.current;
      const disc = el?.querySelector<HTMLElement>(".intro__disc");
      const hero = document.querySelector<HTMLElement>(".hero-field");
      if (!el || !disc || !hero) return;
      const d = disc.getBoundingClientRect();
      const h = hero.getBoundingClientRect();
      const cx = h.left + h.width / 2;
      const cy = h.top + h.height / 2;
      if (d.width === 0 || cy < 0 || cy > window.innerHeight || cx < 0 || cx > window.innerWidth) return; // hero disc not in view: the disc just shrinks away
      el.style.setProperty("--to-x", `${(cx - (d.left + d.width / 2)).toFixed(1)}px`);
      el.style.setProperty("--to-y", `${(cy - (d.top + d.height / 2)).toFixed(1)}px`);
      el.style.setProperty("--to-s", (h.width / d.width).toFixed(3));
    };
    const beginSplit = () => {
      if (split) return;
      split = true;
      html.setAttribute("data-intro-split", "");
    };
    const finish = () => {
      alive = false;
      beginSplit();
      html.dataset.intro = "done";
      setGone(true);
    };

    timers.push(window.setTimeout(() => { aim(); beginSplit(); }, Math.max(0, INTRO_SPLIT_MS - 40 - sincePaint())));
    timers.push(window.setTimeout(finish, Math.max(0, INTRO_END_MS - sincePaint())));

    // Any press, key, wheel or scroll skips to the exit.
    const skip = () => {
      if (split || !root.current) return;
      root.current.dataset.skip = "";
      beginSplit();
      timers.forEach(clearTimeout);
      timers.length = 0;
      timers.push(window.setTimeout(finish, INTRO_SKIP_MS));
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, skip, { passive: true }));
    root.current?.setAttribute("data-live", ""); // the skip is armed; before this the overlay still ends by itself

    return () => {
      mounted.current = false;
      alive = false;
      timers.forEach(clearTimeout);
      events.forEach((e) => window.removeEventListener(e, skip));
      // Leaving the page for another one counts as the end. A development double run remounts at once, so it is checked a tick later.
      window.setTimeout(() => {
        if (!mounted.current && html.dataset.intro === "lock") {
          html.dataset.intro = "done";
          html.setAttribute("data-intro-split", "");
        }
      }, 0);
    };
  }, []);

  if (gone) return null;

  const slot = own ?? (reading.s === "ready" ? reading.slot : null);
  const text = slot !== null ? formatInt(slot) : "—";
  const long = DIAL_TICKS.filter((t) => t.long).map((t) => t.d).join("");
  const short = DIAL_TICKS.filter((t) => !t.long).map((t) => t.d).join("");
  return (
    <div className="intro on-night" ref={root} aria-hidden="true">
      <div className="intro__half intro__half--top"><span className="ruler-edge" /></div>
      <div className="intro__half intro__half--bottom"><span className="ruler-edge ruler-edge--top" /></div>
      <div className="intro__stage">
        <span className="intro__line" />
        <div className="intro__disc">
          <div className="intro__lock">
            <svg viewBox="0 0 600 600" focusable="false">
              <circle className="hf-ring" cx={CX} cy={CY} r="268" />
              <circle className="hf-ring hf-ring--dim" cx={CX} cy={CY} r="206" />
              <circle className="hf-ring hf-ring--dim" cx={CX} cy={CY} r="148" />
              <g className="intro__settle">
                <path className="hf-index" d={`M${CX} 30L${CX - 9} 10H${CX + 9}Z`} />
                <path className="hf-ticks" d={short} />
                <path className="hf-ticks hf-ticks--long" d={long} />
              </g>
              <circle className="hf-face" cx={CX} cy={CY} r="96" />
              <circle className="hf-inner" cx={CX} cy={CY} r="60" />
              <line className="hf-cross" x1={CX - 34} y1={CY} x2={CX + 34} y2={CY} />
              <line className="hf-cross" x1={CX} y1={CY - 34} x2={CX} y2={CY + 34} />
            </svg>
          </div>
        </div>
        <p className="intro__stamp mono">
          <span className="intro__stamp-label">Measured at slot</span> <span className="num" key={text}>{text}</span>
        </p>
      </div>
    </div>
  );
}
