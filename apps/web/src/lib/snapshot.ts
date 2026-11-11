// Reads one snapshot per mint (docs/SPEC.md 8.1) through the relay.
import {
  BPF_LOADER_UPGRADEABLE_ID,
  METAPLEX_METADATA_PROGRAM_ID,
  PUMP_PROGRAM_ID,
  SPL_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  decodeUpgradeStatus,
  isPubkey,
  metaplexMetadataAddress,
  programDataAddress,
  pumpCurveAddress,
  type Fetched,
  type RawAccount,
  type Snapshot,
} from "@datum/protocol";
import { RpcFailure, type RpcClient } from "./rpc";

type AccountValue = { owner: string; data: [string, string]; executable?: boolean } | null;
type Multi = { context: { slot: number }; value: AccountValue[] };

export function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toFetched(v: AccountValue): Fetched<RawAccount> {
  if (v === null) return { state: "not_found" };
  if (!Array.isArray(v.data) || v.data[1] !== "base64" || typeof v.data[0] !== "string") return { state: "error", message: "Unexpected account encoding." };
  try {
    return { state: "ok", value: { owner: v.owner, data: b64decode(v.data[0]) } };
  } catch {
    return { state: "error", message: "Account data could not be read." };
  }
}

const failMessage = (e: unknown): string => (e instanceof RpcFailure ? e.message : "Could not read the account.");

async function multi(rpc: RpcClient, addresses: string[], extra: Record<string, unknown> = {}): Promise<Multi> {
  const r = await rpc.call<Multi>("getMultipleAccounts", [addresses, { encoding: "base64", commitment: "confirmed", ...extra }]);
  if (!r || !Array.isArray(r.value) || r.value.length !== addresses.length || typeof r.context?.slot !== "number") throw new RpcFailure("bad_response", "The RPC answer could not be read.");
  return r;
}

/** Upgrade status of a token program, read live. Cached per client for the page's life. */
async function readProgramUpgrade(rpc: RpcClient, program: string): Promise<Fetched<{ hasUpgradeAuthority: boolean }>> {
  try {
    const a = await multi(rpc, [program], { dataSlice: { offset: 0, length: 36 } });
    const acc = a.value[0];
    if (!acc) return { state: "not_found" };
    const raw = toFetched(acc);
    if (raw.state !== "ok") return raw.state === "error" ? raw : { state: "not_found" };
    if (raw.value.owner !== BPF_LOADER_UPGRADEABLE_ID) return { state: "ok", value: decodeUpgradeStatus(raw.value.owner, raw.value.data, null) };
    const pd = programDataAddress(raw.value.data);
    const b = await multi(rpc, [pd], { dataSlice: { offset: 0, length: 45 } });
    const pdAcc = toFetched(b.value[0] ?? null);
    if (pdAcc.state !== "ok") return pdAcc.state === "error" ? pdAcc : { state: "not_found" };
    return { state: "ok", value: decodeUpgradeStatus(raw.value.owner, raw.value.data, pdAcc.value.data) };
  } catch (e) {
    return { state: "error", message: failMessage(e) };
  }
}

export type SnapshotResult = { ok: true; snapshot: Snapshot } | { ok: false; reason: "bad_address" | "unreadable"; message: string };

/**
 * Reads the mint, its Metaplex metadata account, the pump.fun curve account and the token program's upgrade status.
 * A failed read becomes an `error` state on that part, so the evaluator reports "cannot check" for it.
 */
export async function readSnapshot(rpc: RpcClient, mint: string, now: () => number = Date.now): Promise<SnapshotResult> {
  if (!isPubkey(mint)) return { ok: false, reason: "bad_address", message: "That does not look like a token address." };
  const [metaplex, pumpCurve] = await Promise.all([metaplexMetadataAddress(mint, METAPLEX_METADATA_PROGRAM_ID), pumpCurveAddress(mint, PUMP_PROGRAM_ID)]);
  let first: Multi;
  try {
    first = await multi(rpc, [mint, metaplex, pumpCurve]);
  } catch (e) {
    return { ok: false, reason: "unreadable", message: failMessage(e) };
  }
  const observedAt = now();
  const mintAccount = toFetched(first.value[0] ?? null);
  const tokenProgram = mintAccount.state === "ok" ? mintAccount.value.owner : SPL_TOKEN_PROGRAM_ID;
  const supported = tokenProgram === SPL_TOKEN_PROGRAM_ID || tokenProgram === TOKEN_2022_PROGRAM_ID;
  const programUpgrade: Fetched<{ hasUpgradeAuthority: boolean }> = mintAccount.state === "ok" && supported ? await readProgramUpgrade(rpc, tokenProgram) : { state: "not_found" };
  return {
    ok: true,
    snapshot: {
      mint,
      slot: first.context.slot,
      observedAt,
      addresses: { mint, metaplex, pumpCurve, tokenProgram },
      mintAccount,
      metaplex: toFetched(first.value[1] ?? null),
      pumpCurve: toFetched(first.value[2] ?? null),
      programUpgrade,
    },
  };
}
