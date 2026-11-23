import { chooseWorkspace, reveal } from '../workbench-controls.ts';
import fs from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { test, expect } from '@playwright/test';
import { startStudioHttp } from '../../../studio/server/http.ts';

test('M17 public workbench preserves hidden buffers and usable controls at PC sizes and 125–150% CSS zoom', async ({ page }, info) => {
  const cache = resolve('.cache/studio-m17'); fs.mkdirSync(cache, { recursive: true }); const root = fs.mkdtempSync(join(cache, 'layout-'));
  fs.mkdirSync(join(root, 'src/modules/think/content'), { recursive: true });
  for (const [module, name, wrapper, value] of [['keep', 'bookmarks', 'publicBookmarks', '[]'], ['me', 'profile', 'publicProfile', 'null'], ['build', 'projects', 'publicProjects', '[]']]) {
    fs.mkdirSync(join(root, 'src/modules', module!), { recursive: true });
    fs.writeFileSync(join(root, 'src/modules', module!, 'data.ts'), `import { ${wrapper} } from './${module === 'me' ? 'profile' : name}.ts';\nexport const ${name} = ${wrapper}(${value});\n`);
  }
  const session = await startStudioHttp({ repositoryRoot: root, port: 0, webDirectory: resolve('.cache/studio/web'), ai: { environment: { DASHSCOPE_BASE_URL: 'https://fixture.cn-beijing.maas.aliyuncs.com/compatible-mode/v1', DASHSCOPE_API_KEY: 'NON_SENSITIVE_LAYOUT_CANARY' } } });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(session.origin+'/#maintenance');
    await expect(page.locator('#current-workspace')).toHaveText('Think');
    await expect(page.getByRole('navigation')).toHaveCount(1);
    await expect(page.locator('#intake-editor')).toHaveCount(0);
    const switcher = page.locator('#workspace-switcher > summary');
    await switcher.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#module-录入')).toBeVisible();
    await expect(page.locator('#module-发布')).toBeVisible();
    await expect(page.locator('#module-私人')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#module-录入')).toBeHidden();
    await expect(switcher).toBeFocused();
    await expect(page.locator('#ai-service')).toContainText('已配置');
    expect(await page.locator('body').textContent()).not.toContain('NON_SENSITIVE_LAYOUT_CANARY');
    await page.locator('#new').click(); await page.locator('#slug').fill('layout-fixture'); await page.locator('#body').fill('NON_SENSITIVE_LAYOUT_BUFFER\n'.repeat(30));
    for (const [width, height] of [[1280, 720], [1440, 900]]) for (const zoom of [1, 1.25, 1.5]) {
      await page.setViewportSize({ width: width!, height: height! }); await page.evaluate(value => { document.documentElement.style.zoom = String(value); }, zoom);
      for (const name of ['Keep', 'Me', 'Build', 'Think']) {
        await chooseWorkspace(page, name.toLowerCase());
        await expect(page.locator('#current-workspace')).toHaveText(name);
        await expect(page.locator('#module-' + name.toLowerCase())).toHaveAttribute('aria-current', 'true');
        const rootSelector = name === 'Think' ? '.workspace' : '#' + name.toLowerCase() + '-editor';
        await expect(page.locator(rootSelector)).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      }
      await expect(page.locator('#body')).toHaveValue('NON_SENSITIVE_LAYOUT_BUFFER\n'.repeat(30));
      await page.locator('#save').scrollIntoViewIfNeeded(); await expect(page.locator('#save')).toBeInViewport();
      const box = await page.locator('#save').boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width!);
      await chooseWorkspace(page, '私人'); await expect(page.locator('#private-editor')).toBeVisible();
      await expect(page.locator('#module-私人')).toHaveAttribute('aria-current', 'true');
      await reveal(page, 'workspace-switcher'); await page.locator('#space-public').click(); await expect(page.locator('.workspace')).toBeVisible();
      await expect(page.locator('#body')).toHaveValue('NON_SENSITIVE_LAYOUT_BUFFER\n'.repeat(30));
    }
    for (const [module, create, title, value] of [['keep', 'keep-new', 'keep-title', 'NON_SENSITIVE_KEEP'], ['build', 'build-new', 'build-title', 'NON_SENSITIVE_BUILD'], ['me', 'me-new', 'me-name', 'NON_SENSITIVE_ME']]) {
      await chooseWorkspace(page, module!); await page.locator('#' + create).click(); await page.locator('#' + title).fill(value!);
      await expect(page.locator('#' + module + '-editor .state-badge')).toContainText('未保存修改');
    }
    await chooseWorkspace(page, 'think'); await page.setViewportSize({ width: 1440, height: 900 }); await page.evaluate(() => { document.documentElement.style.zoom = '1'; });
    await page.locator('#body').focus(); await page.keyboard.press('Control+s'); await expect(page.locator('#save-state')).toHaveText('已保存（本地源码）');
    await page.locator('#documents button').filter({ hasText: 'layout-fixture' }).click();
    await expect(page.locator('#title')).toBeVisible();
    await expect(page.locator('#body')).toBeVisible();
    await expect(page.locator('#think-properties > summary')).toBeVisible();
    await expect(page.locator('#slug')).toBeHidden();
    await expect(page.locator('#ai-panel')).toBeHidden();
    await expect(page.locator('#preview')).toBeVisible();
    await page.locator('#save').scrollIntoViewIfNeeded();
    await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); window.scrollTo(0, 0); });
    await page.screenshot({ path: info.outputPath('workbench.png') });
    expect(errors).toEqual([]);
  } finally { await session.close(); assertOwned(); fs.rmSync(root, { recursive: true }); }
  function assertOwned() { expect(relative(cache, root).startsWith('layout-')).toBe(true); }
});
