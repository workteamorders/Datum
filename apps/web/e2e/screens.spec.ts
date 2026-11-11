import { test, type Page } from "@playwright/test";
import { BONK, BROKEN, PYUSD, USDC, installFakeWallet, mock } from "./helpers";

// Screenshots for docs/screens. Run with SCREENS=1 (they are not part of the normal run).
test.skip(!process.env.SCREENS, "set SCREENS=1");
const OUT = process.env.SCREENS_OUT ?? "../../docs/screens";
const widths = [360, 768, 1440];

async function shoot(page: Page, name: string, w: number) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  if (sw > w) {
    console.log(`OVERFLOW ${name} ${w}: ${sw}`);
    const bad = await page.evaluate((vw) => Array.from(document.querySelectorAll("main *")).filter((e) => e.getBoundingClientRect().right > vw + 1).slice(0, 8).map((e) => `${e.tagName}.${(e as HTMLElement).className} ${Math.round(e.getBoundingClientRect().right)}`), w);
    console.log("  offenders:", bad.join(" | "));
  }
  await page.screenshot({ path: `${OUT}/${name}-${w}.png`, fullPage: true });
  if (w === 1440) {
    const style = await page.addStyleTag({ content: "html{filter:grayscale(1)}" });
    await page.screenshot({ path: `${OUT}/${name}-${w}-gray.png`, fullPage: true });
    await style.evaluate((n) => (n as Element).remove());
  }
}

for (const w of widths) {
  test.describe(`${w}`, () => {
    test.use({ viewport: { width: w, height: 900 } });
    test.beforeEach(async ({ page }) => mock(page, "clear"));
    const plain: [string, string, string?][] = [
      ["home", "/"],
      ["token-pyusd", `/t?m=${PYUSD}`, ".verdict"],
      ["token-broken", `/t?m=${BROKEN}`, ".notice"],
      ["recent", "/recent", ".feed"],
      ["spec", "/spec"],
      ["methodology", "/methodology"],
      ["terms", "/terms"],
      ["notfound", "/nothing-here"],
      ["publish-empty", `/publish?m=${BONK}`],
    ];
    for (const [name, path, wait] of plain) {
      test(`${name}`, async ({ page }) => {
        await page.goto(path);
        if (wait) await page.waitForSelector(wait);
        await page.waitForLoadState("networkidle");
        await shoot(page, name, w);
      });
    }
    test("token with other wallets open", async ({ page }) => {
      await page.goto(`/t?m=${USDC}`);
      await page.waitForSelector(".verdict");
      await shoot(page, "token-usdc-collapsed", w);
      await page.locator("details.others > summary").click();
      await shoot(page, "token-usdc-others-open", w);
    });
    test("since your last visit", async ({ page }) => {
      await page.goto(`/t?m=${USDC}`);
      await page.waitForSelector(".verdict");
      await page.evaluate((m) => {
        const k = `datum.visit.v0.mainnet.${m}`;
        const rec = JSON.parse(localStorage.getItem(k) as string) as { at: number; rows: Record<string, string> };
        for (const id of Object.keys(rec.rows)) rec.rows[id] = "false";
        rec.at -= 3 * 3600_000;
        localStorage.setItem(k, JSON.stringify(rec));
      }, USDC);
      await page.reload();
      await page.waitForSelector(".since");
      await shoot(page, "token-since", w);
    });
    test("publish steps", async ({ page }) => {
      await installFakeWallet(page);
      await page.goto(`/publish?m=${USDC}`);
      await page.getByLabel("Mint authority is revoked").check();
      await page.getByLabel("Decimals equal a value").check();
      await page.getByLabel("Decimals equal a value: value").fill("6");
      await shoot(page, "publish-step1", w);
      await page.getByRole("button", { name: "Next: wallet and check" }).click();
      await page.getByRole("heading", { name: "Would these statements be true now?" }).waitFor();
      await shoot(page, "publish-step2-nowallet", w);
      await page.getByRole("button", { name: "Connect Fake Wallet" }).click();
      await page.getByText("Connected with Fake Wallet").waitFor();
      await page.getByLabel("I have read this.").check();
      await shoot(page, "publish-step2", w);
      await page.getByRole("button", { name: "Review and check the fee" }).click();
      await page.getByRole("heading", { name: "Review", exact: true }).waitFor();
      await shoot(page, "publish-step3-review", w);
      await page.getByLabel("I understand this claim will be public and cannot be withdrawn.").check();
      await page.getByLabel("I understand this claim will show as Not true now.").check();
      await page.getByRole("button", { name: "Sign in my wallet" }).click();
      await page.getByText(/Confirmed in slot/).waitFor({ timeout: 15000 });
      await shoot(page, "publish-step3-done", w);
    });
  });
}

test.describe("phone sheets", () => {
  test.use({ viewport: { width: 360, height: 740 } });
  test.beforeEach(async ({ page }) => mock(page, "clear"));
  test("menu and evidence", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("dialog", { name: "Menu" }).waitFor();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/sheet-menu-360.png` });
    await page.keyboard.press("Escape");
    await page.goto(`/t?m=${USDC}`);
    await page.waitForSelector(".verdict");
    await page.locator(".claim").first().getByRole("button", { name: "Show evidence" }).click();
    await page.getByRole("dialog", { name: "Evidence" }).waitFor();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/sheet-evidence-360.png` });
  });
});
