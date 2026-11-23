import { reveal } from '../workbench-controls.ts';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startStudioHttp } from '../../../studio/server/http.ts';

type BridgeWindow = Window & {
  __m8Messages: Record<string, unknown>[];
  __m8Receive(value: unknown): void;
};
const test = base.extend<{ repo: { content: string; origin: string } }>({
  repo: async ({ page }, use) => {
    fs.mkdirSync('.cache/studio-m8', { recursive: true });
    const root = fs.mkdtempSync(resolve('.cache/studio-m8/browser-')), content = join(root, 'src/modules/think/content');
    fs.mkdirSync(content, { recursive: true });
    const session = await startStudioHttp({ repositoryRoot: root, port: 0, webDirectory: resolve('.cache/studio/web') });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const value = window as unknown as BridgeWindow;
      value.__m8Messages = []; const handlers: ((event: MessageEvent) => void)[] = [];
      Object.defineProperty(window, 'chrome', { value: { webview: {
        postMessage: (message: Record<string, unknown>) => value.__m8Messages.push(message),
        addEventListener: (_type: string, handler: (event: MessageEvent) => void) => handlers.push(handler),
      } }, configurable: true });
      value.__m8Receive = message => handlers.forEach(handler => handler(new MessageEvent('message', { data: message })));
    });
    try { await use({ content, origin: session.origin }); }
    finally { expect((await session.close()).ok).toBe(true); fs.rmSync(root, { recursive: true, force: true }); expect(errors).toEqual([]); }
  },
});
const messages = (page: Page) => page.evaluate(() => (window as unknown as BridgeWindow).__m8Messages);
const close = async (page: Page) => {
  const requestId = randomUUID();
  await page.evaluate(id => (window as unknown as BridgeWindow).__m8Receive({ type: 'studio:prepare-close', requestId: id }), requestId);
  return requestId;
};
async function draft(page: Page, origin: string) {
  await page.goto(origin+'/#think'); await page.getByRole('button', { name: '新建文章', exact: true }).click();
  await page.locator('#slug').fill('m8-draft'); await page.locator('#body').fill('非敏感退出测试：事实和个人语气保留。');
}

test('M8 cancel and Escape preserve buffers; unknown/extra/DOM/frame messages cannot authorize an exit', async ({ page, repo }) => {
  await draft(page, repo.origin);
  for (const value of [{ type: 'saveThink', requestId: randomUUID() }, { type: 'studio:prepare-close', requestId: randomUUID(), path: 'C:/outside' }, { type: 'studio:prepare-close', requestId: 'invalid' }]) await page.evaluate(input => (window as unknown as BridgeWindow).__m8Receive(input), value);
  await page.evaluate(() => window.postMessage({ type: 'studio:prepare-close', requestId: '7e0bfeab-426a-4e45-943e-146fa87b1b8b' }, '*'));
  await page.evaluate(() => { const frame = document.createElement('iframe'); frame.sandbox.add('allow-scripts'); frame.srcdoc = '<p>Non-sensitive untrusted frame</p>'; document.body.append(frame); });
  const child = page.frames().find(frame => frame !== page.mainFrame()); expect(child).toBeDefined();
  await child!.evaluate(() => parent.postMessage({ type: 'studio:prepare-close', requestId: '7e0bfeab-426a-4e45-943e-146fa87b1b8b' }, '*'));
  await expect(page.locator('#studio-exit')).not.toBeVisible();
  const first = await close(page); await expect(page.getByRole('button', { name: '保存并退出', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('#body')).toHaveValue('非敏感退出测试：事实和个人语气保留。');
  const second = await close(page); await page.keyboard.press('Escape');
  expect((await messages(page)).filter(item => item.type === 'studio:close-result')).toEqual([
    { type: 'studio:close-result', requestId: first, status: 'cancel' }, { type: 'studio:close-result', requestId: second, status: 'cancel' },
  ]);
  expect(fs.readdirSync(repo.content)).toEqual([]);
});

test('M8 explicit save and discard decisions are distinct; clean buffers prepare without a write', async ({ page, repo }) => {
  await draft(page, repo.origin); const requestId = await close(page);
  await page.getByRole('button', { name: '保存并退出', exact: true }).click();
  await expect.poll(async () => (await messages(page)).at(-1)).toEqual({ type: 'studio:close-result', requestId, status: 'ready' });
  expect(fs.readFileSync(join(repo.content, 'm8-draft.md'), 'utf8')).toContain('非敏感退出测试');
  await page.reload(); const cleanId = await close(page);
  await expect.poll(async () => (await messages(page)).at(-1)).toEqual({ type: 'studio:close-result', requestId: cleanId, status: 'ready' });
  await page.reload(); await page.getByRole('button', { name: '新建文章', exact: true }).click();
  await page.locator('#body').fill('UNSAVED_DISCARD_FIXTURE'); const discardId = await close(page);
  await page.getByRole('button', { name: '放弃修改并退出', exact: true }).click();
  expect((await messages(page)).at(-1)).toEqual({ type: 'studio:close-result', requestId: discardId, status: 'ready' });
  expect(fs.readdirSync(repo.content)).toEqual(['m8-draft.md']);
});

for (const lost of [false, true]) test(`M8 ${lost ? 'unknown write response' : 'save failure'} keeps the window and buffer, with no retry`, async ({ page, repo }) => {
  await draft(page, repo.origin); let writes = 0;
  await page.route('**/documents', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    writes++;
    if (lost) { await route.fetch(); await route.abort('failed'); }
    else await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'FILE_OPERATION_FAILED' } }) });
  });
  await close(page); await page.getByRole('button', { name: '保存并退出', exact: true }).click();
  await expect(page.locator('#studio-exit-state')).toContainText('保存未确认');
  expect((await messages(page)).filter(item => item.status === 'ready')).toEqual([]);
  expect(writes).toBe(1);
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('#body')).toHaveValue('非敏感退出测试：事实和个人语气保留。');
  expect(fs.readdirSync(repo.content)).toEqual(lost ? ['m8-draft.md'] : []);
});

