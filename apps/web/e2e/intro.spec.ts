import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mock } from "./helpers";

// The general suite runs with the opening sequence switched off (see playwright.config.ts). These tests use a clean browser state.
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page }) => {
  await mock(page, "clear");
});

const overlay = (page: import("@playwright/test").Page) => page.locator(".intro");

test("the first visit in a tab opens with the disc, stamps the real slot, and leaves by itself", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-intro", /lock|done/);
  await expect(overlay(page)).toBeVisible();
  await expect(overlay(page).locator(".intro__stamp")).toContainText("Measured at slot");
  await expect(overlay(page).locator(".intro__stamp .num")).toHaveText(/^[\d,]+$/); // the slot read from the mock chain
  await expect(overlay(page)).toHaveCount(0, { timeout: 2600 });
  await expect(page.locator("html")).toHaveAttribute("data-intro", "done");
});

test("the page underneath is complete in the document while the overlay runs", async ({ page }) => {
  await page.goto("/");
  await expect(overlay(page)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What is true about this token, right now?");
  await expect(page.getByLabel("Token address")).toBeAttached();
  expect(await overlay(page).getAttribute("aria-hidden")).toBe("true");
});

test("when the chain cannot be read the stamp shows a dash, never a number", async ({ page }) => {
  await page.route("**/api/rpc", (route) => route.abort());
  await page.goto("/");
  await expect(overlay(page).locator(".intro__stamp .num")).toHaveText("—");
});

test("it never runs for longer than the hard limit, even before the page has scripts", async ({ page }) => {
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  await page.goto("/");
  await expect(overlay(page)).toBeAttached();
  await page.waitForTimeout(2000);
  await expect(overlay(page)).toBeHidden(); // CSS ends it with no script at all
});

test("a key press skips it and the page can be used straight away", async ({ page }) => {
  await page.goto("/");
  await expect(overlay(page)).toBeVisible();
  await expect(page.locator(".intro[data-live]")).toBeAttached(); // scripts are running and the skip is armed
  await page.keyboard.press("Space");
  await expect(overlay(page)).toHaveCount(0, { timeout: 900 });
  await page.getByLabel("Token address").fill("abc");
  await expect(page.getByLabel("Token address")).toHaveValue("abc");
});

test("a reload, or coming back to the home page, does not repeat the overlay", async ({ page }) => {
  await page.goto("/");
  await expect(overlay(page)).toHaveCount(0, { timeout: 2600 });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-intro", "stamp");
  await expect(overlay(page)).toHaveCount(0);
  await page.getByRole("link", { name: "Recent" }).first().click();
  await page.getByRole("link", { name: "Look up" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(overlay(page)).toHaveCount(0);
});

test("the headline is stamped in word by word, with the same text and no change of layout", async ({ page }) => {
  await page.goto("/");
  await expect(overlay(page)).toHaveCount(0, { timeout: 2600 });
  await page.reload();
  const words = page.locator("h1 .stamp-w");
  await expect(words).toHaveCount(8);
  expect(await words.first().evaluate((el) => getComputedStyle(el).animationName)).toBe("stamp-in");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What is true about this token, right now?");
});

test("Motion: Off, the URL switch and the system setting each skip the opening entirely", async ({ page }) => {
  await page.goto("/?motion=off");
  await expect(page.locator("html")).not.toHaveAttribute("data-intro", /.+/);
  await expect(overlay(page)).toBeHidden();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-intro", /.+/);
  await expect(overlay(page)).toBeHidden();
  expect(await page.locator("h1 .stamp-w").first().evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});

test("the stored Reduced choice skips it", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("datum.motion", "reduced"));
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-intro", /.+/);
  await expect(overlay(page)).toBeHidden();
});

test("it is only for the home page", async ({ page }) => {
  await page.goto("/recent");
  await expect(overlay(page)).toHaveCount(0);
  await page.getByRole("link", { name: "Look up" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(overlay(page)).toHaveCount(0);
});

test("the opening adds no layout shift and leaves nothing for axe to flag", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
        if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/");
  await expect(overlay(page)).toHaveCount(0, { timeout: 2600 });
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBe(0);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("at 360 px the overlay fits the screen and the disc still reaches the page", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  await expect(overlay(page)).toBeVisible();
  const box = await overlay(page).locator(".intro__disc").boundingBox();
  expect(box && box.width <= 360 && box.x >= 0).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 360)).toBe(true);
  await expect(overlay(page)).toHaveCount(0, { timeout: 2600 });
});
