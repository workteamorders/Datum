"use client";

import { useEffect, useRef } from "react";
import { FORMULAS } from "@/lib/formulas";

const R = 140; // the same radius as the circle the background draws around the pointer
const ROW = 64;
const COL = 330;
const FADE_MS = 240;
const FONT = '13px "Chivo Mono", ui-monospace, monospace';
const INTERACTIVE = "a, button, input, textarea, select, summary, label, [role='button'], [role='link'], [contenteditable], dialog";
const READING = "p, li, td, th, dd, dt, code, pre, blockquote, .caption, .lede";

const mix = (a: number, b: number) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
};

/**
 * A lens that follows the mouse. Only inside the circle, blockchain formulas appear; outside it nothing is drawn.
 * The formulas are fixed to the page, so moving the circle uncovers them and scrolling moves them with the content.
 * The lens fades out over links, buttons and fields, and is faint over paragraphs, so it never gets in the way of reading.
 */
export function FormulaLens() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !matchMedia("(pointer: fine)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pen = ctx;
    const size = R * 2 + 4;
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = canvas.height = Math.round(size * scale);
    canvas.style.width = canvas.style.height = `${size}px`;
    pen.setTransform(scale, 0, 0, scale, 0, 0);

    let px = -1000, py = -1000;
    let target = 0; // 0 hidden, 1 full
    let strength = 0;
    let raf = 0;
    let last = 0;
    let ink = "";
    let accent = "";
    const born = new Map<number, number>(); // when each formula last appeared inside the circle
    const widths = new Map<string, number>();
    pen.font = FONT;

    const width = (text: string) => {
      let w = widths.get(text);
      if (w === undefined) (w = pen.measureText(text).width, widths.set(text, w));
      return w;
    };

    function colours(x: number, y: number) {
      const under = document.elementFromPoint(x, y);
      const root = (under?.closest(".on-night") as HTMLElement | null) ?? document.documentElement;
      const css = getComputedStyle(root);
      ink = css.getPropertyValue("--color-ink").trim();
      accent = css.getPropertyValue("--color-accent").trim();
      if (!under) return 1;
      if (under.closest(INTERACTIVE)) return 0;
      if (under.closest(READING)) return 0.3;
      return 1;
    }

    function paint(now: number) {
      pen.clearRect(0, 0, size, size);
      if (strength <= 0.01) return;
      const ox = px - R - 2;
      const oy = py - R - 2;
      const seen = new Set<number>();
      pen.save();
      pen.font = FONT;
      pen.textBaseline = "alphabetic";
      const top = Math.floor((py + scrollY - R) / ROW);
      const bottom = Math.floor((py + scrollY + R) / ROW);
      for (let row = top; row <= bottom; row++) {
        const stagger = (row & 1) * (COL / 2);
        const first = Math.floor((px + scrollX - R - stagger - COL) / COL);
        const lastCol = Math.floor((px + scrollX + R - stagger) / COL);
        for (let col = first; col <= lastCol; col++) {
          const id = mix(row, col);
          const text = FORMULAS[id % FORMULAS.length] ?? "";
          const x = col * COL + stagger + 14 + (id >>> 8) % 70 - scrollX - ox;
          const y = row * ROW + 36 + (id >>> 16) % 14 - scrollY - oy;
          const w = width(text);
          // skip what is entirely outside the circle
          const cx = Math.max(x, Math.min(R + 2, x + w));
          if ((cx - R - 2) ** 2 + (y - 4 - R - 2) ** 2 > (R + 14) ** 2) continue;
          seen.add(id);
          if (!born.has(id)) born.set(id, now);
          const appear = Math.min(1, (now - (born.get(id) ?? now)) / FADE_MS);
          pen.globalAlpha = strength * appear;
          pen.fillStyle = id % 4 === 0 ? accent : ink;
          pen.fillText(text, x, y);
        }
      }
      for (const id of born.keys()) if (!seen.has(id)) born.delete(id);
      pen.restore();
      // soft edge: everything fades to nothing at the rim
      const g = pen.createRadialGradient(R + 2, R + 2, R * 0.7, R + 2, R + 2, R);
      g.addColorStop(0, "rgba(0,0,0,1)"); // tokens-ignore: mask alpha only, never drawn
      g.addColorStop(1, "rgba(0,0,0,0)"); // tokens-ignore: mask alpha only, never drawn
      pen.globalCompositeOperation = "destination-in";
      pen.fillStyle = g;
      pen.fillRect(0, 0, size, size);
      pen.globalCompositeOperation = "source-over";
    }

    function frame(now: number) {
      raf = 0;
      const dt = last ? Math.min(60, now - last) : 16;
      last = now;
      strength += (target - strength) * Math.min(1, dt / 90);
      if (Math.abs(target - strength) < 0.01) strength = target;
      canvas!.style.transform = `translate3d(${px - R - 2}px, ${py - R - 2}px, 0)`;
      canvas!.dataset.strength = strength.toFixed(2);
      paint(now);
      if (strength !== target || (target > 0 && born.size > 0 && [...born.values()].some((t) => now - t < FADE_MS))) raf = requestAnimationFrame(frame);
      else last = 0;
    }
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    function move(e: PointerEvent) {
      if (e.pointerType !== "mouse") return;
      px = e.clientX;
      py = e.clientY;
      target = colours(px, py);
      wake();
    }
    function leave(e: PointerEvent) {
      if (e.type === "pointerout" && e.relatedTarget) return;
      target = 0;
      wake();
    }
    function scroll() {
      if (strength > 0) wake();
    }
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerout", leave, { passive: true });
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerout", leave);
      window.removeEventListener("scroll", scroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={ref} className="formula-lens" aria-hidden="true" data-strength="0.00" />;
}
