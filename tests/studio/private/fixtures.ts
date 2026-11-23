import { chooseWorkspace } from '../workbench-controls.ts';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, resolve, relative } from 'node:path';
import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startStudioHttp } from '../../../studio/server/http.ts';
import { CipherFiles } from '../../../studio/server/private/files.ts';
import { encryptVault } from '../../../src/core/vault/crypto.ts';
import { PrivateDelivery } from '../../../studio/server/private/delivery.ts';
import type { PrivateSelectionMode } from '../../../studio/contracts/private.ts';

export type MemoryBridge = Window & { __privateMessages: Record<string,unknown>[]; __privateReceive(value:unknown):void };
export const password='NON_SENSITIVE_'+randomUUID()+'_'+randomUUID();
const payload=()=>({version:1,modules:{
  think:{posts:[{id:'a'.repeat(32),title:'非敏感已有文章',summary:'说明',date:'2026-10-23',kind:'article',body:'非敏感正文'}, {id:'b'.repeat(32),title:'非敏感保留文章',summary:'保留',date:'2026-10-22',kind:'note',body:'其他记录'}]},
  keep:{bookmarks:[{id:'c'.repeat(32),title:'非敏感保留收藏',description:'保留说明',sourceUrl:'https://example.com/',note:['保留段落']}]},me:{paragraphs:['非敏感保持原样']},build:{projects:[{id:'d'.repeat(32),title:'非敏感保留项目',summary:'保留说明',sections:[{paragraphs:['保留段落'],code:'保留代码\nline two'}]}],supplements:[]},
},assets:{['e'.repeat(32)]:{type:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='}}});
export type Repo={origin:string;file:string;source:string;bundle:string;files:CipherFiles;original:ReturnType<typeof payload>;expectBundle():void;bindCandidate(file:string):string;choose(page:Page,mode:PrivateSelectionMode,file?:string):Promise<void>};
export const test=base.extend<{repo:Repo;deliveryMode:boolean}>({deliveryMode:[false,{option:true}],repo:async({page,deliveryMode},use)=>{
  const cache=resolve('.cache/studio-batch/m13');fs.mkdirSync(cache,{recursive:true});const directory=fs.mkdtempSync(join(cache,'browser-')),root=join(directory,'repo'),outside=join(directory,'external');
  fs.mkdirSync(join(root,'src/modules/think/content'),{recursive:true});fs.mkdirSync(join(root,'src/modules/build'),{recursive:true});fs.mkdirSync(outside);
  const source=join(root,'src/modules/build/data.ts');fs.writeFileSync(source,"import { publicProjects } from './projects.ts';\nexport const projects = publicProjects([]);\n");
  const canary='PRIVATE_EDITOR_'+randomUUID(),original=payload(),file=join(outside,'master.json');original.modules.think.posts[0]!.body=canary;fs.writeFileSync(file,JSON.stringify(await encryptVault(original,password)));
  let delivery:PrivateDelivery|undefined;const files=new CipherFiles(root),server=await startStudioHttp({repositoryRoot:root,port:0,privateFiles:files,webDirectory:resolve('.cache/studio/web'),ai:{environment:{}},...(deliveryMode?{createPrivateDelivery:(revision:()=>string)=>delivery=new PrivateDelivery(root,files,revision)}:{})});
  const expectedFiles=['src/modules/build/data.ts'];
  const errors:string[]=[],externals:string[]=[],leaks:string[]=[];
  page.on('pageerror',()=>errors.push('PAGE_ERROR'));
  page.on('request',request=>{if(new URL(request.url()).origin!==server.origin&&!request.url().startsWith('blob:'))externals.push('EXTERNAL');if([password,canary,'非敏感','PRIVATE_EXECUTED','保留代码'].some(value=>request.postData()?.includes(value)))leaks.push('PLAINTEXT_UPLOAD');if(request.url().includes('/api/studio-private/')&&request.postData()){const body=JSON.parse(request.postData()!) as object;if(Object.keys(body).some(key=>!['envelope','expectedRevision','publicRevision','handle','masterHandle','masterRevision','candidateId','expectedTargetRevision'].includes(key)))leaks.push('UNEXPECTED_PRIVATE_BODY');}});
  await page.addInitScript(()=>{const target=window as unknown as MemoryBridge;target.__privateMessages=[];const callbacks:((event:MessageEvent)=>void)[]=[];Object.defineProperty(window,'chrome',{configurable:true,value:{webview:{postMessage:(value:Record<string,unknown>)=>target.__privateMessages.push(value),addEventListener:(_type:string,callback:(event:MessageEvent)=>void)=>callbacks.push(callback)}}});target.__privateReceive=value=>callbacks.forEach(callback=>callback(new MessageEvent('message',{data:value})));});
  const repo:Repo={origin:server.origin,file,source,bundle:join(root,'public/vault/bundle.json'),files,original,expectBundle(){if(!deliveryMode)throw new Error('Fixture delivery not authorized');if(!expectedFiles.includes('public/vault/bundle.json'))expectedFiles.push('public/vault/bundle.json');},bindCandidate(file){if(!delivery)throw new Error('Fixture delivery not configured');return delivery.bindCandidate(file).handle;},async choose(page,mode,target=file){
    if(mode==='export'&&await page.locator('#private-delivery-steps').isHidden())await page.locator('#private-prepare').click();
    await page.locator('#private-'+(mode==='open'?'open':mode==='export'?'select-export':'create')).click();
    const message=await page.evaluate(()=>(window as unknown as MemoryBridge).__privateMessages.filter(value=>value.type==='studio:private-select').at(-1));expect(message?.mode).toBe(mode);
    const selected=mode==='export'?delivery?.bindCandidate(target):files.bind(target,mode);if(!selected)throw new Error('Fixture delivery not configured');await page.evaluate(({requestId,handle})=>(window as unknown as MemoryBridge).__privateReceive({type:'studio:private-bound',requestId,handle}),{requestId:message!.requestId,handle:selected.handle});
    if(mode==='export'){await secret(page);await expect(page.locator('#private-tools')).toBeVisible();}
  }};
  try { await page.goto(server.origin+'/#think');await chooseWorkspace(page, '私人');await use(repo); }
  finally {
    await page.evaluate(()=>{const button=document.getElementById('private-lock');window.confirm=()=>true;button?.click();});
    expect(await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0&&!document.querySelector('#private-form')?.textContent&&!document.querySelector('#private-preview-content')?.textContent)).toBe(true);
    expect((await server.close()).ok).toBe(true);expect(errors).toEqual([]);expect(externals).toEqual([]);expect(leaks).toEqual([]);
    const sourceFiles:string[]=[];const scan=(directory:string)=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())scan(path);else sourceFiles.push(relative(root,path).replaceAll('\\','/'));}};scan(root);expect(sourceFiles.sort()).toEqual(expectedFiles.sort());
    expect(relative(cache,directory).startsWith('browser-')).toBe(true);fs.rmSync(directory,{recursive:true,force:true});
  }
}});
export async function secret(page:Page,confirm=false){await expect(page.locator('#private-password-dialog')).toBeVisible();await page.locator('#private-password').fill(password);if(confirm)await page.locator('#private-password-confirm').fill(password);await page.locator('#private-password-dialog').getByRole('button',{name:'继续',exact:true}).click();}
export async function open(page:Page,repo:Repo){await repo.choose(page,'open');await secret(page);await expect(page.locator('#private-tools')).toBeVisible();await expect(page.locator('#private-state')).toContainText('本机内存打开');}
export async function save(page:Page){await page.locator('#private-save').click();await secret(page,true);await expect(page.locator('#private-state')).toContainText('资料库已保存');}

