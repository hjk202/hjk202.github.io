import fs from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { test as base, expect } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { startStudioHttp } from '../../../studio/server/http.ts';
import type { StudioHttpSession } from '../../../studio/server/http.ts';
import { keyOf } from '../../../studio/server/think/files.ts';
import { parseFrontmatter } from 'astro/markdown';

type Repository = { root: string; content: string; session: StudioHttpSession; restart(): Promise<void> };
const cache = resolve('.cache/studio-m3');
const test = base.extend<{ repo: Repository }>({
  repo: async ({ page }, use) => {
    fs.mkdirSync(cache, { recursive: true });
    const root = fs.mkdtempSync(join(cache, 'browser-'));
    const content = join(root, 'src/modules/think/content');
    fs.mkdirSync(content, { recursive: true });
    const errors: string[] = [];
    const externalRequests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).origin !== repo.session.origin) externalRequests.push(request.url()); });
    const sessions: StudioHttpSession[] = [];
    const open = async (port = 0) => { const value = await startStudioHttp({ repositoryRoot: root, port, webDirectory: resolve('.cache/studio/web') }); sessions.push(value); return value; };
    const repo: Repository = { root, content, session: await open(), restart: async () => { const port = Number(new URL(repo.session.origin).port); await repo.session.close(); repo.session = await open(port); } };
    try { await use(repo); }
    finally {
      for (const session of sessions) expect((await session.close()).ok).toBe(true);
      expect(relative(cache, root).startsWith('browser-') && !relative(cache, root).includes('..')).toBe(true);
      fs.rmSync(root, { recursive: true, force: true });
      expect(errors).toEqual([]);
      expect(externalRequests).toEqual([]);
    }
  },
});
const source = (slug: string, body = '\nSOURCE_BODY\n') => `---\n# preserve comment\nslug: ${slug}\n---\n${body}`;
const article = (page: Page, name: string) => page.locator('#documents button').filter({ hasText: name });
const message = (page: Page) => page.locator('#message');
const saved = async (page: Page) => { await expect(page.locator('#save-state')).toHaveText('已保存（本地源码）'); await expect(page.locator('#save')).toBeEnabled(); };
async function create(page: Page, slug: string) {
  await page.getByRole('button', { name: '新建文章', exact: true }).click();
  await page.getByLabel('Slug', { exact: true }).fill(slug);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await saved(page);
}
async function hold(page: Page, predicate: (route: Route) => boolean) {
  let release!: () => void, reached!: () => void, completed!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const ready = new Promise<void>(resolve => { reached = resolve; });
  const finished = new Promise<void>(resolve => { completed = resolve; });
  let used = false;
  const handler = async (route: Route) => {
    if (used || !predicate(route)) { await route.continue(); return; }
    used = true;
    try {
      const response = await route.fetch();
      reached(); await gate;
      await route.fulfill({ response });
    } finally { completed(); }
  };
  await page.route('**/api/authoring/v1/think/**', handler);
  return { ready, release, done: async () => { release(); if (used) await finished; await page.unroute('**/api/authoring/v1/think/**', handler); } };
}

