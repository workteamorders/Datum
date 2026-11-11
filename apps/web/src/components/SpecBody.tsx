"use client";

import { useEffect, useRef } from "react";

/** Renders HTML built from our own spec file at build time and adds a Copy button to every code block. Without script the blocks stay readable. */
export function SpecBody({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll("pre, table").forEach((region) => {
      region.setAttribute("tabindex", "0");
    });
    root.querySelectorAll("pre").forEach((pre) => {
      if (pre.parentElement?.classList.contains("codeblock")) return;
      const wrap = document.createElement("div");
      wrap.className = "codeblock";
      pre.replaceWith(wrap);
      wrap.append(pre);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn codeblock__copy";
      button.textContent = "Copy code";
      const note = document.createElement("span");
      note.className = "sr-only";
      note.setAttribute("role", "status");
      button.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(pre.textContent ?? "");
          button.textContent = "Copied";
          note.textContent = "Code copied.";
        } catch {
          button.textContent = "Select the code and copy it";
          note.textContent = "Copying was not allowed. Select the code and copy it.";
        }
        setTimeout(() => {
          button.textContent = "Copy code";
          note.textContent = "";
        }, 3000);
      });
      wrap.prepend(button, note);
    });
  }, []);
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}
