import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { b58encode, decodeMetaplex, decodeMint, decodePumpCurve, decodeUpgradeStatus, programDataAddress, DecodeError,
  PUMP_CURVE_DISCRIMINATOR, PUMP_PROGRAM_ID, SPL_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "../src";

type Fx = Record<string, { address?: string; owner?: string; data: string }>;
const F = JSON.parse(readFileSync(new URL("../fixtures/mainnet-accounts.json", import.meta.url), "utf8")) as Fx;
export const bytes = (k: string): Uint8Array => new Uint8Array(Buffer.from((F[k] as { data: string }).data, "base64"));
const own = (k: string): string => (F[k] as { owner: string }).owner;

describe("real mainnet accounts (read-only fixtures)", () => {
  it("USDC: SPL Token, authorities exist, 6 decimals", () => {
    const m = decodeMint(own("USDC"), bytes("USDC"));
    expect(m.program).toBe("spl-token");
    expect(m.decimals).toBe(6);
    expect(m.mintAuthority).not.toBeNull();
    expect(m.freezeAuthority).not.toBeNull();
    expect(m.supply > 0n).toBe(true);
  });
  it("BONK: authorities are none, 5 decimals", () => {
    const m = decodeMint(own("BONK"), bytes("BONK"));
    expect(m.mintAuthority).toBeNull();
    expect(m.freezeAuthority).toBeNull();
    expect(m.decimals).toBe(5);
  });
  it("PYUSD: Token-2022 with extensions, zero pubkeys normalise to none", () => {
    const m = decodeMint(own("PYUSD"), bytes("PYUSD"));
    expect(m.program).toBe("token-2022");
    expect(m.decimals).toBe(6);
    expect(m.extensions.transferFee).toBeDefined();
    expect(m.extensions.permanentDelegate).toBeDefined();
    expect(m.extensions.transferHook).toBeDefined();
    expect(m.extensions.transferHook?.programId).toBeNull(); // D-011: nonzero check
    expect(m.extensions.metadataPointer).toBeDefined();
    expect(m.extensions.tokenMetadata?.mint).toBe("2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo");
    expect(m.extensions.unknownTypes).toContain(16); // ConfidentialTransferFee, shown as unknown here
  });
  it("Metaplex: USDC and BONK parse, isMutable is read", () => {
    const u = decodeMetaplex(bytes("USDC_META"));
    expect(u.mint).toBe("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    expect(u.isMutable).toBe(true);
    const b = decodeMetaplex(bytes("BONK_META"));
    expect(b.mint).toBe("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263");
    expect(b.isMutable).toBe(true);
  });
  it("upgrade status: SPL Token has none, Token-2022 has one (D-013)", () => {
    const tk = decodeUpgradeStatus(own("TOKENKEG"), bytes("TOKENKEG"), bytes("TOKENKEG_PD"));
    expect(tk.hasUpgradeAuthority).toBe(false);
    const t22 = decodeUpgradeStatus(own("TOKEN2022"), bytes("TOKEN2022"), bytes("TOKEN2022_PD"));
    expect(t22.hasUpgradeAuthority).toBe(true);
    expect(programDataAddress(bytes("TOKENKEG"))).toBe("3gvYRKWyXRR9xKWe1ZjPhLY5ZJRN7KDB4rFZFGoJfFk2");
  });
});

describe("decoders reject bad input without anything but DecodeError", () => {
  it("wrong owner", () => expect(() => decodeMint("11111111111111111111111111111111", bytes("USDC"))).toThrow(DecodeError));
  it("short data", () => expect(() => decodeMint(SPL_TOKEN_PROGRAM_ID, new Uint8Array(10))).toThrow(DecodeError));
  it("uninitialised mint", () => expect(() => decodeMint(SPL_TOKEN_PROGRAM_ID, new Uint8Array(82))).toThrow(DecodeError));
  it("random bytes never throw anything else", () => {
    fc.assert(fc.property(fc.uint8Array({ maxLength: 900 }), fc.constantFrom(SPL_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID), (b, o) => {
      for (const f of [() => decodeMint(o, b), () => decodeMetaplex(b), () => decodeUpgradeStatus("BPFLoaderUpgradeab1e11111111111111111111111", b, b)]) {
        try { f(); } catch (e) { expect(e).toBeInstanceOf(DecodeError); }
      }
      return true;
    }), { numRuns: 500 });
  });
  it("mutating real bytes never throws anything else", () => {
    const base = bytes("PYUSD");
    fc.assert(fc.property(fc.integer({ min: 0, max: base.length - 1 }), fc.integer({ min: 0, max: 255 }), (i, v) => {
      const b = base.slice(); b[i] = v;
      try { decodeMint(own("PYUSD"), b); } catch (e) { expect(e).toBeInstanceOf(DecodeError); }
      return true;
    }), { numRuns: 800 });
  });
});

describe("pump.fun bonding curve (layout from the IDL, docs/DECISIONS.md D-017)", () => {
  it("reads the creator at bytes 49..81", () => {
    const d = new Uint8Array(166);
    d.set(PUMP_CURVE_DISCRIMINATOR, 0);
    const creator = new Uint8Array(32).map((_, i) => i + 1);
    d.set(creator, 49);
    expect(decodePumpCurve(PUMP_PROGRAM_ID, d)?.creator).toBe(b58encode(creator));
  });
  it("needs the right owner and discriminator", () => {
    const d = new Uint8Array(166); d.set(PUMP_CURVE_DISCRIMINATOR, 0);
    expect(decodePumpCurve("11111111111111111111111111111111", d)).toBeNull();
    d[0] = 0;
    expect(decodePumpCurve(PUMP_PROGRAM_ID, d)).toBeNull();
    expect(decodePumpCurve(PUMP_PROGRAM_ID, new Uint8Array(10))).toBeNull();
  });
});
