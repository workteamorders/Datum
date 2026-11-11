import type { Metadata, Viewport } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { MotionRoot } from "@/components/fx/Motion";
import "@/styles/fonts.css";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/components.css";
import "@/styles/editorial.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.DATUM_SITE_URL ?? "http://localhost:3000"),
  openGraph: { images: [{ url: "/art/datum-card.png", width: 1200, height: 630, alt: "Datum" }] },
  twitter: { card: "summary_large_image", images: ["/art/datum-card.png"] },
  icons: { icon: "/favicon.ico", apple: "/art/apple-touch-icon.png" },
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
        <link rel="preload" href="/fonts/big-shoulders-display-latin-900-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        <MotionRoot>
          <a className="skip" href="#main">Skip to content</a>
          <SiteHeader />
          <main id="main">
            <div className="wrap">{children}</div>
          </main>
          <SiteFooter />
        </MotionRoot>
      </body>
    </html>
  );
}
