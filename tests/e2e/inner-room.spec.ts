import { test, expect, type Page } from '@playwright/test';
import { encryptVault } from '../../src/core/vault/crypto.ts';
import { allVaultFixture, vaultPassword, articleId } from '../fixtures/vault.ts';

async function unlock(page: Page, value: unknown = allVaultFixture) {
  const envelope = await encryptVault(value, vaultPassword);
  await page.route('**/vault/bundle.json', route => route.fulfill({ json: envelope }));
  await page.locator('[data-vault-entrance]').press('Enter');
  await page.getByLabel('私人空间口令', { exact: true }).fill(vaultPassword);
  await page.getByRole('button', { name: '解锁', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-vault-unlocked', '');
  await expect(page.locator('[data-vault-dialog]')).not.toBeVisible();
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`inner room theme follows authenticated state, not ${colorScheme} preference`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./');
    const background = () => page.locator('body').evaluate(node => getComputedStyle(node).backgroundColor);
    const original = await background();
    await page.screenshot({ path: info.outputPath('public-home.png') });
    await page.locator('[data-vault-entrance]').press('Enter');
    expect(await background()).toBe(original);
    await page.getByLabel('私人空间口令', { exact: true }).press('Escape');
    expect(await background()).toBe(original);
    await unlock(page);
    expect(await background()).toBe('rgb(13, 18, 25)');
    await page.screenshot({ path: info.outputPath('inner-home.png') });
    await page.getByRole('button', { name: 'Search my space', exact: true }).click();
    await expect(page.getByRole('option', { selected: true })).toHaveCount(0);
    await page.getByRole('combobox').fill('底层');
    await expect(page.getByRole('option')).toHaveCount(1);
    await page.screenshot({ path: info.outputPath('inner-search.png'), animations: 'disabled' });
    await page.getByRole('combobox').press('Escape');
    await expect(page.locator('[data-spotlight]')).not.toBeVisible();
    await page.getByRole('button', { name: '锁定私人空间' }).click();
    expect(await background()).toBe(original);
    await expect(page.locator('html')).not.toHaveAttribute('data-vault-unlocked');
  });
}

const modules = [
  { id: 'me', private: '.private-profile', public: '.profile-story', text: '从一个问题', link: /^Me, average/ },
  { id: 'think', private: '.private-thoughts', public: '.thought-reading', text: '我为什么越来越喜欢从底层理解一个东西', link: 'Think, 3 entries' },
  { id: 'keep', private: '.private-bookmarks', public: '.keep-directory > .bookmark-group', text: 'The Missing Semester', link: 'Keep, 2 entries' },
  { id: 'build', private: '.private-projects', public: '.project-directory > .project-entries', text: 'NEMU', link: 'Build, 2 entries' },
];

for (const module of modules) test(`inner ${module.id}: private first, public intact, responsive and clean on lock`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`./${module.id}/`);
  const publicText = await page.locator(module.public).textContent();
  await page.goto('./');
  await unlock(page);
  await page.getByRole('link', { name: module.link, exact: true }).click();
  await expect(page.locator(module.private)).toBeVisible();
  await expect(page.locator(module.public)).toContainText(module.text);
  // Compare complete public text, not only the title, to catch missing content.
  expect(await page.locator(module.public).evaluate(node => {
    const copy = node.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('.private-project-note').forEach(note => note.remove());
    return copy.textContent;
  })).toBe(publicText);
  expect(await page.evaluate(({ private: first, public: second }) => {
    return !!(document.querySelector(first)!.compareDocumentPosition(document.querySelector(second)!) & Node.DOCUMENT_POSITION_FOLLOWING);
  }, module)).toBe(true);
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`${module.id}-${width}.png`), fullPage: true });
  }
  if (module.id === 'keep') {
    await page.getByRole('button', { name: '私人工具', exact: true }).click();
    await expect(page.getByRole('link', { name: /全部公开收藏/ })).toBeVisible();
    await expect(page.locator(module.public)).toBeVisible();
    expect(new URL(page.url()).search).toBe('');
  }
  if (module.id === 'build') {
    await expect(page.locator('[data-public-project="nemu"] .private-project-note')).toContainText('含私人记录');
    await expect(page.locator('.project-directory > .project-entries > .project-entry')).toHaveCount(1);
  }
  await page.getByRole('button', { name: '锁定私人空间' }).click();
  await expect(page.locator('.vault-view, .private-project-note')).toHaveCount(0);
  expect(await page.locator(module.public).textContent()).toBe(publicText);
  expect(await page.locator('body').textContent()).not.toContain('CANARY_P4');
  expect(errors).toEqual([]);
});

