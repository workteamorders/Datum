// The survey dial's tick marks, shared by the hero picture and the opening sequence so both draw the same disc.

export const DIAL_CX = 300;
export const DIAL_CY = 300;

/** Tick marks around the outer ring: a long tick every 30 degrees, a medium one every 10, a short one every 2. */
export const DIAL_TICKS = Array.from({ length: 180 }, (_, i) => {
  const deg = i * 2;
  const long = deg % 30 === 0;
  const mid = deg % 10 === 0;
  const r1 = 268;
  const r2 = long ? 244 : mid ? 253 : 260;
  const a = (deg - 90) * (Math.PI / 180);
  const f = (n: number) => n.toFixed(2);
  return { d: `M${f(DIAL_CX + r1 * Math.cos(a))} ${f(DIAL_CY + r1 * Math.sin(a))}L${f(DIAL_CX + r2 * Math.cos(a))} ${f(DIAL_CY + r2 * Math.sin(a))}`, long };
});
