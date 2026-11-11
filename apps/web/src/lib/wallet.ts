// Wallet Standard layer. Datum never holds a key: the person's own wallet signs, in its own window.
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount, IdentifierString } from "@wallet-standard/base";
import { StandardConnect, StandardDisconnect, type StandardConnectFeature, type StandardDisconnectFeature } from "@wallet-standard/features";
import { SolanaSignTransaction, type SolanaSignTransactionFeature } from "@solana/wallet-standard-features";
import { SOLANA_DEVNET_CHAIN, SOLANA_MAINNET_CHAIN, SOLANA_TESTNET_CHAIN } from "@solana/wallet-standard-chains";
import type { Cluster } from "./cluster";

export const CHAIN_OF: Record<Exclude<Cluster, "unknown">, IdentifierString> = {
  mainnet: SOLANA_MAINNET_CHAIN,
  devnet: SOLANA_DEVNET_CHAIN,
  testnet: SOLANA_TESTNET_CHAIN,
};

export type WalletEntry = { wallet: Wallet; name: string; icon: string };

/** A wallet can be used here if it can connect and sign a transaction without sending it. */
export function isUsable(w: Wallet): boolean {
  return StandardConnect in w.features && SolanaSignTransaction in w.features;
}

export function listWallets(source: { get(): readonly Wallet[] } = getWallets()): WalletEntry[] {
  return source
    .get()
    .filter(isUsable)
    .map((wallet) => ({ wallet, name: wallet.name, icon: wallet.icon }));
}

/** Calls back whenever a wallet appears or goes away. Returns the unsubscribe function. */
export function watchWallets(cb: () => void, source = getWallets()): () => void {
  const a = source.on("register", cb);
  const b = source.on("unregister", cb);
  return () => {
    a();
    b();
  };
}

export class WalletFailure extends Error {
  constructor(
    public readonly kind: "rejected" | "no_account" | "wrong_chain" | "unsupported" | "failed",
    message: string,
  ) {
    super(message);
    this.name = "WalletFailure";
  }
}

/** Wallets word a refusal in many ways. Anything that comes from the wallet window closing is "rejected". */
function normalise(e: unknown, fallback: string): WalletFailure {
  if (e instanceof WalletFailure) return e;
  const text = `${(e as { name?: string })?.name ?? ""} ${(e as { message?: string })?.message ?? ""}`.toLowerCase();
  const code = (e as { code?: number })?.code;
  if (code === 4001 || /reject|declin|denied|cancel|closed|user refused/.test(text)) return new WalletFailure("rejected", "You closed the wallet request. Nothing was signed.");
  return new WalletFailure("failed", fallback);
}

export async function connect(wallet: Wallet): Promise<readonly WalletAccount[]> {
  const f = (wallet.features as Partial<StandardConnectFeature>)[StandardConnect];
  if (!f) throw new WalletFailure("unsupported", "This wallet cannot connect to websites.");
  try {
    const { accounts } = await f.connect();
    if (accounts.length === 0) throw new WalletFailure("no_account", "The wallet did not share an account.");
    return accounts;
  } catch (e) {
    throw normalise(e, "The wallet could not connect.");
  }
}

export async function disconnect(wallet: Wallet): Promise<void> {
  const f = (wallet.features as Partial<StandardDisconnectFeature>)[StandardDisconnect];
  try {
    await f?.disconnect();
  } catch {
    /* A wallet that cannot disconnect is simply forgotten by the page. */
  }
}

/** Whether this account can sign for the cluster the page is reading. */
export function supportsChain(wallet: Wallet, account: WalletAccount, chain: IdentifierString): boolean {
  return wallet.chains.includes(chain) && account.chains.includes(chain) && account.features.includes(SolanaSignTransaction);
}

/** Asks the wallet to sign. Returns the signed bytes. Sends nothing. */
export async function signWithWallet(wallet: Wallet, account: WalletAccount, chain: IdentifierString, transaction: Uint8Array): Promise<Uint8Array> {
  const f = (wallet.features as Partial<SolanaSignTransactionFeature>)[SolanaSignTransaction];
  if (!f) throw new WalletFailure("unsupported", "This wallet cannot sign transactions for websites.");
  if (!supportsChain(wallet, account, chain)) throw new WalletFailure("wrong_chain", `This wallet account is not set up for ${chain.replace("solana:", "Solana ")}. Switch the network in your wallet and connect again.`);
  try {
    const [out] = await f.signTransaction({ account, transaction, chain });
    if (!out?.signedTransaction) throw new WalletFailure("failed", "The wallet did not return a signed transaction.");
    return out.signedTransaction;
  } catch (e) {
    throw normalise(e, "The wallet could not sign.");
  }
}
