import { chooseWorkspace, reveal, clickDisclosed } from '../workbench-controls.ts';
import fs from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { test as base, expect } from '@playwright/test';
import { startStudioHttp } from '../../../studio/server/http.ts';
import { sourceExpression } from '../../../studio/server/source-expression.ts';

const item = (slug: string, published: boolean) => ({ slug, title: slug + '标题', description: '非敏感说明', published, sourceUrl: 'https://example.com/', note: ['说明\n换行', '第二段'], kind: '课程', category: { id: 'tools', label: '工具' } });
type Fixture = { root: string; file: string; origin: string; original: string };
const test = base.extend<{ repo: Fixture; previewBase: string }>({
  previewBase: ['/', { option: true }],
  repo: async ({ page, previewBase }, use) => {
    const cache = resolve('.cache/studio-batch/m9'); fs.mkdirSync(cache, { recursive: true }); const root = fs.mkdtempSync(join(cache, 'browser-'));
    fs.cpSync('src', join(root, 'src'), { recursive: true }); fs.cpSync('public', join(root, 'public'), { recursive: true });
    for (const path of ['package.json', 'astro.config.mjs', 'tsconfig.json']) fs.copyFileSync(path, join(root, path));
    const file = join(root, 'src/modules/keep/data.ts');
    const original = `// M9 fixture\nimport { publicBookmarks } from './bookmarks.ts';\nexport const bookmarks = publicBookmarks(${JSON.stringify([item('public-test', true), item('draft-test', false)])});\n//keep-tail\n`;
    fs.writeFileSync(file, original);
    const errors: string[] = [], external: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const session = await startStudioHttp({ repositoryRoot: root, port: 0, webDirectory: resolve('.cache/studio/web'), previewBase, ai: { environment: {} } });
    page.on('request', request => { if (new URL(request.url()).origin !== session.origin) external.push(request.url()); });
    try { await page.goto(session.origin+'/#think'); await chooseWorkspace(page, 'keep'); await expect(page.locator('#keep-list button')).toHaveCount(2); await use({ root, file, origin: session.origin, original }); }
    finally {
      expect((await session.close()).ok).toBe(true); expect(errors).toEqual([]); expect(external).toEqual([]);
      expect(relative(cache, root).startsWith('browser-')).toBe(true); fs.rmSync(root, { recursive: true });
    }
  },
});
const entries = (file: string) => sourceExpression(fs.readFileSync(file, 'utf8'), 'bookmarks', 'publicBookmarks', './bookmarks.ts').value as ReturnType<typeof item>[];

test('M9 cooperative exit preserves hidden Keep buffers on cancel and saves both changed modules explicitly', async ({ page, repo }) => {
  type ExitWindow = Window & { __keepMessages: Record<string, unknown>[]; __keepClose(id: string): void };
  await page.addInitScript(() => {
    const target = window as unknown as ExitWindow, handlers: ((event: MessageEvent) => void)[] = [];
    target.__keepMessages = [];
    Object.defineProperty(window, 'chrome', { configurable: true, value: { webview: {
      postMessage: (message: Record<string, unknown>) => target.__keepMessages.push(message),
      addEventListener: (_name: string, callback: (event: MessageEvent) => void) => handlers.push(callback),
    } } });
    target.__keepClose = requestId => handlers.forEach(handler => handler(new MessageEvent('message', { data: { type: 'studio:prepare-close', requestId } })));
  });
  await page.reload(); await chooseWorkspace(page, 'keep'); await page.locator('#keep-list button').filter({ hasText: 'draft-test' }).click();
  await page.locator('#keep-title').fill('隐藏缓冲测试');
  await chooseWorkspace(page, 'think'); await page.locator('#new').click(); await page.locator('#slug').fill('m9-exit-think'); await page.locator('#body').fill('非敏感 Think 缓冲');
  await page.evaluate(id => (window as unknown as ExitWindow).__keepClose(id), crypto.randomUUID());
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('#keep-title')).toHaveValue('隐藏缓冲测试'); expect(fs.readFileSync(repo.file, 'utf8')).toBe(repo.original);
  const requestId = crypto.randomUUID(); await page.evaluate(id => (window as unknown as ExitWindow).__keepClose(id), requestId);
  await page.getByRole('button', { name: '保存并退出', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as ExitWindow).__keepMessages.at(-1))).toEqual({ type: 'studio:close-result', requestId, status: 'ready' });
  expect(entries(repo.file)[1]!.title).toBe('隐藏缓冲测试'); expect(fs.readFileSync(join(repo.root, 'src/modules/think/content/m9-exit-think.md'), 'utf8')).toContain('非敏感 Think 缓冲');
});

