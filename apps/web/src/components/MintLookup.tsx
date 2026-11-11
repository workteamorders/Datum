"use client";

import { PointerAccent } from "./fx/PointerAccent";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { isPubkey } from "@datum/protocol";

/** Paste a token address, go to its page. Checks the address shape before leaving. */
export function MintLookup({ initial = "", autoFocus = false }: { initial?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!isPubkey(v)) {
      setError("That does not look like a token address. It is 32 to 44 letters and numbers.");
      return;
    }
    setError(null);
    router.push(`/t?m=${encodeURIComponent(v)}`);
  }

  return (
    <form className="lookup pointer-area" onSubmit={submit} noValidate>
      <PointerAccent />
      <label className="label" htmlFor={id}>Token address</label>
      <div className="lookup__row">
        <input
          id={id}
          className="field mono"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoFocus={autoFocus}
          placeholder="Paste a mint address"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        <button type="submit" className="btn btn--primary">Look up</button>
      </div>
      {error && <p className="field-error" id={`${id}-err`} role="alert">{error}</p>}
    </form>
  );
}