test('empty list → draft → validation → published note → delete; all changes stay in source', async ({ page, repo }, info) => {
  await page.goto(repo.session.origin);
  await expect(page.locator('#list-message')).toContainText('当前列表为空');
  await expect(page.locator('#studio-session')).toHaveCount(0);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  expect(await page.context().cookies()).toEqual([]);
  await page.getByRole('button', { name: '新建文章', exact: true }).click();
  await page.getByRole('button', { name: '校验', exact: true }).click();
  await expect(page.locator('#issues')).toContainText('INVALID_SLUG');
  await expect(page.locator('#slug')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Slug', { exact: true }).fill('new-note');
  await page.getByRole('button', { name: '校验', exact: true }).click();
  await expect(page.locator('#validation-state')).toHaveText('可保存 · 尚未公开就绪');
  expect(fs.readdirSync(repo.content)).toEqual([]);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await saved(page);
  await expect(page.locator('#slug')).toHaveJSProperty('readOnly', true);
  await expect(page.locator('#filename')).toHaveText('new-note.md');
  expect(fs.readFileSync(join(repo.content, 'new-note.md'), 'utf8')).toContain('published: false');
  await page.getByLabel('标题', { exact: true }).fill('中文标题');
  await page.getByLabel('摘要', { exact: true }).fill('手动确认的非敏感摘要');
  await page.getByLabel('日期', { exact: true }).fill('2026-02-30');
  await page.getByLabel('内容类型', { exact: true }).selectOption('note');
  await page.getByLabel('候选公开状态', { exact: true }).selectOption('true');
  await page.getByLabel('Markdown 正文', { exact: true }).fill('\n## 中文正文\n\n<img src="https://example.invalid/no" onerror="window.__studioXss=true">\n');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('#issues')).toContainText('INVALID_DATE');
  await expect(page.locator('#save-state')).toHaveText('未保存修改');
  expect(fs.readFileSync(join(repo.content, 'new-note.md'), 'utf8')).not.toContain('中文标题');
  await page.getByLabel('日期', { exact: true }).fill('2026-10-16');
  await page.getByRole('button', { name: '校验', exact: true }).click();
  await expect(page.locator('#validation-state')).toHaveText('可保存 · 公开就绪');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await saved(page);
  await expect(page.locator('#source-state')).toContainText('源文件：published');
  expect(parseFrontmatter(fs.readFileSync(join(repo.content, 'new-note.md'), 'utf8')).frontmatter.kind).toBe('note');
  expect(await page.evaluate(() => Object.hasOwn(window, '__studioXss'))).toBe(false);
  await page.locator('#filter').selectOption('draft');
  await expect(page.locator('#documents button')).toHaveCount(0);
  await page.locator('#filter').selectOption('published');
  await expect(article(page, '中文标题')).toHaveCount(1);
  await page.screenshot({ path: info.outputPath('editor.png'), fullPage: true });
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: '删除文章', exact: true }).click();
  expect(fs.existsSync(join(repo.content, 'new-note.md'))).toBe(true);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '删除文章', exact: true }).click();
  await expect(page.locator('#editor')).toBeHidden();
  await expect(page.locator('#documents button')).toHaveCount(0);
  expect(fs.readdirSync(repo.content)).toEqual([]);
});

test('existing omitted fields/comments survive no-op and body-only saves; unsafe sources are read-only', async ({ page, repo }) => {
  const original = source('old-url');
  fs.writeFileSync(join(repo.content, 'different-file.md'), original);
  await page.goto(repo.session.origin);
  await article(page, 'old-url').click();
  await expect(page.locator('#slug')).toHaveJSProperty('readOnly', true);
  await expect(page.locator('#published')).toHaveValue('');
  await expect(page.locator('#kind')).toHaveValue('');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await saved(page);
  expect(fs.readFileSync(join(repo.content, 'different-file.md'), 'utf8')).toBe(original);
  await page.getByLabel('Markdown 正文', { exact: true }).fill('\nBODY_ONLY_CHANGE  \n');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await saved(page);
  expect(fs.readFileSync(join(repo.content, 'different-file.md'), 'utf8')).toBe(source('old-url', '\nBODY_ONLY_CHANGE  \n'));
  expect(fs.existsSync(join(repo.content, 'old-url.md'))).toBe(false);
  fs.writeFileSync(join(repo.content, 'bad.md'), '---\nslug: bad\nunknown: must-not-be-dropped\n---\n');
  await page.locator('#refresh').click();
  await article(page, 'bad.md').click();
  await expect(page.locator('#body')).toBeDisabled();
  await expect(page.locator('#title')).toBeDisabled();
  await expect(page.locator('#save')).toBeDisabled();
  await expect(page.locator('#issues')).toContainText('UNKNOWN_FIELD');
});