test('M9 Keep form CRUD preserves other drafts and paragraphs; cancelling deletion keeps the candidate', async ({ page, repo }) => {
  await page.locator('#keep-list button').filter({ hasText: 'draft-test' }).click();
  await expect(page.locator('#keep-notes textarea').first()).toHaveValue('说明\n换行');
  await page.locator('#keep-title').fill('修改草稿'); await page.locator('#keep-save').click(); await expect(page.locator('#keep-message')).toContainText('已保存到本地源码');
  expect(entries(repo.file)[0]).toEqual(item('public-test', true)); expect(entries(repo.file)[1]!.note).toEqual(['说明\n换行', '第二段']);
  await page.locator('#keep-new').click();
  for (const [field, text] of Object.entries({ slug: 'new-test', title: '新收藏', description: '说明', sourceUrl: 'https://example.com/course' })) await page.locator('#keep-' + field).fill(text);
  await reveal(page, 'keep-extra-notes'); await page.locator('#keep-notes textarea').first().fill('新说明'); await page.locator('#keep-save').click(); await expect(page.locator('#keep-message')).toContainText('已保存到本地源码');
  expect(entries(repo.file).at(-1)!.published).toBe(false);
  page.once('dialog', dialog => dialog.dismiss()); await clickDisclosed(page, 'keep-actions', '#keep-delete'); expect(entries(repo.file)).toHaveLength(3);
  page.once('dialog', dialog => dialog.accept()); await clickDisclosed(page, 'keep-actions', '#keep-delete'); await expect(page.locator('#keep-message')).toContainText('已从源码删除'); expect(entries(repo.file)).toHaveLength(2);
});

test('M9 conflict and an unknown completed write preserve the form and prohibit blind retries', async ({ page, repo }) => {
  await page.locator('#keep-list button').filter({ hasText: 'public-test' }).click(); await page.locator('#keep-title').fill('本地候选');
  fs.appendFileSync(repo.file, '\n// external-change\n'); const external = fs.readFileSync(repo.file, 'utf8');
  await reveal(page, 'keep-list-options'); await page.locator('#keep-refresh').click(); await expect(page.locator('#keep-message')).toContainText('编辑版本与缓冲未覆盖');
  await page.locator('#keep-save').click(); await expect(page.locator('#keep-message')).toContainText('REVISION_CONFLICT');
  await expect(page.locator('#keep-title')).toHaveValue('本地候选'); await expect(page.locator('#keep-save')).toBeDisabled(); expect(fs.readFileSync(repo.file, 'utf8')).toBe(external);
  page.once('dialog', dialog => dialog.accept()); await clickDisclosed(page, 'keep-actions', '#keep-reload'); await expect(page.locator('#keep-message')).toContainText('已读取收藏');
  await page.locator('#keep-title').fill('写入结果不明');
  await page.route('**/api/authoring/v1/keep/documents/public-test', async route => { if (route.request().method() !== 'PUT') return route.continue(); await route.fetch(); await route.abort(); });
  await page.locator('#keep-save').click(); await expect(page.locator('#keep-message')).toContainText('CONNECTION_LOST');
  await expect(page.locator('#keep-title')).toHaveValue('写入结果不明'); await expect(page.locator('#keep-save')).toBeDisabled(); expect(entries(repo.file)[0]!.title).toBe('写入结果不明');
});

for (const previewBase of ['/', '/personal-space/']) test.describe('M9 real Keep Astro preview ' + previewBase, () => {
  test.use({ previewBase });
  // A real isolated Astro build has a 90-second assertion budget; do not let the default 30-second test deadline preempt it.
  test.setTimeout(120_000);
  test('draft preview uses genuine template and inert sandbox without saving', async ({ page, repo }) => {
    await page.locator('#keep-list button').filter({ hasText: 'draft-test' }).click(); await page.locator('#keep-title').fill('仅预览的新标题');
    await page.locator('#keep-preview').click(); await expect(page.locator('#keep-message')).toContainText('预览完成', { timeout: 90000 });
    const frame = page.locator('#keep-preview-frame iframe'); await expect(frame).toHaveAttribute('sandbox', '');
    await expect(frame.contentFrame().locator('article.bookmark h1')).toHaveText('仅预览的新标题');
    await expect(frame.contentFrame().locator('script,iframe,form,a[href]')).toHaveCount(0);
    expect(fs.readFileSync(repo.file, 'utf8')).toBe(repo.original);
    expect(fs.existsSync(join(repo.root, 'dist'))).toBe(false);
    expect(fs.readdirSync(join(repo.root, '.cache/studio/preview'))).toEqual([]);
  });
});
