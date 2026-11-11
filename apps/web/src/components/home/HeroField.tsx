"use client";

import { useHomeReading } from "./HomeData";
import { formatInt } from "@/lib/view";

const CX = 300;
const CY = 300;

/** Tick marks around the outer ring: a long tick every 30 degrees, a medium one every 10, a short one every 2. */
const TICKS = Array.from({ length: 180 }, (_, i) => {
  const deg = i * 2;
  const long = deg % 30 === 0;
  const mid = deg % 10 === 0;
  const r1 = 268;
  const r2 = long ? 244 : mid ? 253 : 260;
  const a = (deg - 90) * (Math.PI / 180);
  const f = (n: number) => n.toFixed(2);
  return { d: `M${f(CX + r1 * Math.cos(a))} ${f(CY + r1 * Math.sin(a))}L${f(CX + r2 * Math.cos(a))} ${f(CY + r2 * Math.sin(a))}`, long };
});

/**
 * The hero picture: a survey disc is aimed at by a measuring line, locks, and is stamped with the slot it was read at.
 * Drawn in code so it needs no image request. The slot is the real latest slot or a dash; it is never invented.
 */
export function HeroField() {
  const reading = useHomeReading();
  const slot = reading.s === "ready" && reading.slot !== null ? formatInt(reading.slot) : "—";
  return (
    <div className="hero-field" aria-hidden="true">
      <svg className="hero-field__svg" viewBox="0 0 600 600" focusable="false">
        <g className="hero-field__rings">
          <circle className="hf-ring" cx={CX} cy={CY} r="268" />
          <circle className="hf-ring hf-ring--dim" cx={CX} cy={CY} r="206" />
          <circle className="hf-ring hf-ring--dim" cx={CX} cy={CY} r="148" />
          <path className="hf-ticks" d={TICKS.filter((t) => !t.long).map((t) => t.d).join("")} />
          <path className="hf-ticks hf-ticks--long" d={TICKS.filter((t) => t.long).map((t) => t.d).join("")} />
        </g>
        <g className="hero-field__disc">
          <circle className="hf-face" cx={CX} cy={CY} r="96" />
          <circle className="hf-inner" cx={CX} cy={CY} r="60" />
          <g className="hero-field__aim">
            <line className="hf-cross" x1={CX - 34} y1={CY} x2={CX + 34} y2={CY} />
            <line className="hf-cross" x1={CX} y1={CY - 34} x2={CX} y2={CY + 34} />
          </g>
        </g>
        <path className="hero-field__line" pathLength="1" d={`M-20 ${CY}H${CX - 100}`} />
        <path className="hero-field__cap" d={`M${CX - 100} ${CY - 14}V${CY + 14}`} />
      </svg>
      <p className="hero-field__stamp mono">
        <span className="hero-field__stamp-label">Measured at slot</span> <span className="num">{slot}</span>
      </p>
    </div>
  );
}
