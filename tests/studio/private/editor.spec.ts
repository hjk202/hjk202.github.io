import { chooseWorkspace } from '../workbench-controls.ts';
import fs from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import { decryptVault } from '../../../src/core/vault/crypto.ts';
import { test, open, save, secret, password } from './fixtures.ts';
import type { MemoryBridge } from './fixtures.ts';

test('M13 real encrypted Think edit/preview/save/delete preserves all other records and never uploads private text',async({page,repo})=>{
  await open(page,repo);await page.locator('#private-list button').first().click();
  const body='## 非敏感标题\n\n<script>window.PRIVATE_EXECUTED=true</script>\n\n```txt\n保留代码\n```\n\n![fixture](asset:'+'e'.repeat(32)+')';
  await page.getByLabel('私人标题',{exact:true}).fill('非敏感已修改标题');await page.getByLabel('私人正文',{exact:true}).fill(body);
  await page.locator('#private-preview').click();await expect(page.locator('#private-preview-content article')).toBeVisible();
  expect(await page.evaluate(()=>!(window as Window&{PRIVATE_EXECUTED?:boolean}).PRIVATE_EXECUTED&&document.querySelector('#private-preview-content')?.textContent?.includes('<script>'))).toBe(true);
  await expect.poll(()=>page.locator('#private-preview-content img').evaluate(image=>(image as HTMLImageElement).naturalWidth)).toBe(1);
  await save(page);const recovered=await decryptVault(JSON.parse(fs.readFileSync(repo.file,'utf8')),password),expected=structuredClone(repo.original);
  expected.modules.think.posts[0]!.title='非敏感已修改标题';expected.modules.think.posts[0]!.body=body;expect(JSON.stringify(recovered)===JSON.stringify(expected)).toBe(true);
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('#private-delete').click();expect((await decryptVault(JSON.parse(fs.readFileSync(repo.file,'utf8')),password)).modules.think!==undefined).toBe(true);
  page.once('dialog',dialog=>dialog.accept());await page.locator('#private-delete').click();await save(page);
  expected.modules.think.posts.shift();expect(JSON.stringify(await decryptVault(JSON.parse(fs.readFileSync(repo.file,'utf8')),password))===JSON.stringify(expected)).toBe(true);
});
test('M13 new date is local and editable; lock cancellation retains draft while confirmed lock clears DOM',async({page,repo})=>{
  const target=join(repo.file,'..','new.json');await repo.choose(page,'create',target);await expect(page.locator('#private-tools')).toBeVisible();await page.locator('#private-new').click();
  const correct=await page.getByLabel('私人日期',{exact:true}).evaluate(element=>{const date=new Date();return (element as HTMLInputElement).value===`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;});expect(correct).toBe(true);
  await page.getByLabel('私人日期',{exact:true}).fill('2026-10-01');await page.getByLabel('私人标题',{exact:true}).fill('非敏感新文章');
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('#private-lock').click();expect(await page.getByLabel('私人标题',{exact:true}).inputValue()==='非敏感新文章').toBe(true);
  page.once('dialog',dialog=>dialog.accept());await page.locator('#private-lock').click();await expect(page.locator('#private-tools')).toBeHidden();expect(fs.existsSync(target)).toBe(false);
  expect(await page.locator('#private-form').textContent()==='').toBe(true);
});
test('M13 revision conflicts retain private candidate and block blind retry; explicit module departure locks it',async({page,repo})=>{
  await open(page,repo);await page.locator('#private-list button').first().click();await page.getByLabel('私人标题',{exact:true}).fill('非敏感冲突缓冲');
  fs.appendFileSync(repo.file,'\n');const before=fs.readFileSync(repo.file);await page.locator('#private-save').click();await secret(page,true);
  await expect(page.locator('#private-state')).toContainText('PRIVATE_CONFLICT');await expect(page.locator('#private-save')).toBeDisabled();expect(fs.readFileSync(repo.file).equals(before)).toBe(true);
  expect(await page.getByLabel('私人标题',{exact:true}).inputValue()==='非敏感冲突缓冲').toBe(true);
  page.once('dialog',dialog=>dialog.dismiss());await chooseWorkspace(page, 'think');await expect(page.locator('#private-editor')).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());await chooseWorkspace(page, 'think');expect(await page.locator('#private-form').textContent()==='').toBe(true);await expect(page.locator('#private-editor')).toBeHidden();
});
test('M13 native close cancel preserves draft; save-and-exit encrypts through a separate password dialog and clears private DOM',async({page,repo})=>{
  await open(page,repo);await page.locator('#private-list button').first().click();await page.getByLabel('私人标题',{exact:true}).fill('非敏感退出保存');
  const receive=async()=>page.evaluate(id=>(window as unknown as MemoryBridge).__privateReceive({type:'studio:prepare-close',requestId:id}),randomUUID());
  await receive();await page.locator('#studio-exit').getByRole('button',{name:'取消',exact:true}).click();expect(await page.getByLabel('私人标题',{exact:true}).inputValue()==='非敏感退出保存').toBe(true);
  await receive();await page.locator('#studio-exit').getByRole('button',{name:'保存并退出',exact:true}).click();await secret(page,true);
  await expect.poll(()=>page.evaluate(()=>(window as unknown as MemoryBridge).__privateMessages.some(value=>value.type==='studio:close-result'&&value.status==='ready'))).toBe(true);
  const result=await decryptVault(JSON.parse(fs.readFileSync(repo.file,'utf8')),password);expect((result.modules.think as {posts:{title:string}[]}).posts[0]!.title==='非敏感退出保存').toBe(true);
  expect(await page.locator('#private-form').textContent()==='').toBe(true);
});

test('M13 public source changes during password entry reject a stale encrypted candidate; background locking clears it',async({page,repo})=>{
  await open(page,repo);await page.locator('#private-list button').first().click();await page.getByLabel('私人标题',{exact:true}).fill('非敏感关联变化');
  const before=fs.readFileSync(repo.file);await page.locator('#private-save').click();await expect(page.locator('#private-password-dialog')).toBeVisible();fs.appendFileSync(repo.source,'\n// public revision changed\n');await secret(page,true);
  await expect(page.locator('#private-state')).toContainText('PRIVATE_PUBLIC_CHANGED');expect(fs.readFileSync(repo.file).equals(before)).toBe(true);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.locator('#private-tools')).toBeHidden();expect(await page.locator('#private-form').textContent()==='').toBe(true);
});

test('M13 an unknown write result retains the private candidate and cannot be blindly retried',async({page,repo})=>{
  await open(page,repo);await page.locator('#private-list button').first().click();await page.getByLabel('私人标题',{exact:true}).fill('非敏感响应未知');
  await page.route('**/api/studio-private/files/*',async route=>{if(route.request().method()==='PUT'){await route.fetch();await route.abort('connectionfailed');}else await route.continue();});
  await page.locator('#private-save').click();await secret(page,true);await expect(page.locator('#private-state')).toContainText('CONNECTION_LOST');await expect(page.locator('#private-save')).toBeDisabled();
  const result=await decryptVault(JSON.parse(fs.readFileSync(repo.file,'utf8')),password);expect((result.modules.think as {posts:{title:string}[]}).posts[0]!.title==='非敏感响应未知').toBe(true);
  expect(await page.getByLabel('私人标题',{exact:true}).inputValue()==='非敏感响应未知').toBe(true);
});

test('M13 late file reads cannot show a password dialog or reopen a locked editor',async({page,repo})=>{
  let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/studio-private/files/*',async route=>{await pending;await route.continue();});
  await repo.choose(page,'open');await page.locator('#private-lock').click();release();
  await page.waitForResponse(response=>response.url().includes('/api/studio-private/files/'));await page.waitForTimeout(100);
  await expect(page.locator('#private-tools')).toBeHidden();await expect(page.locator('#private-password-dialog')).not.toBeVisible();expect(await page.locator('#private-form').textContent()==='').toBe(true);
});
