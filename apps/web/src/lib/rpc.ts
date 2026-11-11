// RPC client. Talks only to the Datum relay (/api/rpc). Never to a provider directly.
// Reads are cached briefly and identical in-flight calls are shared; at most MAX_INFLIGHT calls run at once.

export type RpcFailureKind = "rate_limit" | "blocked" | "unavailable" | "network" | "rpc" | "bad_response";

export class RpcFailure extends Error {
  constructor(
    public readonly kind: RpcFailureKind,
    message: string,
    public readonly code?: number,
    /** The upstream's JSON-RPC error `data` field, if any (for example simulation logs). */
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "RpcFailure";
  }
}

export type RpcOptions = {
  /** Relay URL. Defaults to NEXT_PUBLIC_RPC_URL, then /api/rpc. */
  url?: string;
  fetchImpl?: typeof fetch;
  /** Cache lifetime for read calls, in ms. */
  ttlMs?: number;
  maxInflight?: number;
  /** Retries after a rate-limit answer. */
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

const READ_METHODS = new Set(["getAccountInfo", "getMultipleAccounts", "getSignaturesForAddress", "getTransaction", "getGenesisHash", "getSignatureStatuses"]);

export const defaultRpcUrl = (): string => process.env.NEXT_PUBLIC_RPC_URL || "/api/rpc";

export class RpcClient {
  private url: string;
  private f: typeof fetch;
  private ttl: number;
  private max: number;
  private retries: number;
  private sleep: (ms: number) => Promise<void>;
  private now: () => number;
  private inflight = 0;
  private waiting: (() => void)[] = [];
  private cache = new Map<string, { at: number; value: unknown }>();
  private shared = new Map<string, Promise<unknown>>();
  private id = 0;

  constructor(o: RpcOptions = {}) {
    this.url = o.url ?? defaultRpcUrl();
    this.f = o.fetchImpl ?? ((...a) => fetch(...a));
    this.ttl = o.ttlMs ?? 5_000;
    this.max = o.maxInflight ?? 4;
    this.retries = o.retries ?? 2;
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = o.now ?? Date.now;
  }

  private async slot<T>(fn: () => Promise<T>): Promise<T> {
    if (this.inflight >= this.max) await new Promise<void>((r) => this.waiting.push(r));
    this.inflight++;
    try {
      return await fn();
    } finally {
      this.inflight--;
      this.waiting.shift()?.();
    }
  }

  private async once(method: string, params: unknown[]): Promise<unknown> {
    let res: Response;
    try {
      res = await this.f(this.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++this.id, method, params }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new RpcFailure("network", "The network did not answer.");
    }
    let body: { result?: unknown; error?: { code?: number; message?: string; data?: unknown } } | null = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (res.status === 429) throw new RpcFailure("rate_limit", "Too many requests. Try again shortly.", body?.error?.code);
    if (res.status === 403 && body?.error?.code === -32003) throw new RpcFailure("blocked", "Sending transactions is not available in your region.", -32003);
    if (res.status === 503 || res.status === 502 || res.status === 504) throw new RpcFailure("unavailable", body?.error?.message ?? "The RPC service is unavailable.", body?.error?.code);
    if (!body || typeof body !== "object") throw new RpcFailure("bad_response", "The RPC answer could not be read.");
    if (body.error) throw new RpcFailure("rpc", body.error.message ?? "RPC error.", body.error.code, body.error.data);
    if (!("result" in body)) throw new RpcFailure("bad_response", "The RPC answer had no result.");
    return body.result;
  }

  private async withRetry(method: string, params: unknown[]): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.slot(() => this.once(method, params));
      } catch (e) {
        const retryable = e instanceof RpcFailure && (e.kind === "rate_limit" || e.kind === "unavailable") && attempt < this.retries;
        if (!retryable) throw e;
        await this.sleep(500 * 2 ** attempt);
      }
    }
  }

  /** Sends one call. Read calls are cached for `ttlMs` and shared while in flight. */
  async call<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    if (!READ_METHODS.has(method)) return (await this.withRetry(method, params)) as T;
    const key = `${method}:${JSON.stringify(params)}`;
    const hit = this.cache.get(key);
    if (hit && this.now() - hit.at < this.ttl) return hit.value as T;
    const pending = this.shared.get(key);
    if (pending) return (await pending) as T;
    const p = this.withRetry(method, params)
      .then((v) => {
        this.cache.set(key, { at: this.now(), value: v });
        if (this.cache.size > 500) this.cache.delete(this.cache.keys().next().value as string);
        return v;
      })
      .finally(() => this.shared.delete(key));
    this.shared.set(key, p);
    return (await p) as T;
  }

  /** Forget cached answers (used by Refresh). */
  clear(): void {
    this.cache.clear();
  }
}

export const rpc = new RpcClient();
