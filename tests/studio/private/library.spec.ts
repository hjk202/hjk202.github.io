import fs from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { test, open, save, secret, password } from './fixtures.ts';
import type { MemoryBridge } from './fixtures.ts';
import { decryptVault } from '../../../src/core/vault/crypto.ts';

test.use({ deliveryMode: true });
async function visibility(page: Page, hidden: boolean) {
  await page.evaluate(value => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}
async function pending(page: Page, button = 'open') {
  await page.locator('#private-' + button).click();
  const request = await page.evaluate(() => (window as unknown as MemoryBridge).__privateMessages.filter(value => value.type === 'studio:private-select').at(-1));
  expect(typeof request?.requestId).toBe('string');
  return request!.requestId as string;
}
async function receive(page: Page, value: Record<string, unknown>) {
  await page.evaluate(value => (window as unknown as MemoryBridge).__privateReceive(value), value);
}
async function cleared(page: Page) {
  await expect(page.locator('#private-tools')).toBeHidden();
  expect(await page.locator('#private-form').textContent()).toBe('');
  expect(await page.locator('#private-preview-content').textContent()).toBe('');
  expect(await page.locator('#private-password').inputValue()).toBe('');
}

test('M18 local-only library save has no website side effect; optional wizard is explicit and reversible', async ({ page, repo }) => {
  await open(page, repo);
  await expect(page.getByRole('heading', { name: '私人资料库', exact: true })).toBeVisible();
  await expect(page.locator('#private-delivery-steps')).toBeHidden();
  await page.locator('#private-list button').first().click();
  await page.getByLabel('私人标题', { exact: true }).fill('非敏感仅本机保存');
  await save(page);
  await expect(page.locator('#private-state')).toContainText('仅本机使用可到此结束');
  const master = fs.readFileSync(repo.file);
  expect(fs.existsSync(repo.bundle)).toBe(false);
  await page.locator('#private-prepare').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#private-step-select')).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('#private-export')).toBeHidden();
  await expect(page.locator('#private-deliver')).toBeHidden();
  await expect(page.locator('#private-delivery details')).not.toHaveAttribute('open');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => { document.documentElement.style.zoom = '1.5'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.locator('#private-select-export').scrollIntoViewIfNeeded();
  await expect(page.locator('#private-select-export')).toBeInViewport();
  await page.locator('#private-delivery-back').click();
  await expect(page.locator('#private-delivery-steps')).toBeHidden();
  expect(fs.readFileSync(repo.file).equals(master)).toBe(true);
  expect(fs.existsSync(repo.bundle)).toBe(false);
});

for (const mode of ['open', 'create'] as const) test(`M18 ${mode} selection survives hiding only as a handle and resumes visibly without old plaintext`, async ({ page, repo }) => {
  await open(page, repo); await page.locator('#private-list button').first().click();
  await page.locator('#private-preview').click();
  const before = fs.readFileSync(repo.file), requestId = await pending(page, mode);
  await cleared(page); await visibility(page, true);
  const file = mode === 'create' ? join(repo.file, '..', 'new-library.json') : repo.file;
  const selected = repo.files.bind(file, mode);
  await receive(page, { type: 'studio:private-bound', requestId, handle: selected.handle });
  await cleared(page); await expect(page.locator('#private-password-dialog')).not.toBeVisible();
  await visibility(page, false);
  if (mode === 'open') { await secret(page); }
  await expect(page.locator('#private-tools')).toBeVisible();
  expect(fs.readFileSync(repo.file).equals(before)).toBe(true);
  if (mode === 'create') expect(fs.existsSync(file)).toBe(false);
  expect(fs.existsSync(repo.bundle)).toBe(false);
});

test('M18 export selection clears plaintext, reauthenticates after visibility, and final cancellation never writes the website', async ({ page, repo }) => {
  await open(page, repo);
  const master = fs.readFileSync(repo.file), path = join(repo.file, '..', 'hidden-update.json');
  await page.locator('#private-list button').first().click(); await page.locator('#private-preview').click();
  await page.locator('#private-prepare').click();
  const requestId = await pending(page, 'select-export'); await cleared(page);
  await visibility(page, true);
  // Only the trusted native/backend fixture sees the path, just like the real picker.
  await receive(page, { type: 'studio:private-bound', requestId, handle: repo.bindCandidate(path) });
  await cleared(page); await expect(page.locator('#private-password-dialog')).not.toBeVisible();
  await visibility(page, false); await secret(page);
  await expect(page.locator('#private-step-export')).toHaveAttribute('aria-current', 'step');
  await page.locator('#private-export').click(); await secret(page, true);
  await expect(page.locator('#private-step-confirm')).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('#private-editor .state-badge')).toHaveText('当前无未保存修改');
  page.once('dialog', dialog => dialog.dismiss()); await page.locator('#private-deliver').click();
  await expect(page.locator('#private-deliver')).toBeEnabled();
  expect(fs.existsSync(path)).toBe(true); expect(fs.existsSync(repo.bundle)).toBe(false);
  expect(fs.readFileSync(repo.file).equals(master)).toBe(true);
});

test('M18 explicit lock cancels selector identity; forged, duplicate and late results cannot reopen it', async ({ page, repo }) => {
  await open(page, repo); const requestId = await pending(page);
  const selected = repo.files.bind(repo.file, 'open');
  await receive(page, { type: 'studio:private-bound', requestId: randomUUID(), handle: selected.handle });
  await receive(page, { type: 'studio:private-bound', requestId, handle: selected.handle, path: 'not-accepted.json' });
  await expect(page.locator('#private-password-dialog')).not.toBeVisible();
  await page.locator('#private-lock').click();
  await receive(page, { type: 'studio:private-bound', requestId, handle: selected.handle });
  await cleared(page); await expect(page.locator('#private-password-dialog')).not.toBeVisible();
  const next = await pending(page);
  await receive(page, { type: 'studio:private-bound', requestId: next, handle: selected.handle });
  await secret(page); await expect(page.locator('#private-tools')).toBeVisible();
  await page.locator('#private-lock').click();
  await receive(page, { type: 'studio:private-bound', requestId: next, handle: selected.handle });
  await cleared(page);
});

test('M18 selector cancellation/error and password cancellation stay locked with no file changes', async ({ page, repo }) => {
  const before = fs.readFileSync(repo.file);
  for (const type of ['studio:private-cancelled', 'studio:private-error']) {
    const requestId = await pending(page); await visibility(page, true);
    await receive(page, { type, requestId }); await visibility(page, false);
    await cleared(page); await expect(page.locator('#private-open')).toBeEnabled();
  }
  await repo.choose(page, 'open');
  await page.locator('#private-password-cancel').click(); await cleared(page);
  await expect(page.locator('#private-state')).toContainText('解锁已取消');
  expect(fs.readFileSync(repo.file).equals(before)).toBe(true);
  expect(fs.existsSync(repo.bundle)).toBe(false);
});

test('M18 close during a selection cannot unlock under the close dialog; cancelling close resumes with password', async ({ page, repo }) => {
  const requestId = await pending(page), selected = repo.files.bind(repo.file, 'open');
  await receive(page, { type: 'studio:prepare-close', requestId: randomUUID() });
  await expect(page.locator('#studio-exit')).toBeVisible();
  await receive(page, { type: 'studio:private-bound', requestId, handle: selected.handle });
  await expect(page.locator('#private-password-dialog')).not.toBeVisible();
  await page.locator('#studio-exit').getByRole('button', { name: '取消', exact: true }).click();
  await secret(page); await expect(page.locator('#private-tools')).toBeVisible();
});

test('M18 encrypted backup copied to a new library reopens the whole package without changing the current library', async ({ page, repo }) => {
  await open(page, repo); await page.locator('#private-list button').first().click();
  await page.getByLabel('私人标题', { exact: true }).fill('非敏感新版本'); await save(page);
  const current = fs.readFileSync(repo.file), outside = join(repo.file, '..');
  const backups = fs.readdirSync(outside).filter(name => name.startsWith('.studio-vault-backup-'));
  expect(backups.length).toBe(1);
  const copy = join(outside, 'recovered-library.json'); fs.copyFileSync(join(outside, backups[0]!), copy);
  await repo.choose(page, 'open', copy); await secret(page);
  await expect(page.locator('#private-tools')).toBeVisible();
  expect(JSON.stringify(await decryptVault(JSON.parse(fs.readFileSync(copy, 'utf8')), password)) === JSON.stringify(repo.original)).toBe(true);
  expect(fs.readFileSync(repo.file).equals(current)).toBe(true);
  for (const module of ['think', 'keep', 'me', 'build']) {
    await page.locator('#private-module-' + module).click(); await expect(page.locator('#private-list button').first()).toBeVisible();
  }
  expect(fs.existsSync(repo.bundle)).toBe(false);
});

for (const kind of ['library', 'export', 'website'] as const) test(`M18 hiding during a sent ${kind} write preserves uncertainty while late success cannot reopen plaintext`, async ({ page, repo }) => {
  await open(page, repo);
  const path = join(repo.file, '..', 'late-update.json');
  if (kind === 'library') {
    await page.locator('#private-list button').first().click();
    await page.getByLabel('私人标题', { exact: true }).fill('非敏感后台保存');
  } else {
    await repo.choose(page, 'export', path);
    if (kind === 'website') {
      await page.locator('#private-export').click(); await secret(page, true);
      await expect(page.locator('#private-deliver')).toBeEnabled(); repo.expectBundle();
    }
  }
  let committed!: () => void, release!: () => void;
  const written = new Promise<void>(resolve => { committed = resolve; }), held = new Promise<void>(resolve => { release = resolve; });
  const endpoint = kind === 'library' ? '**/api/studio-private/files/*' : '**/api/studio-private/delivery/' + (kind === 'export' ? 'export' : 'replace');
  await page.route(endpoint, async route => {
    const response = await route.fetch(); committed(); await held; await route.fulfill({ response });
  });
  if (kind === 'website') page.once('dialog', dialog => dialog.accept());
  await page.locator('#private-' + (kind === 'library' ? 'save' : kind === 'export' ? 'export' : 'deliver')).click();
  if (kind !== 'website') await secret(page, true);
  await written;
  await visibility(page, true); await cleared(page); await visibility(page, false);
  await expect(page.locator('#private-state')).toContainText('写入结果须重新核对');
  await expect(page.locator('#private-editor .state-badge')).toHaveText('操作结果待核对');
  await expect(page.locator('#private-editor .state-badge')).toHaveAttribute('data-uncertain', 'true');
  const response = page.waitForResponse(value => kind === 'library' ? value.url().includes('/api/studio-private/files/') : value.url().endsWith('/delivery/' + (kind === 'export' ? 'export' : 'replace')));
  release(); await response; await cleared(page);
  await expect(page.locator('#private-password-dialog')).not.toBeVisible();
  await expect(page.locator('#private-editor .state-badge')).toHaveAttribute('data-uncertain', 'true');
  expect(fs.existsSync(kind === 'library' ? repo.file : kind === 'export' ? path : repo.bundle)).toBe(true);
  if (kind === 'website') {
    await page.locator('#private-prepare').click(); await page.locator('#private-delivery summary').click();
    await page.locator('#private-delivery-status').click();
    await expect(page.locator('#private-delivery-message')).toContainText('已读取并确认');
    await expect(page.locator('#private-editor .state-badge')).toHaveAttribute('data-uncertain', 'false');
  }
});
