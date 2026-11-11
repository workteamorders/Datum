"use client";

import { useEffect, useRef } from "react";
import { useHomeReading } from "./HomeData";
import { formatInt } from "@/lib/view";
import { DIAL_CX, DIAL_CY, DIAL_TICKS } from "@/lib/dial";

const CX = DIAL_CX;
const CY = DIAL_CY;
const TICKS = DIAL_TICKS;

/**
 * The hero picture: a survey disc is aimed at by a measuring line, locks, and is stamped with the slot it was read at.
 * Drawn in code so it needs no image request. The slot is the real latest slot or a dash; it is never invented.
 */
export function HeroField() {
  const reading = useHomeReading();
  const root = useRef<HTMLDivElement>(null);

  // The crosshair and the rings lean toward the pointer. One listener, one frame at a time, mouse only, and only while motion is on.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let frame = 0;
    let nx = 0;
    let ny = 0;
    const apply = () => {
      frame = 0;
      el.style.setProperty("--px", nx.toFixed(3));
      el.style.setProperty("--py", ny.toFixed(3));
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || el.closest('[data-motion="full"]') === null) return;
      const box = el.getBoundingClientRect();
      nx = Math.max(-1, Math.min(1, (e.clientX - (box.left + box.width / 2)) / (window.innerWidth / 2)));
      ny = Math.max(-1, Math.min(1, (e.clientY - (box.top + box.height / 2)) / (window.innerHeight / 2)));
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const slot = reading.s === "ready" && reading.slot !== null ? formatInt(reading.slot) : "—";
  return (
    <div className="hero-field" aria-hidden="true" ref={root}>
      <svg className="hero-field__svg" viewBox="0 0 600 600" focusable="false">
        <g className="hero-field__rings">
          <circle className="hf-ring" cx={CX} cy={CY} r="268" />
          <circle className="hf-ring hf-ring--dim" cx={CX} cy={CY} r="206" />
          <circle className="hf-ring hf-ring--dim" cx={CX} cy={CY} r="148" />
        </g>
        <g className="hero-field__dial">
          <g className="hero-field__spin">
            <path className="hf-index" d={`M${CX} 30L${CX - 9} 10H${CX + 9}Z`} />
            <path className="hf-ticks" d={TICKS.filter((t) => !t.long).map((t) => t.d).join("")} />
            <path className="hf-ticks hf-ticks--long" d={TICKS.filter((t) => t.long).map((t) => t.d).join("")} />
          </g>
        </g>
        <g className="hero-field__counter">
          <circle className="hf-ring hf-ring--dash" cx={CX} cy={CY} r="177" />
        </g>
        <g className="hero-field__lean">
        <g className="hero-field__disc">
          <circle className="hf-face" cx={CX} cy={CY} r="96" />
          <circle className="hf-inner" cx={CX} cy={CY} r="60" />
          <g className="hero-field__aim">
            <line className="hf-cross" x1={CX - 34} y1={CY} x2={CX + 34} y2={CY} />
            <line className="hf-cross" x1={CX} y1={CY - 34} x2={CX} y2={CY + 34} />
          </g>
        </g>
        </g>
        <path className="hero-field__line" pathLength="1" d={`M-20 ${CY}H${CX - 100}`} />
        <path className="hero-field__cap" d={`M${CX - 100} ${CY - 14}V${CY + 14}`} />
      </svg>
      <p className="hero-field__stamp mono">
        <span className="hero-field__stamp-label">Measured at slot</span> <span className="num hero-field__slot" key={slot}>{slot}</span>
      </p>
    </div>
  );
}
