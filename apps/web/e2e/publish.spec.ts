import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PYUSD, WALLET_ADDRESS, installFakeWallet, mock } from "./helpers";

test.beforeEach(async ({ page }) => mock(page, "clear"));

async function fillClaim(page: Page) {
  await page.goto(`/publish?m=${PYUSD}`);
  await page.getByLabel("No transfer hook").check();
  await page.getByLabel("Transfer fee is at most").check();
  await page.getByLabel("Transfer fee is at most: value").fill("0");
  await page.getByLabel("Label (optional)").fill("My checks");
  await page.getByRole("button", { name: "Next: wallet and check" }).click();
}
/** Connects the fake wallet and confirms the one-time notice, the way a first-time publisher would. */
async function connect(page: Page) {
  await page.getByRole("button", { name: "Connect Fake Wallet" }).click();
  await expect(page.getByText("Connected with Fake Wallet")).toBeVisible();
  await page.getByLabel("I have read this.").check();
}
const sent = async (page: Page) => (await (await page.request.get("/__mock/sent/")).json()) as string[];

test("no wallet: a plain message and publishing stays off", async ({ page }) => {
  await fillClaim(page);
  await expect(page.getByText("No Solana wallet was found in this browser.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Review and check the fee" })).toBeDisabled();
});

test("the memo preview shows the exact bytes and limit", async ({ page }) => {
  await fillClaim(page);
  await expect(page.locator(".memo__text")).toContainText(`{"t":"datum/0","m":"${PYUSD}","p":[{"k":"t22_no_transfer_hook"},{"k":"t22_transfer_fee_max_bps","v":"0"}],"n":"My checks"}`);
  await expect(page.getByText(/Largest allowed 512 bytes/)).toBeVisible();
});

test("a full publish: fee shown, wallet signs, signed bytes checked, sent once, claim appears", async ({ page }) => {
  await installFakeWallet(page);
  await fillClaim(page);
  await expect(page.getByText("Would be true now").first()).toBeVisible();
  await connect(page);
  await page.getByRole("button", { name: "Review and check the fee" }).click();
  await expect(page.getByRole("heading", { name: "Review", exact: true })).toBeVisible();
  await expect(page.getByText("This will stay public on Solana.")).toBeVisible();
  await expect(page.locator(".relation")).toContainText("Unrelated wallet");
  await expect(page.getByText(/SOL/).first()).toBeVisible();
  await expect(page.getByText(/5,000 lamports per signature/)).toBeVisible();
  // The wallet is not called before the person confirms.
  expect(await page.evaluate(() => (window as unknown as { __signCalls?: number }).__signCalls ?? 0)).toBe(0);
  const go = page.getByRole("button", { name: "Sign in my wallet" });
  await expect(go).toBeDisabled();
  await page.getByLabel(/I understand this claim will be public/).check();
  await go.click();
  await expect(page.getByText(/Confirmed in slot/)).toBeVisible({ timeout: 15_000 });
  expect(await sent(page)).toHaveLength(1);
  await page.getByRole("link", { name: "Open the token page" }).click();
  await expect(page.locator(".verdict")).toBeVisible();
  // A wallet with no authority over the token lands under "From other wallets", which is collapsed.
  const others = page.locator("details.others");
  await others.locator("summary").click();
  await expect(others.getByText("My checks")).toBeVisible();
  await expect(others.getByText("Unrelated wallet").first()).toBeVisible();
});

test("a refusal in the wallet sends nothing", async ({ page }) => {
  await installFakeWallet(page, "reject");
  await fillClaim(page);
  await connect(page);
  await page.getByRole("button", { name: "Review and check the fee" }).click();
  await page.getByLabel(/I understand/).check();
  await page.getByRole("button", { name: "Sign in my wallet" }).click();
  await expect(page.getByText("You closed the wallet request. Nothing was signed.")).toBeVisible();
  expect(await sent(page)).toHaveLength(0);
});

test("a wallet that changes the memo is caught before anything is sent", async ({ page }) => {
  await installFakeWallet(page, "tamper");
  await fillClaim(page);
  await connect(page);
  await page.getByRole("button", { name: "Review and check the fee" }).click();
  await page.getByLabel(/I understand/).check();
  await page.getByRole("button", { name: "Sign in my wallet" }).click();
  await expect(page.getByText(/not the claim that was shown|different from the one shown/)).toBeVisible();
  expect(await sent(page)).toHaveLength(0);
});

