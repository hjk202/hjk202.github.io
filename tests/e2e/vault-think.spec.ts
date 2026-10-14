import { test,expect } from '@playwright/test';
import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { encryptVault } from '../../src/core/vault/crypto.ts';
import { thinkVaultFixture,vaultPassword,articleId } from '../fixtures/vault.ts';
async function setup(page:import('@playwright/test').Page) {
  const envelope=await encryptVault(thinkVaultFixture,vaultPassword);
  await page.route('**/vault/bundle.json',route=>route.fulfill({json:envelope}));
  await page.goto('./');await page.locator('[data-vault-entrance]').press('Enter');await page.getByLabel('私人空间口令',{exact:true}).fill(vaultPassword);await page.getByRole('button',{name:'解锁',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-vault-unlocked','');await expect(page.locator('[data-vault-dialog]')).not.toBeVisible();
}
test('Think private list/detail/back/lock preserves public article and safely renders code, raw HTML and encrypted images',async({page},info)=>{
  const requests:string[]=[];page.on('request',request=>requests.push(request.url()));await setup(page);
  await page.getByRole('link',{name:'Think, 3 entries',exact:true}).click();await expect(page.locator('.vault-view')).toContainText('安全验收样本：私人文章');
  await page.getByRole('link',{name:'安全验收样本：私人文章',exact:true}).click();await expect(page).toHaveURL(new RegExp(`#vault=${articleId}$`));await expect(page.locator('h1:visible')).toHaveText('安全验收样本：私人文章');
  await expect(page.locator('.think-private-article pre code')).toContainText('<script>window.vaultInjected = true</script>');
  expect(await page.evaluate(()=>(window as unknown as {vaultInjected?:boolean}).vaultInjected)).toBeUndefined();
  await expect(page.locator('.vault-view a[href^="javascript:"]')).toHaveCount(0);
  const image=page.locator('.vault-view img');await expect(image).toHaveAttribute('src',/^blob:/);await expect.poll(()=>image.evaluate(element=>(element as HTMLImageElement).naturalWidth)).toBe(1);
  const blob=await image.getAttribute('src');expect(requests.some(url=>url.includes('example.com/private.jpg'))).toBe(false);
  for(const theme of ['light','dark'] as const){await page.emulateMedia({colorScheme:theme});await page.setViewportSize({width:375,height:812});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`private-think-${theme}.png`),fullPage:true});}
  await expect(page).toHaveTitle('Think — Personal Space');await expect(page.locator('link[rel="canonical"]')).not.toHaveAttribute('href',/vault/);
  await page.getByRole('link',{name:'返回 Think',exact:false}).click();await expect(page.locator('.vault-view')).toContainText('安全验收样本：一则随记');
  await page.getByRole('link',{name:'我为什么越来越喜欢从底层理解一个东西',exact:true}).click();await expect(page.locator('h1:visible')).toHaveText('我为什么越来越喜欢从底层理解一个东西');
  await page.getByRole('button',{name:'锁定私人空间'}).click();await expect(page.locator('.vault-view')).toHaveCount(0);expect(await page.locator('body').innerText()).not.toContain('安全验收样本');
  expect(await page.evaluate(async url=>{try{await fetch(url!);return false;}catch{return true;}},blob)).toBe(true);
});
test('private deep link/refresh stays neutral until unlock; missing target and lock restore safe public state',async({page,baseURL})=>{
  const url=new URL(`think/#vault=${articleId}`,baseURL!).href;await page.goto(url);await expect(page.locator('.vault-view')).toContainText('需要解锁');expect(await page.locator('body').innerText()).not.toContain('安全验收样本');
  await setup(page);await page.goto(url);await expect(page.locator('html')).not.toHaveAttribute('data-vault-unlocked');await expect(page.locator('.vault-view')).toContainText('需要解锁');
  await page.getByRole('button',{name:'解锁私人空间',exact:true}).click();await page.getByLabel('私人空间口令',{exact:true}).fill(vaultPassword);await page.getByRole('button',{name:'解锁',exact:true}).click();await expect(page.locator('h1:visible')).toHaveText('安全验收样本：私人文章');
  await page.getByRole('button',{name:'锁定私人空间'}).click();await expect(page).toHaveURL(/think\/$/);await expect(page.locator('h1:visible')).toHaveText('想法不必一开始就有答案。');
  await page.evaluate(()=>{location.hash='vault='+ 'f'.repeat(32);});await expect(page.locator('.vault-view')).toContainText('需要解锁');await page.getByRole('button',{name:'解锁私人空间',exact:true}).click();await page.getByLabel('私人空间口令',{exact:true}).fill(vaultPassword);await page.getByRole('button',{name:'解锁',exact:true}).click();await expect(page.locator('.vault-view')).toContainText('不存在或已移除');await page.getByRole('button',{name:'锁定私人空间'}).click();
  await page.getByRole('link',{name:'Home',exact:true}).click();await expect(page.locator('[data-compass]')).toBeVisible();await page.locator('[data-vault-entrance]').press('Enter');await page.getByLabel('私人空间口令',{exact:true}).fill(vaultPassword);await page.getByRole('button',{name:'解锁',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-vault-unlocked','');
  await page.getByRole('link',{name:'Think, 3 entries',exact:true}).click();await page.getByRole('link',{name:'安全验收样本：私人文章',exact:true}).click();await expect(page.locator('h1:visible')).toHaveText('安全验收样本：私人文章');await page.reload();await expect(page.locator('.vault-view')).toContainText('需要解锁');
});
test('undeclared private asset fails before opening the session and static production has no fixture plaintext',async({page})=>{
  const envelope=await encryptVault({...thinkVaultFixture,assets:{}},vaultPassword);await page.route('**/vault/bundle.json',route=>route.fulfill({json:envelope}));await page.goto('./');await page.locator('[data-vault-entrance]').press('Enter');await page.getByLabel('私人空间口令',{exact:true}).fill(vaultPassword);await page.getByRole('button',{name:'解锁',exact:true}).click();await expect(page.locator('#vault-status')).toHaveText('口令或内容校验失败。');await expect(page.locator('html')).not.toHaveAttribute('data-vault-unlocked');
  const walk=(directory:string):string[]=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(join(directory,entry.name)):[join(directory,entry.name)]);
  for(const file of walk(process.env.E2E_DIST??'dist'))expect(readFileSync(file).includes('CANARY_P4_THINK_ONLY')).toBe(false);
});
