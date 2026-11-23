import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join,resolve,relative } from 'node:path';
import { createHash,randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { execFileSync } from 'node:child_process';
import { CipherFiles } from '../../studio/server/private/files.ts';
import { PrivateDelivery } from '../../studio/server/private/delivery.ts';
import { startStudioHttp } from '../../studio/server/http.ts';
import type { StudioHttpSession } from '../../studio/server/http.ts';
import { encryptVault,decryptVault } from '../../src/core/vault/crypto.ts';
import { validatePrivatePayload } from '../../studio/private/payload.ts';
import { privateSelection } from '../../studio/contracts/private.ts';
import { deliveryPassword,deliveryPayload } from '../studio/private/delivery-data.ts';
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
async function fixture(t:TestContext){
  const cache=resolve('.cache/studio-batch/m15');fs.mkdirSync(cache,{recursive:true});const directory=fs.mkdtempSync(join(cache,'delivery-')),root=join(directory,'repo'),outside=join(directory,'external');fs.mkdirSync(join(root,'src/modules/think/content'),{recursive:true});fs.mkdirSync(join(root,'src/modules/build'),{recursive:true});fs.mkdirSync(outside);
  const source=join(root,'src/modules/build/data.ts');fs.writeFileSync(source,"import { publicProjects } from './projects.ts';\nexport const projects=publicProjects([{slug:'nemu',title:'非敏感',summary:'验收',published:true,sections:[{paragraphs:['内容']}]}]);\n");
  const getRevision=()=>hash(fs.readFileSync(source)),master=join(outside,'master.json'),envelope=await encryptVault(deliveryPayload(),deliveryPassword);fs.writeFileSync(master,JSON.stringify(envelope));const masters=new CipherFiles(root),selected=masters.bind(master,'open'),delivery=new PrivateDelivery(root,masters,getRevision),bundle=join(root,'public/vault/bundle.json');
  const sessions:StudioHttpSession[]=[];
  t.after(async()=>{for(const session of sessions)assert.equal((await session.close()).ok,true);delivery.close();masters.close();assert.ok(relative(cache,directory).startsWith('delivery-'));fs.rmSync(directory,{recursive:true,force:true});});
  const exportCandidate=(name=randomUUID()+'.json',value=envelope,revision=selected.revision)=>{const path=join(outside,name),handle=delivery.bindCandidate(path).handle;return {path,candidate:delivery.export({handle,masterHandle:selected.handle,masterRevision:revision,publicRevision:getRevision(),envelope:value})};};
  return {root,outside,source,master,envelope,masters,selected,delivery,bundle,getRevision,exportCandidate,sessions};
}
test('M15 export is separate from fixed delivery, old ciphertext backs up outside public and verified recovery restores the full package',async t=>{
  const f=await fixture(t),originalSource=fs.readFileSync(f.source),originalMaster=fs.readFileSync(f.master);validatePrivatePayload(deliveryPayload(),{revision:f.getRevision(),slugs:['nemu']});
  const first=f.exportCandidate();assert.equal(fs.existsSync(f.bundle),false);assert.equal(fs.readFileSync(f.master).equals(originalMaster),true);assert.equal(hash(fs.readFileSync(first.path)),first.candidate.revision);
  const written=f.delivery.replace(first.candidate.id,null);assert.equal(written.revision,first.candidate.revision);assert.equal(written.backupRevision,null);const old=fs.readFileSync(f.bundle);assert.deepEqual(await decryptVault(JSON.parse(old.toString()),deliveryPassword),deliveryPayload());
  const changed=deliveryPayload();changed.modules.think.posts[0]!.title='STUDIO_DELIVERY_TEST_THINK_CHANGED';const next=await encryptVault(changed,deliveryPassword),masterWrite=f.masters.save(f.selected.handle,f.selected.revision,next);
  const second=f.exportCandidate('second.json',next,masterWrite.revision);const replaced=f.delivery.replace(second.candidate.id,first.candidate.revision);assert.equal(replaced.backupRevision,hash(old));const backup=join(f.outside,`.studio-delivery-backup-${hash(old)}.json`);assert.equal(fs.readFileSync(backup).equals(old),true);assert.deepEqual(fs.readdirSync(join(f.root,'public/vault')),['bundle.json']);
  const recovery=join(f.outside,'recovered-master.json');fs.copyFileSync(backup,recovery);const restored=f.masters.bind(recovery,'open'),candidateHandle=f.delivery.bindCandidate(join(f.outside,'restored-candidate.json')).handle;
  const candidate=f.delivery.export({handle:candidateHandle,masterHandle:restored.handle,masterRevision:restored.revision,publicRevision:f.getRevision(),envelope:restored.envelope});f.delivery.replace(candidate.id,replaced.revision);assert.deepEqual(await decryptVault(JSON.parse(fs.readFileSync(f.bundle,'utf8')),deliveryPassword),deliveryPayload());assert.equal(fs.readFileSync(f.source).equals(originalSource),true);
  for(const file of fs.readdirSync(f.outside)){const bytes=fs.readFileSync(join(f.outside,file));assert.equal(bytes.includes(Buffer.from(deliveryPassword)),false);assert.equal(bytes.includes(Buffer.from('STUDIO_DELIVERY_TEST_')),false);}
});
test('M15 stale master/candidate/public/target revisions cannot replace the formal bundle',async t=>{
  for(const kind of ['master','candidate','public','target'] as const)await t.test(kind,async sub=>{
    const f=await fixture(sub),exported=f.exportCandidate();
    if(kind==='master')fs.appendFileSync(f.master,'\n');else if(kind==='candidate')fs.appendFileSync(exported.path,'\n');else if(kind==='public')fs.appendFileSync(f.source,'\n// changed\n');else{fs.mkdirSync(join(f.root,'public/vault'),{recursive:true});fs.writeFileSync(f.bundle,JSON.stringify(f.envelope)+'\n');}
    const before=fs.existsSync(f.bundle)?fs.readFileSync(f.bundle):undefined;assert.throws(()=>f.delivery.replace(exported.candidate.id,null));if(before)assert.equal(fs.readFileSync(f.bundle).equals(before),true);else assert.equal(fs.existsSync(f.bundle),false);
  });
});
test('M15 candidate selection, fixed target and external backup reject paths, links, plaintext envelopes and backup collisions',async t=>{
  const f=await fixture(t);assert.throws(()=>f.delivery.bindCandidate(join(f.root,'candidate.json')),/PRIVATE_FILE_UNSAFE/);assert.throws(()=>f.delivery.bindCandidate(f.master),/PRIVATE_FILE_SELECTION_INVALID/);
  const fixed=CipherFiles.forBundle(f.root);assert.throws(()=>fixed.bind(join(f.outside,'no.json'),'create'),/PRIVATE_FILE_UNSAFE/);fixed.close();
  const handle=f.delivery.bindCandidate(join(f.outside,'invalid.json')).handle;assert.throws(()=>f.delivery.export({handle,masterHandle:f.selected.handle,masterRevision:f.selected.revision,publicRevision:f.getRevision(),envelope:deliveryPayload()}),/PRIVATE_ENVELOPE_INVALID/);assert.equal(fs.existsSync(join(f.outside,'invalid.json')),false);
  const first=f.exportCandidate();f.delivery.replace(first.candidate.id,null);const old=fs.readFileSync(f.bundle),different=await encryptVault({version:1,modules:{},assets:{}},deliveryPassword);fs.writeFileSync(join(f.outside,`.studio-delivery-backup-${hash(old)}.json`),JSON.stringify(different));const second=f.exportCandidate('collision.json');assert.throws(()=>f.delivery.replace(second.candidate.id,hash(old)),/PRIVATE_BACKUP_INVALID/);assert.equal(fs.readFileSync(f.bundle).equals(old),true);
  const hard=join(f.outside,'hard.json');fs.linkSync(second.path,hard);assert.throws(()=>f.delivery.replace(second.candidate.id,hash(old)),/PRIVATE_FILE_UNSAFE/);fs.unlinkSync(hard);
});
test('M15 atomic delivery failure keeps the old formal bytes and cleanup; dependency changes at fsync fail before commit',async t=>{
  const f=await fixture(t),first=f.exportCandidate();f.delivery.replace(first.candidate.id,null);const before=fs.readFileSync(f.bundle),second=f.exportCandidate('failure.json');const rename=fs.renameSync;
  try{fs.renameSync=(from,to)=>{if(resolve(String(to))===f.bundle)throw new Error('NON_SENSITIVE_DELIVERY_FAILURE');return rename(from,to);};assert.throws(()=>f.delivery.replace(second.candidate.id,hash(before)),/PRIVATE_WRITE_FAILED/);}finally{fs.renameSync=rename;}
  assert.equal(fs.readFileSync(f.bundle).equals(before),true);assert.deepEqual(fs.readdirSync(join(f.root,'public/vault')),['bundle.json']);
  const sync=fs.fsyncSync;let changed=false;try{fs.fsyncSync=fd=>{sync(fd);if(!changed){changed=true;fs.appendFileSync(f.source,'\n// before commit\n');}};assert.throws(()=>f.delivery.replace(second.candidate.id,hash(before)),/PRIVATE_PUBLIC_CHANGED/);}finally{fs.fsyncSync=sync;}
  assert.equal(changed,true);assert.equal(fs.readFileSync(f.bundle).equals(before),true);assert.deepEqual(fs.readdirSync(join(f.root,'public/vault')),['bundle.json']);
});
test('M15 HTTP delivery is authenticated, exact ciphertext-only bodies; native export selector cannot carry paths or passwords',async t=>{
  const f=await fixture(t);let delivery!:PrivateDelivery;const server=await startStudioHttp({repositoryRoot:f.root,port:0,privateFiles:f.masters,ai:{environment:{}},createPrivateDelivery:revision=>delivery=new PrivateDelivery(f.root,f.masters,revision)});f.sessions.push(server);
  const call=async(action:string,body?:unknown,headers:Record<string,string>={})=>{const response=await fetch(server.origin+'/api/studio-private/delivery/'+action,{method:body===undefined?'GET':'POST',headers:{'X-Studio-Token':server.token,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json()};};
  assert.equal((await call('status',undefined,{'X-Studio-Token':'bad'})).status,401);assert.equal((await call('status',undefined,{Origin:'https://example.invalid'})).status,403);assert.equal((await call('status')).data.value.targetRevision,null);
  const selected=delivery.bindCandidate(join(f.outside,'http.json')),args={handle:selected.handle,masterHandle:f.selected.handle,masterRevision:f.selected.revision,publicRevision:f.getRevision(),envelope:f.envelope};
  for(const extra of [{path:'C:/outside.json'},{password:deliveryPassword},{payload:deliveryPayload()}])assert.equal((await call('export',{...args,...extra})).status,400);
  const exported=await call('export',args);assert.equal(exported.status,200);assert.equal(fs.existsSync(f.bundle),false);assert.equal((await call('replace',{candidateId:randomUUID(),expectedTargetRevision:null})).status,409);assert.equal((await call('replace',{candidateId:exported.data.value.id,expectedTargetRevision:null})).status,200);
  const message={type:'studio:private-select',requestId:randomUUID(),mode:'export'};assert.equal(privateSelection(message),true);assert.equal(privateSelection({...message,path:'C:/outside.json'}),false);assert.equal(privateSelection({...message,password:'non-sensitive'}),false);
});
test('M15 redirected formal directories and hardlinked targets fail closed, and prebuild refuses leftover ciphertext staging',async t=>{
  const f=await fixture(t);fs.mkdirSync(join(f.root,'public'));const redirected=join(f.root,'public/vault');fs.symlinkSync(f.outside,redirected,process.platform==='win32'?'junction':'dir');try{assert.throws(()=>f.exportCandidate(),/PRIVATE_FILE_UNSAFE/);}finally{fs.unlinkSync(redirected);}
  const first=f.exportCandidate();f.delivery.replace(first.candidate.id,null);const hard=join(f.outside,'formal-hard.json');fs.linkSync(f.bundle,hard);try{assert.throws(()=>f.delivery.status(),/PRIVATE_FILE_UNSAFE/);}finally{fs.unlinkSync(hard);}
  const staged=join(f.root,'public/vault/.studio-private-nonsensitive.tmp');fs.writeFileSync(staged,JSON.stringify(f.envelope));assert.throws(()=>execFileSync(process.execPath,['--experimental-strip-types',resolve('scripts/vault/check-public.mjs')],{cwd:f.root,stdio:'pipe',windowsHide:true}));fs.unlinkSync(staged);execFileSync(process.execPath,['--experimental-strip-types',resolve('scripts/vault/check-public.mjs')],{cwd:f.root,stdio:'pipe',windowsHide:true});
});
test('M15 failed trusted delivery initialization releases acquired source leases before restart',async t=>{
  const f=await fixture(t);await assert.rejects(startStudioHttp({repositoryRoot:f.root,port:0,ai:{environment:{}},createPrivateDelivery:revision=>{revision();throw new Error('NON_SENSITIVE_INIT_FAILURE');}}),/INVALID_REQUEST/);
  const server=await startStudioHttp({repositoryRoot:f.root,port:0,privateFiles:f.masters,ai:{environment:{}}});f.sessions.push(server);const response=await fetch(server.origin+'/api/studio-private/public-build',{headers:{'X-Studio-Token':server.token}});assert.equal(response.status,200);assert.equal((await response.json()).ok,true);
});
