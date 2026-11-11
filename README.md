# Datum

Look up a Solana token mint and see what is true on chain right now, next to the claims wallets have published about it (`datum/0`, see `docs/SPEC.md`).

Static Next.js export plus one Cloudflare Pages Function (`/api/rpc`, added in the build stage). Non-custodial: no keys, no backend state.

## Commands

```
pnpm install
pnpm dev            # http://localhost:3000, design review at /styleguide
pnpm build          # runs check:tokens and copy:check, then next build -> apps/web/out
pnpm typecheck
pnpm test           # protocol and web unit tests
pnpm --filter @datum/web exec playwright test   # end-to-end against a mock RPC (needs `pnpm build` first)
pnpm --filter @datum/web rpc:check              # checks your keyed RPC provider against the relay's allowlist
```

Example environment values live in `.env.example`. Never commit `.env*` or `.dev.vars`.

## Layout

- `apps/web`: the site. Tokens in `src/styles/tokens.css`, components in `src/components`, review page at `src/app/styleguide`.
- `apps/web/functions` and `apps/web/src/server`: the `/api/rpc` relay (allowlist, rate limit, geoblock). Upstream URL only from `RPC_UPSTREAM_URL`.
- `apps/web/e2e`: mock chain, mock server and Playwright tests.
- `packages/protocol`: the pure protocol library (memo schema, addresses, decoders, evaluator, stability, signer relation).
- `docs`: `SPEC.md` (protocol), `DECISIONS.md` (verified facts and decisions), `CONCEPTS.md` (visual directions), `STAGE2-REGISTRY-SPEC.md` (optional on-chain registry, specification only), `screens/` (review screenshots).
