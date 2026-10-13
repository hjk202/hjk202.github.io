import { test, expect } from '@playwright/test';

test('isolated Markdown article, image, relative links and long code work under base', async ({ page, request, baseURL }) => {
  await page.goto('./think/content-probe/');
  await expect(page.locator('.prose h2')).toHaveText('Markdown bridge');
  const image = page.getByRole('img', { name: 'Fixture image' });
  await expect(image).toBeVisible();
  expect(await image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect((await request.get(new URL((await image.getAttribute('src'))!, page.url()).href)).status()).toBe(200);
  await page.setViewportSize({ width: 375, height: 667 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('pre').evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await page.getByRole('link', { name: 'Me', exact: true }).click();
  await expect(page).toHaveURL(new URL('me/', baseURL!).href);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Search my space', exact: true }).click();
  await page.getByRole('combobox').fill('内容验证');
  await page.getByRole('combobox').press('Enter');
  await expect(page).toHaveURL(/personal-space\/think\/content-probe\/$/);
});
