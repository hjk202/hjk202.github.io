import { test, expect } from '@playwright/test';

test('Me Compass shows peer average while public data still counts one actual profile', async ({ page, request, baseURL }) => {
  const index = await (await request.get(new URL('search-index.json', baseURL!).href)).json();
  expect(index.modules.map((module: { count: number }) => module.count)).toEqual([2, 1, 1, 3]);
  await page.goto('./');
  const me = page.getByRole('link', { name: 'Me, average count 2 across other modules', exact: true });
  await me.hover();
  await expect(page.locator('[data-compass-count]')).toHaveText('Avg · 2');
  const point = page.locator('[data-radar="me"]');
  const x = Number(await point.getAttribute('cx')), y = Number(await point.getAttribute('cy'));
  expect(Math.hypot(x - 300, y - 300)).toBeCloseTo(130.5 * Math.log1p(2) / Math.log1p(3), 5);
  await me.click();
  await expect(page).toHaveURL(/personal-space\/me\/$/);
});

test('Keep multiple categories survive filtering, refresh, Back and detail return under a deployment base', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./keep/');
  await expect(page.locator('.bookmark-card')).toHaveCount(3);
  await expect(page.getByRole('navigation', { name: '收藏分类' }).getByRole('link')).toHaveCount(3);
  await page.locator('[data-category-filter="systems"]').click();
  await expect(page).toHaveURL(/personal-space\/keep\/\?category=systems$/);
  await expect(page.locator('.bookmark-card:visible')).toHaveCount(1);
  await expect(page.locator('[data-category-status]')).toHaveText('共 1 项收藏');
  await page.reload();
  await expect(page.locator('[data-category-filter="systems"]')).toHaveAttribute('aria-current', 'true');
  await page.getByRole('link', { name: '系统资源', exact: true }).click();
  await expect(page).toHaveURL(/keep\/three\/\?category=systems$/);
  await expect(page.locator('[data-bookmark-return]')).toHaveAttribute('href', /personal-space\/keep\/\?category=systems$/);
  await page.goBack();
  await expect(page.locator('.bookmark-card:visible')).toHaveCount(1);
  await page.locator('[data-category-filter="all"]').click();
  await expect(page.locator('.bookmark-card:visible')).toHaveCount(3);
  await page.goBack();
  await expect(page.locator('.bookmark-card:visible')).toHaveCount(1);
  await page.goto('./keep/?category=missing');
  await expect(page).toHaveURL(/personal-space\/keep\/$/);
  await expect(page.locator('.bookmark-card:visible')).toHaveCount(3);
  await page.locator('[data-category-filter="tools"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.bookmark-card:visible')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('Think separates real article and note forms and renders the note inline', async ({ page }) => {
  await page.goto('./think/');
  await expect(page.locator('.thought-entry')).toHaveCount(1);
  await expect(page.locator('.thought-note')).toHaveCount(1);
  await expect(page.locator('.note-body')).toContainText('测试中的想法正文，可以在列表直接读完。');
  await page.getByRole('link', { name: '一个测试中的小问题', exact: true }).click();
  await expect(page).toHaveURL(/personal-space\/think\/design-note\/$/);
  await expect(page.locator('.prose')).toContainText('测试中的想法正文');
});

test('Build author-maintained records show actual stages, ordered updates and readable issue states', async ({ page }) => {
  await page.goto('./build/record-probe/');
  await expect(page.locator('[data-milestone]')).toHaveCount(2);
  await expect(page.locator('#milestones')).toContainText('已完成 1 / 2 阶段');
  await expect(page.locator('.project-update summary').first()).toContainText('最新更新');
  await expect(page.locator('.project-update').first()).toHaveAttribute('open', '');
  const older = page.locator('.project-update').last();
  await expect(older).not.toHaveAttribute('open');
  await older.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(older).toHaveAttribute('open', '');
  await expect(older).toContainText('完成核心逻辑');
  await page.getByRole('link', { name: '问题与复盘', exact: true }).click();
  await expect(page).toHaveURL(/personal-space\/build\/record-probe\/#issues$/);
  await expect(page.locator('.project-issue').first()).toContainText('待解决');
  await expect(page.locator('.project-issue').last()).toContainText('已解决');
  await expect(page.locator('.project-issue').last()).toContainText('增加边界检查');
  await page.setViewportSize({ width: 375, height: 667 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
