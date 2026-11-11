import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Marked } from "marked";
import type { Metadata } from "next";
import { SpecBody } from "@/components/SpecBody";

export const metadata: Metadata = { title: "Specification" };

// The page is rendered at build time from docs/SPEC.md, so the site and the spec cannot drift apart.
const md = new Marked({
  gfm: true,
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const id = tokens.map((t) => ("text" in t ? String(t.text) : "")).join("").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
    html() {
      return ""; // the spec has no raw HTML; never pass any through
    },
  },
});

export default function SpecPage() {
  const source = readFileSync(join(process.cwd(), "..", "..", "docs", "SPEC.md"), "utf8");
  const html = md.parse(source) as string;
  return (
    <article className="prose">
      <p className="caps">Specification</p>
      <SpecBody html={html} />
    </article>
  );
}
