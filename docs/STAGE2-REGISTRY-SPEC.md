# Datum claim registry — Stage 2 specification

Status: **specification only.** Nothing in this file has been built or run. Rust, the Solana CLI and Anchor are not installed in the build environment, and this project does not install them on its own (see docs/DECISIONS.md). The registry targets localnet and devnet. Mainnet needs an independent audit and an explicit decision by the owner.

Stage 1 (`datum/0`, docs/SPEC.md) publishes claims as Memo transactions and reads them back through transaction history. Stage 2 is an optional on-chain program that keeps the **current claim of each publisher for each token in one account**, so that reading it takes `getAccountInfo` instead of walking history, and so that the list of claims for a token cannot be flooded by strangers.

Words used here are the ones used in SPEC.md: mint, publisher, claim, memo, predicate, supersede.

---

## 1. Goals and non-goals

Goals
1. Read the current claim of a known publisher for a mint with one account read.
2. Read "claims from the token's authorities" with **one** `getMultipleAccounts` call and no history walk, and make that read immune to spam by construction (section 6).
3. Keep the claim bytes identical to a `datum/0` memo, so the existing strict parser, evaluator, signer-relation and stability rules apply unchanged.
4. Hold no user funds. The only lamports the program ever holds are the rent of its own claim accounts.

Non-goals
- No tokens, no fees to Datum, no admin withdrawal, no allow-list, no ranking, no scoring.
- No new predicates. The dictionary stays in SPEC.md section 9.
- No history. The chain's transaction history is the history; the account holds only the latest claim of each (mint, publisher).

---

## 2. Program

One Anchor program, working name `datum_registry`.

- Program ID: **not chosen.** It is generated when the program is first built (`anchor keys`). No address is written into this document or into the web app until then.
- Dependencies: Anchor, `bs58` for the mint check in section 4.1. No other program is called except the System program (account creation).
- Upgrade authority: on devnet it is held by the owner's own key. For mainnet the options are in section 9 and are the owner's decision.

---

## 3. Accounts

### 3.1 `Claim` (program-owned, one per mint and publisher)

PDA seeds: `["claim", mint (32 bytes), publisher (32 bytes)]`.

| Field | Type | Meaning |
|---|---|---|
| discriminator | 8 bytes | Anchor account discriminator |
| version | u8 | `0` for this layout |
| bump | u8 | canonical bump |
| mint | Pubkey | the token the claim is about |
| publisher | Pubkey | the wallet that signed; equals the seed |
| slot | u64 | `Clock::slot` of the last write |
| writes | u32 | number of times this account has been written (1 on creation) |
| memo_len | u16 | length of the memo in bytes, 1..=512 |
| memo | [u8; 512] | the `datum/0` memo, zero-padded after `memo_len` |

Size: 8 + 1 + 1 + 32 + 32 + 8 + 4 + 2 + 512 = **600 bytes**, fixed. A fixed size gives a fixed, predictable cost and avoids `realloc`.

Rent: the rent-exempt minimum is `(128 + 600) × 6,960 = 5,066,880` lamports (about 0.0051 SOL) at the cluster's default rent constants. These constants are an assumption of this document: the implementation must read `getMinimumBalanceForRentExemption(600)` from the cluster and show that figure to the publisher before signing, as Stage 1 does for the network fee. The publisher pays the rent when the account is created. It is not a fee: it stays in the account.

### 3.2 No other accounts in v1

There is no global config account, no admin account, no counter and no index. Every extra account would be something to attack or to administer.

---

## 4. Instructions

### 4.1 `publish_claim(memo: Vec<u8>)`

Accounts: `publisher` (signer, writable, pays), `mint` (read-only, any account address; **not** required to be a mint, see below), `claim` (writable, the PDA of 3.1, created if missing), `system_program`.

