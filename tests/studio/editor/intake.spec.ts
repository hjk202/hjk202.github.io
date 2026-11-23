import { chooseWorkspace, reveal, clickDisclosed } from '../workbench-controls.ts';
import fs from 'node:fs';
import {join,resolve} from 'node:path';
import {test as base,expect} from '@playwright/test';
import {startStudioHttp} from '../../../studio/server/http.ts';
import {randomUUID} from 'node:crypto';

const test=base.extend<{repo:{root:string;origin:string;restart():Promise<void>}}>({repo:async({page},use)=>{
  const cache=resolve('.cache/studio-m19-1');fs.mkdirSync(cache,{recursive:true});const root=fs.mkdtempSync(join(cache,'browser-'));fs.mkdirSync(join(root,'src/modules/think/content'),{recursive:true});
  const open=(port=0)=>startStudioHttp({repositoryRoot:root,port,intakeDirectory:join(root,'fixture-inbox'),webDirectory:resolve('.cache/studio/web')});let session=await open();
  const errors:string[]=[],external:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!==session.origin)external.push(r.url());});
  try{await use({root,origin:session.origin,restart:async()=>{const port=Number(new URL(session.origin).port);await session.close();session=await open(port);}});}finally{await session.close();fs.rmSync(root,{recursive:true,force:true});expect(errors).toEqual([]);expect(external).toEqual([]);}
}});
test('M19.1 default review, incomplete import, metadata/body refinement, recovery and approved draft',async({page,repo})=>{
  await page.goto(repo.origin+'/#maintenance'); await chooseWorkspace(page, '录入');await expect(page.locator('#intake-editor')).toBeVisible();
  await page.locator('#intake-material').fill('中文正文\n```ts\nconst a = 1;\n```');await page.locator('#intake-create').click();await expect(page.locator('#intake-review')).toBeVisible();await expect(page.locator('#intake-apply')).toBeDisabled();expect(fs.readdirSync(join(repo.root,'src/modules/think/content'))).toEqual([]);
  await page.locator('#intake-slug').fill('review-proof');await page.locator('#intake-title').fill('文章测试');await page.locator('#intake-date').fill('2026-10-31');await page.locator('#intake-save').click();await expect(page.locator('#intake-message')).toContainText('候选已保存');await expect(page.locator('#intake-apply')).toBeEnabled();
  await repo.restart();await page.reload();await chooseWorkspace(page, '录入');await page.locator('#intake-list button').first().click();await expect(page.locator('#intake-slug')).toHaveValue('review-proof');await expect(page.locator('#intake-body')).toHaveValue(/const a = 1;/);
  await page.locator('#intake-body').fill('修订后的非敏感正文');await expect(page.locator('#intake-apply')).toBeDisabled();await page.locator('#intake-save').click();await expect(page.locator('#intake-apply')).toBeEnabled();
  page.once('dialog',d=>d.accept());await page.locator('#intake-apply').click();await expect(page.locator('#intake-message')).toContainText('已保存到真正内容源');expect(fs.readFileSync(join(repo.root,'src/modules/think/content/review-proof.md'),'utf8')).toContain('published: false');
  const stored=fs.readFileSync(join(repo.root,'fixture-inbox',fs.readdirSync(join(repo.root,'fixture-inbox'))[0]!),'utf8');expect(stored).not.toContain('修订后的非敏感正文');expect(stored).not.toContain('material');
  await chooseWorkspace(page, 'think');await expect(page.locator('#documents button')).toHaveCount(1);
});
test('M19.1 local UTF-8 file, safe material rendering, cancellation and size feedback',async({page,repo})=>{
  await page.goto(repo.origin+'/#maintenance'); await chooseWorkspace(page, '录入');await reveal(page, 'intake-options'); await page.locator('#intake-file').setInputFiles({name:'test.md',mimeType:'text/markdown',buffer:Buffer.from('---\nslug: file-proof\n---\n<script>throw "EXECUTED"</script>\n中文')});await expect(page.locator('#intake-material')).toHaveValue(/中文/);await page.locator('#intake-create').click();await expect(page.locator('#intake-original')).toContainText('<script>');
  page.once('dialog',d=>d.dismiss());await page.locator('#intake-apply').click();expect(fs.readdirSync(join(repo.root,'src/modules/think/content'))).toEqual([]);
  page.once('dialog',d=>d.accept());await clickDisclosed(page, 'intake-actions', '#intake-discard');await expect(page.locator('#intake-list button')).toHaveCount(0);
  await reveal(page, 'intake-options'); await page.locator('#intake-file').setInputFiles({name:'large.md',mimeType:'text/markdown',buffer:Buffer.alloc(65537,65)});await expect(page.locator('#intake-message')).toContainText('PAYLOAD_TOO_LARGE');
});
test('M19.1 cooperative close saves unimported material as a pending proposal without a source write',async({page,repo})=>{
  await page.addInitScript(()=>{const callbacks:((e:MessageEvent)=>void)[]=[];const target=window as unknown as {__reviewMessages:unknown[];__reviewReceive(value:unknown):void};target.__reviewMessages=[];target.__reviewReceive=value=>callbacks.forEach(fn=>fn(new MessageEvent('message',{data:value})));Object.defineProperty(window,'chrome',{value:{webview:{postMessage:(value:unknown)=>target.__reviewMessages.push(value),addEventListener:(_name:string,fn:(e:MessageEvent)=>void)=>callbacks.push(fn)}}});});
  await page.goto(repo.origin+'/#maintenance'); await chooseWorkspace(page, '录入');await page.locator('#intake-material').fill('尚未导入的非敏感文字');const requestId=randomUUID();await page.evaluate(id=>(window as unknown as {__reviewReceive(value:unknown):void}).__reviewReceive({type:'studio:prepare-close',requestId:id}),requestId);
  await expect(page.locator('#studio-exit')).toBeVisible();await page.getByRole('button',{name:'保存并退出',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as unknown as {__reviewMessages:{type:string;status:string}[]}).__reviewMessages.some(value=>value.type==='studio:close-result'&&value.status==='ready'))).toBe(true);
  expect(fs.readdirSync(join(repo.root,'src/modules/think/content'))).toEqual([]);expect(fs.readFileSync(join(repo.root,'fixture-inbox',fs.readdirSync(join(repo.root,'fixture-inbox'))[0]!),'utf8')).toContain('尚未导入的非敏感文字');
});
