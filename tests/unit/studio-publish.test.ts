import fs from'node:fs';import{join}from'node:path';import{test}from'node:test';import assert from'node:assert/strict';
import{createPublisher}from'../../studio/server/publish/service.ts';import{git}from'../../studio/server/publish/support.ts';import type{EditorResult}from'../../studio/contracts/result.ts';import type{PublicationStatus,PublicationPlan}from'../../studio/contracts/publish.ts';import{sourceExpression}from'../../studio/server/source-expression.ts';
const value=<T>(r:EditorResult<T>):T=>{assert.ok(r.ok,JSON.stringify(r));return r.value;};
const project=(slug:string)=>({slug,title:slug,summary:'NON_SENSITIVE_FIXTURE',published:slug==='other',sections:[{paragraphs:['NON_SENSITIVE_BODY']} ]});
import{publicationFixture}from'../studio/publish-fixture.ts';
import { saveThinkImage } from '../../studio/server/think/image.ts';
import { checkFastThink } from '../../studio/server/publish/think-fast.ts';
async function finished(publisher:ReturnType<typeof createPublisher>,id:string){let s:PublicationStatus;for(let n=0;n<1000;n++){s=value(await publisher.status(id));if(!publisher.busy())return s;await new Promise(r=>setTimeout(r,10));}throw new Error('Fixture publication did not settle');}
test('M23 only approved Build entry reaches remote; dirty index, non-target source bytes and local branch are preserved',async t=>{
  const f=await publicationFixture(t),beforeHead=await git(f.root,['rev-parse','HEAD']);const raw=fs.readFileSync(f.buildFile,'utf8').replace('"slug":"other","title":"other"','"slug":"other","title":"USER_OTHER_DIRTY"');fs.writeFileSync(f.buildFile,raw);fs.writeFileSync(join(f.root,'unrelated.txt'),'USER_STAGED_CHANGE');await git(f.root,['add','unrelated.txt','src/modules/build/data.ts']);const index=fs.readFileSync(join(f.root,'.git/index')),source=value(f.build.listBuild());
  const plan=value(await f.publisher.prepare({module:'build',key:'target',expectedSourceRevision:source.revision}));assert.equal(plan.canExecute,true,JSON.stringify(plan.issues));assert.ok(!plan.remoteDiff.includes('USER_OTHER_DIRTY'));assert.equal(fs.readFileSync(f.buildFile,'utf8'),raw);assert.deepEqual(fs.readFileSync(join(f.root,'.git/index')),index);
  const requests=await Promise.all([f.publisher.execute(plan.id,{bindingHash:plan.bindingHash,approvePublication:true}),f.publisher.execute(plan.id,{bindingHash:plan.bindingHash,approvePublication:true})]);assert.equal(requests.filter(r=>r.ok).length,1);
  const status=await finished(f.publisher,plan.id);assert.equal(status.phase,'complete',JSON.stringify(status));assert.equal(status.live,true);assert.deepEqual(f.calls,{push:1,dispatch:1,verify:1});assert.equal(await git(f.root,['rev-parse','HEAD']),beforeHead);assert.deepEqual(fs.readFileSync(join(f.root,'.git/index')),index);assert.equal(fs.readFileSync(join(f.root,'unrelated.txt'),'utf8'),'USER_STAGED_CHANGE');assert.ok(fs.readFileSync(f.buildFile,'utf8').includes('/* EXACT_OTHER_FORMAT */ '+JSON.stringify({...project('other'),title:'USER_OTHER_DIRTY'})));
  const remote=await git(f.bare,['show','refs/heads/main:src/modules/build/data.ts']);assert.ok(!remote.includes('USER_OTHER_DIRTY'));const entries=sourceExpression(remote,'projects','publicProjects','./projects.ts').value as {slug:string;published:boolean}[];assert.equal(entries.find(p=>p.slug==='target')?.published,true);assert.equal((await f.publisher.execute(plan.id,{bindingHash:plan.bindingHash,approvePublication:true})).ok,false);
  const receipt=fs.readFileSync(join(f.root,'receipts',plan.id+'.json'),'utf8');assert.ok(!receipt.includes('NON_SENSITIVE_BODY'));assert.ok(!receipt.includes('USER_OTHER_DIRTY'));
});
test('M23 direct proposal publication needs no preliminary draft source write; approved result clears inbox material',async t=>{
  const f=await publicationFixture(t),p=value(await f.intake.create({material:'---\nslug: from-proposal\ntitle: 非敏感标题\nsummary: 非敏感说明\ndate: 2026-10-31\n---\nNON_SENSITIVE_PROPOSAL_BODY',format:'markdown'}));const plan=value(await f.publisher.prepare({proposalId:p.id,expectedProposalRevision:p.revision}));assert.equal(plan.canExecute,true);assert.equal(fs.existsSync(join(f.root,'src/modules/think/content/from-proposal.md')),false);value(await f.publisher.execute(plan.id,{bindingHash:plan.bindingHash,approvePublication:true}));const s=await finished(f.publisher,plan.id);assert.equal(s.phase,'complete',JSON.stringify(s));const receipt=value(await f.intake.read(p.id));assert.equal(receipt.state,'applied');assert.ok(!fs.readFileSync(join(f.root,'inbox',p.id+'.json'),'utf8').includes('NON_SENSITIVE_PROPOSAL_BODY'));
});
for(const mode of ['fast','fast-artifact-fail'] as const)test('M23 '+mode+' delegates only the checked Think article and never re-uploads on verification',async t=>{
  const f=await publicationFixture(t,mode),base=await f.gateway.head(),head=await git(f.root,['rev-parse','HEAD']);
  fs.writeFileSync(join(f.root,'unrelated.txt'),'staged unrelated change');await git(f.root,['add','unrelated.txt']);
  const index=fs.readFileSync(join(f.root,'.git/index'));
  const draft=value(await f.intake.create({format:'markdown',material:'---\nslug: checked-think\ntitle: 合成文章\nsummary: 仅用于发布测试\ndate: 2026-11-23\n---\n# 非敏感样本\n\n只核对本地隔离链路。'}));
  const plan=value(await f.publisher.prepare({proposalId:draft.id,expectedProposalRevision:draft.revision}));
  assert.equal(plan.verification,'github-think-v1');assert.equal(await f.gateway.head(),base);
  value(await f.publisher.execute(plan.id,{bindingHash:plan.bindingHash,approvePublication:true}));
  const result=await finished(f.publisher,plan.id);
  assert.equal(f.fullChecks(),0);
  assert.equal(await git(f.bare,['diff','--name-only',base,'refs/heads/main']),'src/modules/think/content/checked-think.md');
  assert.equal(await git(f.root,['rev-parse','HEAD']),head);assert.deepEqual(fs.readFileSync(join(f.root,'.git/index')),index);
  if(mode==='fast-artifact-fail'){
    assert.equal(result.live,false);assert.equal(result.pushState,'confirmed');assert.equal(result.dispatchState,'confirmed');
    const other=value(await f.intake.create({format:'markdown',material:'---\nslug: second-check\ntitle: 第二篇\nsummary: 隔离样本\ndate: 2026-11-23\n---\n合成发布草稿。'}));
    const blocked=value(await f.publisher.prepare({proposalId:other.id,expectedProposalRevision:other.revision}));
    assert.equal(blocked.canExecute,false);assert.ok(blocked.issues.some(issue=>issue.startsWith('PREVIOUS_PUBLICATION_UNCONFIRMED')));
    assert.equal(value(await f.publisher.verifyAgain(plan.id)).live,true);
  }
  else assert.equal(result.live,true,JSON.stringify(result));
  assert.equal(f.calls.push,1);assert.equal(f.calls.dispatch,1);
});
test('M23 lightweight check requires committed local images and routes raw HTML to the full gate', async t => {
  const f = await publicationFixture(t, 'fast');
  const path = 'src/modules/think/content/test-resources.md';
  const write = (body: string) => fs.writeFileSync(join(f.root, path), `---\nslug: test-resources\ntitle: 合成测试\nsummary: 图片与语法检查\ndate: "2026-11-23"\npublished: true\n---\n${body}\n`);
  write('<img src="https://example.invalid/raw.png">');
  assert.equal(await checkFastThink(f.root, path, 'test-resources'), false);
  write('![远程图片](https://example.invalid/external.png)');
  assert.equal(await checkFastThink(f.root, path, 'test-resources'), false);
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ9sAAAAASUVORK5CYII=';
  const saved = saveThinkImage(f.root, {mime:'image/png',data:png});
  assert.equal(saved.ok, true);
  const image = value(saved);
  write(`![本地图片](${image.url})`);
  assert.equal(await checkFastThink(f.root, path, 'test-resources'), false);
  const imagePath = `src/modules/think/content/${image.url.slice(2)}`;
  await git(f.root, ['add', '--', imagePath]);
  await git(f.root, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture: approve image']);
  assert.equal(await checkFastThink(f.root, path, 'test-resources'), true);
});
test('M23 blocks a Think attachment outside the approved remote tree without writing source or pushing', async t => {
  const f = await publicationFixture(t);
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ9sAAAAASUVORK5CYII=';
  assert.equal(saveThinkImage(f.root, {mime:'image/gif',data:png}).ok, false);
  assert.equal(saveThinkImage(f.root, {mime:'image/png',data:Buffer.from('<svg/>').toString('base64')}).ok, false);
  const image = value(saveThinkImage(f.root, {mime:'image/png',data:png}));
  assert.deepEqual(value(saveThinkImage(f.root, {mime:'image/png',data:png})), image);
  const proposal = value(await f.intake.create({format:'markdown',material:`---\nslug: image-proof\ntitle: 非敏感标题\nsummary: 测试图片\ndate: 2026-10-31\n---\n![测试](${image.url})`}));
  const plan = value(await f.publisher.prepare({proposalId:proposal.id,expectedProposalRevision:proposal.revision}));
  assert.equal(plan.canExecute, false);
  assert.ok(plan.issues.some(issue => issue.startsWith('PUBLICATION_IMAGE_NOT_ON_MAIN')));
  assert.equal(fs.existsSync(join(f.root, 'src/modules/think/content/image-proof.md')), false);
  assert.deepEqual(f.calls, {push:0,dispatch:0,verify:0});
});
for(const mode of ['checks-fail','push-lost','dispatch-lost','artifact-fail','run-mismatch'] as const)test('M23 '+mode+' records real boundary and never blindly retries',async t=>{
  const f=await publicationFixture(t,mode),before=fs.readFileSync(f.buildFile),source=value(f.build.listBuild()),plan=value(await f.publisher.prepare({module:'build',key:'target',expectedSourceRevision:source.revision}));value(await f.publisher.execute(plan.id,{bindingHash:plan.bindingHash,approvePublication:true}));const s=await finished(f.publisher,plan.id);assert.equal(s.live,false);assert.ok(['failed','unknown'].includes(s.phase),JSON.stringify(s));assert.equal((await f.publisher.execute(plan.id,{bindingHash:plan.bindingHash,approvePublication:true})).ok,false);
  if(mode==='checks-fail'){assert.deepEqual(fs.readFileSync(f.buildFile),before);assert.equal(f.calls.push,0);}if(mode==='push-lost'){assert.equal(s.pushState,'unknown');assert.equal(f.calls.dispatch,0);assert.equal(await f.gateway.head(),s.commitSha);}if(mode==='dispatch-lost'){assert.equal(s.dispatchState,'unknown');value(await f.publisher.reconcile(plan.id));assert.equal(f.calls.dispatch,1);}if(mode==='artifact-fail'||mode==='run-mismatch'){assert.equal(s.pushState,'confirmed');assert.equal(s.live,false);}
});
test('M23 active checks refuse unsafe abandonment boundaries and owner loss stops before source/push',async t=>{
  const f=await publicationFixture(t,'gate-hold'),source=value(f.build.listBuild()),plan=value(await f.publisher.prepare({module:'build',key:'target',expectedSourceRevision:source.revision}));
  assert.equal((await f.publisher.execute(plan.id,{bindingHash:'0'.repeat(64),approvePublication:true})).ok,false);const original=fs.readFileSync(f.buildFile);value(await f.publisher.execute(plan.id,{bindingHash:plan.bindingHash,approvePublication:true}));await f.gateStarted;assert.equal(f.publisher.busy(),true);const abandoned=f.publisher.abandon();f.release();await abandoned;assert.deepEqual(fs.readFileSync(f.buildFile),original);assert.equal(f.calls.push,0);
});

for(const changed of['source','index','head','remote','proposal'] as const)test('M23 '+changed+' changed after preparation invalidates the real approved snapshot',async t=>{
  const f=await publicationFixture(t),source=value(f.build.listBuild());
  const p=changed==='proposal'?value(await f.intake.create({material:'---\nslug: stale-proof\ntitle: 非敏感标题\nsummary: 测试\ndate: 2026-10-31\n---\nbody',format:'markdown'})):undefined;
  const plan=value(await f.publisher.prepare(p?{proposalId:p.id,expectedProposalRevision:p.revision}:{module:'build',key:'target',expectedSourceRevision:source.revision}));
  if(changed==='source')fs.appendFileSync(f.buildFile,'\n// external saved change\n');
  if(changed==='index'){fs.writeFileSync(join(f.root,'unrelated.txt'),'NEW_STAGED');await git(f.root,['add','unrelated.txt']);}
  if(changed==='head')await git(f.root,['-c','commit.gpgsign=false','commit','--allow-empty','-m','FIXTURE_LOCAL_CHANGE']);
  if(changed==='remote'){const base=await f.gateway.head(),tree=await git(f.bare,['rev-parse',base+'^{tree}']),next=await git(f.root,['-c','commit.gpgsign=false','commit-tree',tree,'-p',base],{input:'FIXTURE_REMOTE_CHANGE\n'});await git(f.bare,['fetch',f.root,next]);await git(f.bare,['update-ref','refs/heads/main',next,base]);}
  if(p&&p.state!=='applied')value(await f.intake.update(p.id,{expectedProposalRevision:p.revision,candidate:{...p.candidate,body:'CHANGED_AUTHOR_BODY'},target:p.target}));
  const before=fs.readFileSync(f.buildFile),answer=await f.publisher.execute(plan.id,{bindingHash:plan.bindingHash,approvePublication:true});assert.equal(answer.ok,false);assert.equal(f.publisher.busy(),false);assert.equal(f.calls.push,0);assert.equal(f.calls.dispatch,0);assert.deepEqual(fs.readFileSync(f.buildFile),before);
});

test('M23 HTTP auth and strict DTOs apply to publication; closing during real held checks keeps server alive',async t=>{
  const f=await publicationFixture(t,'gate-hold'),source=value(f.build.listBuild()),session=await f.startHttp(false);
  const call=(method:string,path:string,body?:unknown,token=session.token)=>fetch(session.origin+'/api/authoring/v1/publish'+path,{method,headers:{'X-Studio-Token':token,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  assert.equal((await call('GET','',undefined,'wrong')).status,401);assert.equal((await call('POST','/prepare',{module:'private',key:'x',expectedSourceRevision:source.revision})).status,400);
  const plan=value<PublicationPlan>(await(await call('POST','/prepare',{module:'build',key:'target',expectedSourceRevision:source.revision})).json());
  assert.equal((await call('POST','/'+plan.id+'/reconcile',{path:'arbitrary'})).status,400);
  assert.equal((await call('POST','/'+plan.id+'/execute',{bindingHash:plan.bindingHash,approvePublication:true})).status,202);await f.gateStarted;
  const close=await session.close();assert.equal(close.ok,false);assert.equal((await call('GET','/'+plan.id)).status,200);assert.equal(f.calls.push,0);
  const abandon=session.abandon();f.release();assert.equal((await abandon).ok,true);assert.equal(f.calls.push,0);
});

test('M23 restart reads body-free boundaries; readonly proof recovery does not replay Git/dispatch and corrupt receipts fail closed',async t=>{
  const f=await publicationFixture(t,'artifact-fail'),source=value(f.build.listBuild()),plan=value(await f.publisher.prepare({module:'build',key:'target',expectedSourceRevision:source.revision}));
  value(await f.publisher.execute(plan.id,{bindingHash:plan.bindingHash,approvePublication:true}));const failed=await finished(f.publisher,plan.id);assert.equal(failed.live,false);assert.equal(failed.runId,1);
  const reopened=await f.restart();assert.equal(value(await reopened.status(plan.id)).pushState,'confirmed');assert.equal((await reopened.execute(plan.id,{bindingHash:plan.bindingHash,approvePublication:true})).ok,false);
  f.gateway.verify=async()=>{f.calls.verify++;return{artifactId:42,artifactDigest:'sha256:'+'a'.repeat(64)};};
  value(await reopened.reconcile(plan.id));const recovered=value(await reopened.verifyAgain(plan.id));assert.equal(recovered.live,true);assert.equal(value(await reopened.status(plan.id)).phase,'complete');assert.equal(f.calls.push,1);assert.equal(f.calls.dispatch,1);assert.equal(f.calls.verify,2);
  const path=join(f.root,'receipts',plan.id+'.json'),raw=JSON.parse(fs.readFileSync(path,'utf8'));raw.sourceState='unknown';fs.writeFileSync(path,JSON.stringify(raw));assert.equal((await reopened.status(plan.id)).ok,false);assert.equal((await reopened.list()).ok,false);assert.equal(f.calls.push,1);
});
