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

for (const [path, title] of [["/terms", "Risk and terms"], ["/methodology", "How Datum reads a claim"], ["/spec", /Datum protocol/], ["/recent", "Recent claims"], ["/publish", "Publish a claim"]] as const) {
  test(`${path} has the night head with one h1, a turning disc and a ruler edge`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: title })).toHaveCount(1);
    await expect(page.locator(".page-hero .page-disc")).toBeVisible();
    await expect(page.locator(".page-hero .ruler-edge")).toHaveCount(1);
    await expect(page.locator(".page-disc__spin")).toHaveCSS("animation-name", "hf-spin");
  });
}

test("prose pages list their sections on a side rail and number them", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/terms");
  const links = page.locator(".toc a");
  await expect(links).toHaveCount(await page.locator(".prose h2").count());
  await links.nth(2).click();
  await expect(page).toHaveURL(/#reading$/);
  await expect(page.locator(".prose h2").first()).toHaveCSS("counter-increment", /sec 1/);
});

test("with motion off the inner-page disc is still", async ({ page }) => {
  await page.goto("/terms?motion=off");
  await expect(page.locator(".page-disc__spin")).toHaveCSS("animation-name", "none");
});

test("the ruler edges slide sideways while the page scrolls and stay put with motion off", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ticker__item").first()).toBeVisible();
  const shift = () => page.locator(".ticker-wrap").evaluate((el) => el.style.getPropertyValue("--ruler-shift"));
  await page.evaluate(() => window.scrollTo(0, 50));
  await expect.poll(shift).toBe("30.00px");
  await page.evaluate(() => window.scrollTo(0, 100));
  await expect.poll(shift).toBe("0.00px");
  await page.evaluate(() => window.scrollTo(0, 75));
  await expect.poll(shift).toBe("45.00px");
  await page.goto("/?motion=off");
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(200);
  expect(await page.locator(".ticker-wrap").evaluate((el) => el.style.getPropertyValue("--ruler-shift"))).toBe("");
});

test.describe("formula lens", () => {
  const lit = (page: import("@playwright/test").Page) =>
    page.locator(".formula-lens").evaluate((c: HTMLCanvasElement) => {
      const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if ((data[i] ?? 0) > 20) n++;
      return n;
    });

  test("formulas appear only inside the pointer circle", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator(".formula-lens")).toHaveCount(1);
    await page.mouse.move(700, 80);
    await expect.poll(() => page.locator(".formula-lens").getAttribute("data-strength")).toBe("1.00");
    await page.waitForTimeout(400);
    const box = await page.locator(".formula-lens").boundingBox();
    expect(box?.width).toBeLessThan(300);
    expect(await lit(page)).toBeGreaterThan(300);
    // the corner pixels of the canvas, outside the circle, stay empty
    const corners = await page.locator(".formula-lens").evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext("2d")!.getImageData(0, 0, 12, 12).data;
      return Array.from(d).filter((v, i) => i % 4 === 3 && v > 0).length;
    });
    expect(corners).toBe(0);
  });

  test("the lens goes away over a button and is faint over a paragraph", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator(".formula-lens")).toHaveCount(1);
    const button = await page.getByRole("button", { name: "Look up" }).boundingBox();
    await page.mouse.move(button!.x + 10, button!.y + 10);
    await expect.poll(() => page.locator(".formula-lens").getAttribute("data-strength")).toBe("0.00");
    const lede = await page.locator(".hero .lede").boundingBox();
    await page.mouse.move(lede!.x + 40, lede!.y + 10);
    await expect.poll(async () => Number(await page.locator(".formula-lens").getAttribute("data-strength"))).toBeGreaterThan(0.25);
    expect(Number(await page.locator(".formula-lens").getAttribute("data-strength"))).toBeLessThan(0.4);
  });

  test("with motion off there is no lens", async ({ page }) => {
    await page.goto("/?motion=off");
    await expect(page.locator(".formula-lens")).toHaveCount(0);
  });

  test("the lens never catches a click", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".formula-lens")).toHaveCSS("pointer-events", "none");
    await expect(page.locator(".formula-lens")).toHaveAttribute("aria-hidden", "true");
  });
});
