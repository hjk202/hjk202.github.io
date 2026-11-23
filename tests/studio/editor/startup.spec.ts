import { chooseWorkspace, reveal, clickDisclosed } from '../workbench-controls.ts';
import fs from 'node:fs';
import { join,resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { test as base,expect } from '@playwright/test';
import { startStudioHttp } from '../../../studio/server/http.ts';

type Bridge = Window & {__startupMessages:Record<string,unknown>[];__startupReceive(value:unknown):void};
const environment={DASHSCOPE_API_KEY:'NON_SENSITIVE_STARTUP_KEY',DASHSCOPE_BASE_URL:'https://fixture.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'};
const test=base.extend<{repo:{origin:string;ready():void;fail():void}}>( {repo:async({page},use)=>{
  const cache=resolve('.cache/studio-m16-3');fs.mkdirSync(cache,{recursive:true});const root=fs.mkdtempSync(join(cache,'editor-'));
  fs.mkdirSync(join(root,'src/modules/think/content'),{recursive:true});
  let ready!:(environment:NodeJS.ProcessEnv)=>void,fail!:(error:Error)=>void;
  const pending=new Promise<NodeJS.ProcessEnv>((resolve,reject)=>{ready=resolve;fail=reject;});
  const server=await startStudioHttp({repositoryRoot:root,port:0,webDirectory:resolve('.cache/studio/web'),ai:{loadEnvironment:()=>pending}});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{const target=window as unknown as Bridge;target.__startupMessages=[];const callbacks:((event:MessageEvent)=>void)[]=[];
    Object.defineProperty(window,'chrome',{configurable:true,value:{webview:{postMessage:(value:Record<string,unknown>)=>target.__startupMessages.push(value),addEventListener:(_type:string,callback:(event:MessageEvent)=>void)=>callbacks.push(callback)}}});
    target.__startupReceive=value=>callbacks.forEach(callback=>callback(new MessageEvent('message',{data:value})));
  });
  try{await use({origin:server.origin,ready:()=>ready(environment),fail:()=>fail(new Error('NON_SENSITIVE_HIDDEN_ERROR_DETAIL'))});}
  finally{ready({});expect((await server.close()).ok).toBe(true);fs.rmSync(root,{recursive:true,force:true});expect(errors).toEqual([]);}
}});

test('M16.3 AI loading is independent of editing and secondary panels are created only on first use',async({page,repo})=>{
  await page.goto(repo.origin+'/#think');await expect(page.locator('#ai-service')).toContainText('正在读取本机加密配置');
  expect(await page.locator('#ai-service').textContent()).not.toContain('AI_NOT_CONFIGURED');
  await expect(page.locator('#private-password-dialog')).toHaveCount(0);await expect(page.locator('#keep-form')).toHaveCount(0);
  await page.locator('#new').click();await page.locator('#slug').fill('startup-note');await reveal(page, 'think-properties'); await page.locator('#kind').selectOption('note');await page.locator('#body').fill('非敏感启动测试');
  await page.locator('#save').click();await expect(page.locator('#save-state')).toContainText('已保存');
  await chooseWorkspace(page, 'keep');await expect(page.locator('#keep-editor')).toBeVisible();await expect(page.locator('#private-password-dialog')).toHaveCount(0);
  await chooseWorkspace(page, 'think');await chooseWorkspace(page, '私人');await expect(page.locator('#private-password-dialog')).toHaveCount(1);
  await chooseWorkspace(page, 'think');repo.ready();await expect(page.locator('#ai-service')).toContainText('后端已配置');
  expect(await page.locator('body').textContent()).not.toContain(environment.DASHSCOPE_API_KEY);
});
test('M16.3 failed saved configuration is distinct from missing and does not break ordinary validation',async({page,repo})=>{
  await page.goto(repo.origin+'/#think');repo.fail();await expect(page.locator('#ai-service')).toContainText('AI_CONFIG_UNAVAILABLE');
  expect(await page.locator('#ai-service').textContent()).not.toContain('HIDDEN_ERROR_DETAIL');
  await page.locator('#new').click();await page.locator('#slug').fill('readiness-draft');await page.locator('#body').fill('非敏感文字');
  await clickDisclosed(page, 'think-actions', '#validate');await expect(page.locator('#ai-request')).toBeDisabled();await expect(page.locator('#save')).toBeEnabled();
});
test('M16.3 native editable-ready waits for the first list response; cancelling close preserves input during initialization',async({page,repo})=>{
  let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/authoring/v1/think/documents?*',async route=>{await held;await route.continue();});
  await page.route('**/api/authoring/v1/think/documents',async route=>{if(route.request().method()==='GET'){await held;}await route.continue();});
  await page.goto(repo.origin+'/#think');await expect.poll(()=>page.evaluate(()=>(window as unknown as Bridge).__startupMessages.some(value=>value.type==='studio:editor-initialized'))).toBe(true);
  expect(await page.evaluate(()=>(window as unknown as Bridge).__startupMessages.some(value=>value.type==='studio:editor-ready'))).toBe(false);
  await page.locator('#new').click();await page.locator('#body').fill('非敏感初始化缓冲');
  await page.evaluate(id=>(window as unknown as Bridge).__startupReceive({type:'studio:prepare-close',requestId:id}),randomUUID());
  await page.locator('#studio-exit').getByRole('button',{name:'取消',exact:true}).click();await expect(page.locator('#body')).toHaveValue('非敏感初始化缓冲');
  release();await expect.poll(()=>page.evaluate(()=>(window as unknown as Bridge).__startupMessages.filter(value=>value.type==='studio:editor-ready').length)).toBe(1);repo.ready();
});
