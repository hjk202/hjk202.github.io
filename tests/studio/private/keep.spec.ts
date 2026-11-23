import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import { decryptVault } from '../../../src/core/vault/crypto.ts';
import { test, open, save, secret, password } from './fixtures.ts';
import type { MemoryBridge } from './fixtures.ts';

test('M14.1 Keep fields/controlled preview/encrypted save preserve stable ids, other modules and assets',async({page,repo})=>{
  await open(page,repo);await page.locator('#private-module-keep').click();await page.locator('#private-list button').first().click();
  await page.getByLabel('私人收藏标题',{exact:true}).fill('非敏感私人收藏修改');await page.getByLabel('私人收藏类型（可选）',{exact:true}).fill('参考');
  await page.getByRole('button',{name:'添加私人分类',exact:true}).click();const id=await page.getByLabel('私人分类 ID（32位）',{exact:true}).inputValue();expect(/^[a-f0-9]{32}$/.test(id)).toBe(true);await page.getByLabel('私人分类名称',{exact:true}).fill('非敏感分类');
  await page.getByRole('button',{name:'添加私人说明段落',exact:true}).click();await page.getByLabel('私人说明段落 2',{exact:true}).fill('非敏感新段落\n保留换行');
  await page.locator('#private-preview').click();await expect(page.locator('#private-preview-content article')).toBeVisible();const url=page.url();await page.locator('#private-preview-content').getByRole('link',{name:'打开来源 ↗'}).click();expect(page.url()).toBe(url);
  await save(page);const expected=structuredClone(repo.original);Object.assign(expected.modules.keep.bookmarks[0]!,{title:'非敏感私人收藏修改',kind:'参考',category:{id,label:'非敏感分类'},note:['保留段落','非敏感新段落\n保留换行']});
  expect(JSON.stringify(await decryptVault(JSON.parse(fs.readFileSync(repo.file,'utf8')),password))===JSON.stringify(expected)).toBe(true);
  await page.locator('#private-module-think').click();await page.locator('#private-module-keep').click();await page.locator('#private-list button').first().click();expect(await page.getByLabel('私人分类 ID（32位）',{exact:true}).inputValue()===id).toBe(true);
});
test('M14.1 invalid URLs/categories cannot be saved, corrected new entry can be deleted with explicit confirmation',async({page,repo})=>{
  await open(page,repo);await page.locator('#private-module-keep').click();await page.locator('#private-new').click();
  await page.getByLabel('私人收藏标题',{exact:true}).fill('非敏感新收藏');await page.getByLabel('私人收藏说明',{exact:true}).fill('非敏感说明');await page.getByLabel('私人来源链接',{exact:true}).fill('javascript:alert(1)');await page.getByLabel('私人说明段落 1',{exact:true}).fill('非敏感段落');
  const before=fs.readFileSync(repo.file);await page.locator('#private-validate').click();await expect(page.locator('#private-state')).toContainText('PRIVATE_VALIDATION_FAILED');expect(fs.readFileSync(repo.file).equals(before)).toBe(true);
  await page.getByLabel('私人来源链接',{exact:true}).fill('https://example.com/new');await page.getByRole('button',{name:'添加私人分类',exact:true}).click();await page.getByLabel('私人分类 ID（32位）',{exact:true}).fill('public-category-slug');await page.getByLabel('私人分类名称',{exact:true}).fill('非敏感');
  await page.locator('#private-validate').click();await expect(page.locator('#private-state')).toContainText('PRIVATE_VALIDATION_FAILED');await page.getByRole('button',{name:'移除私人分类',exact:true}).click();await save(page);
  const saved=await decryptVault(JSON.parse(fs.readFileSync(repo.file,'utf8')),password);expect((saved.modules.keep as {bookmarks:unknown[]}).bookmarks.length).toBe(2);
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('#private-delete').click();await expect(page.getByLabel('私人收藏标题',{exact:true})).toBeVisible();page.once('dialog',dialog=>dialog.accept());await page.locator('#private-delete').click();await save(page);
  expect(JSON.stringify(await decryptVault(JSON.parse(fs.readFileSync(repo.file,'utf8')),password))===JSON.stringify(repo.original)).toBe(true);
});
test('M14.1 close cancellation keeps Keep edits; conflict never overwrites source and confirmed locking clears fields',async({page,repo})=>{
  await open(page,repo);await page.locator('#private-module-keep').click();await page.locator('#private-list button').first().click();await page.getByLabel('私人收藏标题',{exact:true}).fill('非敏感收藏退出缓冲');
  await page.evaluate(id=>(window as unknown as MemoryBridge).__privateReceive({type:'studio:prepare-close',requestId:id}),randomUUID());await page.locator('#studio-exit').getByRole('button',{name:'取消',exact:true}).click();expect(await page.getByLabel('私人收藏标题',{exact:true}).inputValue()==='非敏感收藏退出缓冲').toBe(true);
  fs.appendFileSync(repo.file,'\n');const before=fs.readFileSync(repo.file);await page.locator('#private-save').click();await secret(page,true);await expect(page.locator('#private-state')).toContainText('PRIVATE_CONFLICT');expect(fs.readFileSync(repo.file).equals(before)).toBe(true);
  page.once('dialog',dialog=>dialog.accept());await page.locator('#private-lock').click();expect(await page.locator('#private-form').textContent()==='').toBe(true);await expect(page.locator('#private-tools')).toBeHidden();
});
test('M14.1 an unlocked idle session locks after ten minutes even without subsequent activity',async({page,repo})=>{
  await page.clock.install();await open(page,repo);await page.clock.fastForward(600001);await expect(page.locator('#private-tools')).toBeHidden();await expect(page.locator('#private-state')).toContainText('闲置十分钟');expect(await page.locator('#private-form').textContent()==='').toBe(true);
});
