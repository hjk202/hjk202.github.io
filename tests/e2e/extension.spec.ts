import { test, expect } from '@playwright/test';
// Run exclusively against the isolated output produced by test:extension.
test('fifth module joins Compass, shortcuts, search, counts and real routing automatically', async ({ page, request, baseURL }) => {
  const index = await (await request.get(new URL('search-index.json', baseURL!).href)).json();
  expect(index.modules).toHaveLength(5);
  expect(index.modules.at(-1).count).toBe(1);
  await page.goto('./');
  await expect(page.getByRole('link', { name: 'Observatory, 1 entry', exact: true })).toBeVisible();
  expect((await page.locator('.compass-outline').getAttribute('points'))!.split(' ')).toHaveLength(5);
  await page.getByRole('button', { name: 'Search my space', exact: true }).click();
  await expect(page.getByRole('option')).toHaveCount(5);
  await page.getByRole('combobox').fill('Extension verification');
  await expect(page.getByRole('option')).toHaveCount(1);
  await page.getByRole('combobox').press('Enter');
  await expect(page).toHaveURL(/observatory\/$/);
  await expect(page.locator('h1')).toHaveText('Extension verification');
  await expect(page).toHaveTitle('Observatory — Personal Space');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Observatory — Personal Space的公开模块。');
  const icon = await page.locator('link[rel="icon"]').getAttribute('href');
  expect((await request.get(new URL(icon!, page.url()).href)).status()).toBe(200);
});
