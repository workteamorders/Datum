import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { buildMemo, byteLength, parseMemo, serializeMemo, claimMintTag, feedTag, b58decode, b58encode, isPubkey } from "../src";

const MINT = "DatumExamp1eMintA11111111111111111111111111";

const V1 = `{"t":"datum/0","m":"${MINT}","p":[{"k":"mint_authority_none"},{"k":"freeze_authority_none"}],"n":"Launch terms"}`;
const V2 = `{"t":"datum/0","m":"${MINT}","p":[{"k":"mint_authority_none"},{"k":"freeze_authority_none"},{"k":"supply_max","v":"1000000000000000"},{"k":"token_program","v":"token-2022"},{"k":"t22_no_permanent_delegate"},{"k":"t22_no_transfer_hook"},{"k":"t22_transfer_fee_max_bps","v":"0"},{"k":"metadata_immutable"}],"n":"Fixed supply, no hooks, no fees."}`;
const V3 = `{"t":"datum/0","m":"${MINT}","p":[{"k":"decimals_eq","v":"6"},{"k":"future_predicate","v":"42"}]}`;

describe("SPEC section 12.1 valid examples", () => {
  it("has the stated sizes", () => {
    expect(byteLength(V1)).toBe(148);
    expect(byteLength(V2)).toBe(380);
    expect(byteLength(V3)).toBe(133);
  });
  for (const [name, m] of [["V1", V1], ["V2", V2], ["V3", V3]] as const) {
    it(`parses ${name} and round-trips`, () => {
      const r = parseMemo(m);
      expect(r.ok).toBe(true);
      if (r.ok) expect(serializeMemo(r.memo)).toBe(m);
    });
    it(`parses ${name} from bytes`, () => {
      expect(parseMemo(new TextEncoder().encode(m)).ok).toBe(true);
    });
  }
  it("accepts an unknown predicate key", () => {
    const r = parseMemo(V3);
    expect(r.ok && r.memo.p[1]?.k).toBe("future_predicate");
  });
});

describe("SPEC section 12.2 rejected examples", () => {
  const rej = (s: string) => {
    const r = parseMemo(s);
    expect(r.ok).toBe(false);
    return r.ok ? "" : r.reason;
  };
  it("whitespace", () => rej(V1.replace('"t":"datum', '"t": "datum')));
  it("key order", () => rej(`{"m":"${MINT}","t":"datum/0","p":[{"k":"mint_authority_none"}]}`));
  it("unknown top-level field", () => rej(`{"t":"datum/0","m":"${MINT}","p":[{"k":"mint_authority_none"}],"x":1}`));
  it("33-byte mint", () => rej(V1.replace(MINT, "DatumExamp1eMintA1111111111111111111111111111")));
  it("31-byte mint", () => rej(V1.replace(MINT, "DatumExamp1eMintA1111111111111111111111111")));
  it("non-base58 mint", () => rej(V1.replace(MINT, "DatumExamp1eMint0111111111111111111111111111")));
  it("no predicates", () => rej(`{"t":"datum/0","m":"${MINT}","p":[]}`));
  it("nine predicates", () => {
    const p = Array.from({ length: 9 }, (_, i) => `{"k":"future_${i}"}`).join(",");
    rej(`{"t":"datum/0","m":"${MINT}","p":[${p}]}`);
  });
  it("duplicate key", () => rej(`{"t":"datum/0","m":"${MINT}","p":[{"k":"supply_max","v":"1"},{"k":"supply_max","v":"2"}]}`));
  it("value not decimal", () => rej(`{"t":"datum/0","m":"${MINT}","p":[{"k":"supply_max","v":"1e9"}]}`));
  it("value not a string", () => rej(`{"t":"datum/0","m":"${MINT}","p":[{"k":"supply_max","v":1000}]}`));
  it("known predicate takes no value", () => rej(`{"t":"datum/0","m":"${MINT}","p":[{"k":"mint_authority_none","v":"1"}]}`));
  it("known predicate needs a value", () => rej(`{"t":"datum/0","m":"${MINT}","p":[{"k":"supply_max"}]}`));
  it("decimals out of range", () => rej(`{"t":"datum/0","m":"${MINT}","p":[{"k":"decimals_eq","v":"256"}]}`));
  it("label with html", () => rej(`{"t":"datum/0","m":"${MINT}","p":[{"k":"mint_authority_none"}],"n":"<b>hi</b>"}`));
  it("label with leading space", () => rej(`{"t":"datum/0","m":"${MINT}","p":[{"k":"mint_authority_none"}],"n":" padded"}`));
  it("over 512 bytes", () => rej(V1 + " ".repeat(400)));
  it("not json", () => rej("{nope"));
  it("not an object", () => rej("[]"));
  it("null", () => rej("null"));
  it("duplicate JSON key is not canonical", () => rej(`{"t":"datum/0","m":"${MINT}","m":"${MINT}","p":[{"k":"mint_authority_none"}]}`));
  it("escapes are rejected", () => rej(`{"t":"datum/0","m":"${MINT}","p":[{"k":"mint_authority_none"}],"n":"a\\u0062"}`));
  it("invalid utf-8 bytes do not throw", () => {
    expect(parseMemo(new Uint8Array([0xff, 0xfe, 0x7b])).ok).toBe(false);
  });
});

