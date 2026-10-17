import { test,expect } from '@playwright/test';
import {encryptVault} from '../../src/core/vault/crypto.ts';
test('real Vault session persists through modules and Enter navigation; idle, pagehide, BFCache and refresh lock',async({page})=>{
  const activate=async()=>{await page.goto('./observatory/');await page.getByRole('button',{name:'Unlock non-sensitive empty fixture'}).click();await expect(page.locator('html')).toHaveAttribute('data-vault-unlocked','');};
  await activate();
  await page.getByRole('link',{name:'Home',exact:true}).click();await expect(page.locator('[data-compass]')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-vault-unlocked','');
  await page.getByRole('link',{name:'Think, 2 entries',exact:true}).click();await expect(page.locator('.thought-heading h1')).toHaveText('想法不必一开始就有答案。');
  await expect(page.locator('html')).toHaveAttribute('data-vault-unlocked','');
  await page.getByRole('button',{name:'Search my space',exact:true}).click();await page.getByRole('combobox').fill('NEMU');await page.getByRole('combobox').press('Enter');
  await expect(page).toHaveURL(/build\/nemu\/$/);await expect(page.locator('h1')).toHaveText('NEMU：从指令执行到分页与异常的 x86 模拟器');
  await expect(page.locator('html')).toHaveAttribute('data-vault-unlocked','');
  await page.goBack();await expect(page).toHaveURL(/think\/$/);await expect(page.locator('html')).toHaveAttribute('data-vault-unlocked','');
  await activate();await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await expect(page.locator('html')).not.toHaveAttribute('data-vault-unlocked');
  await activate();await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await expect(page.locator('html')).not.toHaveAttribute('data-vault-unlocked');
  await activate();await page.reload();await expect(page.locator('html')).not.toHaveAttribute('data-vault-unlocked');
  expect(await page.evaluate(()=>localStorage.length+sessionStorage.length)).toBe(0);
});

test('real Vault idle protection clears a session after ten minutes',async({page})=>{await page.clock.install();await page.goto('./observatory/');await page.getByRole('button',{name:'Unlock non-sensitive empty fixture'}).click();await expect(page.locator('html')).toHaveAttribute('data-vault-unlocked','');await page.clock.fastForward(10*60*1000+1);await expect(page.locator('html')).not.toHaveAttribute('data-vault-unlocked');});

test('fifth private adapter automatically participates in search and Compass; unknown modules fail closed',async({page})=>{
 const password='isolated-private-adapter-password',id='c'.repeat(32);
 const envelope=await encryptVault({version:1,modules:{observatory:{title:'隔离私人天文台'}},assets:{}},password);
 await page.route('**/vault/bundle.json',route=>route.fulfill({json:envelope}));await page.goto('./');
 await expect(page.locator('[data-compass-link][data-module="me"]')).toHaveAttribute('aria-label','Me, average count 1 across other modules');
 await page.locator('[data-vault-entrance]').press('Enter');await page.getByLabel('私人空间口令',{exact:true}).fill(password);await page.getByRole('button',{name:'解锁',exact:true}).click();await expect(page.locator('[data-vault-dialog]')).not.toBeVisible();await expect(page.locator('[data-compass-link][data-module="observatory"]')).toHaveAttribute('aria-label','Observatory, 1 entry');await expect(page.locator('[data-compass-link][data-module="me"]')).toHaveAttribute('aria-label','Me, average count 1.25 across other modules');
 await page.getByRole('button',{name:'Search my space',exact:true}).click();await page.getByRole('combobox').fill('隔离私人');await expect(page.getByRole('option')).toHaveCount(1);await page.getByRole('combobox').press('Enter');await expect(page).toHaveURL(new RegExp(`/observatory/#vault=${id}$`));await expect(page.locator('.vault-view h1')).toHaveText('隔离私人天文台');await page.getByRole('button',{name:'锁定私人空间'}).click();await expect(page.locator('.vault-view')).toHaveCount(0);
 await page.unroute('**/vault/bundle.json');const unsupported=await encryptVault({version:1,modules:{disabled:{title:'not enabled'}},assets:{}},password);await page.route('**/vault/bundle.json',route=>route.fulfill({json:unsupported}));await page.goto('./');await page.locator('[data-vault-entrance]').press('Enter');await page.getByLabel('私人空间口令',{exact:true}).fill(password);await page.getByRole('button',{name:'解锁',exact:true}).click();await expect(page.locator('#vault-status')).toHaveText('口令或内容校验失败。');await expect(page.locator('html')).not.toHaveAttribute('data-vault-unlocked');
});
