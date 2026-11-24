import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, relative, resolve } from 'node:path';
import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startStudioHttp } from '../../../studio/server/http.ts';
import { publicationFixture } from '../publish-fixture.ts';

const content = 'src/modules/think/content';
const cache = resolve('.cache/studio-think-writing');
const mixedBody = '## 写作验证\r\n\n```js\r\nconst example = "<tag>";\n```\r\n\n最后一行  \r\n';
const original = '\uFEFF---\r\n# 保留这条注释\r\nslug: existing\r\ntitle: "现有文章"\r\nsummary: "非敏感验证"\r\ndate: "2026-10-30"\r\n---\r\n' + mixedBody;
const cm = (page: Page) => page.getByRole('textbox', { name: 'Markdown 编辑器' });
const save = (page: Page) => page.getByRole('button', { name: '保存', exact: true }).click();
const sourceSaved = (page: Page) => expect(page.locator('#writing-save-state')).toHaveText('已保存至网站源码');
const picker = (page: Page) => page.locator('#writing-current');
const open = async (page: Page, label: string | RegExp) => {
  await picker(page).click(); await page.getByRole('button', { name: label }).click();
  await expect(page.locator('#writing-pick')).not.toHaveAttribute('open', '');
};
const structured = (slug: string, body: string) => '---\nslug: ' + slug + '\ntitle: "非敏感测试"\nsummary: "用于测试的摘要"\ndate: "2026-10-30"\n---\n' + body;
type Repo = { source: string; directory: string; calls: string[]; origin: string; restart(): Promise<void>; delay(): Promise<void>; release(): void };
type Bridge = Window & { writingReceive(message: unknown): void; writingMessages: { requestId?: string; status?: string }[] };
const test = base.extend<{ repo: Repo }>({
  repo: async ({ page }, use, info) => {
    fs.mkdirSync(cache, { recursive: true });
    const root = fs.mkdtempSync(join(cache, 'work-')), directory = join(root, content), source = join(directory, 'existing.md');
    fs.cpSync('src', join(root, 'src'), { recursive: true }); fs.cpSync('public', join(root, 'public'), { recursive: true });
    for (const file of ['package.json', 'astro.config.mjs', 'tsconfig.json']) fs.copyFileSync(file, join(root, file));
    fs.writeFileSync(source, original);
    const calls: string[] = [], errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    let pending: Promise<void> | undefined, release = () => {};
    const start = (port = 0) => startStudioHttp({
      repositoryRoot: root, port, webDirectory: resolve('.cache/studio/web'),
      intakeDirectory: join(root, 'inbox'), previewBase: info.project.name === 'webkit' ? '/personal-space/' : '/',
      publication: { receiptDirectory: join(root, 'receipts') },
      ai: { environment: { DASHSCOPE_API_KEY: 'NON_SENSITIVE_WRITING_AI', DASHSCOPE_BASE_URL: 'https://fixture.cn-beijing.maas.aliyuncs.com/compatible-mode/v1' }, fetch: async (_url, init) => {
        const material = JSON.parse(String(init?.body)).messages[1].content as string;
        calls.push(material);
        await pending;
        const arranged = material.startsWith('对比定位样本') ? material.replace('保留第 28 段。', '建议分段甲\n\n建议分段乙\n\n建议分段丙\n\n保留第 28 段。').replace(/保留第 (10|11|12) 段。\n\n/g, '') : '## 建议排版\n\n我只完成了原型。';
        const output = material.includes('教务着变') ? {
          candidate: { metadata: { summary: '未经确认的诗作摘要' }, body: '轻灵在春的光艳中教务着变。\n\n另一段保持原样。' },
          evidence: [], unknowns: ['可能是抄写错误，请对照原出处。'],
          edits: [{ before: '教务着变', after: '交舞着变' }, { before: '#### 林徽因', after: '' }],
        } : { candidate: { metadata: { slug: 'organized', title: '原型笔记', summary: '非敏感摘要' }, body: arranged },
          evidence: [{ field: 'body', quote: '我只完成了原型。' }], unknowns: ['请核对哪些工作仍为计划'] };
        return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(output) } }] }), { headers: { 'Content-Type': 'application/json' } });
      } },
    });
    let session = await start();
    try {
      await use({ source, directory, calls, origin: session.origin, restart: async () => {
        const port = Number(new URL(session.origin).port); expect((await session.close()).ok).toBe(true); session = await start(port);
      }, delay: () => pending = new Promise(resolve => { release = resolve; }), release: () => { release(); pending = undefined; } });
    } finally {
      release(); expect((await session.close()).ok).toBe(true); expect(errors).toEqual([]);
      expect(relative(cache, root).startsWith('work-')).toBe(true); fs.rmSync(root, { recursive: true, force: true });
    }
  },
});

