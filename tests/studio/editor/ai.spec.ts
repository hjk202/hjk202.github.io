import fs from 'node:fs';
import { createServer } from 'node:http';
import { join, relative, resolve } from 'node:path';
import { test as base, expect } from '@playwright/test';
import type { ServerResponse } from 'node:http';
import { AI_OPERATIONS } from '../../../studio/contracts/ai.ts';
import { startStudioHttp } from '../../../studio/server/http.ts';

const key = 'NON_SENSITIVE_M5_UPSTREAM_KEY_CANARY';
const cache = resolve('.cache/studio-m5');
type Fixture = { root: string; file: string; original: Buffer; origin: string; calls: { messages: { role: string; content: string }[] }[]; output: string; mode: 'success' | 'auth' | 'rate' | 'invalid' | 'slow' };
const test = base.extend<{ repo: Fixture; configured: boolean }>({
  configured: [true, { option: true }],
  repo: async ({ page, configured }, use, info) => {
    fs.mkdirSync(cache, { recursive: true }); const root = fs.mkdtempSync(join(cache, 'browser-'));
    const content = join(root, 'src/modules/think/content'); fs.mkdirSync(content, { recursive: true });
    const file = join(content, 'sample.md'); fs.writeFileSync(file, '---\n# M5 non-sensitive fixture\nslug: sample\npublished: false\n---\nSOURCE_TEXT\n');
    const errors: string[] = [], external: string[] = []; let browserExposedKey = false;
    const responses: ServerResponse[] = [];
    const remote = createServer((request, response) => {
      const chunks: Buffer[] = []; request.on('data', chunk => chunks.push(chunk)); request.on('end', () => {
        expect(request.headers.authorization).toBe('Bearer ' + key);
        repo.calls.push(JSON.parse(Buffer.concat(chunks).toString())); responses.push(response);
        response.writeHead(repo.mode === 'auth' ? 401 : repo.mode === 'rate' ? 429 : 200, { 'Content-Type': 'application/json' });
        if (repo.mode === 'slow') { response.write('{'); return; }
        response.end(JSON.stringify(repo.mode === 'success' ? { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: repo.output } }] } : repo.mode === 'invalid' ? { choices: [{ finish_reason: 'length', message: { role: 'assistant', content: 'TRUNCATED' } }] } : { error: { message: key } }));
      });
    });
    await new Promise<void>(resolve => remote.listen(0, '127.0.0.1', resolve));
    const address = remote.address(); if (!address || typeof address === 'string') throw new Error('M5 fixture did not start');
    const session = await startStudioHttp({ repositoryRoot: root, port: 0, webDirectory: resolve('.cache/studio/web'), ai: {
      environment: configured ? { DASHSCOPE_API_KEY: key, DASHSCOPE_BASE_URL: 'https://fixture.cn-beijing.maas.aliyuncs.com/compatible-mode/v1' } : {},
      fetch: (url, init) => { expect(String(url)).toBe('https://fixture.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions'); return fetch(`http://127.0.0.1:${address.port}/chat/completions`, init); }, timeoutMs: 1000,
    } });
    const repo: Fixture = { root, file, original: fs.readFileSync(file), origin: session.origin, calls: [], output: 'AI_CANDIDATE', mode: 'success' };
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (new URL(request.url()).origin !== session.origin) external.push(request.url());
      if (JSON.stringify(request.headers()).includes(key) || request.postData()?.includes(key)) browserExposedKey = true;
    });
    try { await use(repo); }
    finally {
      expect((await session.close()).ok).toBe(true); for (const response of responses) response.destroy();
      remote.closeAllConnections(); await new Promise<void>(resolve => remote.close(() => resolve()));
      await info.attach('ai-browser-boundaries', { contentType: 'application/json', body: JSON.stringify({ simulatedUpstream: true, upstreamCalls: repo.calls.length, errors, externalBrowserRequests: external, browserExposedKey }) });
      expect(errors).toEqual([]); expect(external).toEqual([]); expect(browserExposedKey).toBe(false);
      expect(relative(cache, root).startsWith('browser-') && !relative(cache, root).includes('..')).toBe(true); fs.rmSync(root, { recursive: true });
    }
  },
});

const open = async (page: import('@playwright/test').Page, repo: Fixture) => {
  await page.goto(repo.origin); await page.locator('#documents button').filter({ hasText: 'sample' }).click();
  await expect(page.locator('#body')).toHaveValue('SOURCE_TEXT\n'); await expect(page.locator('#ai-service')).not.toContainText('正在');
};

