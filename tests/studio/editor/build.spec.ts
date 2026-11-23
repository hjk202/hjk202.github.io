import { chooseWorkspace, clickDisclosed } from '../workbench-controls.ts';
import fs from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { test as base, expect } from '@playwright/test';
import { startStudioHttp } from '../../../studio/server/http.ts';
import { sourceExpression } from '../../../studio/server/source-expression.ts';

const item = (slug: string, published: boolean) => ({ slug, title: slug + '标题', summary: '非敏感摘要', published, sections: [{ title: '章节', paragraphs: ['说明\n换行'], code: 'code1\ncode2' }], keywords: ['工具'], status: 'in-progress', milestones: [{ title: '阶段一', status: 'planned', description: '已有说明' }], updates: [{ date: '2026-10-23', title: '已有更新', accomplishments: ['完成项'] }], issues: [{ title: '已有问题', description: '问题说明', status: 'open' }] });
type Fixture = { root: string; file: string; origin: string; original: string };
const test = base.extend<{ repo: Fixture; previewBase: string }>({
  previewBase: ['/', { option: true }],
  repo: async ({ page, previewBase }, use) => {
    const cache = resolve('.cache/studio-batch/m11'); fs.mkdirSync(cache, { recursive: true }); const root = fs.mkdtempSync(join(cache, 'browser-'));
    fs.cpSync('src', join(root, 'src'), { recursive: true }); fs.cpSync('public', join(root, 'public'), { recursive: true });
    for (const path of ['package.json', 'astro.config.mjs', 'tsconfig.json']) fs.copyFileSync(path, join(root, path));
    const file = join(root, 'src/modules/build/data.ts');
    const original = `// M11 fixture\nimport { publicProjects } from './projects.ts';\nexport const projects = publicProjects(${JSON.stringify([item('public-test', true), item('draft-test', false)])});\n//build-tail\n`;
    fs.writeFileSync(file, original);
    const errors: string[] = [], external: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const session = await startStudioHttp({ repositoryRoot: root, port: 0, webDirectory: resolve('.cache/studio/web'), previewBase, ai: { environment: {} } });
    page.on('request', request => { if (new URL(request.url()).origin !== session.origin) external.push(request.url()); });
    try { await page.goto(session.origin+'/#think'); await chooseWorkspace(page, 'build'); await expect(page.locator('#build-list button')).toHaveCount(2); await use({ root, file, origin: session.origin, original }); }
    finally {
      expect((await session.close()).ok).toBe(true); expect(errors).toEqual([]); expect(external).toEqual([]);
      expect(relative(cache, root).startsWith('browser-')).toBe(true); fs.rmSync(root, { recursive: true });
    }
  },
});
const entries = (file: string) => sourceExpression(fs.readFileSync(file, 'utf8'), 'projects', 'publicProjects', './projects.ts').value as ReturnType<typeof item>[];

test('M11 stepped forms preserve nested code/records and other projects; draft creation/deletion is explicit', async ({ page, repo }) => {
  await page.locator('#build-list button').filter({ hasText: 'draft-test' }).click(); await page.locator('#build-title').fill('修改草稿项目');
  await page.locator('#build-steps').getByRole('button', { name: '技术内容', exact: true }).click();
  await expect(page.locator('#build-sections').getByLabel('代码（可选，保留换行）')).toHaveValue('code1\ncode2');
  await page.locator('#build-sections').getByLabel('代码（可选，保留换行）').fill('  updated\n\n  code\n');
  await page.locator('#build-steps').getByRole('button', { name: '阶段目标', exact: true }).click(); await page.locator('#build-milestones').getByLabel('阶段状态', { exact: true }).selectOption('done');
  await page.locator('#build-save').click(); await expect(page.locator('#build-message')).toContainText('已保存到本地源码');
  const saved = entries(repo.file); expect(saved[0]).toEqual(item('public-test', true)); expect(saved[1]!.sections[0]!.code).toBe('  updated\n\n  code\n'); expect(saved[1]!.milestones[0]!.status).toBe('done'); expect(saved[1]!.updates).toEqual(item('draft-test', false).updates); expect(saved[1]!.issues).toEqual(item('draft-test', false).issues);
  await page.locator('#build-new').click(); await page.locator('#build-steps').getByRole('button', { name: '基本信息', exact: true }).click();
  for (const [field, text] of Object.entries({ slug: 'new-project', title: '新项目', summary: '非敏感摘要' })) await page.locator('#build-' + field).fill(text);
  await page.locator('#build-steps').getByRole('button', { name: '技术内容', exact: true }).click(); await page.locator('#build-sections textarea').first().fill('非敏感项目说明');
  await page.locator('#build-save').click(); await expect(page.locator('#build-message')).toContainText('已保存到本地源码'); expect(entries(repo.file).at(-1)!.published).toBe(false);
  page.once('dialog', dialog => dialog.dismiss()); await clickDisclosed(page, 'build-actions', '#build-delete'); expect(entries(repo.file)).toHaveLength(3);
  page.once('dialog', dialog => dialog.accept()); await clickDisclosed(page, 'build-actions', '#build-delete'); await expect(page.locator('#build-message')).toContainText('已从源码删除'); expect(entries(repo.file)).toHaveLength(2);
});

