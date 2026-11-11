import type { ReactNode } from "react";
import { PageDisc } from "./PageDisc";

/** The head of every inner page: a night band with the title, a short lead, and a turning disc. It ends in a ruler edge. */
export function PageHero({ eyebrow, title, lede, sheet, variant = 0, children }: { eyebrow: string; title: ReactNode; lede?: ReactNode; sheet: string; variant?: number; children?: ReactNode }) {
  return (
    <div className="band on-night page-hero">
      <div className="band__in page-hero__grid">
        <div className="page-hero__copy stack">
          <p className="caps">{eyebrow}</p>
          <h1>{title}</h1>
          {lede ? <p className="lede">{lede}</p> : null}
          {children}
        </div>
        <PageDisc variant={variant} sheet={sheet} />
      </div>
      <span className="ruler-edge" aria-hidden="true" />
    </div>
  );
}
