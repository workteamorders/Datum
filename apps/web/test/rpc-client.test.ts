import { describe, expect, it, vi } from "vitest";
import { RpcClient, RpcFailure } from "../src/lib/rpc";
import { fakeRelay } from "./helpers";

const mk = (handler: Parameters<typeof fakeRelay>[0], o: ConstructorParameters<typeof RpcClient>[0] = {}) => {
  const relay = fakeRelay(handler);
  return { relay, rpc: new RpcClient({ url: "/api/rpc", fetchImpl: relay.f, sleep: async () => {}, ...o }) };
};
const err = (status: number, code: number, message = "x") => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code, message } }), { status });

describe("RpcClient", () => {
  it("returns results and caches reads within the lifetime", async () => {
    let t = 0;
    const { relay, rpc } = mk(() => ({ v: 1 }), { now: () => t, ttlMs: 1000 });
    await rpc.call("getAccountInfo", ["a"]);
    await rpc.call("getAccountInfo", ["a"]);
    expect(relay.calls).toHaveLength(1);
    t = 2000;
    await rpc.call("getAccountInfo", ["a"]);
    expect(relay.calls).toHaveLength(2);
  });
  it("shares identical calls that are in flight", async () => {
    const { relay, rpc } = mk(async () => { await new Promise((r) => setTimeout(r, 5)); return 1; });
    await Promise.all([rpc.call("getAccountInfo", ["a"]), rpc.call("getAccountInfo", ["a"]), rpc.call("getAccountInfo", ["a"])]);
    expect(relay.calls).toHaveLength(1);
  });
  it("never caches or shares sends", async () => {
    const { relay, rpc } = mk(() => "sig");
    await rpc.call("sendTransaction", ["AQ=="]);
    await rpc.call("sendTransaction", ["AQ=="]);
    expect(relay.calls).toHaveLength(2);
  });
  it("limits concurrency", async () => {
    let now = 0, peak = 0;
    const { rpc } = mk(async () => { now++; peak = Math.max(peak, now); await new Promise((r) => setTimeout(r, 5)); now--; return 1; }, { maxInflight: 2 });
    await Promise.all(Array.from({ length: 8 }, (_, i) => rpc.call("getAccountInfo", [`a${i}`])));
    expect(peak).toBe(2);
  });
  it("retries a rate-limit answer, then succeeds", async () => {
    let n = 0;
    const { relay, rpc } = mk(() => { if (n++ < 2) throw err(429, -32005); return "ok"; });
    expect(await rpc.call("getGenesisHash")).toBe("ok");
    expect(relay.calls).toHaveLength(3);
  });
  it("gives up after the retries and reports rate_limit", async () => {
    const { rpc } = mk(() => { throw err(429, -32005); });
    await expect(rpc.call("getGenesisHash")).rejects.toMatchObject({ kind: "rate_limit" });
  });
  it("maps blocked, unavailable, rpc errors and bad bodies", async () => {
    const run = (h: Parameters<typeof fakeRelay>[0]) => mk(h, { retries: 0 }).rpc.call("sendTransaction", ["AQ=="]).catch((e: RpcFailure) => e);
    expect(await run(() => { throw err(403, -32003); })).toMatchObject({ kind: "blocked" });
    expect(await run(() => { throw err(503, -32002); })).toMatchObject({ kind: "unavailable" });
    expect(await run(() => { throw err(200, -32002, "Simulation failed"); })).toMatchObject({ kind: "rpc", message: "Simulation failed" });
    expect(await run(() => { throw new Response("<html>", { status: 200 }); })).toMatchObject({ kind: "bad_response" });
  });
  it("maps a network failure", async () => {
    const rpc = new RpcClient({ url: "/x", fetchImpl: (async () => { throw new TypeError("fail"); }) as unknown as typeof fetch, retries: 0 });
    await expect(rpc.call("getGenesisHash")).rejects.toMatchObject({ kind: "network" });
  });
  it("does not cache failures", async () => {
    let n = 0;
    const { rpc } = mk(() => { if (n++ === 0) throw err(200, -32000, "boom"); return "fine"; }, { retries: 0 });
    await expect(rpc.call("getAccountInfo", ["a"])).rejects.toBeInstanceOf(RpcFailure);
    expect(await rpc.call("getAccountInfo", ["a"])).toBe("fine");
  });
  it("posts to the relay URL as JSON-RPC 2.0", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: 1 })));
    await new RpcClient({ url: "/api/rpc", fetchImpl: f as unknown as typeof fetch }).call("getGenesisHash");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/rpc");
    expect(JSON.parse(String(init.body))).toMatchObject({ jsonrpc: "2.0", method: "getGenesisHash", params: [] });
  });
});
