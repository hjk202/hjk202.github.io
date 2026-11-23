import { test, expect } from '@playwright/test';
import { thinkCount } from './public-counts.ts';

test('public links navigate without speculative requests on hover or fast clicks', async ({ page, baseURL, request }) => {
  const count = await thinkCount(request);
  const errors: string[] = [];
  const speculative: string[] = [];
  const targets = new Set(['', 'think/', 'think/understanding-from-the-bottom/'].map(path => new URL(path, baseURL!).href));
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (targets.has(request.url()) && !request.isNavigationRequest()) speculative.push(request.url());
  });
  await page.goto('./think/sunshine/');
  const back = page.getByRole('link', { name: /返回 Think/ });
  await back.hover();
  // Observe background hover activity before the explicit navigation action.
  await page.waitForTimeout(400);
  expect(speculative).toEqual([]);
  await back.click();
  await expect(page).toHaveURL(new URL('think/', baseURL!).href);
  await page.getByRole('link', { name: '我为什么越来越喜欢从底层理解一个东西', exact: true }).click();
  await expect(page).toHaveURL(new URL('think/understanding-from-the-bottom/', baseURL!).href);
  await expect(page.locator('[role="math"]')).toBeVisible();
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(baseURL!);
  await expect(page.getByRole('link', { name: `Think, ${count} entries`, exact: true })).toBeVisible();
  expect(speculative).toEqual([]);
  expect(errors).toEqual([]);
});

test('Compass clears click emphasis on Back/Forward and responds to fresh pointer movement', async ({ page, baseURL, request }) => {
  const count = await thinkCount(request);
  await page.goto('./');
  for (const name of ['Think', 'Build', 'Me', 'Keep']) {
    const label = name === 'Me' ? `Me, average count ${Number(((count + 2) / 3).toFixed(2))} across other modules` : name === 'Think' ? `Think, ${count} entries` : `${name}, 1 entry`;
    const link = page.getByRole('link', { name: label, exact: true });
    await link.hover();
    await expect(page.locator('[data-compass-name]')).toHaveText(name);
    await Promise.all([page.waitForURL(new URL(`${name.toLowerCase()}/`, baseURL!).href, { waitUntil: 'load' }), link.click()]);
    await page.goBack();
    await expect(page.locator('[data-compass-name]')).toBeEmpty();
    await expect(page.locator('[data-pointer-active], [data-radar].active')).toHaveCount(0);
    await page.goForward();
    await page.waitForURL(new URL(`${name.toLowerCase()}/`, baseURL!).href, { waitUntil: 'load' });
    await page.goBack();
    await expect(page.locator('[data-compass-count]')).toBeEmpty();
    await page.mouse.move(1, 1);
    await link.hover();
    await expect(page.locator('[data-compass-count]')).toHaveText(name === 'Me' ? `Avg · ${Number(((count + 2) / 3).toFixed(2))}` : name === 'Think' ? `${count} entries` : '1 entry');
  }
});

test('Compass keeps keyboard focus and clears transient pointer state on cached restore', async ({ page }) => {
  await page.goto('./');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const first = page.locator('[data-compass-link]').first();
  await expect(first).toBeFocused();
  await expect(page.locator('[data-compass-name]')).toHaveText('Think');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/think\/$/);
  await page.goBack();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus-visible')).toHaveCount(1);
  await page.mouse.move(1, 1);
  await first.hover();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(page.locator('[data-pointer-active]')).toHaveCount(0);
  await page.mouse.move(2, 2);
  await first.hover();
  await expect(page.locator('[data-compass-name]')).toHaveText('Think');
});

test('all modules and public search targets are accessible with correct base and no browser errors', async ({ page, request, baseURL }) => {
  const response = await request.get(new URL('search-index.json', baseURL!).href);
  expect(response.status()).toBe(200);
  const index = await response.json();
  expect(index.modules.map((module: { id: string }) => module.id)).toEqual(['think', 'build', 'me', 'keep']);
  const articleResults = index.results.filter((result: { module: string }) => result.module === 'think');
  expect(index.modules.map((module: { count: number }) => module.count)).toEqual([articleResults.length, 1, 1, 1]);
  const articleRoutes = articleResults.map((result: { url: string }) => result.url);
  expect(articleRoutes).toEqual(expect.arrayContaining(['/think/sunshine/', '/think/understanding-from-the-bottom/']));
  expect(new Set(articleRoutes).size).toBe(articleRoutes.length);
  expect(index.results.filter((result: { module: string }) => result.module !== 'think').map((result: { url: string }) => result.url)).toEqual(['/build/nemu/', '/me/', '/keep/missing-semester/']);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const failedResponses: string[] = [];
  page.on('response', (result) => { if (result.status() >= 400) failedResponses.push(result.url()); });
  const targets = new Set<string>([...index.modules.map((module: { route: string }) => module.route), ...index.results.map((result: { url: string }) => result.url)]);
  for (const target of targets) {
    const url = new URL(target.slice(1), baseURL!);
    expect((await request.get(url.href)).status()).toBe(200);
    await page.goto(url.href);
    if (target === '/me/') await expect(page.locator('h1')).toHaveText('韩江恺');
    else if (target.startsWith('/think/')) {
      await expect(page.locator('.demo-label')).toHaveCount(0);
      await expect(page.locator(target === '/think/' ? '.thought-heading h1' : '.think-article > h1')).toHaveText(target === '/think/' ? '想法不必一开始就有答案。' : articleResults.find((result: { url: string }) => result.url === target)!.title);
    } else if (target.startsWith('/build/')) {
      await expect(page.locator('.demo-label')).toHaveCount(0);
      await expect(page.locator('h1')).toHaveText(target === '/build/' ? '构建与记录。' : 'NEMU：从指令执行到分页与异常的 x86 模拟器');
    } else if (target.startsWith('/keep/')) {
      await expect(page.locator('.demo-label')).toHaveCount(0);
      await expect(page.locator('h1')).toHaveText(target === '/keep/' ? '收藏夹' : 'The Missing Semester of Your CS Education');
    }
    await page.reload();
    await expect(page.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('href', new URL(baseURL!).pathname);
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(page).toHaveURL(baseURL!);
  }
  for (const module of index.modules) {
    await page.getByRole('link', { name: new RegExp(`^${module.name},`) }).click();
    await expect(page).toHaveURL(new URL(module.route.slice(1), baseURL!).href);
    await page.getByRole('link', { name: 'Home', exact: true }).click();
  }
  expect(errors).toEqual([]);
  expect(failedResponses).toEqual([]);
  expect((await request.get(new URL('unknown-page/', baseURL!).href)).status()).toBe(404);
});

test('only public snapshots and browser scripts are shipped', async ({ request, baseURL }) => {
  const index = await (await request.get(new URL('search-index.json', baseURL!).href)).json();
  for (const result of index.results) expect(Object.keys(result).sort()).toEqual(['description', 'module', 'title', 'url']);
  const html = await (await request.get(baseURL!)).text();
  const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((match) => match[1]);
  expect(scripts.length).toBeGreaterThan(0);
  for (const script of scripts) {
    const response = await request.get(new URL(script, baseURL!).href);
    expect(response.status()).toBe(200);
    const code = await response.text();
    expect(code).not.toMatch(/node:fs|import\.meta\.glob|buildPublicData|createRegistry|posts\.map|bookmarks\.map/);
  }
});
