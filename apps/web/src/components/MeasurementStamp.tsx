"use client";

import { useMeasurementMotion } from "@/hooks/useMeasurementMotion";
import { useId } from "react";
import { formatInt } from "@/lib/view";

type Props = {
  slot: number;
  /** For example "12 s ago", from the device clock. */
  ageLabel: string;
  /** Commitment level used for the reading. */
  commitment?: string;
  size?: number;
};

/** Round stamp. Always render the inline sentence next to it for narrow screens and screen readers. */
export function MeasurementStamp({ slot, ageLabel, commitment = "confirmed", size = 168 }: Props) {
  const stamp = useMeasurementMotion<SVGSVGElement>(slot, "stamp");
  const digits = useMeasurementMotion<SVGTextElement>(slot, "digits");
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const top = `st${uid}`;
  const bottom = `sb${uid}`;
  return (
    <svg
      ref={stamp}
      className="stamp"
      width={size}
      height={size}
      viewBox="0 0 168 168"
      role="img"
      aria-label={`Measured at slot ${formatInt(slot)}, ${ageLabel}, ${commitment}`}
    >
      <defs>
        <path id={top} d="M 84 84 m -66 0 a 66 66 0 1 1 132 0" />
        <path id={bottom} d="M 84 84 m -77 0 a 77 77 0 0 0 154 0" />
      </defs>
      <circle className="stamp__face" cx="84" cy="84" r="83" />
      <circle className="stamp__inner" cx="84" cy="84" r="58" />
      <text className="stamp__ring stamp__ring--top">
        <textPath href={`#${top}`} startOffset="50%" textAnchor="middle">MEASURED AT SLOT</textPath>
      </text>
      <text className="stamp__ring stamp__ring--bottom">
        <textPath href={`#${bottom}`} startOffset="50%" textAnchor="middle">{`DATUM/0  ${commitment.toUpperCase()}`}</textPath>
      </text>
      <line className="stamp__cross" x1="76" y1="62" x2="92" y2="62" />
      <line className="stamp__cross" x1="84" y1="54" x2="84" y2="70" />
      <text ref={digits} className="stamp__slot" x="84" y="92" textAnchor="middle">{formatInt(slot)}</text>
      <text className="stamp__age" x="84" y="110" textAnchor="middle">{ageLabel}</text>
    </svg>
  );
}

/** Small disc plus a plain sentence. The version used inside rows and on phones. */
export function MeasurementLine({ slot, ageLabel }: { slot: number; ageLabel: string }) {
  const digits = useMeasurementMotion<HTMLElement>(slot, "digits");
  return (
    <p className="measure-line">
      <span className="measure-line__disc" aria-hidden="true" />
      <span>
        Measured at slot <b ref={digits} className="mono num measure-line__slot">{formatInt(slot)}</b>, <span className="nowrap">{ageLabel}</span>
      </span>
    </p>
  );
}
