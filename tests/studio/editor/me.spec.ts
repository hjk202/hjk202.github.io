import { chooseWorkspace, reveal, clickDisclosed } from '../workbench-controls.ts';
import fs from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { test as base, expect } from '@playwright/test';
import { startStudioHttp } from '../../../studio/server/http.ts';
import { sourceExpression } from '../../../studio/server/source-expression.ts';

const profile = { name: '测试姓名', description: '非敏感介绍', paragraphs: ['第一段\n第二行'], links: [{ label: '测试链接', url: 'https://example.com/' }], published: false };
type Fixture = { file: string; root: string; original: string };
const test = base.extend<{ repo: Fixture; previewBase: string }>({
  previewBase: ['/', { option: true }],
  repo: async ({ page, previewBase }, use) => {
    const cache = resolve('.cache/studio-batch/m10'); fs.mkdirSync(cache, { recursive: true }); const root = fs.mkdtempSync(join(cache, 'browser-'));
    fs.cpSync('src', join(root, 'src'), { recursive: true }); fs.cpSync('public', join(root, 'public'), { recursive: true });
    for (const path of ['package.json', 'astro.config.mjs', 'tsconfig.json']) fs.copyFileSync(path, join(root, path));
    const file = join(root, 'src/modules/me/data.ts'), original = `// M10 fixture\nimport { publicProfile } from './profile.ts';\nexport const profile = publicProfile(${JSON.stringify(profile)});\n//tail\n`;
    fs.writeFileSync(file, original);
    const errors: string[] = [], external: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const session = await startStudioHttp({ repositoryRoot: root, port: 0, webDirectory: resolve('.cache/studio/web'), previewBase, ai: { environment: {} } });
    page.on('request', request => { if (new URL(request.url()).origin !== session.origin) external.push(request.url()); });
    try { await page.goto(session.origin+'/#think'); await chooseWorkspace(page, 'me'); await expect(page.locator('#me-name')).toHaveValue(profile.name); await use({ root, file, original }); }
    finally { expect((await session.close()).ok).toBe(true); expect(errors).toEqual([]); expect(external).toEqual([]); expect(relative(cache, root).startsWith('browser-')).toBe(true); fs.rmSync(root, { recursive: true }); }
  },
});
const source = (file: string) => sourceExpression(fs.readFileSync(file, 'utf8'), 'profile', 'publicProfile', './profile.ts').value;

test('M10 singleton edit/optional links/clear cancellation and null do not fabricate data', async ({ page, repo }) => {
  await page.locator('#me-name').fill('修改后的姓名'); await page.locator('#me-save').click(); await expect(page.locator('#me-message')).toContainText('已保存到本地源码');
  expect(source(repo.file)).toEqual({ ...profile, name: '修改后的姓名' });
  page.once('dialog', dialog => dialog.dismiss()); await clickDisclosed(page, 'me-actions', '#me-clear'); expect(source(repo.file)).not.toBeNull();
  page.once('dialog', dialog => dialog.accept()); await clickDisclosed(page, 'me-actions', '#me-clear'); await expect(page.locator('#me-message')).toContainText('已清空为 null'); expect(source(repo.file)).toBeNull();
  await expect(page.locator('#me-form')).toBeHidden(); await clickDisclosed(page, 'me-actions', '#me-reload'); await expect(page.locator('#me-empty')).toContainText('没有资料');
  await page.locator('#me-new').click(); await expect(page.locator('#me-name')).toHaveValue(''); await expect(page.locator('#me-published')).toHaveValue('false');
  expect(source(repo.file)).toBeNull();
});
test('M10 whole-file conflict keeps unsaved form and blocks clear/save until explicit reload', async ({ page, repo }) => {
  await page.locator('#me-name').fill('保留的未保存姓名'); fs.appendFileSync(repo.file, '\n//external'); const changed = fs.readFileSync(repo.file, 'utf8');
  await page.locator('#me-save').click(); await expect(page.locator('#me-message')).toContainText('REVISION_CONFLICT'); await expect(page.locator('#me-name')).toHaveValue('保留的未保存姓名');
  await expect(page.locator('#me-save')).toBeDisabled(); await expect(page.locator('#me-clear')).toBeDisabled(); expect(fs.readFileSync(repo.file, 'utf8')).toBe(changed);
  page.once('dialog', dialog => dialog.accept()); await clickDisclosed(page, 'me-actions', '#me-reload'); await expect(page.locator('#me-name')).toHaveValue(profile.name);
  await reveal(page, 'me-properties'); await page.locator('#me-links input').last().fill('javascript:bad()'); await page.locator('#me-save').click(); await expect(page.locator('#me-message')).toContainText('VALIDATION_FAILED'); expect(fs.readFileSync(repo.file, 'utf8')).toBe(changed);
});
for (const previewBase of ['/', '/personal-space/']) test.describe('M10 original Me Astro preview ' + previewBase, () => {
  test.use({ previewBase });
  // A real isolated Astro build has a 90-second assertion budget; do not let the default 30-second test deadline preempt it.
  test.setTimeout(120_000);
  test('unsaved draft uses singleton template and sandbox, source/dist untouched', async ({ page, repo }) => {
    await page.locator('#me-name').fill('仅预览的姓名'); await page.locator('#me-preview').click(); await expect(page.locator('#me-message')).toContainText('资料预览完成', { timeout: 90000 });
    const frame = page.locator('#me-preview-frame iframe'); await expect(frame).toHaveAttribute('sandbox', ''); await expect(frame.contentFrame().locator('article.profile h1')).toHaveText('仅预览的姓名');
    await expect(frame.contentFrame().locator('script,iframe,form,a[href]')).toHaveCount(0); expect(fs.readFileSync(repo.file, 'utf8')).toBe(repo.original); expect(fs.existsSync(join(repo.root, 'dist'))).toBe(false);
  });
});
