import type { Metadata } from "next";
import { RecentPage } from "./RecentPage";

export const metadata: Metadata = { title: "Recent claims" };

export default function Page() {
  return (
    <>
      <link rel="preload" href="/fonts/chivo-mono-latin-400-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href="/fonts/chivo-mono-latin-600-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <RecentPage />
    </>
  );
}