test("a failed simulation stops before the wallet is asked", async ({ page }) => {
  await installFakeWallet(page);
  await mock(page, "simerror", "AccountNotFound");
  await fillClaim(page);
  await connect(page);
  await page.getByRole("button", { name: "Review and check the fee" }).click();
  await expect(page.getByText(/does not have enough SOL/)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __signCalls?: number }).__signCalls ?? 0)).toBe(0);
});

test("a blocked region cannot publish but the message is plain", async ({ page }) => {
  await installFakeWallet(page);
  await mock(page, "blocked", "1");
  await fillClaim(page);
  await page.getByRole("button", { name: "Connect Fake Wallet" }).click();
  await expect(page.getByText("Publishing is not available in your region.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Review and check the fee" })).toBeDisabled();
});

test("a transaction that is sent but not yet seen says so and does not invite a second publish", async ({ page }) => {
  await installFakeWallet(page);
  await mock(page, "hold");
  await fillClaim(page);
  await connect(page);
  await page.getByRole("button", { name: "Review and check the fee" }).click();
  await page.getByLabel(/I understand/).check();
  await page.getByRole("button", { name: "Sign in my wallet" }).click();
  await expect(page.getByText(/Not confirmed yet. Do not publish again/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Check again" })).toBeVisible();
  expect(await sent(page)).toHaveLength(1);
  expect(WALLET_ADDRESS).toBeTruthy();
});

test("axe finds nothing on the publish page", async ({ page }) => {
  await installFakeWallet(page);
  await fillClaim(page);
  await page.getByRole("button", { name: "Connect Fake Wallet" }).click();
  await expect(page.getByText("Connected with Fake Wallet")).toBeVisible();
  const r = await new AxeBuilder({ page }).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test("three steps with a progress indicator; Back keeps every input", async ({ page }) => {
  await installFakeWallet(page);
  await fillClaim(page);
  await expect(page.getByRole("list", { name: "Publishing progress" }).locator('[aria-current="step"]')).toContainText("Wallet and check");
  await connect(page);
  await page.getByRole("button", { name: "Review and check the fee" }).click();
  await expect(page.getByRole("heading", { name: "Review", exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Publishing progress" }).locator('[aria-current="step"]')).toContainText("Review and sign");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Label (optional)")).toHaveValue("My checks");
  await expect(page.getByLabel("Transfer fee is at most: value")).toHaveValue("0");
  await expect(page.getByLabel("No transfer hook")).toBeChecked();
});

test("a statement that is not true now: hard warning and a separate checkbox before signing", async ({ page }) => {
  await installFakeWallet(page);
  await page.goto(`/publish?m=${PYUSD}`);
  await page.getByLabel("Decimals equal a value").check();
  await page.getByLabel("Decimals equal a value: value").fill("5");
  await page.getByRole("button", { name: "Next: wallet and check" }).click();
  await expect(page.getByText("Would not be true now").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "One statement is not true now" })).toBeVisible();
  await connect(page);
  await page.getByRole("button", { name: "Review and check the fee" }).click();
  await expect(page.getByRole("heading", { name: "Review", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "One statement is not true now" })).toBeVisible();
  const go = page.getByRole("button", { name: "Sign in my wallet" });
  await page.getByLabel("I understand this claim will be public and cannot be withdrawn.").check();
  await expect(go).toBeDisabled();
  await page.getByLabel("I understand this claim will show as Not true now.").check();
  await expect(go).toBeEnabled();
  expect(await page.evaluate(() => (window as unknown as { __signCalls?: number }).__signCalls ?? 0)).toBe(0);
});

test("the one-time risk notice is shown before the first claim and not again after it", async ({ page }) => {
  await installFakeWallet(page);
  await fillClaim(page);
  await expect(page.getByRole("heading", { name: "Before your first claim" })).toBeVisible();
  await connect(page);
  await page.getByRole("button", { name: "Review and check the fee" }).click();
  await page.getByLabel(/I understand this claim will be public/).check();
  await page.getByRole("button", { name: "Sign in my wallet" }).click();
  await expect(page.getByText(/Confirmed in slot/)).toBeVisible({ timeout: 15_000 });
  await fillClaim(page);
  await expect(page.getByRole("heading", { name: "Would these statements be true now?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Before your first claim" })).toHaveCount(0);
});
