import type { Page } from "@playwright/test";

export const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
export const PYUSD = "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo";
export const BROKEN = "So11111111111111111111111111111111111111112";
export const MISSING = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
export const WALLET_ADDRESS = "7p9vKmJgcGiFsPEEoPvVevREc4MGsKRVTh4n7FJPLwCm";

export async function mock(page: Page, action: string, arg = "") {
  await page.request.get(`/__mock/${action}/${arg}`);
}

/** A Wallet Standard wallet that signs by filling the signature slot. It holds no key and the mock RPC does not check it. */
export async function installFakeWallet(page: Page, mode: "ok" | "reject" | "tamper" = "ok") {
  await page.addInitScript(
    ({ address, mode }) => {
      const chains = ["solana:mainnet", "solana:devnet"];
      const acct = { address, publicKey: new Uint8Array(32), chains, features: ["solana:signTransaction"], label: undefined, icon: undefined };
      const wallet = {
        version: "1.0.0",
        name: "Fake Wallet",
        icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIvPg==",
        chains,
        accounts: [] as unknown[],
        features: {
          "standard:connect": { version: "1.0.0", connect: async () => ({ accounts: [acct] }) },
          "solana:signTransaction": {
            version: "1.0.0",
            supportedTransactionVersions: ["legacy", 0],
            signTransaction: async (...inputs: { transaction: Uint8Array }[]) => {
              (window as unknown as { __signCalls: number }).__signCalls = ((window as unknown as { __signCalls?: number }).__signCalls ?? 0) + 1;
              if (mode === "reject") throw Object.assign(new Error("User rejected the request."), { code: 4001 });
              return inputs.map(({ transaction }) => {
                const out = new Uint8Array(transaction);
                out.fill(7, 1, 65); // one signature slot, after the one-byte count
                if (mode === "tamper") {
                  const text = new TextEncoder().encode('"t":"datum/0"');
                  outer: for (let i = 65; i < out.length - text.length; i++) {
                    for (let j = 0; j < text.length; j++) if (out[i + j] !== text[j]) continue outer;
                    out[i + 1] = 84; // changes the memo text the wallet "signed"
                    break;
                  }
                }
                return { signedTransaction: out };
              });
            },
          },
        },
      };
      const register = (api: { register: (w: unknown) => void }) => api.register(wallet);
      window.addEventListener("wallet-standard:app-ready", (e) => register((e as CustomEvent).detail));
      window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", { detail: register }));
    },
    { address: WALLET_ADDRESS, mode },
  );
}
