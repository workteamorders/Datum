import type { Metadata } from "next";
import { RecentPage } from "./RecentPage";

export const metadata: Metadata = { title: "Recent claims" };

export default function Page() {
  return <RecentPage />;
}
