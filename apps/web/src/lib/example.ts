// One invented claim for the Home page. It is labelled EXAMPLE wherever it is shown and is never mixed with real results.
import { buildMemo } from "./memo";
import { describePredicate, formulaOf } from "./predicates";
import { rulerProps } from "./readings";
import type { ClaimGroup } from "./token-view";

export const EXAMPLE_MINT = "DatumExamp1eMintA11111111111111111111111111";
const PUBLISHER = "7p9vKmJgcGiFsPEEoPvVevREc4MGsKRVTh4n7FJPLwCm";
const SIGNATURE = "ExampLe1SignaTure1111111111111111111111111111111111111111111111111111111111111111";
const memo = buildMemo(EXAMPLE_MINT, [{ k: "mint_authority_none" }, { k: "supply_max", v: "1000000000" }], "Launch terms");

const base = { publisher: PUBLISHER, claimSlot: 467_800_112, signature: SIGNATURE, memo, label: "Launch terms", measuredSlot: 467_813_648, measuredAge: "12 s ago", relations: ["mint_authority" as const], accounts: [{ name: "Mint account", address: EXAMPLE_MINT }] };

export const EXAMPLE_GROUP: ClaimGroup = {
  signature: SIGNATURE,
  publisher: PUBLISHER,
  claimSlot: 467_800_112,
  label: "Launch terms",
  memo,
  status: "false",
  relations: ["mint_authority"],
  current: true,
  rows: [
    {
      ...base,
      id: "ex:0",
      status: "false",
      statement: describePredicate("mint_authority_none"),
      formula: formulaOf("mint_authority_none"),
      measured: "Mint authority: 7p9v…PLwCm.",
      stability: "can_change",
      stabilityReason: "A mint authority exists and can change the supply.",
    },
    {
      ...base,
      id: "ex:1",
      status: "true",
      statement: describePredicate("supply_max", "1000000000"),
      formula: formulaOf("supply_max", "1000000000"),
      measured: "Raw supply: 812,400,000 base units.",
      stability: "can_change",
      stabilityReason: "Supply can change while a mint authority exists.",
      ruler: rulerProps({ limit: 1_000_000_000n, now: 812_400_000n, unit: "base units", what: "Supply" }),
    },
  ],
};
