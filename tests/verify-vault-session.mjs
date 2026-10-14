import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import process from 'node:process';
import { log } from 'node:console';
const snapshot=directory=>Object.fromEntries(readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
 const file=join(directory,entry.name);return entry.isDirectory()?Object.entries(snapshot(file)):[[file,createHash('sha256').update(readFileSync(file)).digest('hex')]];
}));
const before=snapshot('src'),isolated=resolve('.cache',`vault-session-${Date.now()}`);
mkdirSync(isolated,{recursive:true});cpSync('src',join(isolated,'src'),{recursive:true});cpSync('public',join(isolated,'public'),{recursive:true});
for(const file of ['package.json','astro.config.mjs','tsconfig.json'])cpSync(file,join(isolated,file));
const owner=join(isolated,'src/modules/observatory');mkdirSync(owner);
writeFileSync(join(owner,'module.ts'),`export default {id:'observatory',name:'Observatory',route:'/observatory/',icon:'M4 4h16v16H4z',order:50,async count(){return 0},async search(){return []}};`);
writeFileSync(join(owner,'pages.ts'),`import Index from './Index.astro';export default [{path:'',component:Index,props:{}}];`);
writeFileSync(join(owner,'Index.astro'),`<h1>Isolated session verification</h1><button data-fixture-unlock>Unlock non-sensitive empty fixture</button><script>import {vault} from '../../shell/vault/runtime';import {encryptVault} from '../../core/vault/crypto';import {onPage} from '../../shell/layout/lifecycle';onPage(()=>{const abort=new AbortController();document.querySelector('[data-fixture-unlock]')?.addEventListener('click',async()=>{const password='session-fixture-only-no-secrets';await vault.unlock(await encryptVault({version:1,modules:{},assets:{}},password),password);},{signal:abort.signal});return()=>abort.abort();});</script>`);
writeFileSync(join(owner,'vault.client.ts'),`import {vaultTarget,targetHref} from '../../core/vault/targets';
import type {VaultFactory} from '../../core/vault/types';
const create:VaultFactory=(value,context)=>{
 if(!value||typeof value!=='object'||Object.keys(value).join()!=='title'||typeof (value as {title?:unknown}).title!=='string')throw new Error('Invalid isolated record');
 let title=(value as {title:string}).title;const id='c'.repeat(32);
 return {count:n=>n+1,search:()=>[{module:context.module.id,title,description:'ISOLATED_PRIVATE_ADAPTER',url:vaultTarget(context.module.route,id)}],hasTarget:target=>target===id,mount(root,target){const node=document.createElement(target?'h1':'a');node.textContent=title;if(node instanceof HTMLAnchorElement)node.href=targetHref(vaultTarget(context.module.route,id),context.base);root.append(node);},dispose(){title='';}};
};export default create;`);
const packageJson=JSON.parse(readFileSync('node_modules/astro/package.json','utf8'));
execFileSync(process.execPath,[resolve('node_modules/astro',packageJson.bin.astro),'check'],{cwd:isolated,stdio:'inherit',env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'}});
execFileSync(process.execPath,[resolve('node_modules/astro',packageJson.bin.astro),'build'],{cwd:isolated,stdio:'inherit',env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'}});
assert.deepEqual(snapshot('src'),before);writeFileSync('.cache/vault-session-output.txt',join(isolated,'dist'));log('Isolated real Vault session site built; production source unchanged.');
