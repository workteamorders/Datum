import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleRpc, resetBuckets, validateParams, ALLOWED_METHODS, MAX_BODY_BYTES, type RpcEnv } from "../src/server/rpc-handler";

const SITE = "https://datum.example";
const ENV: RpcEnv = { RPC_UPSTREAM_URL: "https://upstream.test/rpc", BLOCKED_COUNTRIES: "XX" };
const ADDR = "So11111111111111111111111111111111111111112";

function post(body: unknown, headers: Record<string, string> = {}, raw = false): Request {
  return new Request(`${SITE}/api/rpc`, {
    method: "POST",
    headers: { origin: SITE, "content-type": "application/json", ...headers },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}
const rpc = (method: string, params?: unknown[], id: number | string = 1) => ({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) });
const okFetch = () => vi.fn(async (_u: unknown, _i?: unknown) => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "ok" }), { status: 200 }));
type Fetcher = ReturnType<typeof okFetch>;
const sent = (f: Fetcher) => JSON.parse(String((f.mock.calls[0]?.[1] as RequestInit).body));

beforeEach(() => resetBuckets());

describe("allowlist", () => {
  it("lists exactly the permitted methods", () => {
    expect([...ALLOWED_METHODS].sort()).toEqual(
      ["getAccountInfo", "getGenesisHash", "getLatestBlockhash", "getMultipleAccounts", "getSignatureStatuses", "getSignaturesForAddress", "getTransaction", "sendTransaction", "simulateTransaction"].sort(),
    );
  });
  it.each(["getProgramAccounts", "getTokenLargestAccounts", "getBlockTime", "getTokenAccountsByOwner", "requestAirdrop", "getBlock", "getSlot", "__proto__"])("rejects %s", async (m) => {
    const f = okFetch();
    const res = await handleRpc(post(rpc(m, [ADDR])), ENV, { fetchImpl: f as unknown as typeof fetch });
    expect(res.status).toBe(403);
    expect(f).not.toHaveBeenCalled();
  });
  it("forwards an allowed method and returns the upstream body", async () => {
    const f = okFetch();
    const res = await handleRpc(post(rpc("getAccountInfo", [ADDR, { encoding: "base64", commitment: "confirmed" }])), ENV, { fetchImpl: f as unknown as typeof fetch });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ result: "ok" });
    expect(f.mock.calls[0]?.[0]).toBe("https://upstream.test/rpc");
    expect(sent(f)).toMatchObject({ method: "getAccountInfo" });
  });
});