test('M11 conflicts keep form/source; formal Vault blocks public-parent deletion and unpublishing', async ({ page, repo }) => {
  await page.locator('#build-list button').filter({ hasText: 'public-test' }).click(); await page.locator('#build-title').fill('保留的项目候选');
  fs.appendFileSync(repo.file, '\n//external'); const raw = fs.readFileSync(repo.file, 'utf8');
  await page.locator('#build-save').click(); await expect(page.locator('#build-message')).toContainText('REVISION_CONFLICT'); await expect(page.locator('#build-title')).toHaveValue('保留的项目候选'); await expect(page.locator('#build-save')).toBeDisabled(); expect(fs.readFileSync(repo.file, 'utf8')).toBe(raw);
  page.once('dialog', dialog => dialog.accept()); await clickDisclosed(page, 'build-actions', '#build-reload'); await expect(page.locator('#build-message')).toContainText('已读取项目');
  fs.mkdirSync(join(repo.root, 'public/vault'), { recursive: true }); fs.writeFileSync(join(repo.root, 'public/vault/bundle.json'), 'NON_SENSITIVE_PRESENCE_FIXTURE');
  page.once('dialog', dialog => dialog.accept()); await clickDisclosed(page, 'build-actions', '#build-delete'); await expect(page.locator('#build-message')).toContainText('无法核对私人补充关联'); expect(fs.readFileSync(repo.file, 'utf8')).toBe(raw);
  await page.locator('#build-published').selectOption('false'); await page.locator('#build-save').click(); await expect(page.locator('#build-message')).toContainText('已阻止删除或取消公开'); expect(fs.readFileSync(repo.file, 'utf8')).toBe(raw);
});

for (const previewBase of ['/', '/personal-space/']) test.describe('M11 original Build Astro preview ' + previewBase, () => {
  test.use({ previewBase });
  // A real isolated Astro build has a 90-second assertion budget; do not let the default 30-second test deadline preempt it.
  test.setTimeout(120_000);
  test('unsaved draft shows project/code/records in inert sandbox without saving', async ({ page, repo }) => {
    await page.locator('#build-list button').filter({ hasText: 'draft-test' }).click(); await page.locator('#build-title').fill('仅预览的项目');
    await page.locator('#build-preview').click(); await expect(page.locator('#build-message')).toContainText('预览完成', { timeout: 90000 });
    const frame = page.locator('#build-preview-frame iframe'); await expect(frame).toHaveAttribute('sandbox', ''); await expect(frame.contentFrame().locator('article.project h1')).toHaveText('仅预览的项目');
    await expect(frame.contentFrame().locator('article.project pre code')).toHaveText('code1\ncode2'); await expect(frame.contentFrame().locator('#milestones')).toContainText('阶段一');
    await expect(frame.contentFrame().locator('script,iframe,form,a[href]')).toHaveCount(0); expect(fs.readFileSync(repo.file, 'utf8')).toBe(repo.original); expect(fs.existsSync(join(repo.root, 'dist'))).toBe(false);
  });
});

