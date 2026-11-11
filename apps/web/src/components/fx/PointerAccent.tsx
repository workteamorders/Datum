"use client";

import { useEffect, useRef } from "react";

export function PointerAccent() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const ring = ref.current;
    const parent = ring?.parentElement;
    if (!ring || !parent) return;
    function move(e: PointerEvent) {
      if (e.pointerType !== "mouse" || !ring || !parent) return;
      const bounds = parent.getBoundingClientRect();
      ring.style.transform = `translate(${e.clientX - bounds.left - 10}px, ${e.clientY - bounds.top - 10}px)`;
      ring.dataset.pointing = "true";
    }
    function leave() {
      if (ring) delete ring.dataset.pointing;
    }
    parent.addEventListener("pointermove", move, { passive: true });
    parent.addEventListener("pointerleave", leave);
    return () => {
      parent.removeEventListener("pointermove", move);
      parent.removeEventListener("pointerleave", leave);
    };
  }, []);
  return <span ref={ref} className="pointer-accent" aria-hidden="true" />;
}
