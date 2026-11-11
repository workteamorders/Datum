// "Since your last visit": what changed on a token page since this browser last showed it.
// Everything here is kept in this browser only. When storage is unavailable the section is simply not shown.
import { readStored, writeStored } from "./storage";
import type { ClaimGroup } from "./token-view";
import { STATUS_LABEL, type Status } from "./view";

export type VisitRecord = { at: number; rows: Record<string, Status>; statements: Record<string, string> };
export type Change = { id: string; text: string };

const key = (cluster: string, mint: string) => `datum.visit.v0.${cluster}.${mint}`;

/** What to remember about the claims that are shown as current. */
export function recordOf(groups: readonly ClaimGroup[], at: number): VisitRecord {
  const rows: Record<string, Status> = {};
  const statements: Record<string, string> = {};
  for (const g of groups) {
    for (const r of g.rows) {
      rows[r.id] = r.status;
      statements[r.id] = r.statement;
    }
  }
  return { at, rows, statements };
}

export function loadVisit(cluster: string, mint: string): VisitRecord | null {
  const raw = readStored(key(cluster, mint));
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const o = v as Record<string, unknown>;
    if (typeof o.at !== "number" || typeof o.rows !== "object" || o.rows === null || typeof o.statements !== "object" || o.statements === null) return null;
    return { at: o.at, rows: o.rows as Record<string, Status>, statements: o.statements as Record<string, string> };
  } catch {
    return null;
  }
}

export function saveVisit(cluster: string, mint: string, rec: VisitRecord): boolean {
  return writeStored(key(cluster, mint), JSON.stringify(rec));
}

/** New statements, and statements whose result changed. Results that did not change are not listed. */
export function changesSince(prev: VisitRecord, now: VisitRecord): Change[] {
  const out: Change[] = [];
  for (const [id, after] of Object.entries(now.rows)) {
    const before = prev.rows[id];
    const text = now.statements[id] ?? "A statement";
    if (before === undefined) out.push({ id, text: `New: ${text}. Result: ${STATUS_LABEL[after]}.` });
    else if (before !== after) out.push({ id, text: `${text}: was ${STATUS_LABEL[before]}, now ${STATUS_LABEL[after]}.` });
  }
  return out;
}
