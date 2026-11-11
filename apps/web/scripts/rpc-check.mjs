#!/usr/bin/env node
/*
 * pnpm rpc:check <relay-url> [address]
 * Checks that the upstream behind the relay returns real history (not a silent []), and that the relay refuses what it should.
 * Read-only: it sends no transaction. Run it by the owner after setting RPC_UPSTREAM_URL.
 * Example: pnpm rpc:check https://datum.example/api/rpc
 */
const url = process.argv[2];
const address = process.argv[3] ?? "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"; // SPL Token program: always has history
if (!url) {
  console.error("Usage: pnpm rpc:check <relay-url> [address]");
  process.exit(2);
}
const origin = new URL(url).origin;
let n = 0;
async function call(method, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++n, method, params }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const sigs = await call("getSignaturesForAddress", [address, { limit: 5, commitment: "confirmed" }]);
const list = sigs.body?.result;
check("history is not empty for a busy address", Array.isArray(list) && list.length > 0, `status ${sigs.status}, ${Array.isArray(list) ? list.length : "no"} rows`);
if (Array.isArray(list) && list[0]) {
  const tx = await call("getTransaction", [list[0].signature, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
  check("getTransaction returns a transaction", Boolean(tx.body?.result?.transaction), `status ${tx.status}`);
}
const clamp = await call("getSignaturesForAddress", [address, { limit: 100000, commitment: "confirmed" }]);
check("limit is clamped to 50", Array.isArray(clamp.body?.result) && clamp.body.result.length <= 50);
const refused = await call("getTokenLargestAccounts", [address]);
check("getTokenLargestAccounts is refused", refused.status === 403);
const batchRes = await fetch(url, { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify([{ jsonrpc: "2.0", id: 1, method: "getSlot" }]) });
check("batches are refused", batchRes.status === 400);
const foreign = await fetch(url, { method: "POST", headers: { "content-type": "application/json", origin: "https://not-allowed.invalid" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getGenesisHash" }) });
check("foreign origin is refused", foreign.status === 403);

process.exit(results.every(Boolean) ? 0 : 1);
