// Constants of datum/0. Values come from docs/SPEC.md section 2 and docs/DECISIONS.md.

export const SCHEMA = "datum/0";
export const SEED_FEED = "datum/0/feed";

export const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
export const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
export const SPL_TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const METAPLEX_METADATA_PROGRAM_ID = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
export const PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
export const BPF_LOADER_UPGRADEABLE_ID = "BPFLoaderUpgradeab1e11111111111111111111111";
export const BPF_LOADER_2_ID = "BPFLoader2111111111111111111111111111111111";

export const MEMO_MAX_BYTES = 512;
export const MAX_PREDICATES = 8;
export const LABEL_MAX_BYTES = 48;
export const KEY_MAX_BYTES = 32;
export const VALUE_MAX_BYTES = 64;

/** Claims read per load and signatures requested per page (docs/SPEC.md section 6). */
export const CLAIMS_PER_LOAD = 10;
export const SIGNATURES_PER_PAGE = 50;

/** Pump.fun BondingCurve account discriminator (docs/DECISIONS.md D-017). */
export const PUMP_CURVE_DISCRIMINATOR = [23, 183, 248, 55, 96, 216, 172, 96] as const;
export const PUMP_CURVE_CREATOR_OFFSET = 49;

/** Token-2022 extension type numbers used by Datum (docs/DECISIONS.md D-010, D-012). */
export const EXT = {
  TransferFeeConfig: 1,
  MintCloseAuthority: 3,
  DefaultAccountState: 6,
  PermanentDelegate: 12,
  TransferHook: 14,
  MetadataPointer: 18,
  TokenMetadata: 19,
  ConfidentialMintBurn: 24,
} as const;
