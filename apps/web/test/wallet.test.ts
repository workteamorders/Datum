import { describe, expect, it, vi } from "vitest";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { CHAIN_OF, WalletFailure, connect, isUsable, listWallets, signWithWallet, supportsChain, watchWallets } from "../src/lib/wallet";

const acct = (chains: string[] = ["solana:mainnet"], features: string[] = ["solana:signTransaction"]): WalletAccount =>
  ({ address: "7p9vKmJgcGiFsPEEoPvVevREc4MGsKRVTh4n7FJPLwCm", publicKey: new Uint8Array(32), chains, features, label: undefined, icon: undefined }) as unknown as WalletAccount;

function mk(over: { features?: Record<string, unknown>; chains?: string[]; accounts?: WalletAccount[] } = {}): Wallet {
  return {
    version: "1.0.0",
    name: "Test Wallet",
    icon: "data:image/svg+xml;base64,AA==",
    chains: over.chains ?? ["solana:mainnet", "solana:devnet"],
    accounts: over.accounts ?? [],
    features: over.features ?? {
      "standard:connect": { version: "1.0.0", connect: async () => ({ accounts: [acct()] }) },
      "solana:signTransaction": { version: "1.0.0", supportedTransactionVersions: ["legacy", 0], signTransaction: async (i: { transaction: Uint8Array }) => [{ signedTransaction: new Uint8Array([...i.transaction, 9]) }] },
    },
  } as unknown as Wallet;
}

describe("wallet listing", () => {
  it("keeps only wallets that can connect and sign", () => {
    const good = mk();
    const noSign = mk({ features: { "standard:connect": { version: "1.0.0", connect: async () => ({ accounts: [] }) } } });
    const onlySendAndSign = mk({ features: { "standard:connect": {}, "solana:signAndSendTransaction": {} } });
    expect(isUsable(good)).toBe(true);
    expect(listWallets({ get: () => [good, noSign, onlySendAndSign] }).map((w) => w.wallet)).toEqual([good]);
  });
  it("watches register and unregister and stops on unsubscribe", () => {
    const off = [vi.fn(), vi.fn()];
    const on = vi.fn((_: string, __: () => void) => off[on.mock.calls.length - 1]!);
    const stop = watchWallets(() => {}, { on } as never);
    expect(on.mock.calls.map((c) => c[0])).toEqual(["register", "unregister"]);
    stop();
    expect(off[0]).toHaveBeenCalled();
    expect(off[1]).toHaveBeenCalled();
  });
});

describe("connect", () => {
  it("returns the accounts", async () => {
    expect(await connect(mk())).toHaveLength(1);
  });
  it("maps a closed prompt to a plain message", async () => {
    const w = mk({ features: { "standard:connect": { version: "1.0.0", connect: async () => { throw Object.assign(new Error("User rejected the request."), { code: 4001 }); } } } });
    await expect(connect(w)).rejects.toMatchObject({ kind: "rejected" });
  });
  it("reports a wallet with no account", async () => {
    const w = mk({ features: { "standard:connect": { version: "1.0.0", connect: async () => ({ accounts: [] }) } } });
    await expect(connect(w)).rejects.toMatchObject({ kind: "no_account" });
  });
  it("does not leak a raw wallet error", async () => {
    const w = mk({ features: { "standard:connect": { version: "1.0.0", connect: async () => { throw new Error("internal: secret details"); } } } });
    const e = await connect(w).catch((x: WalletFailure) => x);
    expect(e).toMatchObject({ kind: "failed" });
    expect((e as Error).message).not.toMatch(/secret/);
  });
});

describe("signWithWallet", () => {
  it("passes the account, bytes and chain, and returns the signed bytes", async () => {
    const sign = vi.fn(async (i: { transaction: Uint8Array }) => [{ signedTransaction: new Uint8Array([...i.transaction, 9]) }]);
    const w = mk({ features: { "standard:connect": {}, "solana:signTransaction": { version: "1.0.0", supportedTransactionVersions: ["legacy"], signTransaction: sign } } });
    const a = acct();
    const out = await signWithWallet(w, a, CHAIN_OF.mainnet, new Uint8Array([1, 2]));
    expect([...out]).toEqual([1, 2, 9]);
    expect(sign).toHaveBeenCalledWith({ account: a, transaction: new Uint8Array([1, 2]), chain: "solana:mainnet" });
  });
  it("refuses when the account is not on the cluster, without calling the wallet", async () => {
    const sign = vi.fn();
    const w = mk({ features: { "solana:signTransaction": { version: "1.0.0", signTransaction: sign } } });
    await expect(signWithWallet(w, acct(["solana:devnet"]), CHAIN_OF.mainnet, new Uint8Array())).rejects.toMatchObject({ kind: "wrong_chain" });
    expect(sign).not.toHaveBeenCalled();
    expect(supportsChain(mk(), acct(["solana:mainnet"], []), "solana:mainnet")).toBe(false);
  });
  it("maps a declined signature to 'nothing was signed'", async () => {
    const w = mk({ features: { "solana:signTransaction": { version: "1.0.0", signTransaction: async () => { throw new Error("User declined the request"); } } } });
    const e = await signWithWallet(w, acct(), CHAIN_OF.mainnet, new Uint8Array()).catch((x: WalletFailure) => x);
    expect(e).toMatchObject({ kind: "rejected" });
    expect((e as Error).message).toMatch(/Nothing was signed/);
  });
  it("fails clearly when the wallet returns nothing", async () => {
    const w = mk({ features: { "solana:signTransaction": { version: "1.0.0", signTransaction: async () => [] } } });
    await expect(signWithWallet(w, acct(), CHAIN_OF.mainnet, new Uint8Array())).rejects.toMatchObject({ kind: "failed" });
  });
});
