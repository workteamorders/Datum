"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * A bottom sheet built on the native modal dialog: focus moves in and returns to the trigger,
 * Escape closes it, the page behind it cannot be reached or scrolled.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet__bar">
        <h2 id={titleId} className="sheet__title">{title}</h2>
        <button type="button" className="btn" onClick={onClose}>Close</button>
      </div>
      <div className="sheet__body">{open ? children : null}</div>
    </dialog>
  );
}
