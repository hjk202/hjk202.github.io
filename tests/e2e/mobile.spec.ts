import { test, expect } from '@playwright/test';
import { encryptVault } from '../../src/core/vault/crypto.ts';
import { allVaultFixture, vaultPassword } from '../fixtures/vault.ts';

test.use({ hasTouch: true });

test('mobile native disclosures and nested labels have no tap flash while keyboard focus remains visible', async ({ page }, info) => {
  const envelope = await encryptVault(allVaultFixture, vaultPassword);
  await page.route('**/vault/bundle.json', route => route.fulfill({ json: envelope }));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('./');
  await page.locator('[data-vault-entrance]').press('Enter');
  await page.getByLabel('私人空间口令', { exact: true }).fill(vaultPassword);
  await page.getByRole('button', { name: '解锁', exact: true }).tap();
  await expect(page.locator('[data-vault-dialog]')).not.toBeVisible();
  await page.getByRole('link', { name: 'Build, 2 entries', exact: true }).tap();
  await page.getByRole('link', { name: '安全验收样本：私人项目', exact: true }).tap();
  const summary = page.locator('.private-project .project-update summary');
  await expect(summary).toBeVisible();
  if (await page.evaluate(() => CSS.supports('-webkit-tap-highlight-color', 'transparent'))) {
    for (const selector of ['summary', 'summary time', 'summary span', 'a', 'button']) {
      const colors = await page.locator(selector).evaluateAll(nodes => nodes.map(node => getComputedStyle(node).getPropertyValue('-webkit-tap-highlight-color')));
      expect(colors.length).toBeGreaterThan(0);
      expect(colors.every(color => color === 'rgba(0, 0, 0, 0)'), JSON.stringify({ selector, colors })).toBe(true);
    }
  } else {
    info.annotations.push({ type: 'browser-capability', description: 'This engine does not expose -webkit-tap-highlight-color; touch disclosure and keyboard focus are verified below. Native mobile highlight still requires OPPO acceptance.' });
  }
  await summary.tap();
  await expect(page.locator('.private-project .project-update')).toHaveAttribute('open', '');
  expect(await summary.evaluate(node => node.matches(':focus-visible'))).toBe(false);
  await page.screenshot({ path: info.outputPath('touch-disclosure.png'), fullPage: true });
  await summary.tap();
  await summary.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(summary).toBeFocused();
  await expect(summary).toHaveCSS('outline-style', 'solid');
  await expect(summary).toHaveCSS('outline-width', '2px');
  await summary.press('Enter');
  await expect(page.locator('.private-project .project-update')).toHaveAttribute('open', '');
  await page.screenshot({ path: info.outputPath('keyboard-disclosure.png'), fullPage: true });
});

for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 639, height: 900 }, { width: 641, height: 900 }, { width: 667, height: 375 }, { width: 768, height: 600 }, { width: 768, height: 1024 }]) {
  test(`mobile ${viewport.width}×${viewport.height}: real node and label taps navigate once`, async ({ page, baseURL }, info) => {
    await page.setViewportSize(viewport);
    await page.goto('./');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const metrics = await page.locator('[data-compass-link]').evaluateAll((links) => links.map((link) => {
      const target = link.querySelector('.compass-target')!.getBoundingClientRect();
      const label = link.querySelector('.compass-touch-label div')!;
      const text = label.getBoundingClientRect();
      const range = link.ownerDocument.createRange(); range.selectNodeContents(label);
      const words = range.getBoundingClientRect();
      const glass = link.ownerDocument.querySelector('.compass-outline')!.getBoundingClientRect();
      const separated = words.right + 4 <= glass.left || words.left - 4 >= glass.right || words.bottom + 4 <= glass.top || words.top - 4 >= glass.bottom;
      return { target: { width: target.width, height: target.height }, text: { width: text.width, height: text.height }, separated, wordsInViewport: words.left >= 0 && words.right <= innerWidth };
    }));
    for (const metric of metrics) {
      expect(metric.target.width).toBeGreaterThanOrEqual(44);
      expect(metric.target.height).toBeGreaterThanOrEqual(44);
      if (viewport.width <= 640 || viewport.height <= 760) {
        expect(metric.text.width).toBeGreaterThanOrEqual(44);
        expect(metric.text.height).toBeGreaterThanOrEqual(44);
        expect(metric.separated).toBe(true);
        expect(metric.wordsInViewport).toBe(true);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('home.png'), animations: 'disabled' });
    for (const name of ['think', 'build', 'me', 'keep']) {
      const link = page.locator(`[data-module="${name}"]`);
      const target = link.locator('.compass-target');
      await target.tap();
      await expect(page).toHaveURL(new URL(`${name}/`, baseURL!).href);
      await page.goBack();
      await expect(page.locator('[data-pointer-active]')).toHaveCount(0);
      if (viewport.width <= 640 || viewport.height <= 760) {
        await link.locator('.compass-touch-label div').tap();
        await expect(page).toHaveURL(new URL(`${name}/`, baseURL!).href);
        await page.goBack();
      }
    }
  });
}

