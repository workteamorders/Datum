// Region status from GET /api/rpc. Pattern: Afterbell geo.ts. When the status is unknown, the site is view-only
// for sending (the cautious default): reading never depends on it.
import { defaultRpcUrl } from "./rpc";

export type GeoStatus = { state: "ok"; country: string | null; blocked: boolean } | { state: "unknown" };

export async function fetchGeoStatus(f: typeof fetch = fetch, url = defaultRpcUrl()): Promise<GeoStatus> {
  try {
    const res = await f(url, { method: "GET", signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return { state: "unknown" };
    const j = (await res.json()) as { country?: unknown; blocked?: unknown };
    if (typeof j.blocked !== "boolean") return { state: "unknown" };
    return { state: "ok", country: typeof j.country === "string" ? j.country : null, blocked: j.blocked };
  } catch {
    return { state: "unknown" };
  }
}

/** Publishing is offered only when the relay said the region is allowed. */
export const canPublish = (g: GeoStatus): boolean => g.state === "ok" && !g.blocked;