test('unsaved navigation/new/reload prompts cancel safely, keyboard save and tab refresh guards work', async ({ page, repo }) => {
  fs.writeFileSync(join(repo.content, 'a.md'), source('article-a'));
  fs.writeFileSync(join(repo.content, 'b.md'), source('article-b'));
  await page.goto(repo.session.origin);
  await article(page, 'article-a').click();
  await page.getByLabel('Markdown 正文', { exact: true }).fill('UNSAVED_BUFFER');
  for (const action of [() => article(page, 'article-b').click(), () => page.locator('#new').click(), () => page.locator('#reload').click()]) {
    page.once('dialog', dialog => dialog.dismiss()); await action();
    await expect(page.locator('#body')).toHaveValue('UNSAVED_BUFFER');
  }
  await page.locator('#refresh').click();
  await expect(page.locator('#list-message')).toContainText('2 项');
  await expect(page.locator('#body')).toHaveValue('UNSAVED_BUFFER');
  const reloadCancelled = new Promise<void>(resolve => page.once('dialog', async dialog => { expect(dialog.type()).toBe('beforeunload'); await dialog.dismiss(); resolve(); }));
  await page.evaluate(() => window.location.reload());
  await reloadCancelled;
  await expect(page.locator('#body')).toHaveValue('UNSAVED_BUFFER');
  const closed = new Promise<void>(resolve => page.once('dialog', async dialog => { expect(dialog.type()).toBe('beforeunload'); await dialog.dismiss(); resolve(); }));
  await page.close({ runBeforeUnload: true });
  await closed;
  expect(page.isClosed()).toBe(false);
  await page.locator('#body').press('Control+s');
  await saved(page);
  expect(fs.readFileSync(join(repo.content, 'a.md'), 'utf8')).toContain('UNSAVED_BUFFER');
  await page.reload();
  await expect(page.locator('#editor')).toBeHidden();
  await article(page, 'article-a').click();
  await expect(page.locator('#body')).toHaveValue('UNSAVED_BUFFER');
  await page.locator('#body').fill('DISCARD_WITH_CONFIRM');
  page.once('dialog', dialog => dialog.accept());
  await article(page, 'article-b').click();
  await expect(page.locator('#slug')).toHaveValue('article-b');
  expect(fs.readFileSync(join(repo.content, 'a.md'), 'utf8')).not.toContain('DISCARD_WITH_CONFIRM');
});

test('two tabs and external edits conflict without overwrite/retry; manual re-read is explicit', async ({ page, repo }) => {
  fs.writeFileSync(join(repo.content, 'a.md'), source('conflict'));
  await page.goto(repo.session.origin); await article(page, 'conflict').click();
  const second = await page.context().newPage();
  const errors: string[] = []; second.on('pageerror', error => errors.push(error.message));
  await second.goto(repo.session.origin); await article(second, 'conflict').click();
  await page.locator('#body').fill('TAB_ONE'); await page.locator('#save').click(); await saved(page);
  await second.locator('#body').fill('TAB_TWO_BUFFER'); await second.locator('#save').click();
  await expect(message(second)).toContainText('REVISION_CONFLICT');
  await expect(second.locator('#body')).toHaveValue('TAB_TWO_BUFFER');
  await expect(second.locator('#save')).toBeDisabled();
  expect(fs.readFileSync(join(repo.content, 'a.md'), 'utf8')).toContain('TAB_ONE');
  second.once('dialog', dialog => dialog.dismiss()); await second.locator('#reload').click();
  await expect(second.locator('#body')).toHaveValue('TAB_TWO_BUFFER');
  second.once('dialog', dialog => dialog.accept()); await second.locator('#reload').click();
  await expect(second.locator('#body')).toHaveValue('TAB_ONE');
  await second.locator('#body').fill('AFTER_EXTERNAL');
  fs.appendFileSync(join(repo.content, 'a.md'), '\nEXTERNAL_BYTES\n');
  await second.locator('#save').click();
  await expect(message(second)).toContainText('REVISION_CONFLICT');
  await expect(second.locator('#body')).toHaveValue('AFTER_EXTERNAL');
  expect(fs.readFileSync(join(repo.content, 'a.md'), 'utf8')).toContain('EXTERNAL_BYTES');
  expect(errors).toEqual([]);
  await second.close();
});

test('late reads, list filters, validation and save responses cannot overwrite newer input', async ({ page, repo }) => {
  fs.writeFileSync(join(repo.content, 'a.md'), source('read-a'));
  fs.writeFileSync(join(repo.content, 'b.md'), source('read-b'));
  await page.goto(repo.session.origin);
  const aKey = keyOf('a.md');
  const read = await hold(page, route => route.request().url().endsWith('/documents/' + aKey));
  try {
    await article(page, 'read-a').click(); await read.ready;
    await article(page, 'read-b').click();
    await expect(page.locator('#slug')).toHaveValue('read-b');
  } finally { await read.done(); }
  await expect(page.locator('#slug')).toHaveValue('read-b');
  const validation = await hold(page, route => route.request().url().endsWith('/validate'));
  try {
    await page.locator('#validate').click(); await validation.ready;
    await page.locator('#title').fill('NEWER_TITLE');
  } finally { await validation.done(); }
  await expect(message(page)).toContainText('旧报告未应用');
  await expect(page.locator('#issues')).toBeEmpty();
  const saving = await hold(page, route => route.request().method() === 'PUT');
  try {
    await page.locator('#body').fill('SENT_SNAPSHOT');
    await page.locator('#save').click(); await saving.ready;
    await page.locator('#body').fill('EDITED_DURING_SAVE');
  } finally { await saving.done(); }
  await expect(message(page)).toContainText('当前缓冲仍有未保存修改');
  await expect(page.locator('#body')).toHaveValue('EDITED_DURING_SAVE');
  await expect(page.locator('#save-state')).toHaveText('未保存修改');
  expect(fs.readFileSync(join(repo.content, 'b.md'), 'utf8')).toContain('SENT_SNAPSHOT');
  expect(fs.readFileSync(join(repo.content, 'b.md'), 'utf8')).not.toContain('EDITED_DURING_SAVE');
  await page.locator('#save').click(); await saved(page);
  const filtering = await hold(page, route => route.request().url().endsWith('?status=draft'));
  try {
    await page.locator('#filter').selectOption('draft'); await filtering.ready;
    await page.locator('#filter').selectOption('published');
    await expect(page.locator('#documents button')).toHaveCount(0);
  } finally { await filtering.done(); }
  await expect(page.locator('#documents button')).toHaveCount(0);
  await expect(page.locator('#body')).toHaveValue('EDITED_DURING_SAVE');
});

