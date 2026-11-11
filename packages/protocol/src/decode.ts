import { b58encode } from "./base58";
import {
  BPF_LOADER_2_ID,
  BPF_LOADER_UPGRADEABLE_ID,
  EXT,
  PUMP_CURVE_CREATOR_OFFSET,
  PUMP_CURVE_DISCRIMINATOR,
  PUMP_PROGRAM_ID,
  SPL_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "./constants";

/** Thrown only inside this module; callers turn it into "cannot check". */
export class DecodeError extends Error {}

type Pk = string | null;

export type MintExtensions = {
  transferFee?: { authority: Pk; older: { epoch: bigint; bps: number }; newer: { epoch: bigint; bps: number } };
  mintCloseAuthority?: { authority: Pk };
  defaultAccountState?: { state: number };
  permanentDelegate?: { delegate: Pk };
  transferHook?: { authority: Pk; programId: Pk };
  metadataPointer?: { authority: Pk; metadataAddress: Pk };
  tokenMetadata?: { updateAuthority: Pk; mint: string };
  confidentialMintBurn?: true;
  unknownTypes: number[];
};

export type MintInfo = {
  program: "spl-token" | "token-2022";
  supply: bigint;
  decimals: number;
  mintAuthority: Pk;
  freezeAuthority: Pk;
  extensions: MintExtensions;
};

function view(d: Uint8Array): DataView {
  return new DataView(d.buffer, d.byteOffset, d.byteLength);
}

/** 32 zero bytes mean none (docs/DECISIONS.md D-011). */
function optPk(d: Uint8Array, at: number): Pk {
  if (at + 32 > d.length) throw new DecodeError("short pubkey");
  const s = d.subarray(at, at + 32);
  for (let i = 0; i < 32; i++) if (s[i] !== 0) return b58encode(s);
  return null;
}

function pk(d: Uint8Array, at: number): string {
  if (at + 32 > d.length) throw new DecodeError("short pubkey");
  return b58encode(d.subarray(at, at + 32));
}

/** Decodes a mint account owned by SPL Token or Token-2022. Throws DecodeError when it cannot. */
export function decodeMint(owner: string, data: Uint8Array): MintInfo {
  let program: MintInfo["program"];
  if (owner === SPL_TOKEN_PROGRAM_ID) program = "spl-token";
  else if (owner === TOKEN_2022_PROGRAM_ID) program = "token-2022";
  else throw new DecodeError("unsupported owner");
  if (data.length < 82) throw new DecodeError("short mint");
  if (program === "spl-token" && data.length !== 82) throw new DecodeError("SPL mint must be 82 bytes");
  const v = view(data);
  const mintAuthorityOption = v.getUint32(0, true);
  const supply = v.getBigUint64(36, true);
  const decimals = data[44] as number;
  const initialized = data[45] === 1;
  const freezeOption = v.getUint32(46, true);
  if (!initialized) throw new DecodeError("mint is not initialized");
  if (mintAuthorityOption > 1 || freezeOption > 1) throw new DecodeError("bad option tag");
  const mintAuthority = mintAuthorityOption === 1 ? pk(data, 4) : null;
  const freezeAuthority = freezeOption === 1 ? pk(data, 50) : null;
  const extensions: MintExtensions = { unknownTypes: [] };
  if (program === "token-2022" && data.length > 82) {
    if (data.length < 166 || data[165] !== 1) throw new DecodeError("Token-2022 account is not a mint");
    let at = 166;
    while (at + 4 <= data.length) {
      const type = v.getUint16(at, true);
      const len = v.getUint16(at + 2, true);
      at += 4;
      if (type === 0 && len === 0) break; // uninitialized padding
      if (at + len > data.length) throw new DecodeError("extension overruns account");
      readExtension(extensions, type, data.subarray(at, at + len));
      at += len;
    }
  }
  return { program, supply, decimals, mintAuthority, freezeAuthority, extensions };
}

function readExtension(x: MintExtensions, type: number, d: Uint8Array): void {
  const v = view(d);
  switch (type) {
    case EXT.TransferFeeConfig: {
      if (d.length < 108) throw new DecodeError("short transfer fee extension");
      x.transferFee = {
        authority: optPk(d, 0),
        older: { epoch: v.getBigUint64(72, true), bps: v.getUint16(88, true) },
        newer: { epoch: v.getBigUint64(90, true), bps: v.getUint16(106, true) },
      };
      return;
    }
    case EXT.MintCloseAuthority:
      x.mintCloseAuthority = { authority: optPk(d, 0) };
      return;
    case EXT.DefaultAccountState:
      if (d.length < 1) throw new DecodeError("short default state extension");
      x.defaultAccountState = { state: d[0] as number };
      return;
    case EXT.PermanentDelegate:
      x.permanentDelegate = { delegate: optPk(d, 0) };
      return;
    case EXT.TransferHook:
      x.transferHook = { authority: optPk(d, 0), programId: optPk(d, 32) };
      return;
    case EXT.MetadataPointer:
      x.metadataPointer = { authority: optPk(d, 0), metadataAddress: optPk(d, 32) };
      return;
    case EXT.TokenMetadata:
      x.tokenMetadata = { updateAuthority: optPk(d, 0), mint: pk(d, 32) };
      return;
    case EXT.ConfidentialMintBurn:
      x.confidentialMintBurn = true;
      return;
    default:
      x.unknownTypes.push(type);
  }
}

export type MetaplexInfo = { updateAuthority: string; mint: string; isMutable: boolean };

/** Reads the prefix of a Metaplex MetadataV1 account (docs/DECISIONS.md D-010). */
export function decodeMetaplex(data: Uint8Array): MetaplexInfo {
  if (data.length < 65 || data[0] !== 4) throw new DecodeError("not a MetadataV1 account");
  const v = view(data);
  const updateAuthority = pk(data, 1);
  const mint = pk(data, 33);
  let at = 65;
  for (let i = 0; i < 3; i++) {
    // name, symbol, uri
    if (at + 4 > data.length) throw new DecodeError("short string");
    const n = v.getUint32(at, true);
    at += 4;
    if (n > 1024 || at + n > data.length) throw new DecodeError("bad string length");
    at += n;
  }
  if (at + 2 > data.length) throw new DecodeError("short metadata");
  at += 2; // sellerFeeBasisPoints
  if (at + 1 > data.length) throw new DecodeError("short metadata");
  const hasCreators = data[at];
  at += 1;
  if (hasCreators === 1) {
    if (at + 4 > data.length) throw new DecodeError("short creators");
    const count = v.getUint32(at, true);
    at += 4;
    if (count > 64 || at + count * 34 > data.length) throw new DecodeError("bad creators");
    at += count * 34;
  } else if (hasCreators !== 0) throw new DecodeError("bad option tag");
  if (at + 2 > data.length) throw new DecodeError("short metadata");
  const primarySale = data[at];
  const isMutable = data[at + 1];
  if ((primarySale !== 0 && primarySale !== 1) || (isMutable !== 0 && isMutable !== 1)) throw new DecodeError("bad flag");
  return { updateAuthority, mint, isMutable: isMutable === 1 };
}

/** Reads the creator of a pump.fun bonding curve. Returns null when owner or discriminator do not match. */
export function decodePumpCurve(owner: string, data: Uint8Array): { creator: string } | null {
  if (owner !== PUMP_PROGRAM_ID || data.length < PUMP_CURVE_CREATOR_OFFSET + 32) return null;
  for (let i = 0; i < 8; i++) if (data[i] !== PUMP_CURVE_DISCRIMINATOR[i]) return null;
  return { creator: pk(data, PUMP_CURVE_CREATOR_OFFSET) };
}

/**
 * Whether a program has an upgrade authority. `program` is the program account, `programData` the first
 * 45 bytes of its program data account (null when the program is not upgradeable).
 */
export function decodeUpgradeStatus(
  programOwner: string,
  program: Uint8Array,
  programData: Uint8Array | null,
): { hasUpgradeAuthority: boolean } {
  if (programOwner === BPF_LOADER_2_ID) return { hasUpgradeAuthority: false };
  if (programOwner !== BPF_LOADER_UPGRADEABLE_ID) throw new DecodeError("unknown loader");
  if (program.length < 36 || view(program).getUint32(0, true) !== 2) throw new DecodeError("not a program account");
  if (programData === null || programData.length < 45) throw new DecodeError("missing program data");
  if (view(programData).getUint32(0, true) !== 3) throw new DecodeError("not a program data account");
  const opt = programData[12];
  if (opt !== 0 && opt !== 1) throw new DecodeError("bad option tag");
  return { hasUpgradeAuthority: opt === 1 };
}

/** Program data address named by a program account (for the second read). */
export function programDataAddress(program: Uint8Array): string {
  if (program.length < 36 || view(program).getUint32(0, true) !== 2) throw new DecodeError("not a program account");
  return pk(program, 4);
}