Checks, in this order. Any failure aborts with a distinct error code and changes nothing.
1. `publisher` is a signer.
2. `claim` is the PDA derived from `["claim", mint, publisher]` with the stored bump.
3. `1 ≤ memo.len() ≤ 512`.
4. `memo` starts with exactly `{"t":"datum/0","m":"` followed by the base58 text of `mint`, followed by `","p":[`. This ties the stored claim to the account it is filed under. The program does **not** parse the rest. Full strict parsing stays in the reader (SPEC section 5), exactly as in Stage 1, where the chain never validated memos either.
5. Every byte of `memo` is in `0x20..=0x7E`. Canonical memos are plain ASCII (SPEC section 5), so this rejects control bytes and invalid UTF-8 cheaply.

Effects: create the account if it does not exist (publisher pays rent), set `version`, `bump`, `mint`, `publisher`; set `slot` to the current slot; increment `writes`; copy the memo; zero-pad. Emit the event in 4.2.

Why `mint` is not required to be a mint: the program has no reason to read token program accounts, and Stage 1 already allows claims about addresses that are not mints (the reader shows "Cannot check right now"). Not reading it keeps the instruction small and independent of Token-2022 layout changes.

Overwriting is the only update path. The previous memo is lost from the account, and remains in the transaction that wrote it.

### 4.2 Event `ClaimPublished`

Fields: `mint`, `publisher`, `slot`, `writes`, and the memo bytes. Emitted with Anchor's `emit_cpi!` (self-invocation that appears in the transaction's inner instructions) rather than `emit!` (program log), because logs can be truncated and must not be the only record.

### 4.3 What is deliberately missing: `close_claim`

Stage 1 says a claim cannot be withdrawn, and the site says so before the first claim. A close instruction would let a publisher remove the current claim and take the rent back, which is a withdrawal in everything but name, and it would make the cost of spam recoverable. **v1 has no close instruction.** The rent of a claim account therefore stays locked, which is also what makes spam cost something. This is a trade-off for the owner (section 9, decision 3).

---

## 5. Instruction data and size limits

- Memo: at most 512 bytes (same as `MEMO_MAX_BYTES`).
- Transaction: one compute-budget pair (limit and price, as in Stage 1) plus `publish_claim` and the account-creation inner call. The transaction is well below 1,232 bytes. The size and the compute units are **to be measured on localnet**; this document gives no number for them.
- No instruction takes a length-prefixed list other than `memo`.

---

## 6. Reading

### 6.1 Claims from a token's authorities (the main path)

The web app already knows who the token's authorities are from the snapshot it reads (mint authority, freeze authority, metadata update authority, pump.fun creator). For each of at most four such publishers it derives the `Claim` PDA and reads all of them with **one** `getMultipleAccounts`. No history is walked and nothing a stranger does can add rows to this list, because a stranger's account is at a different address.

This is the answer to "claims from the token's authorities" on the token page, and it needs no indexer.

### 6.2 A known publisher

`getAccountInfo(PDA(["claim", mint, publisher]))`. Used by Publish to show "you already have a claim for this token; publishing replaces it".

### 6.3 Claims from other wallets

There is no address to ask for without knowing the publisher, and the web relay does not allow `getProgramAccounts`. Two options, both optional:
- Keep reading the Stage 1 tag history for "From other wallets" (the registry program can also write the Stage 1 memo, see 7).
- Use an indexer or a provider that offers a filtered program-accounts read (memcmp on `mint` at offset 10). This would be a separate, owner-approved dependency and is **not** part of this specification.

### 6.4 Feed

The `ClaimPublished` events give a feed through `getSignaturesForAddress` on the program ID. It is still open to spam, as in Stage 1; the cost of a spam entry is now the rent of a new account for every new (mint, publisher) pair, but updates of an existing pair are cheap. Treat it as best-effort, as the Recent page already says.

---

## 7. Compatibility with datum/0

- The stored memo is a valid `datum/0` memo. The same `parseMemo` and the same evaluator are used. The result labels, stability rules and signer relations do not change.
- Provenance is part of what the reader shows. A result must say whether the claim was read from the registry account (and at which slot) or from a Memo transaction. Registry claims are overwritten in place, so "superseded" is replaced by "replaced" for them: the old memo is only in history.
- A publisher may have both a Stage 1 memo claim and a registry claim. The newer slot wins, as in SPEC section 7, and the older stays visible as superseded.
- Optional, to be decided with the owner: the instruction may also invoke the Memo program with the same bytes, so that Stage 1 readers and the feed see registry claims without any change. This costs compute units and one more account in the instruction, and is not required by anything above.