test('default Markdown workspace hand-edits existing source with fast preview and byte-preserved unchanged content', async ({ page, repo }, info) => {
  test.setTimeout(120_000);
  await page.goto(repo.origin);
  await expect(page.locator('#studio-content')).toHaveCount(0);
  await expect(page.locator('#private-editor')).toHaveCount(0);
  expect(await page.getByRole('button').allTextContents()).toEqual(['编辑', '预览', 'AI 整理', '刷新', '保存', '发布']);
  await open(page, '现有文章');
  await expect(cm(page)).toContainText('写作验证');
  await expect(cm(page).getByRole('button', { name: '文章信息' })).toBeVisible();
  await save(page); await sourceSaved(page);
  expect(fs.readFileSync(repo.source, 'utf8')).toBe(original);
  await cm(page).press('Control+End'); await page.keyboard.insertText('手工加入的中文。');
  await page.getByRole('button', { name: '刷新', exact: true }).click();
  await expect(cm(page)).toContainText('手工加入的中文。');
  await page.getByRole('button', { name: '预览', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Markdown 快速预览"]');
  await expect(frame.getByText('手工加入的中文。')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-same-origin');
  expect(fs.readFileSync(repo.source, 'utf8')).toBe(original);
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await expect(cm(page)).toContainText('手工加入的中文。');
  await cm(page).press('Control+s'); await sourceSaved(page);
  const updated = fs.readFileSync(repo.source, 'utf8');
  expect(updated).toMatch(/updatedAt: "\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ"/);
  expect(updated).not.toContain('createdAt:');
  expect(updated.replace(/updatedAt: "[^"]+"\r\n/,'')).toBe(original + '手工加入的中文。');
  expect(repo.calls).toEqual([]);
  await page.screenshot({ path: info.outputPath('writing.png') });
  await page.keyboard.press('Control+Shift+M');
  await expect(page.locator('#current-workspace')).toHaveText('Think');
  await page.locator('#workspace-switcher > summary').click();
  await expect(page.getByRole('button', { name: '私人资料库' })).toBeVisible();
});

test('unstructured draft survives backend and tab restart; a manually completed draft lands in source once', async ({ page, repo }) => {
  await page.goto(repo.origin);
  await expect(cm(page)).toHaveAttribute('contenteditable', 'true');
  await cm(page).fill('原始测试材料。\n\n下一段。');
  await save(page);
  await expect(page.locator('#writing-save-state')).toHaveText('原稿已保存');
  expect(fs.existsSync(join(repo.directory, 'manual.md'))).toBe(false);
  await repo.restart();
  await page.reload();
  await open(page, /本机原稿 · 原始测试材料/);
  await expect(cm(page)).toContainText('下一段。');
  await cm(page).fill(structured('manual', '原始测试材料。\n\n下一段。'));
  await save(page); await sourceSaved(page);
  const savedSource = fs.readFileSync(join(repo.directory, 'manual.md'), 'utf8');
  expect(savedSource).toContain('published: false');
  expect(savedSource).toMatch(/createdAt: "(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ)"\nupdatedAt: "\1"/);
  await page.reload();
  await open(page, '非敏感测试');
  await expect(cm(page)).toContainText('下一段。');
  await picker(page).click(); await expect(page.getByRole('button', { name: /本机原稿/ })).toHaveCount(0);
  expect(repo.calls).toEqual([]);
});

test('AI review is explicit and reversible; an in-flight result cannot replace changed text', async ({ page, repo }) => {
  await page.goto(repo.origin);
  const raw = '我只完成了原型。\n\n这段不应丢失。';
  await cm(page).fill(raw);
  await page.getByRole('button', { name: 'AI 整理', exact: true }).click();
  await expect(page.locator('#writing-ai-review')).toBeVisible();
  expect(repo.calls).toEqual([raw]);
  await expect(page.locator('#writing-ai-apply')).toBeDisabled();
  await expect(page.getByText('请先勾选要应用的修改。')).toBeVisible();
  await page.getByRole('checkbox', { name: /slug（待确认）/ }).check();
  await page.getByRole('checkbox', { name: /标题（待确认）/ }).check();
  await page.getByRole('button', { name: '应用选中修改' }).click();
  await expect(cm(page)).toContainText('原型笔记');
  await expect(cm(page)).toContainText('这段不应丢失。');
  expect(fs.existsSync(join(repo.directory, 'organized.md'))).toBe(false);
  await cm(page).press('Control+z');
  await expect(cm(page)).not.toContainText('原型笔记');
  await expect(cm(page)).toContainText('这段不应丢失。');
  void repo.delay();
  await page.getByRole('button', { name: 'AI 整理', exact: true }).click();
  await expect.poll(() => repo.calls.length).toBe(2);
  await cm(page).fill('新的编辑内容。');
  repo.release();
  await expect(page.locator('#writing-ai-review')).toBeHidden();
  await expect(cm(page)).toContainText('新的编辑内容。');
});

test('AI applies selected buffer corrections with incomplete article information and saves them only as a local draft', async ({ page, repo }) => {
  await page.goto(repo.origin);
  const raw = '---\n# 原稿注释\ntitle: "你是人间的四月天"\nsummary: "林徽因的诗作"\n---\n#### 林徽因\n\n轻灵在春的光艳中教务着变。';
  const files = fs.readdirSync(repo.directory);
  await cm(page).fill(raw);
  await page.getByRole('button', { name: 'AI 整理' }).click();
  await page.getByRole('checkbox', { name: /未经确认的诗作摘要/ }).check();
  await page.getByRole('checkbox', { name: /教务着变.*交舞着变/ }).check();
  const apply = page.getByRole('button', { name: '应用选中修改' });
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(cm(page)).toContainText('交舞着变');
  await expect(cm(page)).toContainText('未经确认的诗作摘要');
  await expect(cm(page)).toContainText('# 原稿注释');
  expect(fs.readdirSync(repo.directory)).toEqual(files);
  await cm(page).press('Control+z');
  await expect(cm(page)).toContainText('教务着变');
  await expect(cm(page)).not.toContainText('未经确认的诗作摘要');
  await page.getByRole('button', { name: 'AI 整理' }).click();
  await page.getByRole('checkbox', { name: /教务着变.*交舞着变/ }).check();
  await apply.click();
  await save(page);
  await expect(page.locator('#writing-save-state')).toHaveText('原稿已保存');
  expect(fs.readdirSync(repo.directory)).toEqual(files);
});

test('AI comparison shares scroll and aligns unchanged blocks after additions and deletions', async ({ page, repo }) => {
  await page.goto(repo.origin);
  const raw = ['对比定位样本。我只完成了原型。', ...Array.from({ length: 42 }, (_, i) => `保留第 ${i + 1} 段。`)].join('\n\n');
  await cm(page).fill(raw);
  await expect(cm(page)).toContainText('保留第 42 段。');
  await page.getByRole('button', { name: 'AI 整理' }).click();
  const bodyChanges = page.getByRole('checkbox', { name: /正文修改/ });
  await expect(bodyChanges).toHaveCount(2);
  for (const change of await bodyChanges.all()) await change.check();
  await page.getByText('查看选中修改的正文对比').click();
  const compare = page.locator('#writing-comparison .cm-mergeView');
  await expect(compare).toBeVisible();
  await compare.scrollIntoViewIfNeeded();
  const left = page.locator('#writing-ai-before'), right = page.locator('#writing-ai-after');
  await expect(left.getByText('保留第 10 段。', { exact: true })).toBeAttached();
  await expect(right.getByText('保留第 10 段。', { exact: true })).toHaveCount(0);
  await compare.evaluate(node => { node.scrollTop = 510; });
  const aligned = async (text: string) => {
    const [a, b] = await Promise.all([left.getByText(text, { exact: true }).boundingBox(), right.getByText(text, { exact: true }).boundingBox()]);
    return Math.abs((a?.y ?? -1000) - (b?.y ?? 1000));
  };
  await expect.poll(() => aligned('保留第 16 段。')).toBeLessThan(2);
  await compare.evaluate(node => { node.scrollTop = 1090; });
  const change = right.getByText('建议分段丙', { exact: true });
  await expect(change).toBeInViewport();
  const startScroll = await compare.evaluate(node => node.scrollTop);
  await change.click();
  await expect.poll(() => compare.evaluate(node => node.scrollTop)).toBeGreaterThan(startScroll + 20);
  await expect.poll(async () => {
    const [chunk, pane] = await Promise.all([right.getByText('建议分段甲', { exact: true }).boundingBox(), compare.boundingBox()]);
    // MergeView can group the leading blank line with the insertion.
    return Math.abs((chunk?.y ?? -1000) - (pane?.y ?? 1000));
  }).toBeLessThan(38);
  await expect.poll(() => aligned('保留第 31 段。')).toBeLessThan(2);
  await page.locator('#writing-ai-cancel').click();
  await expect(cm(page)).toContainText('保留第 10 段。');
  await expect(cm(page)).not.toContainText('建议分段丙');
});

test('AI review exposes a typo even when omitted by the whole candidate, protects credits and stays actionable in a short window', async ({ page, repo }) => {
  await page.setViewportSize({ width: 750, height: 490 });
  await page.goto(repo.origin);
  const poetry = '---\n# 自己的注释\nslug: "poetry-review"\ntitle: "你是人间的四月天"\nsummary: "林徽因的诗作"\ndate: "2026-11-12"\n---\n## 你是人间的四月天\n\n#### 林徽因\n\n轻灵在春的光艳中教务着变。\n\n另一段保持原样。';
  await cm(page).fill(poetry);
  const button = page.locator('#writing-ai-apply');
  const organize = page.getByRole('button', { name: 'AI 整理' });
  await organize.click();
  await expect(button).toBeInViewport();
  await expect(button).toBeDisabled();
  const correction = page.getByRole('checkbox', { name: /教务着变.*交舞着变/ });
  const summary = page.getByRole('checkbox', { name: /摘要（待确认）/ });
  await expect(summary).not.toBeChecked();
  await expect(page.locator('#writing-ai-changes')).not.toContainText('林徽因\n（删除）');
  await correction.check();
  await expect(button).toBeInViewport();
  await page.getByRole('button', { name: '取消' }).click();
  await expect(cm(page)).toContainText('教务着变');
  await organize.click();
  await correction.check();
  await button.click();
  await expect(cm(page)).toContainText('交舞着变');
  await expect(cm(page)).toContainText('#### 林徽因');
  await expect(cm(page)).toContainText('# 自己的注释');
  await expect(cm(page)).not.toContainText('未经确认的诗作摘要');
  expect(fs.existsSync(join(repo.directory, 'poetry-review.md'))).toBe(false);
  await cm(page).press('Control+z');
  await expect(cm(page)).toContainText('教务着变');
});

test('unchanged preview reuses its inert frame, while edits and refresh request new content', async ({ page, repo }) => {
  let requests = 0;
  page.on('request', request => { if (request.url().endsWith('/think/preview-fast')) requests++; });
  await page.goto(repo.origin);
  await cm(page).fill('# 合成预览\n\n第一次预览。');
  const preview = page.locator('#writing-preview'), edit = page.locator('#writing-edit');
  const html = page.frameLocator('#writing-preview-pane iframe');
  await preview.click();
  await expect(html.getByText('第一次预览。')).toBeVisible();
  await page.locator('#writing-preview-pane iframe').evaluate(el => { el.dataset.fixture = 'original'; });
  await edit.click(); await preview.click();
  await expect(page.locator('#writing-preview-pane iframe')).toHaveAttribute('data-fixture', 'original');
  expect(requests).toBe(1);
  await edit.click(); await cm(page).fill('# 合成预览\n\n新改的文字。');
  await preview.click(); await expect(html.getByText('新改的文字。')).toBeVisible();
  expect(requests).toBe(2);
  await page.locator('#writing-refresh').click();
  await expect(cm(page)).toContainText('新改的文字。');
  await preview.click(); await expect(html.getByText('新改的文字。')).toBeVisible();
  expect(requests).toBe(3);
});

test('fast preview renders the website Markdown dialect in an inert frame without public metadata', async ({page,repo},info) => {
  fs.writeFileSync(join(repo.directory,'测试 图.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>');
  const text = [
    '# 中文标题','', '软换行','第二行  ','硬换行与 & <em>行内强调</em>','',
    '1. 有序','2. 第二项','','- 无序','- [x] 任务','', '> 引用','',
    '| 字段 | 值 |','| :--- | ---: |','| 中文 | 3 |','',
    '[示例](https://example.invalid/) ![本地图](./%E6%B5%8B%E8%AF%95%20%E5%9B%BE.svg) ![外链](https://example.invalid/a.png)','',
    '```js','const x = "<tag>";','```','',
    '<div class="attention-equation" role="math" aria-label="公式"><span>QK<sup>T</sup></span></div>','',
    '$x^2$','', '$$', 'x^2', '$$','',
    '<script>window.parent.__previewScriptRan=true</script>',
  ].join('\n');
  const files = fs.readdirSync(repo.directory);
  const external: string[] = [];
  page.on('request', request => { if (request.url().startsWith('https://example.invalid/')) external.push(request.url()); });
  await page.goto(repo.origin);
  await cm(page).fill(text);
  await cm(page).press('Control+Home'); await cm(page).press('Shift+End');
  const selection = await page.evaluate(() => getSelection()?.toString());
  const elapsed: number[] = [];
  for (let n=0;n<3;n++) {
    const start = Date.now();
    await page.getByRole('button',{name:'预览',exact:true}).click();
    const frame = page.frameLocator('iframe[title="Markdown 快速预览"]');
    await expect(frame.getByRole('heading',{name:'中文标题'})).toBeVisible();
    elapsed.push(Date.now()-start);
    await expect(frame.locator('br')).toHaveCount(2);
    await expect(frame.locator('table td').last()).toHaveText('3');
    await expect(frame.locator('ol li')).toHaveCount(2);
    await expect(frame.locator('ul li')).toHaveCount(2);
    await expect(frame.locator('input[type=checkbox]')).toBeDisabled();
    await expect(frame.locator('blockquote')).toContainText('引用');
    await expect(frame.locator('em')).toHaveText('行内强调');
    await expect(frame.locator('a')).not.toHaveAttribute('href');
    await expect(frame.locator('img')).toHaveAttribute('src',/^data:image\/svg\+xml/);
    await expect(frame.locator('pre.astro-code code')).toContainText('const x = "<tag>";');
    await expect(frame.locator('pre .line span[style]').first()).toBeVisible();
    await expect(frame.getByRole('math',{name:'公式'})).toHaveCSS('display','flex');
    await expect(frame.locator('sup')).toHaveText('T');
    await expect(frame.locator('.katex math msup').first()).toBeVisible();
    await expect(frame.locator('.katex-display math')).toBeVisible();
    await expect(frame.locator('script')).toHaveCount(0);
    await expect(page.locator('#writing-message')).toContainText('受限');
    await page.getByRole('button',{name:'编辑',exact:true}).click();
  }
  expect(await page.evaluate(() => getSelection()?.toString())).toBe(selection);
  expect(external).toEqual([]);
  expect(fs.readdirSync(repo.directory)).toEqual(files);
  expect(fs.readFileSync(repo.source,'utf8')).toBe(original);
  await info.attach('fast-preview-click-ms',{body:JSON.stringify(elapsed),contentType:'application/json'});
  console.log(info.project.name + ' fast preview click-to-visible ms ' + elapsed.join(','));
});

test('source line previews a nearby paragraph and image and code insertion undo independently',async({page,repo})=>{
  await page.goto(repo.origin);
  const text=Array.from({length:70},(_,index)=>'第 '+(index+1)+' 段。\n这是中文正文。').join('\n\n');
  await cm(page).fill(text);
  await cm(page).press('Control+End');
  const scroll=await page.locator('.cm-scroller').evaluate(el=>el.scrollTop);
  expect(scroll).toBeGreaterThan(0);
  await page.getByRole('button',{name:'预览',exact:true}).click();
  const frame=page.frameLocator('iframe[title="Markdown 快速预览"]');
  await expect(frame.getByText(/第 70 段/)).toBeInViewport();
  await expect(frame.locator('[data-source-line="208"]')).toContainText('第 70 段');
  await page.getByRole('button',{name:'编辑',exact:true}).click();
  await expect.poll(()=>page.locator('.cm-scroller').evaluate(el=>el.scrollTop)).toBe(scroll);
  await cm(page).press('Control+Alt+c');
  await page.keyboard.insertText('js');
  await expect(cm(page)).toContainText('```js');
  await cm(page).press('Control+z');
  await cm(page).press('Control+z');
  await expect(cm(page)).not.toContainText('```');
  await cm(page).evaluate(el=>{
    const transfer=new DataTransfer();
    const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
    transfer.items.add(new File([bytes],'clipboard.png',{type:'image/png'}));
    el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:transfer}));
  });
  await expect(cm(page)).toContainText('./assets/');
  expect(fs.readdirSync(join(repo.directory,'assets'))).toHaveLength(1);
  await page.getByRole('button',{name:'预览',exact:true}).click();
  await expect(frame.locator('img')).toHaveAttribute('src',/^data:image\/png/);
  await page.getByRole('button',{name:'编辑',exact:true}).click();
  await cm(page).press('Control+z');
  await expect(cm(page)).not.toContainText('./assets/');
});

test('writing timer pauses on idle and focus loss and follows a local draft into source', async ({page,repo}) => {
  const time = page.locator('#writing-time');
  await page.clock.install();
  await page.goto(repo.origin);
  await cm(page).fill('需要恢复的计时原稿。');
  await page.clock.runFor(12_000);
  const draftStored = page.waitForResponse(response=>response.url().endsWith('/writing-time') && response.ok());
  await save(page); await draftStored;
  await expect(page.locator('#writing-save-state')).toHaveText('原稿已保存');
  await expect(time).toHaveText('写作 0:12');
  await repo.restart(); await page.reload();
  await open(page,/本机原稿/);
  await expect(time).toHaveText('写作 0:12');
  await cm(page).fill(structured('clock', '需要恢复的计时原稿。'));
  await page.clock.runFor(45_000);
  await expect(time).toHaveText('写作 0:42');
  await cm(page).press('Control+End'); await page.keyboard.insertText('加入一行。');
  await page.clock.runFor(4_000);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.clock.runFor(20_000);
  await expect(time).toHaveText('写作 0:46');
  const persisted = page.waitForResponse(response=>response.url().endsWith('/writing-time') && response.request().postDataJSON().sourceKey);
  await save(page); await sourceSaved(page); await persisted;
  const bytes = fs.readFileSync(join(repo.directory,'clock.md'),'utf8');
  await repo.restart(); await page.reload(); await open(page,'非敏感测试');
  await expect(time).toHaveText('写作 0:46');
  await page.getByRole('button',{name:'预览',exact:true}).click();
  await expect(page.frameLocator('iframe[title="Markdown 快速预览"]').getByText(/加入一行/)).toBeVisible();
  await page.clock.runFor(35_000);
  await expect(time).toHaveText('写作 0:46');
  expect(fs.readFileSync(join(repo.directory,'clock.md'),'utf8')).toBe(bytes);
});

test('cooperative close can save an unstructured draft; an externally changed article is not overwritten', async ({ page, repo }) => {
  await page.addInitScript(() => {
    const bridge = window as unknown as Bridge, handlers: ((event: MessageEvent) => void)[] = [];
    bridge.writingMessages = [];
    bridge.writingReceive = message => handlers.forEach(fn => fn(new MessageEvent('message', { data: message })));
    Object.defineProperty(window, 'chrome', { value: { webview: {
      postMessage: (value: unknown) => bridge.writingMessages.push(value as Bridge['writingMessages'][number]),
      addEventListener: (_type: string, handler: (event: MessageEvent) => void) => handlers.push(handler),
    } } });
  });
  await page.goto(repo.origin);
  await open(page, '现有文章');
  await cm(page).press('Control+End'); await page.keyboard.insertText('保持编辑缓冲。');
  fs.appendFileSync(repo.source, 'EXTERNAL_SOURCE_EDIT');
  await page.getByRole('button', { name: '刷新', exact: true }).click();
  await expect(page.locator('#writing-message')).toContainText('外部变动');
  await expect(cm(page)).toContainText('保持编辑缓冲。');
  const id = randomUUID();
  await page.evaluate(requestId => (window as unknown as Bridge).writingReceive({ type: 'studio:prepare-close', requestId }), id);
  await page.getByRole('button', { name: '保存并退出', exact: true }).click();
  await expect.poll(() => page.evaluate(requestId => (window as unknown as Bridge).writingMessages.some(m => m.requestId === requestId && m.status === 'ready'), id)).toBe(true);
  expect(fs.readFileSync(repo.source, 'utf8')).toBe(original + 'EXTERNAL_SOURCE_EDIT');
  await repo.restart(); await page.reload();
  await open(page, /本机原稿/);
  await expect(cm(page)).toContainText('保持编辑缓冲。');
  await expect(page.locator('#writing-message')).toContainText('源版本已变化');
});

for (const mode of ['success', 'fast'] as const) base(`Think publish (${mode}) reviews the exact candidate once, cancels without source writes, and verifies the approved result`, async ({ page }) => {
  base.setTimeout(120_000);
  const cleanups: (() => void | Promise<void>)[] = [];
  const repo = await publicationFixture({ after: fn => cleanups.push(fn) }, mode);
  const session = await repo.startHttp();
  const file = join(repo.root, content, 'confirmed.md');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(session.origin);
    await cm(page).fill(structured('confirmed', '明确授权的非敏感正文。'));
    const publish = page.getByRole('button', { name: '发布', exact: true });
    repo.gateway.writeAvailable = async () => false;
    await publish.click();
    await expect(page.locator('#writing-publish-issues')).toContainText('GITHUB_WRITE_UNAVAILABLE', { timeout: 35_000 });
    await expect(page.locator('#writing-publish-confirm')).toBeDisabled();
    await page.locator('#writing-publish-cancel').click();
    repo.gateway.writeAvailable = async () => true;
    await publish.click();
    await expect(page.locator('#writing-publish-diff')).toContainText('明确授权的非敏感正文。', { timeout: 35_000 });
    if (mode === 'fast') await expect(page.locator('#writing-publish-target')).toContainText('GitHub 构建和验证');
    expect(fs.existsSync(file)).toBe(false); expect(repo.calls.push).toBe(0);
    await page.locator('#writing-publish-cancel').click();
    await expect(page.locator('#writing-publish-review')).toBeHidden();
    expect(fs.existsSync(file)).toBe(false); expect(repo.calls.push).toBe(0);
    await publish.click();
    await page.getByRole('button', { name: '确认发布', exact: true }).click();
    await expect(page.locator('#writing-publication-state')).toHaveText('已上线', { timeout: 60_000 });
    await sourceSaved(page);
    expect(fs.readFileSync(file, 'utf8')).toContain('published: true');
    expect(repo.calls).toEqual({ push: 1, dispatch: 1, verify: 1 });
    expect(repo.fullChecks()).toBe(mode === 'fast' ? 0 : 1);
    expect(errors).toEqual([]);
  } finally { for (const cleanup of cleanups) await cleanup(); }
});

base('Think shows the confirmed push when a deployment response is lost and reconciles without re-publishing', async ({ page }) => {
  base.setTimeout(120_000);
  const cleanups: (() => void | Promise<void>)[] = [];
  const repo = await publicationFixture({ after: fn => cleanups.push(fn) }, 'dispatch-lost');
  const session = await repo.startHttp();
  try {
    await page.goto(session.origin);
    await cm(page).fill(structured('uncertain', '只使用隔离发布测试材料。'));
    await page.getByRole('button', { name: '发布', exact: true }).click();
    await page.getByRole('button', { name: '确认发布', exact: true }).click();
    await expect(page.locator('#writing-publication-state')).toHaveText('已推送，部署待核对', { timeout: 60_000 });
    await sourceSaved(page);
    await expect(page.getByRole('button', { name: '发布', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: '核对发布' }).click();
    await expect(page.locator('#writing-publication-state')).toHaveText('已上线');
    expect(repo.calls).toEqual({ push: 1, dispatch: 1, verify: 1 });
  } finally { for (const cleanup of cleanups) await cleanup(); }
});

base('Think can keep writing and close after the deployment request is confirmed', async ({ page }) => {
  base.setTimeout(90_000);
  const cleanups: (() => void | Promise<void>)[] = [];
  const repo = await publicationFixture({ after: fn => cleanups.push(fn) }, 'fast-wait');
  const session = await repo.startHttp();
  try {
    await page.goto(session.origin);
    await cm(page).fill(structured('pending', '隔离发布稿件。'));
    await page.getByRole('button', { name: '发布', exact: true }).click();
    await page.getByRole('button', { name: '确认发布', exact: true }).click();
    await expect(page.locator('#writing-publication-state')).toHaveText('已推送，等待部署', { timeout: 30_000 });
    await sourceSaved(page);
    await cm(page).fill(structured('pending', '等待远端时我可以继续写作。'));
    await expect(page.getByRole('button', {name:'保存', exact:true})).toBeEnabled();
    await expect(page.getByRole('button', {name:'发布', exact:true})).toBeDisabled();
    expect((await session.close()).ok).toBe(true);
    expect(repo.calls).toEqual({push:1, dispatch:1, verify:0});
  } finally { for (const cleanup of cleanups) await cleanup(); }
});
