"use client";

import { useEffect, useState } from "react";

type Item = { id: string; text: string };

/** "On this page": built from the h2 headings already in the article, so it can never list a section that is not there. */
export function TocRail() {
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState("");

  useEffect(() => {
    const heads = Array.from(document.querySelectorAll<HTMLElement>(".page-body .prose h2"));
    heads.forEach((h) => {
      if (!h.id) h.id = (h.textContent ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    });
    setItems(heads.map((h) => ({ id: h.id, text: h.textContent ?? "" })));
    const seen = new Set<string>();
    const watch = new IntersectionObserver(
      (entries) => {
        for (const e of entries) (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id));
        const first = heads.find((h) => seen.has(h.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-10% 0px -70% 0px" },
    );
    heads.forEach((h) => watch.observe(h));
    return () => watch.disconnect();
  }, []);

  if (items.length < 2) return null;
  return (
    <nav className="toc" aria-label="On this page">
      <p className="caps">On this page</p>
      <ol>
        {items.map((it, i) => {
          // A document that numbers its own sections ("3. Addresses") keeps its numbers.
          const own = /^(\d+)\.\s+(.*)$/.exec(it.text);
          return (
            <li key={it.id}>
              <a href={`#${it.id}`} aria-current={active === it.id ? "location" : undefined}>
                <span className="mono num">{own ? own[1]!.padStart(2, "0") : String(i + 1).padStart(2, "0")}</span>
                <span>{own ? own[2] : it.text}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
