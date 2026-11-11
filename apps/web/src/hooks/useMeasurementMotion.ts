"use client";

import { useEffect, useRef } from "react";

export function useMeasurementMotion<T extends Element>(value: number, kind: "stamp" | "digits") {
  const element = useRef<T>(null);
  const previous = useRef(value);
  useEffect(() => {
    const changed = previous.current !== value;
    previous.current = value;
    const node = element.current;
    if (!changed || !node?.closest('[data-motion="full"]')) return;
    const duration = parseFloat(getComputedStyle(node).getPropertyValue("--dur-measure"));
    if (!duration) return;
    const animation = node.animate(kind === "stamp"
      ? [{ transform: "scale(1.025)" }, { transform: "scale(1)" }]
      : [{ transform: "translateY(6px)", opacity: .55 }, { transform: "translateY(0)", opacity: 1 }],
    { duration, easing: "ease-out" });
    const root = node.closest(".motion-root");
    const stop = new MutationObserver(() => {
      if (!node.closest('[data-motion="full"]')) animation.cancel();
    });
    if (root) stop.observe(root, { attributeFilter: ["data-motion"] });
    return () => {
      stop.disconnect();
      animation.cancel();
    };
  }, [value, kind]);
  return element;
}
