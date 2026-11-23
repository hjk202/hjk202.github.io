import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import { decryptVault } from '../../../src/core/vault/crypto.ts';
import { test, open, save, secret, password } from './fixtures.ts';
import type { MemoryBridge } from './fixtures.ts';

test('M14.2 private Me paragraphs/links preview and encrypted roundtrip preserve the rest of the package',async({page,repo})=>{
  await open(page,repo);await page.locator('#private-module-me').click();await page.locator('#private-list button').click();await page.getByLabel('私人介绍段落 1',{exact:true}).fill('非敏感私人介绍修改\n保留换行');
  await page.getByRole('button',{name:'添加私人介绍段落',exact:true}).click();await page.getByLabel('私人介绍段落 2',{exact:true}).fill('非敏感第二段');await page.getByRole('button',{name:'添加链接',exact:true}).click();await page.getByLabel('链接名称 1',{exact:true}).fill('非敏感链接');await page.getByLabel('链接地址 1',{exact:true}).fill('https://example.com/me');
  await page.locator('#private-preview').click();await expect(page.locator('#private-preview-content .private-profile')).toBeVisible();const url=page.url();await page.locator('#private-preview-content a').click();expect(page.url()).toBe(url);
  await save(page);const expected=structuredClone(repo.original);Object.assign(expected.modules.me,{paragraphs:['非敏感私人介绍修改\n保留换行','非敏感第二段'],links:[{label:'非敏感链接',url:'https://example.com/me'}]});expect(JSON.stringify(await decryptVault(JSON.parse(fs.readFileSync(repo.file,'utf8')),password))===JSON.stringify(expected)).toBe(true);
  await page.getByRole('button',{name:'省略私人介绍 links 字段',exact:true}).click();await save(page);const recovered=await decryptVault(JSON.parse(fs.readFileSync(repo.file,'utf8')),password);expect(Object.hasOwn(recovered.modules.me as object,'links')).toBe(false);
});
test('M14.2 confirmed clear removes only private Me; explicit new empty profile has no fabricated public fields',async({page,repo})=>{
  await open(page,repo);await page.locator('#private-module-me').click();await page.locator('#private-list button').click();page.once('dialog',dialog=>dialog.dismiss());await page.locator('#private-delete').click();await expect(page.getByLabel('私人介绍段落 1',{exact:true})).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());await page.locator('#private-delete').click();await save(page);const expected=structuredClone(repo.original) as {version:number;modules:Record<string,unknown>;assets:unknown};delete expected.modules.me;expect(JSON.stringify(await decryptVault(JSON.parse(fs.readFileSync(repo.file,'utf8')),password))===JSON.stringify(expected)).toBe(true);
  await page.locator('#private-new').click();await page.locator('#private-validate').click();await expect(page.locator('#private-state')).toContainText('校验通过');await page.locator('#private-preview').click();await expect(page.locator('#private-state')).toContainText('受控预览');expect(await page.locator('#private-preview-content').textContent()==='').toBe(true);await save(page);
  const result=await decryptVault(JSON.parse(fs.readFileSync(repo.file,'utf8')),password);expect(JSON.stringify(result.modules.me)===JSON.stringify({paragraphs:[]})).toBe(true);
});
test('M14.2 invalid links and conflicts retain Me buffer; cancel close and confirmed lock behave safely',async({page,repo})=>{
  await open(page,repo);await page.locator('#private-module-me').click();await page.locator('#private-list button').click();await page.getByRole('button',{name:'添加链接',exact:true}).click();await page.getByLabel('链接名称 1',{exact:true}).fill('非敏感');await page.getByLabel('链接地址 1',{exact:true}).fill('javascript:alert(1)');
  const before=fs.readFileSync(repo.file);await page.locator('#private-validate').click();await expect(page.locator('#private-state')).toContainText('PRIVATE_VALIDATION_FAILED');expect(fs.readFileSync(repo.file).equals(before)).toBe(true);
  await page.evaluate(id=>(window as unknown as MemoryBridge).__privateReceive({type:'studio:prepare-close',requestId:id}),randomUUID());await page.locator('#studio-exit').getByRole('button',{name:'取消',exact:true}).click();expect(await page.getByLabel('链接地址 1',{exact:true}).inputValue()==='javascript:alert(1)').toBe(true);
  await page.getByLabel('链接地址 1',{exact:true}).fill('https://example.com/');fs.appendFileSync(repo.file,'\n');const changed=fs.readFileSync(repo.file);await page.locator('#private-save').click();await secret(page,true);await expect(page.locator('#private-state')).toContainText('PRIVATE_CONFLICT');expect(fs.readFileSync(repo.file).equals(changed)).toBe(true);
  page.once('dialog',dialog=>dialog.accept());await page.locator('#private-lock').click();expect(await page.locator('#private-form').textContent()==='').toBe(true);
});
