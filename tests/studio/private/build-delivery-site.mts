import fs from 'node:fs';
import { join,resolve,relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { CipherFiles } from '../../../studio/server/private/files.ts';
import { PrivateDelivery } from '../../../studio/server/private/delivery.ts';
import { createBuildAuthoring } from '../../../studio/server/build/service.ts';
import { encryptVault,decryptVault } from '../../../src/core/vault/crypto.ts';
import { validatePrivatePayload } from '../../../studio/private/payload.ts';
import { deliveryPassword,deliveryPayload } from './delivery-data.ts';
const phase=resolve('.cache/studio-batch/m15');fs.mkdirSync(phase,{recursive:true});
const hash=(file:string)=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function snapshot(directory:string):Record<string,string>{return Object.fromEntries(fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{const path=join(directory,entry.name);return entry.isDirectory()?Object.entries(snapshot(path)):[[relative(process.cwd(),path),hash(path)]];}));}
const original={src:snapshot('src'),public:snapshot('public')},root=fs.mkdtempSync(join(phase,'site-')),outside=fs.mkdtempSync(join(phase,'site-ciphers-'));
for(const directory of ['src','public','scripts/vault'])fs.cpSync(resolve(directory),join(root,directory),{recursive:true});for(const file of ['package.json','astro.config.mjs','tsconfig.json'])fs.copyFileSync(file,join(root,file));
const build=createBuildAuthoring(root),publicRevision=()=>{const current=build.listBuild();if(!current.ok)throw new Error('FIXTURE_PUBLIC_BUILD_UNAVAILABLE');return current.value;};
const state=publicRevision();validatePrivatePayload(deliveryPayload(),{revision:state.revision,slugs:state.entries.filter(entry=>entry.published===true).map(entry=>entry.slug)});
const envelope=await encryptVault(deliveryPayload(),deliveryPassword),master=join(outside,'master.json');fs.writeFileSync(master,JSON.stringify(envelope));const masters=new CipherFiles(root),selected=masters.bind(master,'open'),delivery=new PrivateDelivery(root,masters,()=>publicRevision().revision),candidate=delivery.bindCandidate(join(outside,'candidate.json'));
const exported=delivery.export({handle:candidate.handle,masterHandle:selected.handle,masterRevision:selected.revision,publicRevision:state.revision,envelope}),delivered=delivery.replace(exported.id,delivery.status().targetRevision);assert.equal(delivered.revision,exported.revision);delivery.close();masters.close();build.close();
const env:NodeJS.ProcessEnv={...process.env,ASTRO_TELEMETRY_DISABLED:'1'};for(const key of Object.keys(env))if(/^(?:DASHSCOPE|STUDIO_AI|OPENAI|ANTHROPIC)_|^E2E_|^(?:BASE_PATH|SITE_URL)$/.test(key))delete env[key];
const cli=resolve('node_modules/astro/bin/astro.mjs'),records:{base:string;output:string;cipherRevision:string}[]=[];
for(const base of ['/','/personal-space/']){
  const output=join(root,base==='/'?'dist':'base-dist'),log=join(phase,base==='/'?'delivery-site-root-build.log':'delivery-site-base-build.log'),fd=fs.openSync(log,'w');
  try{execFileSync(process.execPath,['--experimental-strip-types',join(root,'scripts/vault/check-public.mjs')],{cwd:root,env,stdio:['ignore',fd,fd],windowsHide:true});execFileSync(process.execPath,[cli,'build','--base',base,'--outDir',output],{cwd:root,env,stdio:['ignore',fd,fd],windowsHide:true});}finally{fs.closeSync(fd);}
  assert.equal(hash(join(output,'vault/bundle.json')),exported.revision);assert.deepEqual(await decryptVault(JSON.parse(fs.readFileSync(join(output,'vault/bundle.json'),'utf8')),deliveryPassword),deliveryPayload());
  for(const file of Object.keys(snapshot(output))){const bytes=fs.readFileSync(file);for(const marker of ['STUDIO_DELIVERY_TEST_',deliveryPassword,'studio-assets/','Personal Space Studio'])assert.equal(bytes.includes(Buffer.from(marker)),false,'DELIVERY_RELEASE_BOUNDARY');}
  records.push({base,output,cipherRevision:exported.revision});
}
assert.deepEqual({src:snapshot('src'),public:snapshot('public')},original);fs.writeFileSync(join(phase,'delivery-site-artifacts.json'),JSON.stringify({records,sourceAndPublicUnchanged:true,actualCiphertextDelivery:true},null,2));console.log('Root/base isolated sites built from actual ciphertext delivery; source/public unchanged.');
