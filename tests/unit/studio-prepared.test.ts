import fs from 'node:fs';
import { join,resolve,relative } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { prepareStudio, readOrPrepareStudio, readPreparedStudio } from '../../studio/windows/prepared.ts';
import { startDesktopHost } from '../../studio/windows/desktop.ts';
import { desktopPaths } from '../../studio/windows/desktop-state.ts';
import { createThinkTextSuggestions } from '../../studio/server/ai/suggest.ts';
import { createServer } from 'node:net';
import { fork, spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { StartupTrace } from '../../studio/windows/startup.ts';

async function freePort(){const server=createServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');await new Promise<void>(resolve=>server.close(()=>resolve()));return address.port;}

function fixture(t:TestContext){
  const cache=resolve('.cache/studio-m16-3');fs.mkdirSync(cache,{recursive:true});const root=fs.mkdtempSync(join(cache,'prepared-'));
  fs.cpSync('studio',join(root,'studio'),{recursive:true});fs.cpSync('src/core/vault',join(root,'src/core/vault'),{recursive:true});
  for(const module of ['think','keep','me','build']){
    fs.mkdirSync(join(root,'src/modules',module),{recursive:true});
    for(const name of [module==='think'?'metadata.ts':module==='keep'?'bookmarks.ts':module==='me'?'profile.ts':'projects.ts','vault.schema.ts','vault.client.ts','vault.css'])fs.copyFileSync(join('src/modules',module,name),join(root,'src/modules',module,name));
  }
  for(const file of ['src/modules/think/vault.markdown.ts','src/modules/think/markdown.mjs','src/shell/vault/dom.ts','src/core/module/urls.ts']){fs.mkdirSync(join(root,file,'..'),{recursive:true});fs.copyFileSync(file,join(root,file));}
  fs.mkdirSync(join(root,'src/modules/think/content'),{recursive:true});
  for(const file of ['package.json','package-lock.json'])fs.copyFileSync(file,join(root,file));
  const calls:string[]=[];
  const builders={native:async(_root:string,_note:unknown,buildRoot:string=root)=>{
    calls.push('native');const dir=join(buildRoot,'.cache/studio/desktop/app');fs.mkdirSync(dir,{recursive:true});
    for(const name of ['PersonalSpaceStudio.exe','PersonalSpaceStudio.dll','PersonalSpaceStudio.deps.json','PersonalSpaceStudio.runtimeconfig.json','Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll'])fs.writeFileSync(join(dir,name),'NON_SENSITIVE_NATIVE_FIXTURE_'+name);
    fs.mkdirSync(join(dir,'runtimes/win-x64/native'),{recursive:true});fs.writeFileSync(join(dir,'runtimes/win-x64/native/WebView2Loader.dll'),'NON_SENSITIVE_LOADER');
    return join(dir,'PersonalSpaceStudio.exe');
  },web:async(_root:string,_note:unknown,buildRoot:string=root)=>{
    calls.push('web');const dir=join(buildRoot,'.cache/studio/web');fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(join(dir,'index.html'),'<!doctype html><title>Fixture</title><!--studio-session-->');fs.writeFileSync(join(dir,'main.js'),'');fs.writeFileSync(join(dir,'style.css'),'');return {rebuilt:true};
  }};
  t.after(()=>{assert.ok(relative(cache,root).startsWith('prepared-'));fs.rmSync(root,{recursive:true,force:true});});
  return{root,builders,calls,source:join(root,'src/modules/think/content/proof.md')};
}
test('M16.3 daily reads only complete prepared assets, retains old source version and rejects mixed/tampered artifacts',async t=>{
  const f=fixture(t);assert.throws(()=>readPreparedStudio(f.root),/PREPARATION_REQUIRED/);
  const prepare = (root: string) => prepareStudio(root, f.builders);
  const prepared = await readOrPrepareStudio(f.root, prepare);
  assert.equal((await readOrPrepareStudio(f.root, prepare)).id, prepared.id);
  assert.deepEqual(f.calls, ['native', 'web']);
  const frozen=fs.readFileSync(prepared.backend);fs.writeFileSync(join(f.root,'studio/server/main.ts'),'throw new Error("LIVE_SOURCE_MUST_NOT_RUN");');
  fs.writeFileSync(f.source,'---\nslug: proof\npublished: false\n---\nNon-sensitive content');
  assert.equal(readPreparedStudio(f.root).id,prepared.id);assert.deepEqual(fs.readFileSync(prepared.backend),frozen);assert.deepEqual(f.calls,['native','web']);
  fs.appendFileSync(prepared.backend,'\n// tampered');
  await assert.rejects(readOrPrepareStudio(f.root, prepare), /PREPARED_INVALID/);
  assert.deepEqual(f.calls, ['native', 'web']);
  fs.writeFileSync(prepared.backend,frozen);
  const extra=join(prepared.directory,'runtime/unrecorded.mjs');fs.writeFileSync(extra,'export{}');assert.throws(()=>readPreparedStudio(f.root),/PREPARED_INVALID/);fs.unlinkSync(extra);
  const linked=join(f.root,'linked');fs.linkSync(prepared.backend,linked);assert.throws(()=>readPreparedStudio(f.root),/DESKTOP_STATE_INVALID/);fs.unlinkSync(linked);
  fs.appendFileSync(join(f.root,'package-lock.json'),'\n');assert.throws(()=>readPreparedStudio(f.root),/PREPARED_INVALID/);
});
test('M16.3 failed/changed preparation preserves the old pointer; an active host prevents preparing or replacing it',async t=>{
  const f=fixture(t),old=await prepareStudio(f.root,f.builders),pointer=join(f.root,'.cache/studio/prepared/current.json'),before=fs.readFileSync(pointer);
  await assert.rejects(prepareStudio(f.root,{...f.builders,web:async()=>{throw new Error('NON_SENSITIVE_FAILURE');}}),/PREPARATION_FAILED/);
  assert.deepEqual(fs.readFileSync(pointer),before);assert.equal(readPreparedStudio(f.root).id,old.id);
  await assert.rejects(prepareStudio(f.root,{...f.builders,web:async(...args)=>{const value=await f.builders.web(...args);fs.appendFileSync(join(f.root,'studio/windows/app.ts'),'\n// source changed');return value;}}),/APP_SOURCE_CHANGED/);
  assert.deepEqual(fs.readFileSync(pointer),before);assert.equal(readPreparedStudio(f.root).id,old.id);
  fs.writeFileSync(desktopPaths(f.root).lock,JSON.stringify({pid:process.pid,token:'a'.repeat(64)}));
  await assert.rejects(prepareStudio(f.root,f.builders),/DESKTOP_BUSY/);assert.deepEqual(fs.readFileSync(pointer),before);fs.unlinkSync(desktopPaths(f.root).lock);
});

test('the compiled App host consumes its own startup message without running the legacy desktop CLI', {
  skip: process.platform !== 'win32', timeout: 20_000,
}, async t => {
  const fixtureRoot = fixture(t);
  const prepared = await prepareStudio(fixtureRoot.root, fixtureRoot.builders);
  const paths = desktopPaths(fixtureRoot.root);
  // Exercise the production fork and IPC entry, stopping at the owned lock before any window can open.
  fs.writeFileSync(paths.lock, JSON.stringify({ pid: process.pid, token: 'a'.repeat(64) }));
  const child = fork(prepared.host, ['host'], {
    cwd: fixtureRoot.root, execArgv: [], stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true,
  });
  const messages: unknown[] = [];
  child.on('message', message => messages.push(message));
  const exited = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  child.send({ type: 'studio:app-start', root: fixtureRoot.root, preparedId: prepared.id });
  assert.equal(await exited, 1);
  assert.deepEqual(messages, [{ type: 'studio:app-error', code: 'DESKTOP_BUSY' }]);
  assert.equal(fs.existsSync(paths.state), false);
});

test('M16.3 frozen backend uses the real content root and explicit synthetic store; daily startup needs no compiler/source', {skip:process.platform!=='win32'},async t=>{
  const f=fixture(t),prepared=await prepareStudio(f.root,f.builders);
  fs.writeFileSync(f.source,'---\nslug: proof\npublished: false\n---\nNon-sensitive original');
  fs.writeFileSync(join(f.root,'studio/server/main.ts'),'throw new Error("LIVE_BACKEND_MUST_NOT_RUN");');
  const host=await startDesktopHost({root:f.root,port:await freePort(),store:join(f.root,'absent-test-store.json'),build:false,prepared});
  try{
    const html=await(await fetch(host.origin)).text(),pair=JSON.parse(/<script id="studio-session" type="application\/json">([^<]*)<\/script>/.exec(html)![1]!);
    const headers={'X-Studio-Token':pair.token};
    const list=await(await fetch(host.origin+'/api/authoring/v1/think/documents',{headers})).json();assert.equal(list.ok,true);assert.equal(list.value[0].slug,'proof');
    const status=await(await fetch(host.origin+'/api/authoring/v1/think/suggest',{headers})).json();assert.ok(['AI_INITIALIZING','AI_NOT_CONFIGURED'].includes(status.value.issue));assert.equal(status.value.available,false);
    const saved=await(await fetch(host.origin+'/api/authoring/v1/think/documents',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({document:{metadata:{slug:'prepared-draft',published:false,kind:'note'},body:'NON_SENSITIVE_FROZEN_BACKEND'}})})).json();
    assert.equal(saved.ok,true);assert.ok(fs.readFileSync(join(f.root,'src/modules/think/content/prepared-draft.md'),'utf8').includes('NON_SENSITIVE_FROZEN_BACKEND'));
    assert.deepEqual(f.calls,['native','web']);assert.ok(!fs.existsSync(join(prepared.directory,'src/modules/think/content')));
  }finally{await host.stop();}
  assert.equal(fs.existsSync(desktopPaths(f.root).lease),false);assert.ok(fs.readFileSync(f.source,'utf8').includes('Non-sensitive original'));
});
test('M16.3 compiled host boot precedes API init, keeps one controlled backend and closes without a desktop window', {skip:process.platform!=='win32'},async t=>{
  const f=fixture(t), prepared=await prepareStudio(f.root,f.builders);
  const { startAppHost } = await import(pathToFileURL(prepared.host).href) as typeof import('../../studio/windows/app.ts');
  const mock=join(f.root,'native-canary.mjs'),events=join(f.root,'canary-events.json');
  let nativeExit!:Promise<number|null>;
  fs.writeFileSync(mock,`import readline from 'node:readline';import fs from 'node:fs';const events=[];const send=value=>process.stdout.write(JSON.stringify(value)+'\\n');const record=type=>{events.push(type);fs.writeFileSync(${JSON.stringify(events)},JSON.stringify(events));};readline.createInterface({input:process.stdin}).on('line',async line=>{const value=JSON.parse(line);record(value.type);if(value.type==='studio:boot'){send({type:'studio:window-visible'});send({type:'studio:webview-start'});send({type:'studio:webview-ready'});}if(value.type==='studio:init'){await fetch(value.origin);send({type:'studio:editor-connected'});send({type:'studio:window-ready'});}if(value.type==='studio:prepare-close')send({type:'studio:close-result',requestId:value.requestId,status:'ready'});if(value.type==='studio:close-complete')process.exit(0);});`);
  const host=await startAppHost({root:f.root,port:await freePort(),store:join(f.root,'absent-test-store.json'),windowProcess:(_executable,environment)=>{
    assert.equal(environment.DASHSCOPE_API_KEY,undefined);const child=spawn(process.execPath,[mock],{cwd:f.root,env:{...environment,PATH:join(f.root,'no-compiler')},windowsHide:true,stdio:['pipe','pipe','pipe']});nativeExit=new Promise(resolve=>child.once('exit',resolve));return child;
  }});
  const record=JSON.parse(fs.readFileSync(events,'utf8'));assert.deepEqual(record.slice(0,2),['studio:boot','studio:init']);
  await host.requestClose();assert.equal(fs.existsSync(desktopPaths(f.root).state),false);assert.equal(fs.existsSync(desktopPaths(f.root).lease),false);
  assert.equal(await nativeExit,0); // Windows retains the child's cwd until the process has actually exited.
  const timing=JSON.parse(fs.readFileSync(join(f.root,'.cache/studio/startup-latest.json'),'utf8')) as ReturnType<StartupTrace['snapshot']>;
  assert.equal(timing.scenario,'cold');assert.ok(!timing.stages.some(stage=>['native-build','native-restore','web-build'].includes(stage.phase)));
});
test('M16.3 deferred AI is loading rather than missing; close aborts initialization and late results cannot reopen it',async()=>{
  let complete!:(value:NodeJS.ProcessEnv)=>void;let signal!:AbortSignal;
  const delayed=new Promise<NodeJS.ProcessEnv>(resolve=>{complete=resolve;});
  const ai=createThinkTextSuggestions({loadEnvironment:async value=>{signal=value;return delayed;}});
  assert.equal(ai.status().issue,'AI_INITIALIZING');const unavailable=await ai.suggestThinkText({operation:'polish',input:'Non-sensitive'});assert.ok(!unavailable.ok&&unavailable.error.code==='AI_INITIALIZING');
  const closing=ai.close();assert.equal(signal.aborted,true);complete({DASHSCOPE_API_KEY:'NON_SENSITIVE_CANARY',DASHSCOPE_BASE_URL:'https://fixture.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'});await closing;assert.equal(ai.status().available,false);
  const failed=createThinkTextSuggestions({loadEnvironment:async()=>{throw new Error('NON_SENSITIVE_PRIVATE_DETAIL');}});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(failed.status().issue,'AI_CONFIG_UNAVAILABLE');assert.ok(!JSON.stringify(failed.status()).includes('PRIVATE_DETAIL'));await failed.close();
});
