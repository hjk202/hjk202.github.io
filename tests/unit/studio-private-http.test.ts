import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { CipherFiles } from '../../studio/server/private/files.ts';
import { startStudioHttp } from '../../studio/server/http.ts';
import { encryptVault, decryptVault } from '../../src/core/vault/crypto.ts';
import { PrivateSession } from '../../studio/private/session.ts';
import { PrivateError } from '../../studio/private/error.ts';

test('M13 ciphertext HTTP requires trusted capability/authentication, current public revision and ciphertext-only exact bodies', async t => {
  const cache = resolve('.cache/studio-batch/m13'); fs.mkdirSync(cache,{recursive:true}); const directory=fs.mkdtempSync(join(cache,'http-'));
  const root=join(directory,'repo'), outside=join(directory,'outside'); fs.mkdirSync(join(root,'src/modules/think/content'),{recursive:true}); fs.mkdirSync(join(root,'src/modules/build'),{recursive:true}); fs.mkdirSync(outside);
  const source=join(root,'src/modules/build/data.ts'); fs.writeFileSync(source,"import { publicProjects } from './projects.ts';\nexport const projects = publicProjects([]);\n");
  const files=new CipherFiles(root), selected=files.bind(join(outside,'master.json'),'create');
  const server=await startStudioHttp({repositoryRoot:root,port:0,privateFiles:files,ai:{environment:{}}});
  t.after(async()=>{await server.close();assert.ok(relative(cache,directory).startsWith('http-'));fs.rmSync(directory,{recursive:true,force:true});});
  async function call(path:string,body?:unknown,headers:Record<string,string>={}) {
    const response=await fetch(server.origin+'/api/studio-private/'+path,{method:body===undefined?'GET':'PUT',headers:{'X-Studio-Token':server.token,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:response.status,data:await response.json()};
  }
  assert.equal((await call('public-build',undefined,{'X-Studio-Token':'invalid'})).status,401);
  assert.equal((await call('public-build',undefined,{Origin:'https://example.invalid'})).status,403);
  assert.equal((await call('files/'+randomUUID())).status,403);
  const snapshot=(await call('public-build')).data.value;
  assert.equal(snapshot.revision.length,64); assert.deepEqual(snapshot.slugs,[]);
  assert.equal((await call('files/'+selected.handle)).data.value.envelope,null);
  const secret='NON_SENSITIVE_M13_HTTP_PASSPHRASE', payload={version:1,modules:{think:{posts:[]}},assets:{}}, envelope=await encryptVault(payload,secret);
  const args={envelope,expectedRevision:null,publicRevision:snapshot.revision};
  assert.equal((await call('files/'+selected.handle,{...args,path:join(outside,'other.json')})).status,400);
  assert.equal((await call('files/'+selected.handle,{...args,password:secret})).status,400);
  assert.equal((await call('files/'+selected.handle,{...args,envelope:payload})).data.error.code,'PRIVATE_ENVELOPE_INVALID');
  const first=await call('files/'+selected.handle,args); assert.equal(first.status,200);
  const saved=fs.readFileSync(join(outside,'master.json'));
  assert.equal(saved.includes(Buffer.from(secret)),false); assert.deepEqual(await decryptVault(JSON.parse(saved.toString()),secret),payload);
  assert.equal((await call('files/'+selected.handle,args)).data.error.code,'PRIVATE_CONFLICT');
  fs.appendFileSync(source,'\n// public source changed\n');
  assert.equal((await call('files/'+selected.handle,{...args,expectedRevision:first.data.value.revision})).data.error.code,'PRIVATE_PUBLIC_CHANGED');
  assert.equal(fs.readFileSync(join(outside,'master.json')).equals(saved),true);
  fs.unlinkSync(join(outside,'master.json'));
  assert.equal((await call('files/'+selected.handle)).data.error.code,'PRIVATE_CONFLICT');
  const latest=(await call('public-build')).data.value;
  assert.equal((await call('files/'+selected.handle,{...args,publicRevision:latest.revision})).data.error.code,'PRIVATE_CONFLICT');
  assert.equal(fs.existsSync(join(outside,'master.json')),false);
  await server.close(); assert.throws(()=>files.read(selected.handle),/PRIVATE_HANDLE_INVALID/);
});

test('M13 partial candidates reject unencodable or oversized data without corrupting the last memory candidate', () => {
  const state=new PrivateSession();state.create({revision:'a'.repeat(64),slugs:[]});const before=state.snapshot();
  const cycle=state.snapshot();cycle.modules.think=cycle;
  for(const candidate of [cycle,{...before,modules:{think:{body:1n}}},{...before,modules:{think:{body:'x'.repeat(8*1024*1024)}}}])assert.throws(()=>state.replaceCandidate(candidate),/PRIVATE_VALIDATION_FAILED/);
  assert.deepEqual(state.snapshot(),before);state.lock();
});

test('M13 final public dependency guard fails before replacing the encrypted master and retains the prior bytes', async t => {
  const cache=resolve('.cache/studio-batch/m13');fs.mkdirSync(cache,{recursive:true});const directory=fs.mkdtempSync(join(cache,'guard-')),root=join(directory,'repo'),outside=join(directory,'external');fs.mkdirSync(root);fs.mkdirSync(outside);
  t.after(()=>{assert.ok(relative(cache,directory).startsWith('guard-'));fs.rmSync(directory,{recursive:true,force:true});});
  const store=new CipherFiles(root),file=join(outside,'master.json'),handle=store.bind(file,'create').handle,envelope=await encryptVault({version:1,modules:{},assets:{}},'NON_SENSITIVE_M13_GUARD_PASSWORD');
  const first=store.save(handle,null,envelope),before=fs.readFileSync(file);let checks=0;
  assert.throws(()=>store.save(handle,first.revision,envelope,()=>{if(++checks===2)throw new PrivateError('PRIVATE_PUBLIC_CHANGED');}),/PRIVATE_PUBLIC_CHANGED/);
  assert.equal(checks,2);assert.equal(fs.readFileSync(file).equals(before),true);assert.equal(fs.readdirSync(outside).some(name=>name.endsWith('.tmp')),false);store.close();
});
