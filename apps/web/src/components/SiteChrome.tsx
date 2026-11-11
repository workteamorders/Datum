"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Disc } from "./Disc";
import { MotionControl } from "./fx/Motion";
import { Sheet } from "./Sheet";

const NAV = [
  { href: "/", label: "Look up" },
  { href: "/recent", label: "Recent" },
  { href: "/publish", label: "Publish" },
  { href: "/spec", label: "Spec" },
  { href: "/methodology", label: "Methodology" },
  { href: "/terms", label: "Risk and terms" },
] as const;

function NavLinks({ onNavigate, className = "nav" }: { onNavigate?: () => void; className?: string }) {
  const path = usePathname().replace(/\/$/, "") || "/";
  return (
    <ul className={className}>
      {NAV.map((n) => {
        const here = n.href === "/" ? path === "/" || path === "/t" : path === n.href;
        return (
          <li key={n.href}>
            <Link href={n.href} aria-current={here ? "page" : undefined} onClick={onNavigate}>{n.label}</Link>
          </li>
        );
      })}
    </ul>
  );
}

/** On a phone the links live in a bottom sheet: focus is held inside, Escape closes it. */
function MobileMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn menu-btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>Menu</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Menu">
        <nav aria-label="Main, in the menu">
          <NavLinks className="nav nav--sheet" onNavigate={() => setOpen(false)} />
        </nav>
        <MotionControl />
      </Sheet>
    </>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="brand" aria-label="Datum, home">
          <Disc size={32} />
          <span className="brand__word">Datum</span>
        </Link>
        <nav aria-label="Main" className="nav-inline">
          <NavLinks />
        </nav>
        <MotionControl className="motion-inline" />
        <MobileMenu />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <p>Datum reads public chain data in your browser. It never holds keys and never sends a transaction you did not sign.</p>
        <MotionControl />
        <p>Claims are statements published by wallets. A result says what the chain shows now, not what anyone intended.</p>
      </div>
    </footer>
  );
}
