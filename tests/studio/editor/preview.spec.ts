import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { extname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { test as baseTest, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startStudioHttp } from '../../../studio/server/http.ts';
import type { StudioHttpSession } from '../../../studio/server/http.ts';

type Repo = { root: string; source: string; original: Buffer; session: StudioHttpSession; tripwire: string; requests: string[]; website(output: string): string; restart(timeoutMs?: number): Promise<void> };
const cache = resolve('.cache/studio-m4');
const test = baseTest.extend<{ repo: Repo; previewBase: string }>({
  previewBase: ['/', { option: true }],
  repo: async ({ page, previewBase }, use, info) => {
    fs.mkdirSync(cache, { recursive: true }); const root = fs.mkdtempSync(join(cache, 'browser-'));
    fs.cpSync('src', join(root, 'src'), { recursive: true }); fs.cpSync('public', join(root, 'public'), { recursive: true });
    for (const file of ['package.json', 'astro.config.mjs', 'tsconfig.json']) fs.copyFileSync(file, join(root, file));
    const fixtureContent = join(root, 'src/modules/think/content');
    for (const name of fs.readdirSync(fixtureContent).filter(name => name.endsWith('.md') && name !== 'understanding-from-the-bottom.md')) {
      const target = resolve(fixtureContent, name);
      expect(target.startsWith(root + sep)).toBe(true); fs.unlinkSync(target);
    }
    const source = join(root, 'src/modules/think/content/understanding-from-the-bottom.md');
    fs.writeFileSync(source, fs.readFileSync(source, 'utf8').replace('published: true', 'published: false'));
    fs.copyFileSync('tests/fixtures/think/probe.svg.fixture', join(root, 'src/modules/think/content/probe.svg'));
    const original = fs.readFileSync(source), requests: string[] = [], errors: string[] = [];
    const tripwire = createServer((req, res) => { requests.push(req.url!); res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); res.end('<svg xmlns="http://www.w3.org/2000/svg"/>'); });
    await new Promise<void>(resolve => tripwire.listen(0, '127.0.0.1', resolve));
    const address = tripwire.address(); if (!address || typeof address === 'string') throw new Error('Tripwire did not start');
    let siteOutput = '';
    const site = createServer((req, res) => {
      try {
        const url = new URL(req.url!, 'http://preview-test.invalid');
        if (!url.pathname.startsWith(previewBase)) throw new Error('Outside base');
        const path = decodeURIComponent(url.pathname.slice(previewBase.length));
        const file = resolve(siteOutput, path.endsWith('/') || !path ? path + 'index.html' : path);
        if (!file.startsWith(siteOutput + sep)) throw new Error('Outside fixture build');
        const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
        const body = fs.readFileSync(file);
        res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }); res.end(body);
      } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); }
    });
    await new Promise<void>(resolve => site.listen(0, '127.0.0.1', resolve));
    const siteAddress = site.address(); if (!siteAddress || typeof siteAddress === 'string') throw new Error('Fixture website did not start');
    const sessions: StudioHttpSession[] = [];
    const open = async (port = 0, timeoutMs?: number) => {
      const session = await startStudioHttp({ repositoryRoot: root, port, webDirectory: resolve('.cache/studio/web'), previewBase, ...(timeoutMs === undefined ? {} : { previewTimeoutMs: timeoutMs }) }); sessions.push(session); return session;
    };
    const repo: Repo = { root, source, original, requests, tripwire: `http://127.0.0.1:${address.port}`, session: await open(), website: output => { siteOutput = output; return `http://127.0.0.1:${siteAddress.port}${previewBase}`; }, restart: async timeoutMs => { const port = Number(new URL(repo.session.origin).port); await repo.session.close(); repo.session = await open(port, timeoutMs); } };
    const recordErrors = (target: Page) => target.on('pageerror', error => errors.push(error.message));
    recordErrors(page); page.context().on('page', recordErrors);
    try { await use(repo); }
    finally {
      for (const session of sessions) expect((await session.close()).ok).toBe(true);
      await new Promise<void>(resolve => tripwire.close(() => resolve()));
      site.closeAllConnections(); await new Promise<void>(resolve => site.close(() => resolve()));
      await info.attach('preview-errors-and-network', { contentType: 'application/json', body: JSON.stringify({ errors, tripwireRequests: requests }) });
      expect(errors).toEqual([]); expect(requests).toEqual([]);
      expect(relative(cache, root).startsWith('browser-') && !relative(cache, root).includes('..')).toBe(true); fs.rmSync(root, { recursive: true, force: true });
    }
  },
});
test.setTimeout(180_000);
const selectOriginal = async (page: Page, origin: string) => { await page.goto(origin); await page.locator('#documents button').filter({ hasText: '底层' }).click(); await expect(page.locator('#body')).not.toHaveValue(''); };
const jobs = (repo: Repo) => { const dir = join(repo.root, '.cache/studio/preview'); return fs.existsSync(dir) ? fs.readdirSync(dir) : []; };
const waitPreview = async (page: Page) => { await expect(page.locator('#preview-state')).toContainText('仅为当前候选', { timeout: 110_000 }); return page.frameLocator('#preview-frame iframe'); };
function websiteBuild(repo: Repo, base: string, label: string, count: number) {
  execFileSync(process.execPath, [resolve('node_modules/astro/bin/astro.mjs'), 'build', '--base', base, '--outDir', label], { cwd: repo.root, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' }, stdio: 'ignore', timeout: 90_000 });
  const output = join(repo.root, label);
  const index = JSON.parse(fs.readFileSync(join(output, 'search-index.json'), 'utf8'));
  expect(index.modules.find((module: { id: string }) => module.id === 'think').count).toBe(count);
  expect(index.results.filter((result: { module: string }) => result.module === 'think')).toHaveLength(count);
  return output;
}

for (const previewBase of ['/', '/personal-space/']) test.describe(previewBase, () => {
  test.use({ previewBase });
  test('unsaved candidate → sandboxed real Astro → explicit save → public build → hide/delete and count', async ({ page, repo }, info) => {
    await selectOriginal(page, repo.session.origin);
    const body = await page.locator('#body').inputValue();
    await page.locator('#body').fill(body + '\n## M4_CANDIDATE\n\n```js\nconst value = "<tag> & 中文";\n```\n\n![Fixture image](./probe.svg)\n' + '\n长文段落。'.repeat(30));
    if (previewBase !== '/') await page.locator('#kind').selectOption('note');
    const dirty = await page.locator('#save-state').innerText();
    await page.locator('#preview').click(); const frame = await waitPreview(page);
    await expect(frame.locator('[role="math"]')).toBeVisible();
    await expect(frame.locator('.think-article')).toHaveCSS('max-width', '720px');
    expect(await frame.locator('body').evaluate(() => [...document.styleSheets].some(sheet => [...sheet.cssRules].some(rule => rule instanceof CSSMediaRule && /width/.test(rule.conditionText))))).toBe(true);
    await expect(frame.locator('pre code')).toContainText('<tag> & 中文');
    await expect(frame.getByRole('img', { name: 'Fixture image' })).toBeVisible();
    expect(await frame.getByRole('img', { name: 'Fixture image' }).evaluate((image: HTMLImageElement) => image.naturalWidth > 0)).toBe(true);
    await expect(page.locator('#preview-frame iframe')).toHaveAttribute('sandbox', '');
    expect(await frame.locator('body').evaluate(() => { try { void window.parent.document.body; return 'exposed'; } catch { return 'blocked'; } })).toBe('blocked');
    await expect(frame.locator('script, iframe, form')).toHaveCount(0);
    await expect(page.locator('#save-state')).toHaveText(dirty);
    expect(fs.readFileSync(repo.source)).toEqual(repo.original); expect(jobs(repo)).toEqual([]);
    await page.locator('#preview-frame iframe').screenshot({ path: info.outputPath('article-preview.png') });
    await page.screenshot({ path: info.outputPath('preview.png'), fullPage: true });
    const digest = createHash('sha256').update(repo.original).digest('hex');
    await info.attach('source-and-preview', { contentType: 'application/json', body: JSON.stringify({ previewBase, sourceSha256: digest, sourceUnchangedBeforeSave: true, candidateUnsaved: true, sandboxOpaque: true, jobsClean: true }) });
    await page.locator('#save').click(); await expect(page.locator('#save-state')).toHaveText('已保存（本地源码）');
    expect(fs.readFileSync(repo.source, 'utf8')).toContain('published: false');
    expect(fs.readFileSync(repo.source, 'utf8')).toContain('M4_CANDIDATE');
    await page.locator('#published').selectOption('true'); await page.locator('#save').click();
    await expect(page.locator('#save-state')).toHaveText('已保存（本地源码）'); await expect(page.locator('#save')).toBeEnabled();
    const published = websiteBuild(repo, previewBase, 'published-out', 1);
    expect(fs.readFileSync(join(published, 'think/understanding-from-the-bottom/index.html'), 'utf8')).toContain('M4_CANDIDATE');
    if (previewBase !== '/') expect(fs.readFileSync(join(published, 'think/index.html'), 'utf8')).toContain('M4_CANDIDATE');
    expect(fs.existsSync(join(published, 'studio'))).toBe(false);
    const visitor = await page.context().newPage(), home = repo.website(published);
    await visitor.goto(home);
    await visitor.getByRole('link', { name: 'Think, 1 entry', exact: true }).click();
    if (previewBase !== '/') await expect(visitor.locator('.note-body')).toContainText('M4_CANDIDATE');
    await visitor.getByRole('link', { name: '我为什么越来越喜欢从底层理解一个东西', exact: true }).click();
    await expect(visitor).toHaveURL(home + 'think/understanding-from-the-bottom/');
    await expect(visitor.locator('[role="math"]')).toBeVisible(); await expect(visitor.locator('.prose')).toContainText('M4_CANDIDATE');
    await visitor.reload(); await expect(visitor.locator('[role="math"]')).toBeVisible();
    await visitor.getByRole('link', { name: /返回 Think/ }).click();
    await visitor.getByRole('button', { name: 'Search my space', exact: true }).click();
    await visitor.getByRole('combobox').fill('底层'); await visitor.getByRole('combobox').press('Enter');
    await expect(visitor).toHaveURL(home + 'think/understanding-from-the-bottom/');
    await visitor.getByRole('link', { name: 'Home', exact: true }).click(); await expect(visitor).toHaveURL(home);
    await page.locator('#published').selectOption('false'); await page.locator('#save').click();
    await expect(page.locator('#save-state')).toHaveText('已保存（本地源码）'); await expect(page.locator('#save')).toBeEnabled();
    const hidden = websiteBuild(repo, previewBase, 'hidden-out', 0);
    expect(fs.existsSync(join(hidden, 'think/understanding-from-the-bottom/index.html'))).toBe(false);
    repo.website(hidden); await visitor.goto(home);
    await expect(visitor.getByRole('link', { name: 'Think, 0 entries', exact: true })).toBeVisible();
    expect((await visitor.request.get(home + 'think/understanding-from-the-bottom/')).status()).toBe(404);
    await visitor.goto(home + 'think/'); await expect(visitor.locator('main')).toContainText('暂无公开文章');
    page.once('dialog', dialog => dialog.accept()); await page.locator('#delete').click(); await expect(page.locator('#editor')).toBeHidden();
    repo.website(websiteBuild(repo, previewBase, 'empty-out', 0));
    await visitor.goto(home + 'think/'); await expect(visitor.locator('main')).toContainText('暂无公开文章');
    expect((await visitor.request.get(home + 'think/understanding-from-the-bottom/')).status()).toBe(404);
    await visitor.close();
    expect(fs.existsSync(join(repo.root, 'src/modules/think/content/probe.svg'))).toBe(true);
  });
});

test('HTML/scripts/frames/remote resources cannot execute, reach the tripwire or read authoring credentials', async ({ page, repo }) => {
  await selectOriginal(page, repo.session.origin);
  await page.locator('#body').fill(`## SAFE\n<script>parent.__previewLeak=true;fetch('${repo.tripwire}/script')</script><iframe src="${repo.tripwire}/frame"></iframe><img src="${repo.tripwire}/image" onerror="parent.__previewLeak=true"><form action="${repo.tripwire}/form"><input name="token"></form><a href="${repo.tripwire}/link">remote</a><p style="background:url(${repo.tripwire}/css)">text</p>`);
  await page.locator('#preview').click(); const frame = await waitPreview(page);
  await expect(frame.locator('h2')).toHaveText('SAFE');
  await expect(frame.locator('script, iframe, form, input')).toHaveCount(0);
  await expect(frame.locator('a[href]')).toHaveCount(0);
  expect(await page.evaluate(() => Object.hasOwn(window, '__previewLeak'))).toBe(false);
  expect(repo.requests).toEqual([]); expect(fs.readFileSync(repo.source)).toEqual(repo.original);
  await page.locator('#body').fill('## AFTER_CHANGE');
  await expect(page.locator('#preview-frame iframe')).toHaveCount(0); await expect(page.locator('#preview-state')).toContainText('失效');
});

test('remote optimized Markdown images are blocked before network access and traversal cannot import outside staging', async ({ page, repo }) => {
  const config = join(repo.root, 'astro.config.mjs');
  fs.writeFileSync(config, fs.readFileSync(config, 'utf8').replace("output: 'static',", "output: 'static', image: { domains: ['127.0.0.1'] },"));
  await selectOriginal(page, repo.session.origin);
  await page.locator('#body').fill(`![Remote](${repo.tripwire}/optimized.svg)`);
  await page.locator('#preview').click();
  await expect(page.locator('#message')).toContainText('PREVIEW_RESOURCE_BLOCKED', { timeout: 110_000 });
  expect(repo.requests).toEqual([]); expect(jobs(repo)).toEqual([]);
  await page.locator('#body').fill('![Escape](../../../../../../outside.svg)');
  await page.locator('#preview').click();
  await expect(page.locator('#message')).toContainText('PREVIEW_RESOURCE_BLOCKED', { timeout: 110_000 });
  expect(jobs(repo)).toEqual([]); expect(fs.readFileSync(repo.source)).toEqual(repo.original);
});

test('timeout/cancel/build failure are recoverable, clean temporary work, preserve source and reject stale response', async ({ page, repo }) => {
  await repo.restart(1); await selectOriginal(page, repo.session.origin);
  await page.locator('#preview').click(); await expect(page.locator('#message')).toContainText('PREVIEW_TIMEOUT', { timeout: 20_000 });
  expect(jobs(repo)).toEqual([]); expect(fs.readFileSync(repo.source)).toEqual(repo.original);
  await repo.restart(); await page.reload(); await page.locator('#documents button').filter({ hasText: '底层' }).click();
  await expect(page.locator('#body')).not.toHaveValue('');
  await page.locator('#preview').click(); await page.locator('#cancel-preview').click();
  await expect(page.locator('#preview-state')).toContainText('取消');
  await expect.poll(() => jobs(repo), { timeout: 15_000 }).toEqual([]);
  const config = join(repo.root, 'astro.config.mjs'), good = fs.readFileSync(config);
  fs.writeFileSync(config, 'throw new Error("NON_SENSITIVE_BUILD_FAILURE");');
  await page.locator('#preview').click(); await expect(page.locator('#message')).toContainText('PREVIEW_FAILED', { timeout: 110_000 });
  expect(jobs(repo)).toEqual([]); fs.writeFileSync(config, good);
  await page.locator('#preview').click(); await waitPreview(page);
  await page.locator('#body').fill('## NEW_BUFFER');
  let release!: () => void, reached!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), ready = new Promise<void>(resolve => { reached = resolve; });
  await page.route('**/api/authoring/v1/think/preview', async route => { reached(); await gate; await route.fulfill({ json: { ok: true, value: { html: '<h1>STALE_RESPONSE</h1>', fingerprint: '0'.repeat(64), blockedResources: 0, cleanupPending: false } } }); });
  await page.locator('#preview').click(); await ready; await page.locator('#body').fill('## EVEN_NEWER_BUFFER'); release();
  await expect(page.locator('#preview-frame iframe')).toHaveCount(0);
  await expect(page.locator('#body')).toHaveValue('## EVEN_NEWER_BUFFER');
  expect(fs.readFileSync(repo.source)).toEqual(repo.original);
});
