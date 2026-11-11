const C = 150;

/** Tick marks: a long tick every 30 degrees, a medium one every 10, a short one every 3. */
const TICKS = Array.from({ length: 120 }, (_, i) => {
  const deg = i * 3;
  const long = deg % 30 === 0;
  const mid = deg % 15 === 0;
  const r1 = 136;
  const r2 = long ? 118 : mid ? 125 : 130;
  const a = (deg - 90) * (Math.PI / 180);
  const f = (n: number) => n.toFixed(2);
  return { long, d: `M${f(C + r1 * Math.cos(a))} ${f(C + r1 * Math.sin(a))}L${f(C + r2 * Math.cos(a))} ${f(C + r2 * Math.sin(a))}` };
});
const SHORT = TICKS.filter((t) => !t.long).map((t) => t.d).join("");
const LONG = TICKS.filter((t) => t.long).map((t) => t.d).join("");

/** The centre of the disc differs by page, so each page has its own mark. Shapes, not colours, tell them apart. */
function Centre({ variant }: { variant: number }) {
  switch (variant % 5) {
    case 1:
      return (<><circle className="pd-inner" cx={C} cy={C} r="28" /><circle className="pd-inner" cx={C} cy={C} r="14" /></>);
    case 2:
      return (<><line className="pd-cross" x1={C} y1={C - 30} x2={C} y2={C + 22} /><line className="pd-cross" x1={C - 12} y1={C - 18} x2={C + 12} y2={C - 18} /><circle className="pd-dot" cx={C} cy={C + 22} r="4" /></>);
    case 3:
      return (<><circle className="pd-inner" cx={C} cy={C} r="30" /><path className="pd-solid" d={`M${C} ${C - 22}L${C - 12} ${C + 12}H${C + 12}Z`} /></>);
    case 4:
      return (<circle className="pd-inner pd-inner--split" cx={C} cy={C} r="26" />);
    default:
      return (<><circle className="pd-inner" cx={C} cy={C} r="28" /><line className="pd-cross" x1={C - 16} y1={C} x2={C + 16} y2={C} /><line className="pd-cross" x1={C} y1={C - 16} x2={C} y2={C + 16} /></>);
  }
}

/** The mark that sits beside the title of a page. Decorative. The dial turns while motion is on. */
export function PageDisc({ variant = 0, sheet }: { variant?: number; sheet: string }) {
  return (
    <div className="page-disc" aria-hidden="true">
      <svg viewBox="0 0 300 300" focusable="false" className="page-disc__svg">
        <circle className="pd-ring" cx={C} cy={C} r="140" />
        <g className="page-disc__spin">
          <path className="pd-ticks" d={SHORT} />
          <path className="pd-ticks pd-ticks--long" d={LONG} />
          <path className="pd-index" d={`M${C} 16L${C - 6} 2H${C + 6}Z`} />
        </g>
        <g className="page-disc__counter"><circle className="pd-ring pd-ring--dash" cx={C} cy={C} r="96" /></g>
        <circle className="pd-ring pd-ring--dim" cx={C} cy={C} r="66" />
        <circle className="pd-face" cx={C} cy={C} r="50" />
        <Centre variant={variant} />
      </svg>
      <p className="page-disc__sheet mono">Sheet {sheet}</p>
    </div>
  );
}
