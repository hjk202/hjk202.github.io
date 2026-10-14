import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
const input = (page: Page) => page.getByRole('combobox', { name: 'Search my space' });
const open = async (page: Page) => { await page.getByRole('button', { name: 'Search my space', exact: true }).click(); await expect(input(page)).toBeFocused(); };

test('opening and reopening do not select Build beneath an animated panel or retain old shortcut highlights', async ({ page }) => {
  await page.goto('./'); await open(page);
  await expect(page.locator('[data-spotlight]')).toHaveCSS('transform','matrix(1, 0, 0, 1, 0, 0)');
  await expect(page.locator('[role="option"][aria-selected="true"]')).toHaveCount(0);
  await input(page).press('Enter');await expect(page.locator('[data-spotlight]')).toBeVisible();await expect(page).toHaveURL(/\/$/);
  await input(page).press('ArrowDown');await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected','true');
  const build=page.getByRole('option',{name:'Build',exact:true});
  const box=await build.boundingBox();await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
  await expect(build).toHaveAttribute('aria-selected','true');
  await input(page).press('Escape');await expect(page.locator('[data-spotlight]')).not.toBeVisible();await open(page);
  await expect(page.locator('[data-spotlight]')).toHaveCSS('transform','matrix(1, 0, 0, 1, 0, 0)');
  await expect(page.locator('[role="option"][aria-selected="true"]')).toHaveCount(0);
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
  // Geometry-generated events at identical pointer coordinates are not a new hover choice.
  await build.dispatchEvent('pointermove',{clientX:box!.x+box!.width/2,clientY:box!.y+box!.height/2,movementX:10,movementY:10,pointerType:'mouse'});
  await input(page).press('ArrowUp');await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected','true');
  await input(page).press('Escape');await expect(page.locator('[data-spotlight]')).not.toBeVisible();await page.emulateMedia({reducedMotion:'reduce'});await open(page);
  await expect(page.locator('[role="option"][aria-selected="true"]')).toHaveCount(0);await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);await expect(build).toHaveAttribute('aria-selected','true');
});

test('dismiss animates panel and backdrop before ending modality and restoring focus', async ({ page }, info) => {
  await page.goto('./');
  const dialog = page.getByRole('dialog');
  const trigger = page.getByRole('button', { name: 'Search my space', exact: true });
  for (const action of ['backdrop', 'escape', 'button']) {
    await open(page);
    await expect(dialog).toHaveCSS('opacity', '1');
    await expect(dialog).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    if (action === 'backdrop') await page.mouse.click(10, 10);
    else if (action === 'escape') await input(page).press('Escape');
    else await page.getByRole('button', { name: 'Close search' }).click();
    await expect(dialog).toHaveAttribute('data-closing', '');
    const frame = await dialog.evaluate(async (element) => {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      return { open: (element as HTMLDialogElement).open, opacity: Number(getComputedStyle(element).opacity), backdrop: getComputedStyle(element, '::backdrop').animationName, locked: document.documentElement.classList.contains('search-open') };
    });
    expect(frame.open).toBe(true); expect(frame.locked).toBe(true);
    expect(frame.opacity).toBeGreaterThan(0); expect(frame.opacity).toBeLessThan(1);
    expect(frame.backdrop).toBe('backdrop-disappear');
    if (action === 'backdrop') await page.screenshot({ path: info.outputPath('closing-frame.png'), animations: 'allow' });
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.classList.contains('search-open'))).toBe(false);
  }
});

test('close during opening and quick reopen leave no stale close task; reduced motion closes immediately', async ({ page }) => {
  await page.goto('./');
  await open(page);
  await input(page).press('Escape');
  await expect(page.getByRole('dialog')).toHaveAttribute('data-closing', '');
  await page.keyboard.press('Control+k');
  await expect(input(page)).toBeFocused();
  await expect(page.getByRole('dialog')).not.toHaveAttribute('data-closing');
  await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
  await input(page).fill('a query after reopening');
  await expect(page.getByRole('dialog')).toBeVisible();
  await input(page).press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await input(page).press('Escape');
  expect(await page.locator('[data-spotlight]').evaluate((element) => (element as HTMLDialogElement).open)).toBe(false);
  await expect(page.getByRole('button', { name: 'Search my space', exact: true })).toBeFocused();
});