test('all five suggestions require explicit request/adoption/save and retain published/revision protection', async ({ page, repo }, info) => {
  await open(page, repo); expect(repo.calls).toHaveLength(0);
  for (const operation of AI_OPERATIONS) {
    await page.locator('#ai-operation').selectOption(operation); repo.output = 'SUGGESTED_' + operation;
    const body = await page.locator('#body').inputValue(), title = await page.locator('#title').inputValue(), summary = await page.locator('#summary').inputValue();
    await expect(page.locator('#ai-input')).toHaveValue(body);
    await page.locator('#ai-request').click(); await expect(page.locator('#ai-output')).toHaveValue(repo.output);
    await expect(page.locator('#body')).toHaveValue(body); await expect(page.locator('#title')).toHaveValue(title); await expect(page.locator('#summary')).toHaveValue(summary);
    expect(fs.readFileSync(repo.file)).toEqual(repo.original); expect(repo.calls.at(-1)!.messages[1]!.content).toBe(body);
    await page.locator('#ai-apply').click();
    await expect(page.locator(operation === 'generateTitle' ? '#title' : operation === 'generateSummary' ? '#summary' : '#body')).toHaveValue(repo.output);
    await expect(page.locator('#published')).toHaveValue('false'); await expect(page.locator('#save-state')).toHaveText('未保存修改');
    expect(fs.readFileSync(repo.file)).toEqual(repo.original);
  }
  await page.screenshot({ path: info.outputPath('ai-editor.png'), fullPage: true });
  await page.locator('#validate').click(); await expect(page.locator('#validation-state')).toContainText('可保存');
  await page.locator('#save').click(); await expect(page.locator('#save-state')).toHaveText('已保存（本地源码）'); await expect(page.locator('#save')).toBeEnabled();
  const saved = fs.readFileSync(repo.file, 'utf8'); expect(saved).toContain('SUGGESTED_generateTitle'); expect(saved).toContain('SUGGESTED_generateSummary'); expect(saved).toContain('SUGGESTED_summarize'); expect(saved).toContain('published: false');
  fs.appendFileSync(repo.file, '\nEXTERNAL_REVISION\n'); const external = fs.readFileSync(repo.file);
  await page.locator('#ai-operation').selectOption('polish'); repo.output = 'AI_AFTER_EXTERNAL_EDIT';
  await page.locator('#ai-request').click(); await expect(page.locator('#ai-output')).toHaveValue(repo.output); await page.locator('#ai-apply').click();
  await page.locator('#save').click(); await expect(page.locator('#message')).toContainText('REVISION_CONFLICT');
  await expect(page.locator('#body')).toHaveValue(repo.output); expect(fs.readFileSync(repo.file)).toEqual(external);
});

test('discard, operation changes and edits invalidate inert suggestions without sending or executing extra content', async ({ page, repo }) => {
  await open(page, repo);
  repo.output = '<script>parent.__aiLeak=true</script><img src="https://invalid.example/ai" onerror="parent.__aiLeak=true">';
  await page.locator('#ai-request').click(); await expect(page.locator('#ai-output')).toHaveValue(repo.output);
  await expect(page.locator('#ai-panel script, #ai-panel img')).toHaveCount(0); expect(await page.evaluate(() => Object.hasOwn(window, '__aiLeak'))).toBe(false);
  expect(await page.content()).not.toContain(key);
  await page.locator('#ai-discard').click(); await expect(page.locator('#ai-output')).toHaveValue(''); await expect(page.locator('#body')).toHaveValue('SOURCE_TEXT\n');
  repo.output = 'SAFE_SUGGESTION'; await page.locator('#ai-request').click(); await expect(page.locator('#ai-output')).toHaveValue(repo.output);
  await page.locator('#ai-operation').selectOption('generateTitle'); await expect(page.locator('#ai-apply')).toBeDisabled(); await expect(page.locator('#ai-output')).toHaveValue('');
  await page.locator('#ai-request').click(); await expect(page.locator('#ai-output')).toHaveValue(repo.output);
  await page.locator('#title').fill('MANUAL_NEW_TITLE'); await expect(page.locator('#ai-output')).toHaveValue(''); await expect(page.locator('#ai-apply')).toBeDisabled();
  expect(fs.readFileSync(repo.file)).toEqual(repo.original); expect(repo.calls).toHaveLength(3);
});