test('mobile search remains usable after reduced viewport and rotation, preserving input and composition', async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.getByRole('button', { name: 'Search my space', exact: true }).tap();
  const input = page.getByRole('combobox');
  await input.fill('底层');
  await expect(page.getByRole('option')).toHaveCount(1);
  await page.setViewportSize({ width: 375, height: 320 });
  await expect(input).toHaveValue('底层');
  const close = page.getByRole('button', { name: 'Close search' });
  const bounds = await close.boundingBox();
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(320);
  const list = await page.locator('#space-results').boundingBox();
  expect(list!.height).toBeGreaterThan(80);
  expect(list!.y + list!.height).toBeLessThanOrEqual(320);
  await page.screenshot({ path: info.outputPath('short-search.png'), animations: 'disabled' });
  await input.dispatchEvent('compositionstart');
  await input.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await input.dispatchEvent('compositionend');
  await page.setViewportSize({ width: 667, height: 375 });
  await expect(input).toHaveValue('底层');
  await input.press('Enter');
  await expect(page).toHaveURL(/think\/understanding-from-the-bottom\/$/);
});

test('mobile search long results scroll inside the glass while inputs and retry remain reachable', async ({ page, request, baseURL }) => {
  await page.setViewportSize({ width: 375, height: 320 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const index = await (await request.get(new URL('search-index.json', baseURL!).href)).json();
  const results = Array.from({ length: 40 }, (_, n) => ({ title: `Mobile topic ${n}`, description: 'A browser-only result used to verify independent scrolling.', module: 'think', url: `/think/mobile-probe-${n}/` }));
  await page.route('**/search-index.json', (route) => route.fulfill({ json: { ...index, results } }));
  await page.goto('./');
  await page.getByRole('button', { name: 'Search my space', exact: true }).tap();
  await page.getByRole('combobox').fill('Mobile topic');
  await expect(page.getByRole('option')).toHaveCount(40);
  const list = page.locator('#space-results');
  expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  for (let n = 0; n < 39; n++) await page.getByRole('combobox').press('ArrowDown');
  await expect(page.getByRole('option').last()).toHaveAttribute('aria-selected', 'true');
  expect(await list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Close search' }).tap();
  await expect(page.getByRole('button', { name: 'Search my space', exact: true })).toBeFocused();
  await page.unroute('**/search-index.json');
  await page.reload();
  await page.route('**/search-index.json', (route) => route.abort());
  await page.getByRole('button', { name: 'Search my space', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await page.unroute('**/search-index.json');
  await page.getByRole('button', { name: 'Try again' }).tap();
  await page.getByRole('combobox').fill('NEMU');
  await expect(page.getByRole('option')).toHaveCount(1);
});

test('mobile close after viewport change can reopen without stale task and restores scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Search my space', exact: true }).tap();
  await page.getByRole('combobox').fill('NEMU');
  await page.waitForTimeout(400);
  await page.setViewportSize({ width: 667, height: 375 });
  await page.getByRole('button', { name: 'Close search' }).tap();
  await expect(page.locator('[data-spotlight]')).toHaveAttribute('data-closing', '');
  const origin = await page.locator('[data-spotlight]').evaluate((dialog) => {
    const source = document.querySelector('[data-search-trigger]')!.getBoundingClientRect();
    const element = dialog as HTMLElement;
    return { actual: parseFloat(element.style.getPropertyValue('--from-x')), expected: source.left + source.width / 2 - (element.offsetLeft + element.offsetWidth / 2) };
  });
  expect(Math.abs(origin.actual - origin.expected)).toBeLessThan(1);
  await page.getByRole('combobox').press('Control+k');
  await page.waitForTimeout(400);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveValue('NEMU');
  await page.getByRole('button', { name: 'Close search' }).tap();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.scrollTo(0, 80));
  const scroll = await page.evaluate(() => scrollY);
  expect(scroll).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Search my space', exact: true }).evaluate((button) => (button as HTMLElement).focus({ preventScroll: true }));
  await page.keyboard.press('Control+k');
  await page.getByRole('button', { name: 'Close search' }).tap();
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  expect(await page.locator('html').getAttribute('class')).not.toContain('search-open');
});

for (const width of [320, 375, 768]) {
  test(`mobile ${width}: all real module pages remain readable and usable at normal and larger text sizes`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 812 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const route of ['me/', 'think/', 'think/understanding-from-the-bottom/', 'build/', 'build/nemu/', 'keep/', 'keep/missing-semester/']) {
      for (const largerText of [false, true]) {
        await page.goto(`./${route}`);
        if (largerText) await page.addStyleTag({ content: ':root {font-size:200%} body {font-size:200%}' });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const home = await page.getByRole('link', { name: 'Home', exact: true }).boundingBox();
        expect(home!.width).toBeGreaterThanOrEqual(44);
        expect(home!.height).toBeGreaterThanOrEqual(44);
        if (route === 'think/understanding-from-the-bottom/' && largerText && width === 320) {
          const equation = page.getByRole('math');
          expect(await equation.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
          expect(await equation.evaluate((element) => { element.scrollLeft = element.scrollWidth; return element.scrollLeft; })).toBeGreaterThan(0);
        }
        if (!largerText && width === 320) await page.screenshot({ path: info.outputPath(route.replaceAll('/', '-') + '.png'), fullPage: true, animations: 'disabled' });
      }
      await page.getByRole('button', { name: 'Search my space', exact: true }).tap();
      await expect(page.getByRole('combobox')).toBeFocused();
      await page.getByRole('combobox').press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await page.getByRole('link', { name: 'Home', exact: true }).tap();
      await expect(page.locator('[data-compass]')).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}
