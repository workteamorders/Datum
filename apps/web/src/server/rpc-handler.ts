import { z } from "zod";

/**
 * Relay RPC: the only server code in Datum. Read methods, simulation and send, from an allowlist.
 * It rejects every other method (getProgramAccounts, getTokenLargestAccounts, getTokenAccountsByOwner...).
 * It limits origin (CORS), body size and rate per IP, and blocks simulate/send for blocked countries.
 * The provider key lives only in the RPC_UPSTREAM_URL variable. Nothing is stored. Pattern: Afterbell's rpc-handler.
 */
export const ALLOWED_METHODS = [
  "getAccountInfo",
  "getMultipleAccounts",
  "getSignaturesForAddress",
  "getTransaction",
  "getLatestBlockhash",
  "getSignatureStatuses",
  "getGenesisHash",
  "simulateTransaction",
  "sendTransaction",
] as const;
export type AllowedMethod = (typeof ALLOWED_METHODS)[number];

/** Methods that prepare or send a transaction: refused for blocked countries. */
const TRADE_METHODS: ReadonlySet<string> = new Set(["simulateTransaction", "sendTransaction"]);

export const MAX_BODY_BYTES = 16 * 1024;
export const MAX_ADDRESSES = 10;
export const MAX_SIGNATURES_PER_PAGE = 50;
const ALLOWED_CONFIG_KEYS = new Set([
  "commitment",
  "encoding",
  "dataSlice",
  "minContextSlot",
  "sigVerify",
  "replaceRecentBlockhash",
  "skipPreflight",
  "preflightCommitment",
  "maxRetries",
  "maxSupportedTransactionVersion",
  "limit",
  "before",
  "until",
  "accounts",
]);

export interface RateLimitBinding {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

export interface RpcEnv {
  RPC_UPSTREAM_URL?: string;
  /** "1" allows the public devnet upstream for local development. Never set it in production. */
  ALLOW_DEFAULT_UPSTREAM?: string;
  ALLOWED_ORIGINS?: string;
  BLOCKED_COUNTRIES?: string;
  RATE_LIMIT_PER_MINUTE?: string;
  RATE_LIMITER?: RateLimitBinding;
}

/** Official devnet endpoint. Not publicnode: it answers [] for history without an error (docs/DECISIONS.md D-009). */
export const DEFAULT_DEV_UPSTREAM = "https://api.devnet.solana.com";

const requestSchema = z
  .object({
    jsonrpc: z.literal("2.0"),
    id: z.union([z.string().max(64), z.number(), z.null()]),
    method: z.string().max(64),
    params: z.array(z.unknown()).max(3).optional(),
  })
  .strict();

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra },
  });
}

function rpcError(id: unknown, code: number, message: string, status: number, extra: Record<string, string> = {}): Response {
  return json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, status, extra);
}

export function parseList(v: string | undefined): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function countryOf(request: Request): string | null {
  const raw = request.headers.get("cf-ipcountry");
  if (!raw) return null;
  const c = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

export function isBlockedCountry(country: string | null, env: RpcEnv): boolean {
  if (!country) return false;
  return parseList(env.BLOCKED_COUNTRIES).map((c) => c.toUpperCase()).includes(country);
}

/** Allowed when the origin host equals the request host, or the origin is listed in ALLOWED_ORIGINS. */
export function originAllowed(request: Request, env: RpcEnv): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  if (host === new URL(request.url).host) return true;
  return parseList(env.ALLOWED_ORIGINS).includes(origin);
}

function cors(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  return origin ? { "access-control-allow-origin": origin, vary: "origin" } : {};
}

/* Per-IP token bucket per isolate (best effort). The Rate Limiting binding is used when present. */
const buckets = new Map<string, { tokens: number; at: number }>();
export function resetBuckets(): void {
  buckets.clear();
}