test('write failure, stopped service and invalidated session preserve the buffer and never auto-retry', async ({ page, repo }) => {
  await page.goto(repo.session.origin); await create(page, 'failure');
  await page.locator('#body').fill('DO_NOT_LOSE_BUFFER');
  await repo.restart();
  await page.locator('#refresh').click();
  await expect(page.locator('#list-message')).toContainText('UNAUTHORIZED');
  await expect(page.locator('#save')).toBeDisabled();
  await expect(page.locator('#body')).toHaveValue('DO_NOT_LOSE_BUFFER');
  page.once('dialog', dialog => dialog.accept());
  await page.reload();
  await article(page, 'failure').click();
  await page.locator('#body').fill('DO_NOT_LOSE_BUFFER');
  let writes = 0;
  const deny = async (route: Route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    writes++;
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'FILE_OPERATION_FAILED', message: 'isolated failure', issues: [] } }) });
  };
  await page.route('**/api/authoring/v1/think/**', deny);
  await page.locator('#save').click(); await expect(message(page)).toContainText('FILE_OPERATION_FAILED');
  expect(writes).toBe(1);
  await expect(page.locator('#body')).toHaveValue('DO_NOT_LOSE_BUFFER');
  await expect(page.locator('#save-state')).toHaveText('未保存修改');
  await page.unroute('**/api/authoring/v1/think/**', deny);
  await repo.session.close();
  await page.locator('#save').click(); await expect(message(page)).toContainText('CONNECTION_LOST');
  await expect(page.locator('#body')).toHaveValue('DO_NOT_LOSE_BUFFER');
  await expect(page.locator('#save')).toBeDisabled();
  await page.locator('#body').press('Control+s');
  await repo.restart();
  // Existing tab has an expired token: refresh the list must not silently re-pair or erase text.
  await page.locator('#refresh').click();
  await expect(page.locator('#list-message')).toContainText('UNAUTHORIZED');
  await expect(page.locator('#body')).toHaveValue('DO_NOT_LOSE_BUFFER');
  expect(fs.readFileSync(join(repo.content, 'failure.md'), 'utf8')).not.toContain('DO_NOT_LOSE_BUFFER');
});

test('Chromium browser IME protocol composes Chinese without implicit save; keyboard save follows composition', async ({ page, repo }, info) => {
  test.skip(info.project.name !== 'chromium', 'WebKit has no CDP IME protocol; real browser IME composition is verified in Windows Chromium.');
  await page.goto(repo.session.origin); await create(page, 'ime');
  const cdp = await page.context().newCDPSession(page);
  await page.locator('#body').focus();
  await cdp.send('Input.imeSetComposition', { text: '中文输入', selectionStart: 4, selectionEnd: 4 });
  await expect(page.locator('#body')).toHaveValue('中文输入');
  await expect(page.locator('#save')).toBeDisabled();
  expect(fs.readFileSync(join(repo.content, 'ime.md'), 'utf8')).not.toContain('中文输入');
  await page.locator('#body').press('Control+s');
  expect(fs.readFileSync(join(repo.content, 'ime.md'), 'utf8')).not.toContain('中文输入');
  await cdp.send('Input.insertText', { text: '中文输入' });
  await expect(page.locator('#save')).toBeEnabled();
  await page.locator('#body').press('End');
  await page.locator('#body').press('Enter');
  await page.locator('#body').press('Control+s');
  await saved(page);
  expect(fs.readFileSync(join(repo.content, 'ime.md'), 'utf8')).toContain('中文输入\n');
  await cdp.detach();
});
