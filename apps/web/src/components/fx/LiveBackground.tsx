"use client";

import { useEffect, useRef } from "react";

export function LiveBackground({ active, debug }: { active: boolean; debug: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const field = useRef<Awaited<ReturnType<typeof import("./field")["mountField"]>> | null>(null);
  const settings = useRef({ active, debug });
  useEffect(() => {
    settings.current = { active, debug };
    field.current?.update(active, debug);
  }, [active, debug]);

  useEffect(() => {
    let ended = false;
    let idle: number | undefined;
    let timer: number | undefined;
    let firstPaint = 0;
    let secondPaint = 0;
    let paintObserver: PerformanceObserver | undefined;
    let settle: number | undefined;
    const load = async () => {
      const module = await import("./field").catch(() => null);
      if (ended || !canvas.current || !module) return;
      field.current = module.mountField(canvas.current, settings.current.active, settings.current.debug);
    };
    const scheduleIdle = () => {
      firstPaint = requestAnimationFrame(() => {
        secondPaint = requestAnimationFrame(() => {
          if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(() => void load());
          else timer = window.setTimeout(() => void load(), 100);
        });
      });
    };
    const settleAfterPaint = () => {
      if (settle !== undefined) clearTimeout(settle);
      settle = window.setTimeout(() => {
        paintObserver?.disconnect();
        scheduleIdle();
      }, 300);
    };
    const schedule = () => {
      if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.includes("largest-contentful-paint")) {
        paintObserver = new PerformanceObserver(settleAfterPaint);
        paintObserver.observe({ type: "largest-contentful-paint", buffered: true });
      }
      settleAfterPaint();
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      ended = true;
      window.removeEventListener("load", schedule);
      paintObserver?.disconnect();
      if (settle !== undefined) clearTimeout(settle);
      cancelAnimationFrame(firstPaint);
      cancelAnimationFrame(secondPaint);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) clearTimeout(timer);
      field.current?.dispose();
      field.current = null;
    };
  }, []);

  return <canvas ref={canvas} className="bench-field" aria-hidden="true" />;
}
