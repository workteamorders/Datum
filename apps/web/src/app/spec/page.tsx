import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Marked } from "marked";
import type { Metadata } from "next";
import { SpecBody } from "@/components/SpecBody";
import { PageHero } from "@/components/PageHero";
import { TocRail } from "@/components/TocRail";

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
  const full = md.parse(source) as string;
  // The document's own first heading becomes the page title; the rest is the body.
  const first = /<h1[^>]*>([\s\S]*?)<\/h1>\n?/.exec(full);
  const html = first ? full.replace(first[0], "") : full;
  const title = first ? <span dangerouslySetInnerHTML={{ __html: first[1] ?? "" }} /> : "Specification";
  return (
    <>
      <PageHero eyebrow="Specification" title={title} lede="The exact rules Datum follows. The site, the tests and any other reader follow this document." sheet="02" variant={4} />
      <div className="band__in page-body page-body--toc">
        <TocRail />
        <article className="prose prose--own-numbers">
          <SpecBody html={html} />
        </article>
      </div>
    </>
  );
}
