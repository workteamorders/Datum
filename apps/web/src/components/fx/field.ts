import { FrameGovernor } from "@/lib/motion";

const RADIUS = 140;
const TRAIL = 20;
const TRAIL_MS = 1500;
const TAU = 2 * Math.PI;

export function mountField(canvas: HTMLCanvasElement, active: boolean, debug: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { update() {}, dispose() {} };
  const pen = ctx;
  const governor = new FrameGovernor();
  const trail = new Float64Array(TRAIL * 3);
  trail.fill(-Infinity);
  let trailIndex = 0;
  let width = 0, height = 0, scale = 1, raf = 0, last = 0, phase = 0;
  let x = -1, y = -1, stakeX = 0, stakeY = 0, stakeAt = -Infinity;
  let inView = true;
  let fine = false;
  let pigment = "";
  let shift = -1;
  let pointerLabel = "";

  function segment(ax: number, ay: number, bx: number, by: number) {
    pen.moveTo(ax, ay);
    pen.lineTo(bx, by);
  }

  function cross(cx: number, cy: number, arm: number) {
    segment(cx - arm, cy, cx + arm, cy);
    segment(cx, cy - arm, cx, cy + arm);
  }

  function disc(cx: number, cy: number, radius: number, angle: number) {
    pen.save();
    pen.translate(cx, cy);
    pen.rotate(angle);
    pen.beginPath();
    pen.arc(0, 0, radius, 0, TAU);
    pen.moveTo(radius * .84, 0);
    pen.arc(0, 0, radius * .84, 0, TAU);
    cross(0, 0, radius * .68);
    for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12;
      segment(Math.cos(a) * radius * .9, Math.sin(a) * radius * .9, Math.cos(a) * radius, Math.sin(a) * radius);
    }
    pen.stroke();
    pen.restore();
  }

  function grid(step: number, time: number, emphasis: boolean) {
    pen.beginPath();
    const pulse = 1 - Math.min(1, (time - stakeAt) / 540);
    for (let cy = 24; cy < height; cy += step) {
      for (let cx = 24; cx < width; cx += step) {
        const near = active && x >= 0 && (cx - x) ** 2 + (cy - y) ** 2 < RADIUS ** 2;
        const marked = active && pulse > 0 && (cx - stakeX) ** 2 + (cy - stakeY) ** 2 < 95 ** 2;
        if ((near || marked) !== emphasis) continue;
        const arm = marked ? 3 + 3 * pulse : near ? 4 : 2;
        if ((Math.round(cx / step) + Math.round(cy / step)) % 2 === 0 || emphasis) cross(cx, cy, arm);
        else segment(cx, cy, cx + 1, cy);
      }
    }
    pen.lineWidth = emphasis ? 1.65 : 1;
    pen.stroke();
  }

  function paint(time: number) {
    pen.clearRect(0, 0, width, height);
    pen.strokeStyle = pigment;
    pen.fillStyle = pigment;
    pen.globalAlpha = .15;
    const spacing = (fine ? 65 : 92) + governor.density * 32;
    grid(spacing, time, false);
    if (active && (x >= 0 || time - stakeAt < 540)) grid(spacing, time, true);
    pen.lineWidth = 1;
    pen.globalAlpha = .11;
    const breath = 1 + Math.sin(phase / 4000) * .02;
    disc(width * .82, height * .26, Math.min(width * .23, 162) * breath, phase / 24000);
    if (governor.density < 2) disc(width * .19, height * .72, Math.min(width * .27, 210) * breath, -phase / 31000);
    if (fine && governor.density === 0) disc(width * .78, height * .91, 68 * breath, phase / 19000);
    pen.globalAlpha = .17;
    pen.beginPath();
    const tickShift = (phase / 240) % 50;
    for (let i = 0, at = tickShift; at < Math.max(width, height); i++, at += 10) {
      const length = i % 5 === 0 ? 12 : 5;
      if (at < width) segment(at, 0, at, length);
      if (at < height) segment(0, at, length, at);
    }
    pen.stroke();

    if (active && x >= 0) {
      pen.globalAlpha = .19;
      pen.beginPath();
      pen.arc(x, y, RADIUS, 0, TAU);
      cross(x, y, 12);
      segment(0, y, Math.max(0, x - RADIUS), y);
      segment(x, 0, x, Math.max(0, y - RADIUS));
      for (let i = 20; i < x - RADIUS; i += 20) segment(i, y - 3, i, y + 3);
      for (let i = 20; i < y - RADIUS; i += 20) segment(x - 3, i, x + 3, i);
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12;
        segment(x + Math.cos(a) * 132, y + Math.sin(a) * 132, x + Math.cos(a) * RADIUS, y + Math.sin(a) * RADIUS);
      }
      pen.stroke();
      pen.globalAlpha = .88;
      pen.font = "12px Chivo Mono, monospace";
      pen.fillText(pointerLabel, Math.max(6, Math.min(x + 16, width - 110)), Math.max(15, Math.min(y + 24, height - 8)));
    }

    if (active) {
      for (let i = 0; i < trail.length; i += 3) {
        const age = time - (trail[i + 2] ?? -Infinity);
        if (age >= TRAIL_MS) continue;
        pen.globalAlpha = .24 * (1 - age / TRAIL_MS);
        pen.fillRect(trail[i] ?? 0, trail[i + 1] ?? 0, 3, 3);
      }
      if (time - stakeAt < TRAIL_MS) {
        pen.globalAlpha = .42 * (1 - (time - stakeAt) / TRAIL_MS);
        pen.lineWidth = 3;
        pen.beginPath();
        cross(stakeX, stakeY, 10);
        pen.stroke();
      }
    }
    if (debug && window.__fx) {
      window.__fx.frames++;
      window.__fx.x = x;
      window.__fx.y = y < 0 ? y : y + Math.min(0, shift);
    }
  }

  function frame(time: number) {
    raf = 0;
    if (last) {
      const dt = time - last;
      governor.sample(dt);
      phase += Math.min(50, dt);
    }
    last = time;
    const offset = -Math.min(40, scrollY * .055);
    if (offset !== shift) {
      if (y >= 0) y += Math.min(0, shift) - offset;
      canvas.style.transform = `translateY(${offset}px)`;
      shift = offset;
    }
    if (governor.stopped) {
      active = false;
      x = y = -1;
    }
    paint(time);
    if (active && inView) raf = requestAnimationFrame(frame);
  }

  function sync() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    governor.resetWindow();
    x = y = -1;
    trail.fill(-Infinity);
    stakeAt = -Infinity;
    if (active && inView) raf = requestAnimationFrame(frame);
    else if (inView) {
      canvas.style.transform = "";
      shift = -1;
      paint(performance.now());
    }
  }

  function size() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    fine = width > 768;
    scale = Math.min(devicePixelRatio || 1, fine ? 2 : 1.5);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    pen.setTransform(scale, 0, 0, scale, 0, 0);
    pigment = getComputedStyle(document.documentElement).getPropertyValue("--fx-field").trim();
    sync();
  }

  function move(e: PointerEvent) {
    if (!active || !inView || !e.isPrimary || (e.pointerType === "touch" && !e.buttons)) return;
    const nx = e.clientX, ny = e.clientY - Math.min(0, shift);
    if (x >= 0 && (nx - x) ** 2 + (ny - y) ** 2 > 100) {
      trail[trailIndex] = x;
      trail[trailIndex + 1] = y;
      trail[trailIndex + 2] = performance.now();
      trailIndex = (trailIndex + 3) % trail.length;
    }
    x = nx;
    y = ny;
    pointerLabel = `x ${Math.round(e.clientX)}  y ${Math.round(e.clientY)}`;
  }

  function down(e: PointerEvent) {
    if (!active || !inView || !e.isPrimary || e.button !== 0) return;
    move(e);
    const now = performance.now();
    if (now - stakeAt < 350) return;
    stakeX = e.clientX;
    stakeY = e.clientY - Math.min(0, shift);
    stakeAt = now;
  }

  function leave(e: PointerEvent) {
    if (e.type === "pointerup" && e.pointerType !== "touch") return;
    if (e.type === "pointerout" && e.relatedTarget) return;
    x = y = -1;
  }

  const observer = new IntersectionObserver(([entry]) => {
    if (!entry || entry.isIntersecting === inView) return;
    inView = entry.isIntersecting;
    sync();
  });
  observer.observe(canvas);
  window.addEventListener("resize", size);
  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("pointerdown", down, { passive: true });
  window.addEventListener("pointerup", leave, { passive: true });
  window.addEventListener("pointerout", leave, { passive: true });
  window.addEventListener("pointercancel", leave, { passive: true });
  size();
  return {
    update(next: boolean, trace: boolean) {
      debug = trace;
      const running = next && !governor.stopped;
      if (running === active) return;
      active = running;
      sync();
    },
    dispose() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", size);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", leave);
      window.removeEventListener("pointerout", leave);
      window.removeEventListener("pointercancel", leave);
    },
  };
}