test('M8 an in-flight write cannot be discarded or treated as rolled back; cancellation preserves its completion', async ({ page, repo }) => {
  await draft(page, repo.origin); let release!: () => void, started!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; }), entered = new Promise<void>(resolve => { started = resolve; });
  await page.route('**/documents', async route => { if (route.request().method() !== 'POST') return route.continue(); started(); await pending; await route.continue(); });
  await page.locator('#save').click(); await entered; await close(page);
  await expect(page.getByRole('button', { name: '放弃修改并退出', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '保存并退出', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '取消', exact: true }).click(); release();
  await expect(page.locator('#save-state')).toHaveText('已保存（本地源码）');
  expect((await messages(page)).filter(item => item.status === 'ready')).toEqual([]);
});

test('M8 failed shutdown restores an editable buffer; stale native messages cannot change a new close decision', async ({ page, repo }) => {
  await draft(page, repo.origin); const requestId = await close(page);
  await page.getByRole('button', { name: '放弃修改并退出', exact: true }).click();
  expect((await messages(page)).at(-1)?.status).toBe('ready');
  await page.evaluate(id => (window as unknown as BridgeWindow).__m8Receive({ type: 'studio:close-failed', requestId: id }), requestId);
  await expect(page.locator('#body')).toBeEditable();
  await expect(page.locator('#body')).toHaveValue('非敏感退出测试：事实和个人语气保留。');
  await expect(page.locator('#message')).toContainText('窗口与缓冲保留');
  await close(page);
  await page.evaluate(id => (window as unknown as BridgeWindow).__m8Receive({ type: 'studio:close-failed', requestId: id }), requestId);
  await expect(page.locator('#studio-exit')).toBeVisible();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  expect(fs.readdirSync(repo.content)).toEqual([]);
});

for (const operation of ['preview', 'suggest']) test(`M8 pending ${operation} survives cancel, then is aborted when save-and-exit is chosen`, async ({ page, repo }) => {
  if (operation === 'suggest') await page.route('**/suggest', async route => {
    if (route.request().method() === 'GET') await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, value: { available: true, service: 'Non-sensitive fixture', model: 'simulated' } }) });
    else await route.fallback();
  });
  await draft(page, repo.origin); let entered!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; }), pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/${operation}`, async route => {
    if (route.request().method() !== 'POST') return route.fallback(); entered(); await pending; await route.abort();
  });
  if (operation !== 'preview') await reveal(page, 'think-ai');
  await page.locator(operation === 'preview' ? '#preview' : '#ai-request').click(); await started;
  await close(page); await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator(operation === 'preview' ? '#cancel-preview' : '#ai-cancel')).toBeVisible();
  const requestId = await close(page); await page.getByRole('button', { name: '保存并退出', exact: true }).click(); release();
  await expect.poll(async () => (await messages(page)).at(-1)).toEqual({ type: 'studio:close-result', requestId, status: 'ready' });
  expect(fs.readFileSync(join(repo.content, 'm8-draft.md'), 'utf8')).toContain('非敏感退出测试');
  await expect(page.locator('#preview-frame')).toBeEmpty();
});
