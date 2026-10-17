import { test, expect } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

async function reviewBackground(page: Page, info: TestInfo, name: string) {
  const trigger = page.getByRole('button', { name: 'Search my space', exact: true });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await expect(trigger).toHaveCSS('color', await page.locator('body').evaluate((element) => getComputedStyle(element).color));
    await page.screenshot({ path: info.outputPath(`${name}-${theme}.png`), fullPage: true, animations: 'disabled' });
    if (await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)) {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.screenshot({ path: info.outputPath(`${name}-bottom-${theme}.png`), animations: 'disabled' });
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await trigger.click();
    await expect(page.getByRole('combobox')).toBeFocused();
    await page.screenshot({ path: info.outputPath(`${name}-search-${theme}.png`), animations: 'disabled' });
    await page.getByRole('combobox').press('Escape');
    await expect(trigger).toBeFocused();
  }
  await page.setViewportSize({ width: 375, height: 667 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`${name}-narrow.png`), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 1280, height: 800 });
}

test('Me real profile is reachable from Compass and Spotlight', async ({ page }, info) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Me, average count 1.33 across other modules', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('韩江恺');
  await expect(page.locator('main')).toContainText('南京大学计算机科学与技术专业本科生');
  await expect(page.locator('.demo-label')).toHaveCount(0);
  await reviewBackground(page, info, 'me');
  const github = page.getByRole('link', { name: /^GitHub/ });
  await expect(github).toHaveAttribute('href', 'https://github.com/hjk202');
  await expect(github).toHaveAttribute('target', '_blank');
  await expect(github).toHaveAttribute('rel', 'noopener noreferrer');
  await page.context().route('https://github.com/hjk202', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Public GitHub destination probe</h1>' }));
  const opened = page.waitForEvent('popup');
  await github.click();
  const destination = await opened;
  await expect(destination).toHaveURL('https://github.com/hjk202');
  await expect(page).toHaveURL(/me\/$/);
  await destination.close();
  await page.reload();
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Search my space', exact: true }).click();
  await page.getByRole('combobox').fill('韩江恺');
  await page.getByRole('combobox').press('Enter');
  await expect(page).toHaveURL(/me\/$/);
  await expect(page.locator('h1')).toHaveText('韩江恺');
});

test('Think renders real Markdown, formula and readable long text', async ({ page }, info) => {
  await page.goto('./think/');
  await reviewBackground(page, info, 'think-index');
  await page.getByRole('link', { name: '我为什么越来越喜欢从底层理解一个东西', exact: true }).click();
  await expect(page.locator('time')).toHaveText('2026-10-13');
  await expect(page.locator('[role="math"]')).toBeVisible();
  await expect(page.locator('.prose')).toContainText('知识开始连接起来。');
  await reviewBackground(page, info, 'think');
  await page.setViewportSize({ width: 375, height: 667 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Search my space', exact: true }).click();
  await page.getByRole('combobox').press('Escape');
  await expect(page.getByRole('button', { name: 'Search my space', exact: true })).toBeFocused();
});

test('Build real NEMU project has complete explanations, paths and no invented links', async ({ page }, info) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Build, 1 entry', exact: true }).click();
  await reviewBackground(page, info, 'build-index');
  await page.getByRole('link', { name: 'NEMU：从指令执行到分页与异常的 x86 模拟器', exact: true }).click();
  await expect(page.locator('.project')).toContainText('2025.09 — 2026.02');
  await expect(page.locator('.project')).toContainText('64 KB、64 B Cache Line、8 路组相联 Cache');
  await expect(page.locator('pre').first()).toContainText('Physical Address');
  await expect(page.locator('.project a[href^="http"]')).toHaveCount(0);
  await expect(page.locator('[data-milestone], .project-update, .project-issue')).toHaveCount(0);
  await expect(page.locator('.project-local-nav')).toHaveCount(0);
  await reviewBackground(page, info, 'build');
  await page.setViewportSize({ width: 375, height: 667 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Search my space', exact: true }).click();
  await page.getByRole('combobox').fill('NEMU');
  await page.getByRole('combobox').press('Enter');
  await expect(page).toHaveURL(/build\/nemu\/$/);
});

test('Keep search opens local detail while source navigation keeps its external URL', async ({ page }, info) => {
  await page.goto('./keep/');
  await reviewBackground(page, info, 'keep-index');
  await page.getByRole('link', { name: 'The Missing Semester of Your CS Education', exact: true }).click();
  await expect(page.getByRole('link', { name: '打开来源' })).toHaveAttribute('href', 'https://missing.csail.mit.edu/');
  await expect(page.locator('.bookmark')).toContainText('工具本身也是计算机能力的一部分。');
  await reviewBackground(page, info, 'keep');
  await page.setViewportSize({ width: 375, height: 667 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Search my space', exact: true }).click();
  await page.getByRole('combobox').fill('工具');
  await page.getByRole('combobox').press('Enter');
  await expect(page).toHaveURL(/keep\/missing-semester\/$/);
  await page.context().route('https://missing.csail.mit.edu/**', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Local source navigation probe</h1>' }));
  const opened = page.waitForEvent('popup');
  await page.getByRole('link', { name: '打开来源' }).click();
  const source = await opened;
  await expect(source).toHaveURL('https://missing.csail.mit.edu/');
  await expect(source.locator('h1')).toHaveText('Local source navigation probe');
  await expect(page).toHaveURL(/keep\/missing-semester\/$/);
  await source.close();
});
