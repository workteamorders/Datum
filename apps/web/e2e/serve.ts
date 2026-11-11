// Serves the static export from ./out and a mock RPC at /api/rpc. For screenshots and end-to-end tests only.
import { createServer } from "node:http";
import { existsSync, createReadStream, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createGzip } from "node:zlib";
import { seededChain, type MockChain } from "./mock-chain";

const ROOT = join(process.cwd(), "out");
const PORT = Number(process.env.PORT ?? 4173);
const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".txt": "text/plain", ".json": "application/json", ".ico": "image/x-icon" };

let chain: MockChain;
let pending: Promise<MockChain>;
let blocked = process.env.MOCK_BLOCKED === "1";
let ready = (pending = seededChain()).then((c) => (chain = c));

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/api/rpc") {
    await ready;
    if (req.method === "GET") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ country: null, blocked: blocked })); return; }
    const body = await new Promise<string>((r) => { let s = ""; req.on("data", (d) => (s += d)); req.on("end", () => r(s)); });
    const rq = JSON.parse(body) as { id: number; method: string; params: unknown[] };
    // Test hooks: the page can ask the mock to change behaviour.
    try {
      const result = await chain.handle(rq.method, rq.params ?? []);
      res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ jsonrpc: "2.0", id: rq.id, result }));
    } catch (e) {
      const err = e as { http?: number; rpc?: number; message?: string };
      res.writeHead(err.http ?? 200, { "content-type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: rq.id, error: { code: err.rpc ?? -32002, message: err.message ?? "error" } }));
    }
    return;
  }
  if (url.pathname.startsWith("/__mock/")) {
    await ready;
    const [, , action, arg] = url.pathname.split("/");
    if (action === "simerror") chain.simError = arg && arg !== "none" ? arg : null;
    if (action === "hold") chain.holdNext = true;
    if (action === "blocked") blocked = arg === "1";
    if (action === "cluster") chain.cluster = (arg as MockChain["cluster"]) ?? "mainnet";
    if (action === "failhistory" && arg) chain.failHistoryFor.add(arg);
    if (action === "clear") { ready = (pending = seededChain()).then((c) => (chain = c)); await ready; blocked = false; res.writeHead(204); res.end(); return; }
    if (action === "clear-state") { chain.sent = []; chain.failHistoryFor.clear(); chain.simError = null; chain.holdNext = false; chain.cluster = "mainnet"; blocked = false; }
    if (action === "sent") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(chain.sent)); return; }
    res.writeHead(204); res.end(); return;
  }
  const p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let f = join(ROOT, p);
  if (existsSync(f) && statSync(f).isDirectory()) { const ix = join(f, "index.html"); f = existsSync(ix) ? ix : f.replace(/[/\\]$/, "") + ".html"; }
  else if (!existsSync(f) && existsSync(f + ".html")) f += ".html";
  if (!existsSync(f)) { const nf = join(ROOT, "404.html"); res.writeHead(404, { "content-type": TYPES[".html"] }); existsSync(nf) ? createReadStream(nf).pipe(res) : res.end("not found"); return; }
  // Cloudflare Pages compresses text responses, so the mock does too. Lighthouse numbers then match production.
  const type = TYPES[extname(f)] ?? "application/octet-stream";
  const zip = /^(text\/|application\/json|image\/svg)/.test(type) && /gzip/.test(String(req.headers["accept-encoding"] ?? ""));
  if (zip) {
    res.writeHead(200, { "content-type": type, "content-encoding": "gzip", vary: "accept-encoding" });
    createReadStream(f).pipe(createGzip()).pipe(res);
  } else {
    res.writeHead(200, { "content-type": type });
    createReadStream(f).pipe(res);
  }
});
server.listen(PORT, () => console.log(`mock server on http://localhost:${PORT}`));