describe("property: the parser never throws", () => {
  it("random strings", () => {
    fc.assert(fc.property(fc.string({ maxLength: 700 }), (s) => { parseMemo(s); return true; }), { numRuns: 500 });
  });
  it("random bytes", () => {
    fc.assert(fc.property(fc.uint8Array({ maxLength: 700 }), (b) => { parseMemo(b); return true; }), { numRuns: 500 });
  });
  it("random JSON values", () => {
    fc.assert(fc.property(fc.json(), (j) => { parseMemo(j); return true; }), { numRuns: 500 });
  });
});

describe("property: build then parse round-trips", () => {
  const key = fc.constantFrom("mint_authority_none", "freeze_authority_none", "metadata_immutable", "t22_no_permanent_delegate", "t22_no_transfer_hook", "t22_no_default_frozen");
  const label = fc.stringMatching(/^[A-Za-z0-9.,!?'-]([A-Za-z0-9 .,!?'-]{0,46}[A-Za-z0-9.,!?'-])?$/);
  it("holds", () => {
    fc.assert(
      fc.property(fc.uniqueArray(key, { minLength: 1, maxLength: 6 }), fc.option(label, { nil: undefined }), fc.bigInt({ min: 0n, max: 18446744073709551615n }), (keys, n, supply) => {
        const p = [...keys.map((k) => ({ k })), { k: "supply_max", v: supply.toString() }];
        const built = buildMemo(MINT, p, n);
        const r = parseMemo(built.text);
        expect(r.ok).toBe(true);
        if (r.ok) expect(serializeMemo(r.memo)).toBe(built.text);
        expect(built.bytes).toBeLessThanOrEqual(512);
      }),
      { numRuns: 300 },
    );
  });
  it("the largest valid v0 claim is 459 bytes", () => {
    const p = [
      { k: "supply_max", v: "18446744073709551615" },
      { k: "update_authority_eq", v: MINT },
      { k: "t22_transfer_fee_max_bps", v: "10000" },
      { k: "token_program", v: "token-2022" },
      { k: "decimals_eq", v: "255" },
      { k: "t22_no_permanent_delegate" },
      { k: "t22_no_default_frozen" },
      { k: "freeze_authority_none" },
    ];
    const b = buildMemo(MINT, p, "a".repeat(48));
    expect(b.bytes).toBeLessThanOrEqual(512);
  });
});

describe("base58 and addresses", () => {
  it("round-trips random 32-byte keys", () => {
    fc.assert(fc.property(fc.uint8Array({ minLength: 32, maxLength: 32 }), (b) => {
      const s = b58encode(b);
      expect(b58decode(s)).toEqual(b);
      return isPubkey(s) || s.length < 32;
    }), { numRuns: 300 });
  });
  it("keeps leading zeros", () => {
    expect(b58encode(new Uint8Array(32))).toBe("11111111111111111111111111111111");
    expect(b58decode("11111111111111111111111111111111")?.length).toBe(32);
  });
  it("rejects characters outside the alphabet", () => {
    expect(b58decode("0OIl")).toBeNull();
  });
  it("derives the reference tag addresses of SPEC section 3", async () => {
    expect(await feedTag()).toBe("6LfGebjFQ5o9qNCQgcGF5HP5johg5MygapbSd2kNb3nK");
    expect(await claimMintTag("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")).toBe("GgLjUUhY3czLcwQuA6vUJpyZUQhe6P2FTTK7RpJZMR7X");
    expect(await claimMintTag("2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo")).toBe("7rtdK5gMQBsE2qXrpet8pNzj8XFZiUZ5fUyUT7txrCG1");
    expect(await claimMintTag("7p9vKmJgcGiFsPEEoPvVevREc4MGsKRVTh4n7FJPLwCm")).toBe("3D9SwUtqaW4mfj98RFG56BcQU3TA5ZbD4BJ5y5Viedqu");
    expect(await claimMintTag(MINT)).toBe("2jehgxCDDxf6YduDQnUVcj7MsLj5CGufsyWo6nW2vCrq");
  });
});
