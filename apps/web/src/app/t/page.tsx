import { Suspense } from "react";
import type { Metadata } from "next";
import { TokenPage } from "./TokenPage";

export const metadata: Metadata = { title: "Token" };

// useSearchParams needs a Suspense boundary in a static export.
export default function Page() {
  return (
    <Suspense fallback={<div className="page-reserve" role="status">Loading…</div>}>
      <TokenPage />
    </Suspense>
  );
}
