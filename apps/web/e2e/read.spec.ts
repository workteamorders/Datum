import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { claimMintTag } from "@datum/protocol";
import { BONK, BROKEN, MISSING, USDC, mock } from "./helpers";

test.beforeEach(async ({ page }) => mock(page, "clear"));

test("a bad address is refused before leaving the lookup", async ({ page }) => {
  await page.goto("/t");
  await page.getByLabel("Token address").fill("not-an-address");
  await page.getByRole("button", { name: "Look up" }).click();
  await expect(page.locator(".field-error")).toContainText("does not look like a token address");
  await expect(page).toHaveURL(/\/t$/);
});

test("lookup leads to the token page", async ({ page }) => {
  await page.goto("/t");
  await page.getByLabel("Token address").fill(USDC);
  await page.getByRole("button", { name: "Look up" }).click();
  await expect(page.getByRole("heading", { level: 2, name: /claims? by this token’s authorities (is|are) true now/ })).toBeVisible();
});

test("token page: verdict, facts, groups and the fixed line", async ({ page }) => {
  await page.goto(`/t?m=${USDC}`);
  await expect(page.getByRole("heading", { name: "1 of 1 claim by this token’s authorities is true now." })).toBeVisible();
  await expect(page.getByText("Solana mainnet")).toBeVisible();
  await expect(page.getByRole("heading", { name: "On the chain now" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "From the token’s authorities" })).toBeVisible();
  await expect(page.getByText("Holds the mint authority")).toBeVisible();
  // Only the authority's claim is counted. The other wallets' claims are collapsed until asked for.
  await expect(page.locator(".verdict__counts")).toContainText("1 true now");
  await expect(page.locator(".verdict__counts")).not.toContainText("not true now");
  const others = page.locator("details.others");
  await expect(others.locator("summary")).toHaveText("From other wallets (2)");
  await expect(page.getByText("Hopeful")).toBeHidden();
  await others.locator("summary").click();
  await expect(others).toContainText("Anyone can publish a claim about any token");
  await expect(others.getByText("Hopeful")).toBeVisible();
  await expect(others.locator(".verdict__counts")).toHaveCount(0);
  await expect(others).toContainText("Not true now");
  await expect(others).toContainText("Not supported by this version");
  await expect(page.getByRole("heading", { name: "What this does not tell you" })).toBeVisible();
  await expect(page.locator(".not-told")).toContainText("It does not tell you whether a token is a good idea, who is behind it, whether liquidity can be pulled, how much a few wallets hold, or whether a claim was made in good faith.");
});

test("evidence drawer shows what was read, the slot and the memo", async ({ page }) => {
  await page.goto(`/t?m=${USDC}`);
  const first = page.locator(".claim").first();
  await first.getByRole("button", { name: "Show evidence" }).click();
  await expect(first.getByRole("region", { name: "Evidence" })).toContainText("Mint account");
  await expect(first.getByRole("region", { name: "Evidence" })).toContainText("Measured at");
  await expect(first.getByRole("region", { name: "Evidence" })).toContainText("How it is checked");
  await first.getByText("Memo as published").click();
  await expect(first.locator(".drawer__memo pre")).toContainText('"t":"datum/0"');
  await first.getByRole("button", { name: "Hide evidence" }).click();
  await expect(first.getByRole("region", { name: "Evidence" })).toHaveCount(0);
});

test("ten claims per load, load more, superseded and malformed are reported", async ({ page }) => {
  await page.goto(`/t?m=${BONK}`);
  await expect(page.locator(".verdict")).toBeVisible();
  await expect(page.getByText("malformed")).toHaveCount(0);
  await page.getByRole("button", { name: "Load more claims" }).click();
  await expect(page.getByText("1 malformed memo ignored.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Load more claims" })).toHaveCount(0);
  await expect(page.getByText(/Superseded claims \(\d+\)/)).toBeVisible();
});

test("an unreadable token is not shown as 'no claims'", async ({ page }) => {
  await page.goto(`/t?m=${BROKEN}`);
  await expect(page.getByRole("heading", { name: "Could not read this token" })).toBeVisible();
  await expect(page.getByText("No claims published")).toHaveCount(0);
  await expect(page.getByText("This does not mean the token is missing or that any claim is false.")).toBeVisible();
});