test('inner Build supplement follows identity and precedes the full public archive', async ({ page }) => {
  await page.goto('./');
  await unlock(page);
  await page.getByRole('link', { name: 'Build, 2 entries', exact: true }).click();
  await page.getByRole('link', { name: 'NEMU：从指令执行到分页与异常的 x86 模拟器', exact: true }).click();
  await expect(page.locator('.private-project-supplement')).toContainText('补充测试记录');
  expect(await page.evaluate(() => {
    const before = (a: string, b: string) => !!(document.querySelector(a)!.compareDocumentPosition(document.querySelector(b)!) & Node.DOCUMENT_POSITION_FOLLOWING);
    return before('.project-cover', '.private-project-supplement') && before('.private-project-supplement', '#archive');
  })).toBe(true);
  await expect(page.locator('#archive')).toContainText('分页');
  await page.getByRole('button', { name: '锁定私人空间' }).click();
  await expect(page.locator('.private-project-supplement')).toHaveCount(0);
  await expect(page.locator('#archive')).toContainText('分页');
});

test('inner search distinguishes public, private and shared targets then removes source markers on lock', async ({ page }, info) => {
  await page.goto('./');
  const fixture = structuredClone(allVaultFixture);
  fixture.modules.me.paragraphs.push('韩江恺：非敏感的同目标检索样本。');
  await unlock(page, fixture);
  await page.getByRole('button', { name: 'Search my space', exact: true }).click();
  await expect(page.getByRole('option', { selected: true })).toHaveCount(0);
  await expect(page.locator('.result-visibility')).toHaveCount(0);
  for (const [query, visibility, label] of [['底层', 'public', '公开'], ['CANARY_P4_ME', 'private', '私人'], ['韩江恺', 'mixed', '公开 · 含私人内容']]) {
    await page.getByRole('combobox').fill(query);
    const option = page.locator(`[role="option"][data-visibility="${visibility}"]`).first();
    await expect(option.locator('.result-visibility')).toHaveText(label);
  }
  await page.getByRole('combobox').fill('Me');
  await expect(page.getByRole('option').first().locator('.result-visibility')).toHaveCount(0);
  await page.getByRole('combobox').fill('私人');
  await expect(page.locator('[data-visibility="private"]')).not.toHaveCount(0);
  await page.screenshot({ path: info.outputPath('inner-search-sources.png'), animations: 'disabled' });
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-vault-lock]')!.click());
  await expect(page.getByRole('combobox')).toHaveValue('');
  await expect(page.locator('.result-visibility, [data-visibility]')).toHaveCount(0);
  await page.getByRole('combobox').fill('CANARY_P4');
  await expect(page.getByRole('option')).toHaveCount(0);
});

test('inner empty private modules retain all public content without placeholder cards', async ({ page }) => {
  await page.goto('./');
  await unlock(page, { version: 1, modules: { think: { posts: [] }, keep: { bookmarks: [] }, build: { projects: [], supplements: [] }, me: { paragraphs: [] } }, assets: {} });
  for (const module of modules) {
    await page.locator(`[data-compass-link][data-module="${module.id}"]`).click();
    await expect(page.locator('html')).toHaveAttribute('data-vault-unlocked', '');
    await expect(page.locator('.vault-view')).toHaveCount(0);
    await expect(page.locator(module.public)).toContainText(module.text);
    await page.getByRole('link', { name: 'Home', exact: true }).click();
  }
});

test('inner reduced motion, opaque fallback and both kinds of reading remain usable at narrow widths', async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('./');
  await unlock(page);
  await page.addStyleTag({ content: '.spotlight { backdrop-filter:none!important; -webkit-backdrop-filter:none!important; background:var(--surface)!important; } .spotlight::backdrop { backdrop-filter:none!important; }' });
  await page.setViewportSize({ width: 320, height: 400 });
  await page.getByRole('button', { name: 'Search my space', exact: true }).click();
  await page.getByRole('combobox').fill('私人文章');
  await expect(page.locator('[data-spotlight]')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('[data-spotlight]')).toHaveCSS('background-color', 'rgb(24, 33, 43)');
  await expect(page.getByRole('button', { name: 'Close search' })).toBeVisible();
  await expect(page.getByRole('option')).toBeVisible();
  await page.screenshot({ path: info.outputPath('inner-opaque-320.png') });
  await page.getByRole('combobox').press('Enter');
  await expect(page).toHaveURL(new RegExp(`#vault=${articleId}$`));
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('.think-private-article')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`private-article-${width}.png`), fullPage: true });
  }
  await page.getByRole('link', { name: '返回 Think', exact: false }).click();
  await page.getByRole('link', { name: '我为什么越来越喜欢从底层理解一个东西', exact: true }).click();
  await expect(page.locator('.vault-public-heading')).toHaveText('PUBLIC / 公开文章');
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`public-article-${width}.png`), fullPage: true });
  }
  await page.getByRole('button', { name: '锁定私人空间' }).click();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(242, 243, 241)');
});
