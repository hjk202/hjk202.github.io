import { expect } from '@playwright/test';
import { test, open } from './fixtures.ts';

test('M17 four private panes remain accessible at PC sizes/zoom and lock clears relocated fields', async ({ page, repo }) => {
  await open(page, repo);
  for (const [width, height] of [[1280, 720], [1440, 900]]) for (const zoom of [1, 1.25, 1.5]) {
    await page.setViewportSize({ width: width!, height: height! }); await page.evaluate(value => { document.documentElement.style.zoom = String(value); }, zoom);
    for (const module of ['think', 'keep', 'me', 'build']) {
      await page.locator('#private-module-' + module).click();
      await page.locator('#private-list button').first().click();
      await expect(page.locator('#private-form')).not.toBeEmpty();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.locator('#private-save').scrollIntoViewIfNeeded(); await expect(page.locator('#private-save')).toBeInViewport();
      await expect(page.locator('#private-save')).toBeEnabled();
    }
  }
  await page.locator('#private-lock').click(); await expect(page.locator('#private-tools')).toBeHidden();
  expect(await page.locator('#private-form').textContent()).toBe('');
  expect(await page.locator('#private-preview-content').textContent()).toBe('');
});
