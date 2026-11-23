import fs from'node:fs';import{join,resolve}from'node:path';import assert from'node:assert/strict';
import{openThinkAuthoring}from'../../studio/server/think/service.ts';import{createBuildAuthoring}from'../../studio/server/build/service.ts';import{createIntake}from'../../studio/server/intake/service.ts';import{createPublisher}from'../../studio/server/publish/service.ts';import type{PublicationGateway,PublicationRun}from'../../studio/server/publish/github.ts';import{runTitle}from'../../studio/server/publish/github.ts';import{git,command,catalog,PublishError}from'../../studio/server/publish/support.ts';import type{EditorResult}from'../../studio/contracts/result.ts';
import{startStudioHttp}from'../../studio/server/http.ts';import type{StudioHttpSession}from'../../studio/server/http.ts';
const value=<T>(r:EditorResult<T>):T=>{assert.ok(r.ok,JSON.stringify(r));return r.value;};
const project=(slug:string)=>({slug,title:slug,summary:'NON_SENSITIVE_FIXTURE',published:slug==='other',sections:[{paragraphs:['NON_SENSITIVE_BODY']} ]});
type Mode='success'|'checks-fail'|'push-lost'|'dispatch-lost'|'artifact-fail'|'run-mismatch'|'gate-hold'|'fast'|'fast-artifact-fail';
export async function publicationFixture(t:{after(callback:()=>void|Promise<void>):void},mode:Mode='success'){
  const cache=resolve('.cache/studio-m23');fs.mkdirSync(cache,{recursive:true});const directory=fs.mkdtempSync(join(cache,'git-fixture-')),root=join(directory,'work'),bare=join(directory,'remote.git');fs.mkdirSync(root);await git(root,['init','--initial-branch=main']);await git(root,['config','user.name','Studio Fixture']);await git(root,['config','user.email','fixture@example.invalid']);
  fs.mkdirSync(join(root,'src/modules/think/content'),{recursive:true});fs.mkdirSync(join(root,'src/modules/build'));fs.mkdirSync(join(root,'.github/workflows'),{recursive:true});fs.mkdirSync(join(root,'scripts/release'),{recursive:true});
  const workflow=fs.readFileSync('.github/workflows/deploy.yml','utf8');
  const fast=mode==='fast' || mode==='fast-artifact-fail';
  fs.writeFileSync(join(root,'.github/workflows/deploy.yml'),fast?workflow:workflow.replace('STUDIO_THINK_FAST_V1','legacy full verification'));
  fs.copyFileSync('scripts/release/record.mjs',join(root,'scripts/release/record.mjs'));
  if(fast)fs.copyFileSync('scripts/release/check-think.mjs',join(root,'scripts/release/check-think.mjs'));
  fs.writeFileSync(join(root,'src/modules/think/content/base.md'),'---\nslug: base\npublished: false\n---\nNON_SENSITIVE_BASE');
  const buildFile=join(root,'src/modules/build/data.ts');fs.writeFileSync(buildFile,"import {publicProjects} from './projects.ts';\nexport const projects=publicProjects(["+JSON.stringify(project('target'))+', /* EXACT_OTHER_FORMAT */ '+JSON.stringify(project('other'))+']);\n');
  fs.writeFileSync(join(root,'unrelated.txt'),'ORIGINAL');fs.writeFileSync(join(root,'.gitignore'),'.cache/\ndist/\ninbox/\nreceipts/\n');
  await git(root,['add','.']);await git(root,['-c','commit.gpgsign=false','commit','-m','NON_SENSITIVE_FIXTURE_BASE']);await git(directory,['init','--bare','remote.git']);await git(root,['remote','add','origin',bare]);await git(root,['push','origin','main']);
  const think=value(openThinkAuthoring(root)),build=createBuildAuthoring(root),intake=createIntake({repositoryRoot:root,think,build,directory:join(root,'inbox')});const calls={push:0,dispatch:0,verify:0};let currentRun:PublicationRun|undefined,heldRelease=()=>{};let fullChecks=0;
  let started!:()=>void;const gateStarted=new Promise<void>(r=>{started=r;});const held=new Promise<void>(r=>{heldRelease=r;});
  const gateway:PublicationGateway={repository:'fixture/repo',site:'https://example.invalid/',gitUrl:bare,
    head:()=>git(bare,['rev-parse','refs/heads/main']),fetch:async(candidate,sha)=>{await git(candidate,['fetch','--depth=1','--no-tags',bare,sha]);},writeAvailable:async()=>true,
    push:async p=>{calls.push++;const candidate=join(root,'.cache/studio/publication-work',p.id);assert.equal(await git(candidate,['rev-parse',p.sha+'^{tree}']),p.tree);await git(bare,['fetch','--no-tags',candidate,p.sha]);await git(bare,['merge-base','--is-ancestor',p.baseSha,p.sha]);await git(bare,['update-ref','refs/heads/main',p.sha,p.baseSha]);if(mode==='push-lost')throw new Error('SIMULATED_RESPONSE_LOST');},
    dispatch:async(id,sha)=>{calls.dispatch++;currentRun={id:1,head_sha:mode==='run-mismatch'?'f'.repeat(40):sha,head_branch:'main',event:'workflow_dispatch',display_title:runTitle(id,sha),status:'completed',conclusion:'success'};if(mode==='dispatch-lost')throw new Error('SIMULATED_DISPATCH_LOST');},
    findRun:async()=>currentRun,inspectRun:async()=>{if(!currentRun)throw new Error('No fixture run');return currentRun;},
    verify:async(_r,expected,candidate)=>{calls.verify++;
      if(mode==='artifact-fail'||mode==='fast-artifact-fail'&&calls.verify===1)throw new PublishError('CHECKED_ARTIFACT_MISMATCH');
      if(expected)assert.deepEqual(catalog(join(candidate,'dist')),expected);else assert.equal(candidate,root);
      return{artifactId:42,artifactDigest:'sha256:'+'a'.repeat(64),...(!expected?{fileHashes:{'index.html':'a'.repeat(64),'release-manifest.json':'b'.repeat(64)}}:{})};},
  };
  const verifyCandidate=async(candidate:string)=>{fullChecks++;started();if(mode==='gate-hold')await held;if(mode==='checks-fail')throw new PublishError('CONTROLLED_CHECK_FAILED');fs.mkdirSync(join(candidate,'dist'));fs.writeFileSync(join(candidate,'dist/index.html'),'NON_SENSITIVE_CHECKED_ARTIFACT');await command(process.execPath,['scripts/release/record.mjs'],candidate,{build:true,env:{GITHUB_SHA:''}});};
  const options={repositoryRoot:root,think,build,intake,receiptDirectory:join(root,'receipts'),gateway,verifyCandidate,guardAssets:async()=>{},timeoutMs:10000};let publisher=createPublisher(options),httpSession:StudioHttpSession|undefined;
  t.after(async()=>{heldRelease();if(httpSession)await httpSession.abandon();for(let n=0;publisher.busy()&&n<1000;n++)await new Promise(r=>setTimeout(r,10));await publisher.close();intake.close();build.close();think.close();assert.ok(resolve(directory).startsWith(cache+'\\')||resolve(directory).startsWith(cache+'/'));fs.rmSync(directory,{recursive:true,force:true});});
  return{root,bare,buildFile,think,build,intake,publisher,calls,gateway,fullChecks:()=>fullChecks,gateStarted,release:()=>heldRelease(),restart:async()=>{await publisher.close();publisher=createPublisher(options);return publisher;},startHttp:async(serveWeb=true)=>{await publisher.close();intake.close();build.close();think.close();httpSession=await startStudioHttp({repositoryRoot:root,port:0,...(serveWeb?{webDirectory:resolve('.cache/studio/web')}:{}),intakeDirectory:join(root,'inbox'),ai:{environment:{}},publication:{receiptDirectory:options.receiptDirectory,gateway,verifyCandidate,guardAssets:async()=>{},timeoutMs:10000}});return httpSession;}};
}
