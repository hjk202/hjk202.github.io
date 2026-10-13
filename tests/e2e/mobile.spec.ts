import { test, expect } from '@playwright/test';

test.use({ hasTouch: true });

for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 639, height: 900 }, { width: 641, height: 900 }, { width: 667, height: 375 }, { width: 768, height: 600 }, { width: 768, height: 1024 }]) {
  test(`mobile ${viewport.width}×${viewport.height}: real node and label taps navigate once`, async ({ page, baseURL }, info) => {
    await page.setViewportSize(viewport);
    await page.goto('./');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const metrics = await page.locator('[data-compass-link]').evaluateAll((links) => links.map((link) => {
      const target = link.querySelector('.compass-target')!.getBoundingClientRect();
      const text = link.querySelector('.compass-touch-label div')!.getBoundingClientRect();
      return { target: { width: target.width, height: target.height }, text: { width: text.width, height: text.height } };
    }));
    for (const metric of metrics) {
      expect(metric.target.width).toBeGreaterThanOrEqual(44);
      expect(metric.target.height).toBeGreaterThanOrEqual(44);
      if (viewport.width <= 640 || viewport.height <= 760) expect(metric.text.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('home.png'), animations: 'disabled' });
    for (const name of ['think', 'build', 'me', 'keep']) {
      const link = page.locator(`[data-module="${name}"]`);
      const target = link.locator('.compass-target');
      await target.tap();
      await expect(page).toHaveURL(new URL(`${name}/`, baseURL!).href);
      await page.goBack();
      await expect(page.locator('[data-pointer-active]')).toHaveCount(0);
      if (viewport.width <= 640 || viewport.height <= 760) {
        await link.locator('.compass-touch-label div').tap();
        await expect(page).toHaveURL(new URL(`${name}/`, baseURL!).href);
        await page.goBack();
      }
    }
  });
}
