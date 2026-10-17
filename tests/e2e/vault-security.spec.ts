import {test,expect} from '@playwright/test';
import {encryptVault} from '../../src/core/vault/crypto.ts';
import {allVaultFixture,vaultPassword,articleId} from '../fixtures/vault.ts';
test('private plaintext has no persistence, background snapshots, URL/log payload or automatic third-party request',async({page,context,baseURL})=>{
  const network:string[]=[],logs:string[]=[];page.on('request',request=>network.push(request.url()+' '+(request.postData()??'')));page.on('console',message=>logs.push(message.text()));
  await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(...args){throw new Error('Unexpected persistence '+args[0]);};void original;});
  const envelope=await encryptVault(allVaultFixture,vaultPassword);await page.route('**/vault/bundle.json',route=>route.fulfill({json:envelope}));await page.goto('./');
  await page.locator('[data-vault-entrance]').press('Enter');await page.getByLabel('私人空间口令',{exact:true}).fill(vaultPassword);await page.getByRole('button',{name:'解锁',exact:true}).click();await expect(page.locator('[data-vault-dialog]')).not.toBeVisible();
  await page.getByRole('link',{name:'Think, 4 entries',exact:true}).click();await page.getByRole('link',{name:'安全验收样本：私人文章',exact:true}).click();await expect(page.locator('.vault-view img')).toHaveAttribute('src',/^blob:/);const blob=await page.locator('.vault-view img').getAttribute('src');
  await expect(page).toHaveTitle('Think — Personal Space');expect(page.url()).not.toMatch(/CANARY|安全验收|phase4-nonsensitive/);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{get:()=>true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});await expect(page.locator('.vault-view')).toHaveCount(0);expect(await page.locator('body').textContent()).not.toContain('CANARY_P4');expect(await page.evaluate(async url=>{try{await fetch(url!);return false;}catch{return true;}},blob)).toBe(true);
  const persistent=await page.evaluate(async()=>({storage:localStorage.length+sessionStorage.length,databases:await indexedDB.databases(),caches:await caches.keys(),workers:await navigator.serviceWorker.getRegistrations()}));expect(persistent).toEqual({storage:0,databases:[],caches:[],workers:[]});expect(await context.cookies()).toEqual([]);
  expect(network.join('\n')+'\n'+logs.join('\n')).not.toMatch(/CANARY_P4|安全验收样本|phase4-nonsensitive-acceptance/);expect(network.filter(url=>/^https:\/\/example\.com/.test(url))).toEqual([]);
  const fresh=await context.newPage();await fresh.goto(new URL(`think/#vault=${articleId}`,baseURL!).href);await expect(fresh.locator('html')).not.toHaveAttribute('data-vault-unlocked');await expect(fresh.locator('.vault-view')).toContainText('需要解锁');expect(await fresh.locator('body').textContent()).not.toContain('CANARY_P4');await fresh.close();
});
