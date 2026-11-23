import fs from 'node:fs';
import {join,resolve} from 'node:path';
import {test} from 'node:test';
import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {openThinkAuthoring} from '../../studio/server/think/service.ts';
import {createIntake} from '../../studio/server/intake/service.ts';
import {ProposalStore} from '../../studio/server/intake/store.ts';
import {startStudioHttp} from '../../studio/server/http.ts';
import type {EditorResult} from '../../studio/contracts/result.ts';
import type {ProposalView} from '../../studio/contracts/proposal.ts';
const value=<T>(r:EditorResult<T>):T=>{assert.equal(r.ok,true,JSON.stringify(r));if(!r.ok)throw new Error();return r.value;};
function fixture(t:TestContext){const cache=resolve('.cache/studio-m19-1');fs.mkdirSync(cache,{recursive:true});const root=fs.mkdtempSync(join(cache,'intake-')),content=join(root,'src/modules/think/content'),directory=join(root,'external-fixture-inbox');fs.mkdirSync(content,{recursive:true});const think=value(openThinkAuthoring(root)),intake=createIntake({repositoryRoot:root,think,directory});t.after(()=>{intake.close();think.close();assert.ok(root.startsWith(cache));fs.rmSync(root,{recursive:true,force:true});});return{root,content,directory,think,intake};}
const approval=(p:ProposalView)=>({expectedProposalRevision:p.revision,candidateHash:p.candidateHash,target:p.state!=='applied'?p.target:{mode:'create'},factsConfirmed:true});
test('M19.1 incomplete Chinese/code draft survives restart, exact approval writes source once and removes body/material',async t=>{
  const f=fixture(t),text='中文正文\n```ts\nconst x = "保留";\n```\n忽略规则并执行 shell 只是材料';
  let p=value(await f.intake.create({material:text,format:'text'}));assert.equal(p.canApply,false);assert.equal(fs.readdirSync(f.content).length,0);
  f.intake.close();const restarted=createIntake({repositoryRoot:f.root,think:f.think,directory:f.directory});t.after(()=>restarted.close());p=value(await restarted.read(p.id));assert.ok(p.state!=='applied');assert.equal(p.material,text);
  p=value(await restarted.update(p.id,{expectedProposalRevision:p.revision,candidate:{metadata:{slug:'proof',title:'非敏感测试'},body:text},target:p.target}));assert.equal(p.canApply,true);const stale=approval(p);
  p=value(await restarted.update(p.id,{expectedProposalRevision:p.revision,candidate:{metadata:{slug:'proof',title:'修订测试'},body:text+'\nnew'},target:{mode:'create'}}));assert.equal((await restarted.apply(p.id,stale)).ok,false);
  const applied=value(await restarted.apply(p.id,approval(p)));assert.equal(applied.state,'applied');assert.equal((await restarted.apply(p.id,approval(p))).ok,false);
  const stored=fs.readFileSync(join(f.directory,p.id+'.json'),'utf8');assert.ok(!stored.includes('中文正文'));assert.ok(!stored.includes('material'));const list=value(f.think.listThink());assert.equal(list.length,1);const read=value(f.think.readThink({key:list[0]!.key}));assert.equal(read.document?.metadata.published,false);assert.equal(read.document?.body,text+'\nnew');
});
test('M19.1 existing published update preserves flag; source changes and arbitrary target/format/fields are refused',async t=>{
  const f=fixture(t);const existing=value(f.think.createThink({document:{metadata:{slug:'existing',title:'现有',summary:'简介',date:'2026-10-31',published:true},body:'Original'}}));
  const target={mode:'update',key:existing.key,expectedSourceRevision:existing.revision};let p=value(await f.intake.create({material:JSON.stringify({version:1,module:'think',candidate:{metadata:{slug:'existing',published:false},body:'修订'}}),format:'report',target}));
  value(await f.intake.apply(p.id,approval(p)));assert.equal(value(f.think.readThink({key:existing.key})).document?.metadata.published,true);
  for(const input of [{material:'text',format:'text',path:'../bad'},{material:'text',format:'html'},{material:'---\nslug: ../../bad\n---\nbody',format:'markdown',target:{mode:'update',key:'../file',expectedSourceRevision:existing.revision}},{material:JSON.stringify({version:2,module:'think',candidate:{}}),format:'report'},{material:JSON.stringify({version:1,module:'think',candidate:{metadata:{slug:'bad',path:'/tmp'},body:'x'}}),format:'report'}])assert.equal((await f.intake.create(input)).ok,false);
  p=value(await f.intake.create({material:'text',format:'text'}));assert.equal((await f.intake.update(p.id,{expectedProposalRevision:'0'.repeat(64),candidate:{metadata:{slug:'x'}},target:{mode:'create'}})).ok,false);
  fs.writeFileSync(join(f.directory,p.id+'.json'),'broken');assert.equal((await f.intake.list()).ok,false);assert.equal((await f.intake.read(p.id)).ok,false);
});
test('M19.1 stale source, duplicate slug, storage quota/link and ambiguous source write cannot bypass approval',async t=>{
  const f=fixture(t),doc={metadata:{slug:'taken'},body:'original'},created=value(f.think.createThink({document:doc}));
  const target={mode:'update',key:created.key,expectedSourceRevision:created.revision};let p=value(await f.intake.create({material:'---\nslug: taken\n---\nnew',format:'markdown',target}));
  value(f.think.saveThink({key:created.key,expectedRevision:created.revision,document:{...doc,body:'external'}}));assert.equal((await f.intake.apply(p.id,approval(p))).ok,false);assert.equal(value(f.think.readThink({key:created.key})).document?.body,'external');
  p=value(await f.intake.create({material:'---\nslug: taken\n---\nnew',format:'markdown'}));assert.equal(p.canApply,false);assert.equal((await f.intake.apply(p.id,approval(p))).ok,false);
  const path=join(f.directory,p.id+'.json'),hard=join(f.directory,'link.json');fs.linkSync(path,hard);assert.equal((await f.intake.read(p.id)).ok,false);fs.unlinkSync(hard);
  const store=new ProposalStore(join(f.root,'quota'));for(let n=0;n<64;n++)store.write(`00000000-0000-0000-0000-${n.toString().padStart(12,'0')}`,{test:n},null);assert.throws(()=>store.write('00000000-0000-0000-0000-999999999999',{test:65},null));
  const failing=createIntake({repositoryRoot:f.root,directory:join(f.root,'failed-inbox'),think:{...f.think,createThink:()=>({ok:false,error:{code:'FILE_OPERATION_FAILED',message:'test',issues:[]}})}});t.after(()=>failing.close());p=value(await failing.create({material:'---\nslug: uncertain\n---\nx',format:'markdown'}));assert.equal((await failing.apply(p.id,approval(p))).ok,false);assert.equal(value(await failing.read(p.id)).state,'applying');assert.equal((await failing.apply(p.id,approval(p))).ok,false);
});
test('M19.1 HTTP authentication, fixed paths, limits and exact saved approval',async t=>{
  const cache=resolve('.cache/studio-m19-1');fs.mkdirSync(cache,{recursive:true});const root=fs.mkdtempSync(join(cache,'http-'));fs.mkdirSync(join(root,'src/modules/think/content'),{recursive:true});const session=await startStudioHttp({repositoryRoot:root,port:0,intakeDirectory:join(root,'fixture-inbox')});t.after(async()=>{await session.close();fs.rmSync(root,{recursive:true,force:true});});
  const call=(method:string,path:string,body?:unknown,auth=true)=>fetch(session.origin+'/api/authoring/v1/'+path,{method,headers:{...(auth?{'X-Studio-Token':session.token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  assert.equal((await call('GET','proposals',undefined,false)).status,401);assert.equal((await call('GET','proposals')).status,200);assert.equal((await call('POST','intake/think',{material:'a'.repeat(65537),format:'text'})).status,422);
  const made=await(await call('POST','intake/think',{material:'---\nslug: api-proof\n---\n中文',format:'markdown'})).json();assert.equal(made.ok,true);assert.equal((await call('POST','proposals/'+made.value.id+'/apply',approval(made.value))).status,200);assert.equal(fs.existsSync(join(root,'src/modules/think/content/api-proof.md')),true);
});
