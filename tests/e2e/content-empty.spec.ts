import { test, expect } from '@playwright/test';

test('unpublished content leaves four accessible empty modules and honest zero radar', async ({ page, request, baseURL }) => {
  const index = await (await request.get(new URL('search-index.json', baseURL!).href)).json();
  expect(index.modules.map((module: { count: number }) => module.count)).toEqual([0, 0, 0, 0]);
  expect(index.results).toEqual([]);
  for (const [id, label] of [['me', '暂无公开介绍'], ['think', '暂无公开文章'], ['build', '暂无公开项目'], ['keep', '暂无公开收藏']]) {
    await page.goto(`./${id}/`);
    await expect(page.locator('main')).toContainText(label);
    await page.getByRole('link', { name: 'Home', exact: true }).click();
  }
  await expect(page.locator('[data-compass-link]')).toHaveCount(4);
  await expect(page.locator('.compass-radar')).toHaveCount(0);
  await page.getByRole('button', { name: 'Search my space', exact: true }).click();
  await expect(page.getByRole('option')).toHaveCount(4);
  await page.getByRole('combobox').fill('NEMU');
  await expect(page.getByRole('option')).toHaveCount(0);
  await page.getByRole('combobox').fill('');
  await page.getByRole('combobox').press('Enter');
  await expect(page).toHaveURL(/think\/$/);
  for (const path of ['think/understanding-from-the-bottom/', 'build/nemu/', 'keep/missing-semester/']) expect((await request.get(new URL(path, baseURL!).href)).status()).toBe(404);
});
