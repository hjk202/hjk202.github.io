import { test, expect } from '@playwright/test';

test('all public pages expose truthful distinct titles, summaries and root/base-safe assets', async ({ page, request, baseURL }) => {
  const pages = [
    ['', 'Personal Space'], ['me/', '韩江恺 — Me — Personal Space'], ['think/', 'Think — Personal Space'],
    ['think/sunshine/', '阳光正好 — Think — Personal Space'],
    ['think/understanding-from-the-bottom/', '我为什么越来越喜欢从底层理解一个东西 — Think — Personal Space'],
    ['build/', 'Build — Personal Space'], ['build/nemu/', 'NEMU：从指令执行到分页与异常的 x86 模拟器 — Build — Personal Space'],
    ['keep/', 'Keep — Personal Space'], ['keep/missing-semester/', 'The Missing Semester of Your CS Education — Keep — Personal Space'],
  ];
  const titles = new Set();
  for (const [path, title] of pages) {
    await page.goto(`./${path}`);
    await expect(page).toHaveTitle(title);
    titles.add(await page.title());
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    expect((await page.locator('meta[name="description"]').getAttribute('content'))!.trim().length).toBeGreaterThan(5);
    const icon = await page.locator('link[rel="icon"]').getAttribute('href');
    const iconURL = new URL('favicon.svg', baseURL!).href;
    expect(new URL(icon!, page.url()).href).toBe(iconURL);
    expect((await request.get(iconURL)).status()).toBe(200);
    const canonical = page.locator('link[rel="canonical"]');
    const site = process.env.E2E_SITE || process.env.SITE_URL || 'https://hjk202.github.io/';
    await expect(canonical).toHaveAttribute('href', new URL(new URL(page.url()).pathname, site).href);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
  }
  expect(titles.size).toBe(9);
});

test('nested missing pages return a real 404 with usable Home and Spotlight', async ({ page, request, baseURL }, info) => {
  const address = new URL('missing/nested/content/', baseURL!).href;
  expect((await request.get(address)).status()).toBe(404);
  const response = await page.goto(address);
  expect(response!.status()).toBe(404);
  await expect(page.locator('h1')).toHaveText('没有找到这个页面。');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 568 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('404.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Search my space', exact: true }).click();
  await page.getByRole('combobox').fill('NEMU');
  await expect(page.getByRole('option')).toHaveCount(1);
  await page.getByRole('combobox').press('Enter');
  await expect(page).toHaveURL(/build\/nemu\/$/);
  await page.goto(address);
  await page.getByRole('link', { name: '返回首页' }).click();
  await expect(page).toHaveURL(baseURL!);
});
