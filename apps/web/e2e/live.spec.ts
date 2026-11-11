import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mock, USDC } from "./helpers";

test("field is decorative and responds without taking input", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/?motion=debug");
  const field = page.locator("canvas.bench-field");
  await expect(field).toHaveAttribute("aria-hidden", "true");
  await expect(field).toHaveCSS("pointer-events", "none");
  await expect.poll(() => page.evaluate(() => window.__fx?.frames ?? 0)).toBeGreaterThan(0);
  await page.mouse.move(185, 207);
  await expect.poll(() => page.evaluate(() => window.__fx?.x)).toBe(185);
  await page.getByLabel("Token address").fill(USDC);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Look up" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".verdict")).toBeVisible();
  expect(errors).toEqual([]);
});

test("system motion reduction holds a single frame and off removes the canvas", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?motion=debug");
  await expect.poll(() => page.evaluate(() => window.__fx?.frames)).toBe(1);
  await page.mouse.move(200, 250);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => ({
    frames: window.__fx?.frames,
    infinite: document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity).length,
  }))).toEqual({ frames: 1, infinite: 0 });
  await page.goto("/?motion=off");
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(await page.evaluate(() => window.__fx?.frames)).toBe(0);
});

test("Motion persists and can be changed with the keyboard", async ({ page }) => {
  await page.goto("/");
  const footer = page.locator("footer");
  await footer.getByRole("button", { name: "Motion: Full" }).focus();
  await page.keyboard.press("Space");
  await expect(footer.getByRole("button", { name: "Motion: Reduced" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.reload();
  await expect(footer.getByRole("button", { name: "Motion: Off" })).toBeVisible();
});

test("Motion works when storage throws", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", {
    get() { throw new Error("Storage disabled"); },
  }));
  await page.goto("/");
  const button = page.locator("footer").getByRole("button", { name: "Motion: Full" });
  await button.click();
  await expect(page.locator("footer").getByRole("button", { name: "Motion: Reduced" })).toBeVisible();
});

test("Save-Data keeps one frame", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", { value: Object.assign(new EventTarget(), { saveData: true }) });
  });
  await page.goto("/?motion=debug");
  await expect.poll(() => page.evaluate(() => window.__fx?.frames)).toBe(1);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__fx?.frames)).toBe(1);
});

test("hiding the document stops frames and showing it resumes them", async ({ page }) => {
  await page.goto("/?motion=debug");
  await expect.poll(() => page.evaluate(() => window.__fx?.frames ?? 0)).toBeGreaterThan(2);
  const root = page.locator(".motion-root");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(root).toHaveAttribute("data-motion", "still");
  const stopped = await page.evaluate(() => window.__fx?.frames);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__fx?.frames)).toBe(stopped);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => page.evaluate(() => window.__fx?.frames ?? 0)).toBeGreaterThan(stopped ?? 0);
});

test("a reread marks only an actual result change", async ({ page }) => {
  await mock(page, "clear");
  await page.goto(`/t?m=${USDC}`);
  const read = page.getByRole("button", { name: "Read again" });
  await read.click();
  await expect(read).toBeEnabled();
  await expect(page.getByText("Changed just now")).toHaveCount(0);
  await mock(page, "change-reading");
  await read.click();
  await expect(page.getByText("Changed just now")).toHaveCount(1);
  await expect(page.locator(".since")).toContainText("was True now, now Not true now");
  await read.click();
  await expect(read).toBeEnabled();
  await expect(page.getByText("Changed just now")).toHaveCount(0);
});

test("Recent animates a newly published row only after it appears in a fresh read", async ({ page }) => {
  await mock(page, "clear");
  await page.goto("/recent");
  const read = page.getByRole("button", { name: "Read again" });
  await read.click();
  await expect(read).toBeEnabled();
  await expect(page.locator('.feed__item[data-new="true"]')).toHaveCount(0);
  await mock(page, "add-claim");
  await read.click();
  await expect(page.locator('.feed__item[data-new="true"]')).toHaveCount(1);
});

for (const width of [360, 768, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test("measures background fps", async ({ page }) => {
      await page.goto("/?motion=debug");
      await expect.poll(() => page.evaluate(() => window.__fx?.frames ?? 0)).toBeGreaterThan(2);
      const sample = await page.evaluate(() => new Promise<{ average: number; p5: number; field: number }>((resolve) => {
        const rates: number[] = [];
        const first = window.__fx?.frames ?? 0;
        let start = 0, previous = 0;
        function frame(now: number) {
          if (!start) start = now;
          if (previous) rates.push(1000 / (now - previous));
          previous = now;
          if (now - start < 2500) requestAnimationFrame(frame);
          else {
            rates.sort((a, b) => a - b);
            const field = (window.__fx?.frames ?? 0) - first;
            resolve({ average: rates.length * 1000 / (now - start), p5: rates[Math.floor(rates.length * .05)] ?? 0, field });
          }
        }
        requestAnimationFrame(frame);
      }));
      console.log(`Field ${width}px: ${sample.average.toFixed(1)} fps, p5 ${sample.p5.toFixed(1)}, ${sample.field} draws`);
      expect(sample.field).toBeGreaterThan(0);
    });

    const routes = ["/", `/t?m=${USDC}`, "/recent", "/publish", "/spec", "/methodology", "/terms", "/styleguide", "/nothing-here"];
    for (const path of routes) {
      test(`axe and overflow ${path}`, async ({ page }) => {
        const response = await page.goto(`${path}${path.includes("?") ? "&" : "?"}motion=debug`);
        expect(response?.status()).toBe(path === "/nothing-here" ? 404 : 200);
        await expect.poll(() => page.evaluate(() => window.__fx?.frames ?? 0)).toBeGreaterThan(0);
        if (path.startsWith("/t?")) await expect(page.locator(".verdict")).toBeVisible();
        if (path === "/recent") await expect(page.locator(".feed")).toBeVisible();
        const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        expect(result.violations).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      });
    }
  });
}
