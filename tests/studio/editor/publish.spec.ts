import { chooseWorkspace } from '../workbench-controls.ts';
import fs from'node:fs';import{join}from'node:path';import{test as base,expect}from'@playwright/test';import{publicationFixture}from'../publish-fixture.ts';
const test=base.extend<{repo:Awaited<ReturnType<typeof publicationFixture>>&{origin:string}}>({repo:async({page},use)=>{
  const cleanups:(()=>void|Promise<void>)[]=[],repo=await publicationFixture({after:fn=>{cleanups.push(fn);}}),session=await repo.startHttp(),errors:string[]=[],external:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!==session.origin)external.push(r.url());});
  try{await use({...repo,origin:session.origin});}finally{for(const cleanup of cleanups)await cleanup();expect(errors).toEqual([]);expect(external).toEqual([]);}
}});test.setTimeout(180000);
test('M23 source review cancel has no effect; one final approval preserves unrelated source and index and shows actual boundaries',async({page,repo})=>{
  const original=fs.readFileSync(repo.buildFile),index=fs.readFileSync(join(repo.root,'.git/index'));
  await page.goto(repo.origin+'/#maintenance');await chooseWorkspace(page, '发布');await page.locator('#publish-module').selectOption('build');await expect(page.locator('#publish-key option')).toHaveCount(3);await page.locator('#publish-key').selectOption('target');await page.locator('#publish-prepare').click();await expect(page.locator('#publish-execute')).toBeEnabled({timeout:30000});await expect(page.locator('#publish-remote-diff')).toContainText('"published": true');expect(fs.readFileSync(repo.buildFile)).toEqual(original);expect(repo.calls.push).toBe(0);
  page.once('dialog',d=>d.dismiss());await page.locator('#publish-execute').click();expect(repo.calls.push).toBe(0);expect(fs.readFileSync(repo.buildFile)).toEqual(original);
  page.once('dialog',d=>d.accept());await page.locator('#publish-execute').click();await expect(page.locator('#publish-phase')).toContainText('已核验上线',{timeout:60000});expect(repo.calls).toEqual({push:1,dispatch:1,verify:1});expect(fs.readFileSync(join(repo.root,'.git/index'))).toEqual(index);await expect(page.locator('#publish-boundaries')).toContainText('远端 main：已确认');await expect(page.locator('#publish-execute')).toBeDisabled();
});
test('M23 direct reviewed proposal enters publication without prior apply and clears stale editable inbox body after save',async({page,repo})=>{
  await page.goto(repo.origin+'/#maintenance'); await chooseWorkspace(page, '录入');await page.locator('#intake-material').fill('---\nslug: ui-publish\ntitle: 非敏感文章\nsummary: 测试说明\ndate: 2026-10-31\n---\nNON_SENSITIVE_UI_PUBLISH_BODY');await page.locator('#intake-create').click();await expect(page.locator('#intake-publish')).toBeEnabled();expect(fs.existsSync(join(repo.root,'src/modules/think/content/ui-publish.md'))).toBe(false);
  await page.locator('#intake-publish').click();await expect(page.locator('#publish-editor')).toBeVisible();await expect(page.locator('#publish-execute')).toBeEnabled({timeout:30000});await expect(page.locator('#publish-remote-diff')).toContainText('NON_SENSITIVE_UI_PUBLISH_BODY');expect(repo.calls.push).toBe(0);
  page.once('dialog',d=>d.accept());await page.locator('#publish-execute').click();await expect(page.locator('#publish-phase')).toContainText('已核验上线',{timeout:60000});await chooseWorkspace(page, '录入');await expect(page.locator('#intake-original')).toContainText('原材料及候选已清除');await expect(page.locator('#intake-body')).toHaveValue('');await expect(page.locator('#intake-publish')).toHaveText('从已保存源码准备发布…');
});
