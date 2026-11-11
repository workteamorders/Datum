/** Survey disc with a crosshair: the Datum mark. Decorative; pair with text. */
export function Disc({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg className={`disc-svg ${className ?? ""}`} width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <circle className="disc-svg__face" cx="14" cy="14" r="13" />
      <circle className="disc-svg__inner" cx="14" cy="14" r="8.5" />
      <line className="disc-svg__cross" x1="9" y1="14" x2="19" y2="14" />
      <line className="disc-svg__cross" x1="14" y1="9" x2="14" y2="19" />
    </svg>
  );
}