async function rateLimited(request: Request, env: RpcEnv, now: number): Promise<boolean> {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (env.RATE_LIMITER) {
    try {
      return !(await env.RATE_LIMITER.limit({ key: ip })).success;
    } catch {
      /* fall back to the token bucket */
    }
  }
  const perMinute = Math.max(1, Number(env.RATE_LIMIT_PER_MINUTE) || 120);
  const b = buckets.get(ip) ?? { tokens: perMinute, at: now };
  b.tokens = Math.min(perMinute, b.tokens + ((now - b.at) / 60_000) * perMinute);
  b.at = now;
  if (b.tokens < 1) {
    buckets.set(ip, b);
    return true;
  }
  b.tokens -= 1;
  buckets.set(ip, b);
  if (buckets.size > 5000) for (const k of buckets.keys()) if ((buckets.get(k)?.at ?? 0) < now - 120_000) buckets.delete(k);
  return false;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Checks the shape of params for one method. May rewrite the config (it clamps `limit`).
 * Returns an error message, or the params to forward.
 */
export function validateParams(method: string, params: unknown[] | undefined): { error: string } | { params: unknown[] } {
  const p = params ?? [];
  const first = p[0];
  const rawConfig = p[1];
  let config: Record<string, unknown> | undefined;
  if (rawConfig !== undefined) {
    if (!isObj(rawConfig)) return { error: "Config must be an object." };
    for (const k of Object.keys(rawConfig)) if (!ALLOWED_CONFIG_KEYS.has(k)) return { error: `Config key "${k}" is not allowed.` };
    config = { ...rawConfig };
    if ("commitment" in config && config.commitment !== "confirmed" && config.commitment !== "finalized") {
      return { error: "Commitment must be confirmed or finalized." };
    }
    if ("preflightCommitment" in config && config.preflightCommitment !== "confirmed" && config.preflightCommitment !== "finalized") {
      return { error: "Commitment must be confirmed or finalized." };
    }
    if ("encoding" in config && config.encoding !== "base64" && config.encoding !== "json") return { error: "Encoding must be base64 or json." };
    if ("maxSupportedTransactionVersion" in config && config.maxSupportedTransactionVersion !== 0) return { error: "maxSupportedTransactionVersion must be 0." };
    if ("accounts" in config) return { error: "Config key \"accounts\" is not allowed." };
  }
  const str = (v: unknown, max: number) => typeof v === "string" && v.length > 0 && v.length <= max;
  switch (method) {
    case "getMultipleAccounts":
      if (!Array.isArray(first) || first.length === 0 || first.some((x) => !str(x, 100))) return { error: "First parameter must be a list of strings." };
      if (first.length > MAX_ADDRESSES) return { error: `At most ${MAX_ADDRESSES} items per call.` };
      return { params: config ? [first, config] : [first] };
    case "getSignatureStatuses":
      if (!Array.isArray(first) || first.length === 0 || first.some((x) => !str(x, 100))) return { error: "First parameter must be a list of strings." };
      if (first.length > MAX_ADDRESSES) return { error: `At most ${MAX_ADDRESSES} items per call.` };
      return { params: config ? [first, config] : [first] };
    case "getLatestBlockhash":
    case "getGenesisHash":
      if (p.length > 0 && method === "getGenesisHash") return { error: "This method takes no parameters." };
      return { params: p };
    case "simulateTransaction":
    case "sendTransaction":
      if (!str(first, 4096)) return { error: "First parameter must be a base64 transaction." };
      if (config && config.encoding !== undefined && config.encoding !== "base64") return { error: "Encoding must be base64." };
      return { params: config ? [first, config] : [first] };
    case "getSignaturesForAddress": {
      if (!str(first, 100)) return { error: "First parameter must be a string." };
      const c = config ?? {};
      const lim = c.limit === undefined ? MAX_SIGNATURES_PER_PAGE : c.limit;
      if (typeof lim !== "number" || !Number.isInteger(lim) || lim < 1) return { error: "Limit must be a positive whole number." };
      c.limit = Math.min(lim, MAX_SIGNATURES_PER_PAGE);
      for (const k of ["before", "until"] as const) if (c[k] !== undefined && !str(c[k], 100)) return { error: `${k} must be a string.` };
      return { params: [first, c] };
    }
    case "getTransaction":
      if (!str(first, 100)) return { error: "First parameter must be a string." };
      return { params: config ? [first, config] : [first] };
    default:
      if (!str(first, 100)) return { error: "First parameter must be a string." };
      return { params: config ? [first, config] : [first] };
  }
}

function resolveUpstream(env: RpcEnv): string | null {
  if (env.RPC_UPSTREAM_URL) return env.RPC_UPSTREAM_URL;
  return env.ALLOW_DEFAULT_UPSTREAM === "1" ? DEFAULT_DEV_UPSTREAM : null;
}

export interface HandleDeps {
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export async function handleRpc(request: Request, env: RpcEnv, deps: HandleDeps = {}): Promise<Response> {
  const now = deps.now?.() ?? Date.now();
  const doFetch = deps.fetchImpl ?? fetch;
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    if (!originAllowed(request, env)) return json({ error: "Origin not allowed." }, 403);
    return new Response(null, {
      status: 204,
      headers: { ...cors(request), "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "600" },
    });
  }

  /* GET: region status. Needs no Origin (read by the site itself) and never touches the upstream. */
  if (method === "GET") {
    const country = countryOf(request);
    return json({ country, blocked: isBlockedCountry(country, env) }, 200);
  }

  if (method !== "POST") return json({ error: "Method not allowed." }, 405, { allow: "GET, POST, OPTIONS" });

  if (!originAllowed(request, env)) return json({ error: "Origin not allowed." }, 403);
  const corsHeaders = cors(request);

  if (await rateLimited(request, env, now)) return rpcError(null, -32005, "Rate limit exceeded. Try again shortly.", 429, { ...corsHeaders, "retry-after": "10" });

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return rpcError(null, -32600, "Request too large.", 413, corsHeaders);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return rpcError(null, -32600, "Request too large.", 413, corsHeaders);

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(text);
  } catch {
    return rpcError(null, -32700, "Parse error.", 400, corsHeaders);
  }
  const parsed = requestSchema.safeParse(parsedBody);
  if (!parsed.success) return rpcError(null, -32600, "Invalid request. Batches are not supported.", 400, corsHeaders);
  const req = parsed.data;

  if (!(ALLOWED_METHODS as readonly string[]).includes(req.method)) {
    return rpcError(req.id, -32601, `Method "${req.method}" is not allowed on this relay.`, 403, corsHeaders);
  }
  const checked = validateParams(req.method, req.params);
  if ("error" in checked) return rpcError(req.id, -32602, checked.error, 400, corsHeaders);

  if (TRADE_METHODS.has(req.method) && isBlockedCountry(countryOf(request), env)) {
    return rpcError(req.id, -32003, "Sending transactions is not available in your region.", 403, corsHeaders);
  }

  const upstream = resolveUpstream(env);
  if (!upstream) return rpcError(req.id, -32002, "The RPC upstream is not configured.", 503, corsHeaders);

  let res: Response;
  try {
    res = await doFetch(upstream, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: req.id, method: req.method, params: checked.params }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return rpcError(req.id, -32004, "The RPC upstream did not answer.", 504, corsHeaders);
  }
  if (res.status === 429) return rpcError(req.id, -32005, "The RPC upstream is rate limiting. Try again shortly.", 429, { ...corsHeaders, "retry-after": "10" });
  if (!res.ok) return rpcError(req.id, -32004, "The RPC upstream returned an error.", 502, corsHeaders);

  const body = await res.text();
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...corsHeaders },
  });
}