test("a missing mint says so and nothing is true or false", async ({ page }) => {
  await page.goto(`/t?m=${MISSING}`);
  await expect(page.getByText("could not be read as an SPL Token or Token-2022 mint")).toBeVisible();
  await expect(page.getByText("No claims from this token’s authorities yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Publish a claim about/ })).toBeVisible();
});

test("evidence opens as a bottom sheet on a phone: Escape closes it and focus returns", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(`/t?m=${USDC}`);
  const button = page.locator(".claim").first().getByRole("button", { name: "Show evidence" });
  await button.click();
  const sheet = page.getByRole("dialog", { name: "Evidence" });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("How it is checked");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(button).toBeFocused();
});

test("on a phone the links are in a Menu sheet that holds focus and closes on Escape", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Main", exact: true })).toBeHidden();
  const menu = page.getByRole("button", { name: "Menu" });
  await menu.click();
  const sheet = page.getByRole("dialog", { name: "Menu" });
  await expect(sheet.getByRole("link", { name: "Publish" })).toBeVisible();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(menu).toBeFocused();
  await menu.click();
  await sheet.getByRole("link", { name: "Recent" }).click();
  await expect(page).toHaveURL(/\/recent/);
  await expect(sheet).toBeHidden();
});

test("since your last visit: nothing on the first visit, changes on the next", async ({ page }) => {
  await page.goto(`/t?m=${USDC}`);
  await expect(page.locator(".verdict")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Since your last visit" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Since your last visit" })).toBeVisible();
  await expect(page.getByText("Nothing changed in the claims shown below.")).toBeVisible();
  // Pretend the last visit saw every statement as not true: the next read reports what changed.
  await page.evaluate((m) => {
    const k = `datum.visit.v0.mainnet.${m}`;
    const rec = JSON.parse(localStorage.getItem(k) as string) as { rows: Record<string, string> };
    for (const id of Object.keys(rec.rows)) rec.rows[id] = "false";
    localStorage.setItem(k, JSON.stringify(rec));
  }, USDC);
  await page.reload();
  await expect(page.locator(".since__list")).toContainText("was Not true now, now True now");
});

test("without local storage the page works and 'Since your last visit' stays hidden", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("blocked", "SecurityError"); } });
  });
  await page.goto(`/t?m=${USDC}`);
  await expect(page.locator(".verdict")).toBeVisible();
  await page.reload();
  await expect(page.locator(".verdict")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Since your last visit" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("recent: each row is checked live, newest first, with no ranking", async ({ page }) => {
  await page.goto("/recent");
  const first = page.locator(".feed__item").first();
  await expect(first).toBeVisible();
  await expect(first.locator(".status-mark__label").first()).toBeVisible({ timeout: 10_000 });
  await expect(first).toContainText("Measured at slot");
  const text = (await page.locator("main").innerText()).toLowerCase();
  for (const w of ["trending", "top ", "best", "popular"]) expect(text).not.toContain(w);
  await expect(page.getByText("It is not ranked")).toBeVisible();
});

test("home shows a labelled example and never presents it as a real claim", async ({ page }) => {
  await page.goto("/");
  const ex = page.locator(".example");
  await expect(ex.getByText("EXAMPLE", { exact: true })).toBeVisible();
  await expect(ex).toContainText("Invented for this page");
});

test("spec page: code blocks can be copied", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
  await page.goto("/spec");
  await expect(page.getByRole("button", { name: "Copy code" }).first()).toBeVisible();
  const copy = page.locator(".codeblock__copy").first(); // the label changes after the click, so do not find it by label
  await copy.click();
  await expect(copy).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).not.toBe("");
});

test("a failed claim history is not 'no claims'", async ({ page }) => {
  await mock(page, "failhistory", await claimMintTag(USDC));
  await page.goto(`/t?m=${USDC}`);
  await expect(page.getByRole("heading", { name: "Published claims could not be loaded" })).toBeVisible();
  await expect(page.getByText("No claims published")).toHaveCount(0);
  await expect(page.locator(".verdict")).toHaveCount(0);
  await expect(page.getByText("This is not the same as “no claims”.")).toBeVisible();
});

test("a non-mainnet cluster is labelled", async ({ page }) => {
  await mock(page, "cluster", "devnet");
  await page.goto(`/t?m=${USDC}`);
  await expect(page.getByText("Solana devnet")).toBeVisible();
  await expect(page.getByText("This is not Solana mainnet.")).toBeVisible();
});

test("no page shows a banned word", async ({ page }) => {
  await page.goto(`/t?m=${BONK}`);
  await expect(page.locator(".verdict")).toBeVisible();
  const text = (await page.locator("main").innerText()).toLowerCase();
  for (const w of ["safe", "verified", "secure", "trusted", "audited", "legit", "rug-proof", "guaranteed", "score"]) expect(text).not.toContain(w);
});

for (const [name, path] of [["token", `/t?m=${USDC}`], ["home", "/"]] as const) {
  test(`axe finds nothing on ${name}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
}
