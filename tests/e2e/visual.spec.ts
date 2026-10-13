import { test, expect } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 900 }, { width: 375, height: 667 }]) {
    test(`${theme} ${viewport.width}×${viewport.height}: readable entrance and usable search`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize(viewport);
      await page.goto('./');
      const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: innerHeight, scrollHeight: document.documentElement.scrollHeight }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
      expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.height + 1);
      await expect(page.getByRole('link', { name: 'Think, 1 entry' })).toBeVisible();
      await page.screenshot({ path: info.outputPath('home.png'), animations: 'disabled' });
      await page.getByRole('link', { name: 'Think, 1 entry' }).hover();
      await expect(page.locator('[data-compass-count]')).toHaveText('1 entry');
      await page.getByRole('button', { name: 'Search my space', exact: true }).click();
      await expect(page.getByRole('combobox')).toBeFocused();
      const bounds = await page.getByRole('dialog').boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
      await page.screenshot({ path: info.outputPath('spotlight.png'), animations: 'disabled' });
      await page.getByRole('combobox').fill('think');
      await expect(page.getByRole('option').first()).toBeVisible();
      await page.screenshot({ path: info.outputPath('search-results.png'), animations: 'disabled' });
      await page.getByRole('combobox').press('Enter');
      await expect(page).toHaveURL(/think\/$/);
    });
  }
}

test('reduced motion disables animation and blur downgrade stays usable', async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('./');
  expect(await page.locator('.compass-radar').evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  await page.addStyleTag({ content: '.spotlight { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; background: var(--surface) !important; } .spotlight::backdrop { backdrop-filter: none !important; }' });
  await page.getByRole('button', { name: 'Search my space', exact: true }).click();
  expect(await page.getByRole('dialog').evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  expect(await page.getByRole('dialog').evaluate((element) => getComputedStyle(element).backdropFilter)).toBe('none');
  await page.screenshot({ path: info.outputPath('fallback.png') });
  await page.getByRole('combobox').press('Escape');
  await expect(page.getByRole('button', { name: 'Search my space', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Search my space', exact: true }).click();
  await page.getByRole('combobox').fill('keep');
  await page.getByRole('combobox').press('Enter');
  await expect(page).toHaveURL(/keep\/$/);
});
