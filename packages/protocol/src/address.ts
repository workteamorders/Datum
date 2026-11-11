import { address, getProgramDerivedAddress } from "@solana/kit";
import { b58decode } from "./base58";
import { MEMO_PROGRAM_ID, SCHEMA, SEED_FEED } from "./constants";

const enc = new TextEncoder();

/** CLAIM_MINT(mint) = findProgramAddress(["datum/0", mint], MEMO). docs/SPEC.md section 3. */
export async function claimMintTag(mint: string): Promise<string> {
  const raw = b58decode(mint);
  if (raw === null || raw.length !== 32) throw new Error("Mint is not a 32-byte address.");
  const [pda] = await getProgramDerivedAddress({
    programAddress: address(MEMO_PROGRAM_ID),
    seeds: [enc.encode(SCHEMA), raw],
  });
  return pda;
}

/** FEED = findProgramAddress(["datum/0/feed"], MEMO). */
export async function feedTag(): Promise<string> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: address(MEMO_PROGRAM_ID),
    seeds: [enc.encode(SEED_FEED)],
  });
  return pda;
}

/** Metaplex metadata PDA: ["metadata", programId, mint]. */
export async function metaplexMetadataAddress(mint: string, programId: string): Promise<string> {
  const raw = b58decode(mint);
  const prog = b58decode(programId);
  if (raw === null || raw.length !== 32 || prog === null) throw new Error("Not a 32-byte address.");
  const [pda] = await getProgramDerivedAddress({
    programAddress: address(programId),
    seeds: [enc.encode("metadata"), prog, raw],
  });
  return pda;
}

/** Pump.fun bonding curve PDA: ["bonding-curve", mint]. */
export async function pumpCurveAddress(mint: string, programId: string): Promise<string> {
  const raw = b58decode(mint);
  if (raw === null || raw.length !== 32) throw new Error("Mint is not a 32-byte address.");
  const [pda] = await getProgramDerivedAddress({
    programAddress: address(programId),
    seeds: [enc.encode("bonding-curve"), raw],
  });
  return pda;
}
