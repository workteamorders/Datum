# Datum protocol — `datum/0`

Status: draft for v0. This document is the source of truth. The site, the tests and any other reader follow it.
Evidence for every number and identifier below is in `docs/DECISIONS.md` (Gate S, 2026-11-10 UTC).

Key words MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119.

---

## 1. What a claim is

A **claim** is a signed public statement about one token mint, published on Solana as one transaction. It lists up to eight **predicates**: facts that anyone can check against the chain right now (for example "the mint authority is none").

A reader never asks whether a token is good. It asks, for each predicate, whether it is **true now**, and shows the evidence.

Non-goals: scores, rankings, "safe" or "verified" labels, prices, liquidity, off-chain promises, statements that cannot be checked on chain, and any history of when a claim became false (that needs an indexer).

---

## 2. Constants

| Name | Value |
|---|---|
| `SCHEMA` | `datum/0` |
| `MEMO_PROGRAM_ID` | `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr` (SPL Memo on BPF Loader 2, not upgradeable). Not `Memo1Uh…` (v1) and not `Memo4c2p…` (v4, upgradeable). |
| `SYSTEM_PROGRAM_ID` | `11111111111111111111111111111111` |
| `SPL_TOKEN_PROGRAM_ID` | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` |
| `TOKEN_2022_PROGRAM_ID` | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` |
| `METAPLEX_METADATA_PROGRAM_ID` | `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s` |
| `PUMP_PROGRAM_ID` | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` |
| `MEMO_MAX_BYTES` | `512` |
| `MAX_PREDICATES` | `8` |
| `LABEL_MAX_BYTES` | `48` |
| `KEY_MAX_BYTES` | `32` |
| `VALUE_MAX_BYTES` | `64` |

Claims are per cluster. A reader MUST read the same cluster the claim was published on and SHOULD show which cluster it reads.

---

## 3. Addresses

Two tag addresses are derived with the standard program-derived-address function (`findProgramAddress`: highest bump, off curve) under `MEMO_PROGRAM_ID`. Nobody holds a key for them, they never hold data, and anyone can recompute them.

```
CLAIM_MINT(mint) = findProgramAddress([utf8("datum/0"), mint (32 bytes)], MEMO_PROGRAM_ID)
FEED             = findProgramAddress([utf8("datum/0/feed")],             MEMO_PROGRAM_ID)
```

Reference values (computed twice, with `@solana/web3.js 1.99.0` and `@solana/kit 8.6.0`):

| Input | Address | Bump |
|---|---|---|
| `FEED` | `6LfGebjFQ5o9qNCQgcGF5HP5johg5MygapbSd2kNb3nK` | 250 |
| `CLAIM_MINT(EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)` | `GgLjUUhY3czLcwQuA6vUJpyZUQhe6P2FTTK7RpJZMR7X` | 255 |
| `CLAIM_MINT(2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo)` | `7rtdK5gMQBsE2qXrpet8pNzj8XFZiUZ5fUyUT7txrCG1` | 253 |
| `CLAIM_MINT(7p9vKmJgcGiFsPEEoPvVevREc4MGsKRVTh4n7FJPLwCm)` | `3D9SwUtqaW4mfj98RFG56BcQU3TA5ZbD4BJ5y5Viedqu` | 254 |
| `CLAIM_MINT(DatumExamp1eMintA11111111111111111111111111)` | `2jehgxCDDxf6YduDQnUVcj7MsLj5CGufsyWo6nW2vCrq` | 254 |

The mints in this table are reference inputs only. Listing them is not a claim about them.

---

## 4. The claim transaction

One claim is one successful transaction (`meta.err` is `null`) that contains:

1. **Exactly one** top-level instruction to `MEMO_PROGRAM_ID` whose data is a `datum/0` memo (section 5). It has no accounts. (The Memo program requires every account passed to it to be a signer, so the tags cannot go here.)
2. **Exactly one** top-level System Program `Transfer` (data: `u32` LE `2`, then `u64` LE `0`) whose accounts are exactly, in order:
   `[publisher (signer, writable), publisher, CLAIM_MINT(m), FEED]`
   where `m` is the mint named in the memo. Both tag accounts are read-only, not signers, and MUST be static account keys of the message (not loaded from an address lookup table).

The **publisher** is the fee payer, `accountKeys[0]`. Other signers are ignored.

Other instructions MAY be present (compute budget, guard instructions a wallet adds). Inner (CPI) instructions are ignored. A transaction that fails these rules is not a claim.

A publisher SHOULD set a compute unit limit from a simulation of the exact transaction. A 512-byte memo costs about 180,000 compute units in the Memo program (`DECISIONS.md` D-003).

---

## 5. Memo format

The memo is UTF-8 JSON in **canonical form**: the bytes MUST equal the canonical serialization of the parsed value. Canonical form is: no whitespace; top-level keys in the order `t`, `m`, `p`, `n`; predicate keys in the order `k`, `v`; strings with no escapes (the allowed characters never need one). Total length MUST be at most `MEMO_MAX_BYTES` bytes.

```
{"t":"datum/0","m":"<mint>","p":[{"k":"<key>"},{"k":"<key>","v":"<value>"}],"n":"<label>"}
```

| Field | Rule |
|---|---|
| `t` | Exactly `"datum/0"`. |
| `m` | Base58 that decodes to exactly 32 bytes and re-encodes to the same string (32 to 44 characters). |
| `p` | Array of 1 to 8 predicate objects. No two objects share the same `k`. |
| `p[].k` | `^[a-z][a-z0-9_]{0,31}$` |
| `p[].v` | Optional. `^[A-Za-z0-9._:-]{1,64}$`. Numbers are always decimal strings. |
| `n` | Optional label. `^[A-Za-z0-9 .,!?'-]{1,48}$`, not starting or ending with a space. No links, no HTML. |

No other top-level field is allowed. Values that are not strings (numbers, booleans, null, objects) are rejected.

For a **known** predicate (section 9), `v` MUST be present exactly when the predicate takes a value, and MUST match that predicate's value rule. Otherwise the whole memo is rejected.

An **unknown** `k` does not make the claim invalid. Its `v`, if present, still follows the general rule above. The reader shows it as "Not supported by this version".

A parser MUST return either a claim or a rejection reason, and MUST NOT throw on any input.

---

## 6. Reading claims

### 6.1 Per mint
1. `getSignaturesForAddress(CLAIM_MINT(mint), { limit ≤ 50, before?, commitment: "confirmed" })`, newest first.
2. Skip entries with `err` not null.
3. Pre-filter: skip entries whose `memo` field does not contain `"t":"datum/0"`. This field has the form `"[<len>] <text>"` and is only a filter, never a source of truth.
4. For each remaining signature: `getTransaction(sig, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" })`. Use `json`, not `jsonParsed`: the parsed System transfer hides the extra accounts.
5. Validate the transaction (section 4), parse the memo (section 5), and require `memo.m === mint`.
6. Stop after 10 valid claims per load; continue later with `before` set to the last signature read.

### 6.2 Feed
Same as 6.1 with `FEED` instead of `CLAIM_MINT(mint)`. Step 5 requires the transfer's third account to equal `CLAIM_MINT(memo.m)`. The feed is not a recommendation: anyone can publish.

### 6.3 Malformed memos
A transaction that passed the pre-filter but fails section 4 or 5 is a **malformed memo**. It is left out of every list and counted. The reader reports the count ("N malformed memos ignored").

---

## 7. Supersession and history

- Claims are grouped by `(publisher, mint)`.
- Order within a group: `slot` descending; within the same slot, the order returned by `getSignaturesForAddress` (newest first). `blockTime` is for display only, because it is an estimate and can be null.
- The newest claim in a group is **current**. Older claims stay visible as **Superseded**.
- A claim cannot be withdrawn. Publishing a new claim is the only way to replace it, and both stay public.
- Because reads go newest first, the claim that supersedes another is always loaded before it.

---

## 8. Evaluation model

### 8.1 Inputs (one snapshot per mint)
- The mint account (owner and raw data), or "not found", or a read error.
- The Metaplex metadata account at `findProgramAddress(["metadata", METAPLEX_METADATA_PROGRAM_ID, mint], METAPLEX_METADATA_PROGRAM_ID)`, or "not found", or a read error.
- Whether the mint's token program has an upgrade authority (read from the program account and its program data account).
- The pump.fun bonding curve at `findProgramAddress(["bonding-curve", mint], PUMP_PROGRAM_ID)`, used only for the signer relation.
- `slot` from the RPC response context and `observedAt`, the device time when the response arrived.

Supported token programs: `SPL_TOKEN_PROGRAM_ID` and `TOKEN_2022_PROGRAM_ID`. Token-2022 extensions are read from the TLV area after byte 166. In every optional pubkey field, 32 zero bytes mean none.

### 8.2 Result of one predicate
| Field | Meaning |
|---|---|
| `status` | `true`, `false`, `cannot_check`, or `unsupported` |
| `measured` | The value read now, as text (for example an address, `None`, or a decimal) |
| `limit` | The claim's value (`v`), if any |
| `slot`, `observedAt` | When it was measured |
| `accounts` | The accounts read, for explorer links |
| `stability` | `permanent` or `can_change`, with a one-sentence reason (section 11) |

| Status | Shown as | Used when |
|---|---|---|
| `true` | True now | The predicate holds on chain now. |
| `false` | Not true now | The predicate does not hold on chain now. |
| `cannot_check` | Cannot check right now | RPC failed or was rate limited, the account was not found, the owner is not a supported token program, the data could not be decoded, or the predicate cannot be read for this token (stated per predicate). |
| `unsupported` | Not supported by this version | The predicate key is unknown to this reader. |

`cannot_check` MUST NOT be merged with `false`.

### 8.3 Result of a claim
A claim's overall status is `false` if any predicate is `false`; otherwise `cannot_check` if any is `cannot_check`; otherwise `unsupported` if any is `unsupported`; otherwise `true`. A claim is "True now" only when every statement in it was checked and holds.

---

## 9. Predicate dictionary v0

Notation: `T22` means the mint is owned by `TOKEN_2022_PROGRAM_ID`. For a mint owned by `SPL_TOKEN_PROGRAM_ID`, every `t22_*` predicate evaluates to `true` with `measured = "Not a Token-2022 token"` and the note "SPL Token has no extensions"; this is never an error.

| Key | `v` | True now when | `measured` | Can't check when |
|---|---|---|---|---|
| `mint_authority_none` | none | Mint authority is none. | Authority address or `None` | |
| `freeze_authority_none` | none | Freeze authority is none. | Authority address or `None` | |
| `supply_max` | decimal `u64` (`^(0\|[1-9][0-9]{0,19})$`, at most 18446744073709551615) | Current raw supply ≤ `v`. | Raw supply (base units) | The mint has the `ConfidentialMintBurn` extension (part of the supply is not readable). |
| `decimals_eq` | `0` to `255` | Decimals equal `v`. | Decimals | |
| `token_program` | `spl-token` or `token-2022` | The mint's owner program matches. | `spl-token` or `token-2022` | |
| `metadata_immutable` | none | At least one metadata source exists and every source is fixed: Metaplex `isMutable = false`; T22 `TokenMetadata.updateAuthority` none; T22 `MetadataPointer.authority` none. No source at all is `false` ("No on-chain metadata found"). | Each source and its state | The metadata pointer names an account other than the mint itself or the Metaplex PDA; or the Metaplex account read failed. |
| `update_authority_eq` | address | Every metadata source has update authority equal to `v`. No source, or a none authority, is `false`. | Update authority per source | Same as above. |
| `t22_no_permanent_delegate` | none | T22: extension absent, or delegate none. | Delegate or `None` | |
| `t22_no_transfer_hook` | none | T22: extension absent, or hook program id none. | Hook program or `None` | |
| `t22_no_default_frozen` | none | T22: extension absent, or default state is not Frozen. | `Initialized`, `Frozen` or `None` | |
| `t22_transfer_fee_max_bps` | `0` to `10000` | T22: extension absent (fee 0), or the larger of the older and newer fee rates (basis points) ≤ `v`. The larger is used so that a scheduled change is never hidden. | Both rates and their epochs | |

There are no predicates about price, liquidity, reputation, ownership of wallets, or anything off chain.

---

## 10. Signer relation

Computed from the chain now and shown as is. A publisher can have several relations at once.

| Relation | When |
|---|---|
| Holds the mint authority | Mint authority = publisher. |
| Holds the freeze authority | Freeze authority = publisher. |
| Holds the metadata update authority | Metaplex `updateAuthority` or T22 `TokenMetadata.updateAuthority` = publisher. |
| Is the pump.fun creator of this coin | The bonding curve exists, is owned by `PUMP_PROGRAM_ID`, starts with discriminator `[23,183,248,55,96,216,172,96]`, and its `creator` field (bytes 49 to 81) = publisher. This field can change. |
| Authority revoked; cannot establish who signed | No relation above holds, and at least one relevant authority (mint, freeze, or update authority of an existing metadata source) is none. |
| Unrelated wallet | No relation above holds and every relevant authority exists. |

Only claims with one of the first four relations count as "From the token's authorities". All others are "From other wallets". The relation never says who owns a wallet.

---

## 11. Stability

A result is **Permanent** only when all of these hold at evaluation time; otherwise it is **Can change**, with a one-sentence reason.

- **P1** The property cannot change under the token program's current code (proofs: `DECISIONS.md` D-014).
- **P2** The token program has no upgrade authority (read live).
- **P3** The mint cannot be closed: always for SPL Token; for T22, no `MintCloseAuthority` extension or its authority is none.

| Key | Permanent when (in addition to P2 and P3) |
|---|---|
| `mint_authority_none`, `freeze_authority_none` | Result is `true`. |
| `supply_max` | Result is `true`, mint authority is none, and no `ConfidentialMintBurn`. Supply can then only fall. |
| `decimals_eq`, `token_program` | Always (either result). |
| `metadata_immutable`, `update_authority_eq` | Never in v0. |
| `t22_no_permanent_delegate` | Result is `true` (an absent extension cannot be added; a none delegate cannot be set). |
| `t22_no_transfer_hook` | Result is `true`, and the extension is absent or its authority is none. |
| `t22_no_default_frozen` | Result is `true`, and the extension is absent or the freeze authority is none. |
| `t22_transfer_fee_max_bps` | Result is `true`, and the extension is absent or its config authority is none. |

As of 2026-11-10 the Token-2022 program has an upgrade authority, so every result for a Token-2022 mint (including pump.fun coins) is "Can change", with the reason "Token-2022 can be upgraded by its upgrade authority; under its current code this cannot change."

---

## 12. Examples

### 12.1 Valid
The mint below is a made-up, valid address used only for examples.

```json
{"t":"datum/0","m":"DatumExamp1eMintA11111111111111111111111111","p":[{"k":"mint_authority_none"},{"k":"freeze_authority_none"}],"n":"Launch terms"}
```
148 bytes.

```json
{"t":"datum/0","m":"DatumExamp1eMintA11111111111111111111111111","p":[{"k":"mint_authority_none"},{"k":"freeze_authority_none"},{"k":"supply_max","v":"1000000000000000"},{"k":"token_program","v":"token-2022"},{"k":"t22_no_permanent_delegate"},{"k":"t22_no_transfer_hook"},{"k":"t22_transfer_fee_max_bps","v":"0"},{"k":"metadata_immutable"}],"n":"Fixed supply, no hooks, no fees."}
```
380 bytes.

```json
{"t":"datum/0","m":"DatumExamp1eMintA11111111111111111111111111","p":[{"k":"decimals_eq","v":"6"},{"k":"future_predicate","v":"42"}]}
```
133 bytes. Valid; `future_predicate` shows as "Not supported by this version", so the claim's overall status is `unsupported` unless `decimals_eq` is `false` or `cannot_check`.

The largest valid v0 claim with known predicates is 459 bytes.

### 12.2 Rejected (each MUST be rejected without throwing)
| Memo (shortened) | Reason |
|---|---|
| `{"t": "datum/0",…}` | Not canonical (whitespace). |
| `{"m":"…","t":"datum/0",…}` | Not canonical (key order). |
| `{…,"p":[…],"x":1}` | Unknown top-level field. |
| `{"t":"datum/1",…}` | Wrong schema. |
| `{…,"m":"DatumExamp1eMintA1111111111111111111111111111",…}` | Decodes to 33 bytes, not 32. |
| `{…,"m":"DatumExamp1eMintA1111111111111111111111111",…}` | Decodes to 31 bytes, not 32. |
| `{…,"m":"DatumExamp1eMint0…",…}` | Not base58 (`0` is not in the alphabet). |
| `{…,"p":[]}` | No predicates. |
| nine predicate objects | More than 8 predicates. |
| two objects with `"k":"supply_max"` | Duplicate key. |
| `{"k":"supply_max","v":"1e9"}` | Value is not a decimal. |
| `{"k":"supply_max","v":1000}` | Value is not a string. |
| `{"k":"mint_authority_none","v":"1"}` | Known predicate takes no value. |
| `{"k":"decimals_eq","v":"256"}` | Out of range. |
| `"n":"<b>hi</b>"` | Label has forbidden characters. |
| `"n":" padded"` | Label starts with a space. |
| any memo over 512 bytes | Too long. |

---

## 13. Not in v0

- `top_holders_max_pct`: `getTokenLargestAccounts` is disabled or rate limited on free RPC (`DECISIONS.md` D-008), and its result lists token accounts, which may be pools or exchanges, not people.
- Predicates for `PausableConfig`, `PermissionedBurn`, `ScaledUiAmountConfig`, `InterestBearingConfig`, `NonTransferable`, confidential transfer, and token groups. These extensions are shown as on-chain facts only.
- Any history of when a claim was first false.
- Off-chain statements (for example "the team will not sell"). They cannot be checked on chain, so Datum does not accept them.
- Withdrawal of claims.

---

## 14. Versioning

`datum/0` is frozen once published on mainnet. A future version uses a new `t` and new seeds (for example `datum/1`), so old readers ignore it and old claims keep their meaning. New predicate keys MAY be added under `datum/0`; old readers show them as "Not supported by this version".

---

## 15. Minimal reader (outline)

```ts
// Inputs: rpc(method, params) -> result; base58 encode/decode; findProgramAddress.
const MEMO = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const SYSTEM = '11111111111111111111111111111111';

async function readClaims(mint: string, before?: string) {
  const tag = findProgramAddress([utf8('datum/0'), base58decode(mint)], MEMO);
  const feed = findProgramAddress([utf8('datum/0/feed')], MEMO);
  const sigs = await rpc('getSignaturesForAddress', [tag, { limit: 50, before, commitment: 'confirmed' }]);
  const claims = []; let malformed = 0;
  for (const s of sigs) {
    if (s.err || !s.memo?.includes('"t":"datum/0"')) continue;
    const tx = await rpc('getTransaction', [s.signature, { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]);
    if (!tx || tx.meta.err) continue;
    const keys = tx.transaction.message.accountKeys;          // static keys only
    const top = tx.transaction.message.instructions;
    const memos = top.filter(ix => keys[ix.programIdIndex] === MEMO)
                     .map(ix => base58decode(ix.data))
                     .filter(b => startsWith(b, '{"t":"datum/0"'));
    const claim = memos.length === 1 ? parseStrict(memos[0]) : null; // section 5; never throws
    const transfers = top.filter(ix => keys[ix.programIdIndex] === SYSTEM
      && isZeroTransfer(ix.data)                               // u32 LE 2, u64 LE 0
      && ix.accounts.length === 4 && ix.accounts.every(i => i < keys.length)
      && keys[ix.accounts[0]] === keys[0] && keys[ix.accounts[1]] === keys[0]
      && keys[ix.accounts[2]] === tag && keys[ix.accounts[3]] === feed);
    if (!claim || claim.m !== mint || transfers.length !== 1) { malformed++; continue; }
    claims.push({ ...claim, publisher: keys[0], signature: s.signature, slot: tx.slot, blockTime: tx.blockTime });
    if (claims.length === 10) break;
  }
  return { claims, malformed, next: sigs.at(-1)?.signature };
}
```