test('identical polish says no changes and disables adoption; whitespace-only changes remain real suggestions', async ({ page, repo }, info) => {
  await open(page, repo);
  const original = await page.locator('#body').inputValue();
  repo.output = original;
  await page.locator('#ai-request').click();
  await expect(page.locator('#ai-state')).toHaveText('本次未产生修改');
  await expect(page.locator('#ai-output')).toHaveValue(original);
  await expect(page.locator('#ai-apply')).toBeDisabled();
  await expect(page.locator('#body')).toHaveValue(original);
  await expect(page.locator('#save-state')).toHaveText('已保存（本地源码）');
  expect(fs.readFileSync(repo.file)).toEqual(repo.original);
  expect(repo.calls).toHaveLength(1);
  await page.screenshot({ path: info.outputPath('ai-no-changes.png'), fullPage: true });
  repo.output = original + '\n';
  await page.locator('#ai-request').click();
  await expect(page.locator('#ai-state')).toContainText('建议已返回');
  await expect(page.locator('#ai-apply')).toBeEnabled();
  await page.locator('#ai-apply').click();
  await expect(page.locator('#body')).toHaveValue(original + '\n');
  await expect(page.locator('#save-state')).toHaveText('未保存修改');
  expect(fs.readFileSync(repo.file)).toEqual(repo.original);
  expect(repo.calls).toHaveLength(2);
});

test('upstream auth/rate/truncation/timeout failures preserve the buffer, leave save usable and never retry automatically', async ({ page, repo }) => {
  await open(page, repo); await page.locator('#body').fill('MANUAL_BUFFER');
  for (const [mode, error] of [['auth', 'AI_AUTH_FAILED'], ['rate', 'AI_RATE_LIMITED'], ['invalid', 'AI_INVALID_RESPONSE'], ['slow', 'AI_TIMEOUT']] as const) {
    repo.mode = mode; const count = repo.calls.length;
    await page.locator('#ai-request').click(); await expect(page.locator('#ai-state')).toContainText(error);
    await expect(page.locator('#body')).toHaveValue('MANUAL_BUFFER'); await expect(page.locator('#save')).toBeEnabled(); await expect(page.locator('#ai-apply')).toBeDisabled();
    expect(repo.calls).toHaveLength(count + 1); expect(fs.readFileSync(repo.file)).toEqual(repo.original);
  }
  repo.mode = 'success'; await page.locator('#ai-request').click(); await expect(page.locator('#ai-output')).toHaveValue(repo.output);
});

test('cancel and deliberately late completed responses cannot overwrite newer input', async ({ page, repo }) => {
  await open(page, repo); repo.mode = 'slow';
  await page.locator('#ai-request').click(); await expect.poll(() => repo.calls.length).toBe(1);
  await page.locator('#ai-cancel').click(); await expect(page.locator('#ai-state')).toContainText('取消'); await expect(page.locator('#ai-request')).toBeEnabled();
  repo.mode = 'success';
  let reached!: () => void, release!: () => void, complete!: () => void;
  const ready = new Promise<void>(resolve => { reached = resolve; }), gate = new Promise<void>(resolve => { release = resolve; }), done = new Promise<void>(resolve => { complete = resolve; });
  await page.route('**/api/authoring/v1/think/suggest', async route => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    try { const response = await route.fetch(); reached(); await gate; await route.fulfill({ response }); }
    finally { complete(); }
  });
  await page.locator('#ai-request').click(); await ready;
  await page.locator('#body').fill('NEWER_MANUAL_BUFFER'); release(); await done;
  await expect(page.locator('#ai-request')).toBeEnabled(); await expect(page.locator('#ai-output')).toHaveValue('');
  await expect(page.locator('#body')).toHaveValue('NEWER_MANUAL_BUFFER'); expect(fs.readFileSync(repo.file)).toEqual(repo.original);
});

test.describe('unconfigured backend', () => {
  test.use({ configured: false });
  test('AI is unavailable while ordinary editor validation/save still work', async ({ page, repo }) => {
    await open(page, repo); await expect(page.locator('#ai-service')).toContainText('AI_NOT_CONFIGURED'); await expect(page.locator('#ai-request')).toBeDisabled();
    await page.locator('#body').fill('EDIT_WITHOUT_AI'); await page.locator('#save').click();
    await expect(page.locator('#save-state')).toHaveText('已保存（本地源码）'); expect(fs.readFileSync(repo.file, 'utf8')).toContain('EDIT_WITHOUT_AI'); expect(repo.calls).toHaveLength(0);
  });
});
