import type { Metadata, Viewport } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import "@/styles/fonts.css";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/components.css";

export const metadata: Metadata = {
  title: { default: "Datum", template: "%s · Datum" },
  description:
    "Look up a Solana token and see what is true on chain right now, next to the claims wallets have published about it.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#e2e4e1" }; // tokens-ignore: browser chrome colour cannot use a CSS variable

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* The fonts used above the fold start loading with the HTML. */}
        <link rel="preload" href="/fonts/chivo-latin-400-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/chivo-latin-800-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/chivo-latin-900-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <SiteHeader />
        <main id="main">
          <div className="wrap">{children}</div>
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
