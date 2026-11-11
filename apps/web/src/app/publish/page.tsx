import { Suspense } from "react";
import type { Metadata } from "next";
import { PublishPage } from "./PublishPage";

export const metadata: Metadata = { title: "Publish a claim" };

export default function Page() {
  return (
    <Suspense fallback={<div className="page-reserve" role="status">Loading…</div>}>
      <PublishPage />
    </Suspense>
  );
}