---

## 8. Security considerations

- **Authority over writes.** Only the publisher can create or replace the account at its own PDA. The PDA seeds contain the publisher and the signer check ties them together. No admin path exists.
- **PDA canonicalisation.** Store and check the canonical bump. Reject an account whose address does not match.
- **Memo content.** The program checks shape, not truth. A claim can say anything that fits the prefix, as in Stage 1. The reader remains the only place where a claim is judged against the chain.
- **Rent and lamports.** The program never transfers lamports except the rent it receives on creation. There is no instruction that sends lamports anywhere.
- **Re-initialisation.** Writing to an existing account must not reset `writes` or re-run creation. Use `init_if_needed` only with explicit checks on owner, size and discriminator, or split creation and update inside one instruction handler.
- **Upgrade authority.** A program with an upgrade authority can be changed by its holder. Readers must keep treating registry claims as "Can change" in the stability labels, exactly as they do for Token-2022 today, unless and until the program is made immutable and that is verified live.
- **Denial of service by filling the feed.** Not preventable on chain without an allow-list, which this project does not want. Mitigated by 6.1 (authority claims never share a list with strangers) and by the rent cost.
- **No oracle, no off-chain input, no CPI to other programs** other than System. The attack surface is the checks in 4.1.

---

## 9. Decisions for the owner

1. **Registry or Memo only.** Stage 1 works without any program. The registry adds a read path and spam resistance for the authority list, at the cost of a program to maintain, audit and pay rent for.
2. **Upgrade authority policy** (devnet: owner key; mainnet: immutable, multisig, or an owner key). Each choice changes what the stability label may say.
3. **`close_claim` or not** (section 4.3). Not having it keeps "cannot be withdrawn" true and makes spam cost something; having it returns the rent.
4. **Write the Memo too** (section 7, last point).
5. **Audit.** Required before any mainnet deployment. Who performs it and at what cost is outside this document.

---

## 10. Test plan

Everything below runs on localnet first, then devnet. Nothing is broadcast to mainnet.

Program tests (Anchor test framework or a program-test harness):
- Create: first write creates the account, sets all fields, `writes = 1`, emits one event.
- Replace: second write by the same publisher overwrites the memo, increases `writes`, keeps `bump`.
- Wrong signer: a different wallet cannot write to someone else's PDA (the derived address differs, so the instruction fails the seed check).
- Wrong PDA: a client-supplied account that is not the derived address is rejected.
- Memo checks: empty memo; 513 bytes; 512 bytes exactly (accepted); prefix with a different mint; prefix with extra whitespace; non-ASCII and control bytes; truncated prefix.
- Re-initialisation: a replace must not reset `writes`, `bump` or `mint`.
- Rent: the account is rent-exempt after creation; the lamports equal `getMinimumBalanceForRentExemption(600)`.
- Fuzz: random memos and random account lists never panic and never change state on failure.

Compatibility tests:
- Every valid example in SPEC section 12.1, written to the registry and read back, passes the same `parseMemo` as the site uses; every rejected example from 12.2 that passes the program's shallow checks is still rejected by the reader.
- The reader's address derivation for `["claim", mint, publisher]` matches an independently computed value.

Web tests (mock RPC, no network):
- `getMultipleAccounts` for up to four authority PDAs: found, missing, wrong owner, wrong size, undecodable.
- Provenance is shown; a registry claim and a Memo claim for the same publisher and mint resolve by slot.
- An RPC failure is "Cannot check right now", never "Not true now".

Measurements to record in docs/DECISIONS.md once the toolchain exists: transaction size, compute units for create and replace, rent per account, and whether the free RPC tiers answer `getMultipleAccounts` for program-owned accounts without extra limits.

---

## 11. What is not done

No code, no program ID, no deployment, no measurement. The numbers marked "to be measured" are unknown on purpose.