describe("request shape", () => {
  it("rejects batches", async () => {
    const f = okFetch();
    const res = await handleRpc(post([rpc("getAccountInfo", [ADDR])]), ENV, { fetchImpl: f as unknown as typeof fetch });
    expect(res.status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
  it("rejects invalid JSON", async () => {
    const res = await handleRpc(post("{nope", {}, true), ENV, { fetchImpl: okFetch() as unknown as typeof fetch });
    expect(res.status).toBe(400);
  });
  it("rejects extra top-level keys and more than 3 params", async () => {
    const f = okFetch();
    expect((await handleRpc(post({ ...rpc("getAccountInfo", [ADDR]), extra: 1 }), ENV, { fetchImpl: f as unknown as typeof fetch })).status).toBe(400);
    expect((await handleRpc(post(rpc("getAccountInfo", [ADDR, {}, 1, 2])), ENV, { fetchImpl: f as unknown as typeof fetch })).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
  it("rejects a body over the cap", async () => {
    const big = JSON.stringify(rpc("getAccountInfo", ["a".repeat(MAX_BODY_BYTES)]));
    const res = await handleRpc(post(big, {}, true), ENV, { fetchImpl: okFetch() as unknown as typeof fetch });
    expect(res.status).toBe(413);
  });
  it("answers 405 for other verbs", async () => {
    const res = await handleRpc(new Request(`${SITE}/api/rpc`, { method: "PUT", headers: { origin: SITE } }), ENV);
    expect(res.status).toBe(405);
  });
});

describe("origin and CORS", () => {
  it("rejects a missing or foreign origin", async () => {
    const f = okFetch();
    const noOrigin = new Request(`${SITE}/api/rpc`, { method: "POST", body: JSON.stringify(rpc("getLatestBlockhash")) });
    expect((await handleRpc(noOrigin, ENV, { fetchImpl: f as unknown as typeof fetch })).status).toBe(403);
    expect((await handleRpc(post(rpc("getLatestBlockhash"), { origin: "https://evil.test" }), ENV, { fetchImpl: f as unknown as typeof fetch })).status).toBe(403);
    expect(f).not.toHaveBeenCalled();
  });
  it("accepts a listed origin and echoes it", async () => {
    const f = okFetch();
    const env = { ...ENV, ALLOWED_ORIGINS: "http://localhost:3000" };
    const res = await handleRpc(post(rpc("getLatestBlockhash"), { origin: "http://localhost:3000" }), env, { fetchImpl: f as unknown as typeof fetch });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
  });
  it("answers preflight only for allowed origins", async () => {
    const ok = await handleRpc(new Request(`${SITE}/api/rpc`, { method: "OPTIONS", headers: { origin: SITE } }), ENV);
    expect(ok.status).toBe(204);
    const bad = await handleRpc(new Request(`${SITE}/api/rpc`, { method: "OPTIONS", headers: { origin: "https://evil.test" } }), ENV);
    expect(bad.status).toBe(403);
  });
});

describe("rate limit", () => {
  it("returns 429 after the bucket is empty", async () => {
    const f = okFetch();
    const env = { ...ENV, RATE_LIMIT_PER_MINUTE: "3" };
    const deps = { fetchImpl: f as unknown as typeof fetch, now: () => 1_000_000 };
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await handleRpc(post(rpc("getLatestBlockhash"), { "cf-connecting-ip": "1.2.3.4" }), env, deps)).status);
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
  });
  it("refills over time and separates IPs", async () => {
    const f = okFetch();
    const env = { ...ENV, RATE_LIMIT_PER_MINUTE: "1" };
    let t = 0;
    const deps = { fetchImpl: f as unknown as typeof fetch, now: () => t };
    const a = { "cf-connecting-ip": "1.1.1.1" };
    expect((await handleRpc(post(rpc("getLatestBlockhash"), a), env, deps)).status).toBe(200);
    expect((await handleRpc(post(rpc("getLatestBlockhash"), a), env, deps)).status).toBe(429);
    expect((await handleRpc(post(rpc("getLatestBlockhash"), { "cf-connecting-ip": "2.2.2.2" }), env, deps)).status).toBe(200);
    t = 61_000;
    expect((await handleRpc(post(rpc("getLatestBlockhash"), a), env, deps)).status).toBe(200);
  });
  it("uses the binding when present", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const res = await handleRpc(post(rpc("getLatestBlockhash")), { ...ENV, RATE_LIMITER: { limit } }, { fetchImpl: okFetch() as unknown as typeof fetch });
    expect(res.status).toBe(429);
    expect(limit).toHaveBeenCalled();
  });
});

describe("geoblock", () => {
  const tx = "AQ==";
  it("blocks simulate and send for a blocked country but not reads", async () => {
    const f = okFetch();
    const deps = { fetchImpl: f as unknown as typeof fetch };
    const h = { "cf-ipcountry": "XX" };
    expect((await handleRpc(post(rpc("simulateTransaction", [tx, { encoding: "base64" }]), h), ENV, deps)).status).toBe(403);
    expect((await handleRpc(post(rpc("sendTransaction", [tx, { encoding: "base64" }]), h), ENV, deps)).status).toBe(403);
    expect(f).not.toHaveBeenCalled();
    expect((await handleRpc(post(rpc("getAccountInfo", [ADDR]), h), ENV, deps)).status).toBe(200);
  });
  it("lets other countries simulate", async () => {
    const f = okFetch();
    const res = await handleRpc(post(rpc("simulateTransaction", [tx, { encoding: "base64" }]), { "cf-ipcountry": "ID" }), ENV, { fetchImpl: f as unknown as typeof fetch });
    expect(res.status).toBe(200);
  });
  it("GET reports the status without Origin", async () => {
    const res = await handleRpc(new Request(`${SITE}/api/rpc`, { headers: { "cf-ipcountry": "xx" } }), ENV);
    expect(await res.json()).toEqual({ country: "XX", blocked: true });
    const none = await handleRpc(new Request(`${SITE}/api/rpc`), ENV);
    expect(await none.json()).toEqual({ country: null, blocked: false });
  });
});

describe("params", () => {
  it("clamps the signature limit to 50 and defaults it", () => {
    expect(validateParams("getSignaturesForAddress", [ADDR, { limit: 1000 }])).toEqual({ params: [ADDR, { limit: 50 }] });
    expect(validateParams("getSignaturesForAddress", [ADDR])).toEqual({ params: [ADDR, { limit: 50 }] });
    expect(validateParams("getSignaturesForAddress", [ADDR, { limit: 10, before: "abc" }])).toEqual({ params: [ADDR, { limit: 10, before: "abc" }] });
  });
  it.each([0, -1, 1.5, "10", null])("rejects limit %s", (l) => {
    expect(validateParams("getSignaturesForAddress", [ADDR, { limit: l }])).toHaveProperty("error");
  });
  it("rejects unknown config keys and processed commitment", () => {
    expect(validateParams("getAccountInfo", [ADDR, { foo: 1 }])).toHaveProperty("error");
    expect(validateParams("getAccountInfo", [ADDR, { commitment: "processed" }])).toHaveProperty("error");
    expect(validateParams("getAccountInfo", [ADDR, { commitment: "confirmed", encoding: "jsonParsed" }])).toHaveProperty("error");
    expect(validateParams("simulateTransaction", ["AQ==", { accounts: { addresses: [ADDR] } }])).toHaveProperty("error");
  });
  it("caps list sizes", () => {
    expect(validateParams("getMultipleAccounts", [Array(11).fill(ADDR)])).toHaveProperty("error");
    expect(validateParams("getMultipleAccounts", [Array(10).fill(ADDR)])).toHaveProperty("params");
    expect(validateParams("getMultipleAccounts", [[]])).toHaveProperty("error");
    expect(validateParams("getMultipleAccounts", [[1]])).toHaveProperty("error");
  });
  it("requires version 0 for maxSupportedTransactionVersion", () => {
    expect(validateParams("getTransaction", ["sig", { maxSupportedTransactionVersion: 0, encoding: "json" }])).toHaveProperty("params");
    expect(validateParams("getTransaction", ["sig", { maxSupportedTransactionVersion: 1 }])).toHaveProperty("error");
  });
  it("only forwards the validated params upstream", async () => {
    const f = okFetch();
    await handleRpc(post(rpc("getSignaturesForAddress", [ADDR, { limit: 9999, commitment: "confirmed" }])), ENV, { fetchImpl: f as unknown as typeof fetch });
    expect(sent(f).params).toEqual([ADDR, { limit: 50, commitment: "confirmed" }]);
  });
});

describe("upstream", () => {
  it("503 when not configured and the dev default is not enabled", async () => {
    const res = await handleRpc(post(rpc("getLatestBlockhash")), {}, { fetchImpl: okFetch() as unknown as typeof fetch });
    expect(res.status).toBe(503);
  });
  it("uses devnet only with ALLOW_DEFAULT_UPSTREAM=1", async () => {
    const f = okFetch();
    await handleRpc(post(rpc("getLatestBlockhash")), { ALLOW_DEFAULT_UPSTREAM: "1" }, { fetchImpl: f as unknown as typeof fetch });
    expect(f.mock.calls[0]?.[0]).toBe("https://api.devnet.solana.com");
  });
  it("maps 429, 5xx and network failure", async () => {
    const mk = (r: () => Promise<Response>) => handleRpc(post(rpc("getLatestBlockhash")), ENV, { fetchImpl: vi.fn(r) as unknown as typeof fetch });
    expect((await mk(async () => new Response("x", { status: 429 }))).status).toBe(429);
    expect((await mk(async () => new Response("x", { status: 500 }))).status).toBe(502);
    expect((await mk(async () => { throw new Error("boom"); })).status).toBe(504);
  });
  it("never leaks the upstream URL in errors", async () => {
    const res = await handleRpc(post(rpc("getLatestBlockhash")), { RPC_UPSTREAM_URL: "https://secret-key.test/abc123" }, { fetchImpl: vi.fn(async () => { throw new Error("secret-key.test/abc123"); }) as unknown as typeof fetch });
    expect(await res.text()).not.toContain("abc123");
  });
});
