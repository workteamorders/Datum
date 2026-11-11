import { expect, test } from "@playwright/test";
import { mock } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mock(page, "clear");
});

test("home ticker shows claims that were read, each linking to its token", async ({ page }) => {
  await page.goto("/");
  const first = page.locator(".ticker__list:not(.ticker__list--copy) .ticker__item").first();
  await expect(first).toBeVisible();
  await expect(first.locator(".ticker__slot")).toContainText(/slot [\d,]+/);
  await expect(first.locator("a")).toHaveAttribute("href", /^\/t\?m=/);
});

test("when the chain cannot be read the ticker says so and no number is invented", async ({ page }) => {
  await page.route("**/api/rpc", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".ticker__empty")).toHaveText("No recent claims read right now.");
  await expect(page.locator(".ticker__item")).toHaveCount(0);
  await expect(page.locator(".hero-field__stamp .num")).toHaveText("—");
  const tiles = page.locator(".tile__value");
  await expect(tiles.nth(0)).toHaveText("—");
  await expect(tiles.nth(2)).toHaveText("—");
});

test("with motion off the ticker does not move and the copy is hidden", async ({ page }) => {
  await page.goto("/?motion=off");
  await expect(page.locator(".ticker__item").first()).toBeVisible();
  await expect(page.locator(".ticker__list--copy")).toBeHidden();
  const name = await page.locator(".ticker__track").evaluate((el) => getComputedStyle(el).animationName);
  expect(name).toBe("none");
});

test("with motion on the ticker runs and pauses on hover", async ({ page }) => {
  await page.goto("/");
  const track = page.locator(".ticker__track");
  await expect(track).toHaveCSS("animation-name", "ticker-run");
  await page.locator(".ticker").hover();
  await expect(track).toHaveCSS("animation-play-state", "paused");
});

for (const width of [360, 768, 1440]) {
  test(`home has no sideways scroll at ${width}px and keeps the fixed line`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator(".ticker__item").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.getByRole("heading", { name: "What this does not tell you" })).toBeVisible();
  });
}

test("addresses in the ticker are not put in capitals", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ticker__link").first()).toHaveCSS("text-transform", "none");
});

test("the hero keeps moving: the dial turns, the measuring loop runs, the crosshair follows the pointer", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".hero-field__spin")).toHaveCSS("animation-name", "hf-spin");
  const angle = () => page.locator(".hero-field__spin").evaluate((el) => { const m = new DOMMatrix(getComputedStyle(el).transform); return Math.atan2(m.b, m.a); });
  const first = await angle();
  await page.waitForTimeout(1500);
  expect(await angle()).not.toBe(first);
  await expect(page.locator(".hero-field__line")).toHaveCSS("animation-iteration-count", "infinite");
  await page.mouse.move(5, 450);
  await expect.poll(() => page.locator(".hero-field").evaluate((el) => Number(el.style.getPropertyValue("--px")))).toBeLessThan(-0.5);
  await page.mouse.move(1270, 450);
  await expect.poll(() => page.locator(".hero-field").evaluate((el) => Number(el.style.getPropertyValue("--px")))).toBeGreaterThan(0.5);
});

test("with motion off the hero is a still picture and ignores the pointer", async ({ page }) => {
  await page.goto("/?motion=off");
  await expect(page.locator(".hero-field__spin")).toHaveCSS("animation-name", "none");
  await page.mouse.move(5, 450);
  await page.waitForTimeout(200);
  expect(await page.locator(".hero-field").evaluate((el) => el.style.getPropertyValue("--px"))).toBe("");
});

test("an unread feed is shown as a dash, never as zero claims", async ({ page }) => {
  await page.route("**/api/rpc", async (route) => {
    const body = route.request().postData() ?? "";
    if (body.includes("getLatestBlockhash")) return route.continue();
    return route.abort();
  });
  await page.goto("/");
  await expect(page.locator(".hero-field__stamp .num")).not.toHaveText("—");
  await expect(page.locator(".tile__value").nth(0)).toHaveText("—");
  await expect(page.locator(".ticker__empty")).toHaveText("No recent claims read right now.");
});