test('click, shortcuts, arrow boundaries, Enter and all page entry points', async ({ page }) => {
  for (const path of ['./', './think/', './think/understanding-from-the-bottom/']) {
    await page.goto(path);
    await open(page);
    await expect(page.getByRole('option')).toHaveCount(4);
    await input(page).press('ArrowUp');
    await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
    await input(page).press('ArrowDown');
    await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
    await input(page).fill('  MiCrO nonexistent  ');
    await expect(page.getByRole('option')).toHaveCount(0);
    await input(page).press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await input(page).fill('底层');
    await expect(page.getByRole('option')).toHaveCount(1);
    await input(page).press('Enter');
    await expect(page).toHaveURL(/think\/understanding-from-the-bottom\/$/);
    await expect(page.locator('h1')).toHaveText('我为什么越来越喜欢从底层理解一个东西');
  }
});

test('Ctrl/Cmd K, focus containment, close controls, backdrop and restoration', async ({ page }) => {
  await page.goto('./');
  const trigger = page.getByRole('button', { name: 'Search my space', exact: true });
  await trigger.focus();
  await page.keyboard.press('Control+k');
  await expect(input(page)).toBeFocused();
  await input(page).press('Tab');
  await expect(page.getByRole('button', { name: 'Close search' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(input(page)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Close search' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.keyboard.press('Meta+k');
  await expect(input(page)).toBeFocused();
  await page.getByRole('button', { name: 'Close search' }).click();
  await expect(trigger).toBeFocused();
  await open(page);
  await page.mouse.click(10, 10);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('query changes, clearing, mouse results and per-page index cache', async ({ page }) => {
  let requests = 0;
  page.on('request', (request) => { if (request.url().endsWith('search-index.json')) requests++; });
  await page.goto('./'); await open(page);
  await input(page).fill('底层');
  await expect(page.getByRole('option')).not.toHaveCount(0);
  await input(page).press('ArrowDown');
  await input(page).fill('build');
  await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
  await input(page).fill(''); await expect(page.getByRole('option')).toHaveCount(4);
  await input(page).press('Escape'); await open(page);
  expect(requests).toBe(1);
  await input(page).fill('NEMU');
  await page.getByRole('option').click();
  await expect(page).toHaveURL(/build\/nemu\/$/);
});

test('index loading, failure, retained shortcuts and retry', async ({ page }) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/search-index.json', async (route) => { await gate; await route.fulfill({ status: 503, body: 'unavailable' }); });
  await page.goto('./'); await open(page);
  await expect(page.getByRole('status')).toHaveText('Loading search…');
  await expect(page.getByRole('option')).toHaveCount(4);
  release();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByRole('option')).toHaveCount(4);
  await page.unroute('**/search-index.json');
  await page.getByRole('button', { name: 'Try again' }).click();
  await input(page).fill('工具');
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Try again' })).not.toBeVisible();
});

test('IME composition does not navigate; editing does not steal the shortcut', async ({ page }) => {
  await page.goto('./'); await open(page);
  await input(page).fill('think');
  await input(page).dispatchEvent('compositionstart');
  await input(page).press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await input(page).dispatchEvent('compositionend');
  await input(page).press('Enter');
  await expect(page).toHaveURL(/think\/$/);
  await page.evaluate(() => { const editor = document.createElement('textarea'); editor.setAttribute('aria-label', 'Test editor'); document.body.append(editor); });
  await page.getByRole('textbox', { name: 'Test editor' }).focus();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('queued native close events do not steal focus from the next interaction', async ({ page }) => {
  await page.goto('./think/'); await open(page);
  await input(page).press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
  const home=page.getByRole('link',{name:'Home',exact:true});await home.focus();
  await page.locator('[data-spotlight]').dispatchEvent('close');await expect(home).toBeFocused();
});

test('long result lists scroll while selected results remain visible', async ({ page }) => {
  await page.route('**/search-index.json', async (route) => {
    const response = await route.fetch();
    const index = await response.json();
    index.results = Array.from({ length: 30 }, (_, i) => ({ title: `Demo result ${String(i).padStart(2, '0')}`, description: 'Long list verification', url: `/think/demo-${i}/`, module: 'think' }));
    await route.fulfill({ json: index });
  });
  await page.goto('./'); await open(page); await input(page).fill('Demo result');
  await expect(page.getByRole('option')).toHaveCount(30);
  for (let i = 0; i < 35; i++) await input(page).press('ArrowDown');
  await expect(page.getByRole('option').last()).toHaveAttribute('aria-selected', 'true');
  expect(await page.locator('#space-results').evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.locator('#space-results').evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
});
