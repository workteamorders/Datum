// Thin wrappers over @datum/protocol for the UI. The rules live in the protocol package.
import { MEMO_MAX_BYTES, buildMemo as build, byteLength, validateLabel as validate } from "@datum/protocol";

export { MEMO_MAX_BYTES, byteLength };

export type Pick = { k: string; v?: string };

/** Canonical memo text, or "" when the picks are not valid yet. */
export function buildMemo(mint: string, picks: readonly Pick[], label: string): string {
  try {
    return build(mint, picks, label).text;
  } catch {
    return "";
  }
}

/** Returns an error, or null when the label is allowed. An empty label is allowed (it is optional). */
export function validateLabel(label: string): string | null {
  return label === "" ? null : validate(label);
}
