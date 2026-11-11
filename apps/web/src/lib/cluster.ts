// Cluster identification. Genesis hashes were read live from the three public endpoints
// with getGenesisHash on 2026-11-11 (docs/DECISIONS.md D-044), not typed from memory.
export type Cluster = "mainnet" | "devnet" | "testnet" | "unknown";

export const GENESIS: Record<Exclude<Cluster, "unknown">, string> = {
  mainnet: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  testnet: "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY",
};

export function clusterFromGenesis(hash: string): Cluster {
  for (const [name, h] of Object.entries(GENESIS)) if (h === hash) return name as Cluster;
  return "unknown";
}

export const CLUSTER_LABEL: Record<Cluster, string> = {
  mainnet: "Solana mainnet",
  devnet: "Solana devnet",
  testnet: "Solana testnet",
  unknown: "Unknown cluster",
};
