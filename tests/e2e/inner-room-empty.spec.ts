import { test, expect } from '@playwright/test';
import { encryptVault } from '../../src/core/vault/crypto.ts';
import { allVaultFixture, vaultPassword } from '../fixtures/vault.ts';

// Runs only against the isolated all-public-empty build produced by verify-content.mjs.
for (const configured of [true, false]) test(`inner room with no public content and private configured=${configured}`, async ({ page, request }) => {
  const index = await (await request.get('./search-index.json')).json();
  expect(index.results).toEqual([]);
  expect(index.modules.map((module: { count: number }) => module.count)).toEqual([0, 0, 0, 0]);
  const fixture = structuredClone(allVaultFixture);
  fixture.modules.build.supplements = [];
  const envelope = await encryptVault(configured ? fixture : { version: 1, modules: {}, assets: {} }, vaultPassword);
  await page.route('**/vault/bundle.json', route => route.fulfill({ json: envelope }));
  await page.goto('./');
  await page.locator('[data-vault-entrance]').press('Enter');
  await page.getByLabel('私人空间口令', { exact: true }).fill(vaultPassword);
  await page.getByRole('button', { name: '解锁', exact: true }).click();
  await expect(page.locator('[data-vault-dialog]')).not.toBeVisible();
  for (const id of ['me', 'think', 'keep', 'build']) {
    await page.locator(`[data-compass-link][data-module="${id}"]`).click();
    await expect(page.locator('html')).toHaveAttribute('data-vault-unlocked', '');
    await expect(page.getByText(/^暂无公开/)).toBeVisible();
    if (configured) {
      await expect(page.locator('.vault-view')).toBeVisible();
      expect(await page.evaluate(() => !!(document.querySelector('.vault-view')!.compareDocumentPosition([...document.querySelectorAll('p')].find(node => /^暂无公开/.test(node.textContent ?? ''))!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    } else await expect(page.locator('.vault-view')).toHaveCount(0);
    await page.setViewportSize({ width: 320, height: 700 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('link', { name: 'Home', exact: true }).click();
  }
  await page.getByRole('button', { name: '锁定私人空间' }).click();
  expect(await page.locator('body').textContent()).not.toContain('CANARY_P4');
});
