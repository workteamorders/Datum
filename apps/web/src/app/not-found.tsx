import Link from "next/link";
import { MintLookup } from "@/components/MintLookup";

export default function NotFound() {
  return (
    <div className="stack">
      <h1>Page not found</h1>
      <p>There is nothing at this address. Look up a token instead.</p>
      <MintLookup />
      <p><Link href="/">Back to the start</Link></p>
    </div>
  );
}
