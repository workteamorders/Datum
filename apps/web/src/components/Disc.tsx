"use client";

import { useRef } from "react";

/** Survey disc with a crosshair: the Datum mark. Decorative; pair with text. */
export function Disc({ size = 28, className }: { size?: number; className?: string }) {
  const cross = useRef<SVGGElement>(null);
  return (
    <svg className={`disc-svg ${className ?? ""}`} width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false"
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || !cross.current) return;
        const box = e.currentTarget.getBoundingClientRect();
        cross.current.style.setProperty("--aim-x", `${(e.clientX - box.left - box.width / 2) / box.width * 7}px`);
        cross.current.style.setProperty("--aim-y", `${(e.clientY - box.top - box.height / 2) / box.height * 7}px`);
        cross.current.dataset.aiming = "true";
      }}
      onPointerLeave={() => { if (cross.current) delete cross.current.dataset.aiming; }}
    >
      <circle className="disc-svg__face" cx="14" cy="14" r="13" />
      <circle className="disc-svg__inner" cx="14" cy="14" r="8.5" />
      <g ref={cross} className="disc-svg__aim">
      <line className="disc-svg__cross" x1="9" y1="14" x2="19" y2="14" />
      <line className="disc-svg__cross" x1="14" y1="9" x2="14" y2="19" />
      </g>
    </svg>
  );
}
