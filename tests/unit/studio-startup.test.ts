import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { StartupTrace, STARTUP_PHASES } from '../../studio/windows/startup.ts';

test('M16.1 diagnostics classify caches and activation without retaining arbitrary data; linked report fails closed', t => {
  const cache=resolve('.cache/studio-m16-1');fs.mkdirSync(cache,{recursive:true});const root=fs.mkdtempSync(join(cache,'trace-'));
  t.after(()=>{assert.ok(relative(cache,root).startsWith('trace-'));fs.rmSync(root,{recursive:true});});
  for(const [reasons,scenario]of [[['hit','hit'],'cold'],[['missing','hit'],'initial-preparation'],[['changed','hit'],'updated-or-recovery'],[['invalid','hit'],'updated-or-recovery']] as const){
    const trace=new StartupTrace(root);trace.mark('native-check');trace.mark('native-check',reasons[0]);trace.mark('web-check',reasons[1]);trace.mark('api-ready');
    assert.equal(trace.snapshot().scenario,scenario);assert.ok(trace.snapshot().stages.every((event,i,all)=>event.atMs>=0&&(!i||event.atMs>=all[i-1]!.atMs)));
    assert.equal(trace.snapshot().stages.length,3);
  }
  const trace=new StartupTrace(root,'opener');trace.mark('activated');assert.equal(trace.snapshot().scenario,'activation');
  trace.mark('SECRET_BODY_PATH_TOKEN' as typeof STARTUP_PHASES[number]);trace.mark('failed','SECRET' as 'hit');
  const file=join(root,'.cache/studio/startup-latest.json'),saved=fs.readFileSync(file,'utf8');assert.ok(!saved.includes('SECRET'));assert.ok(Buffer.byteLength(saved)<2048);
  const duplicate=join(root,'report-hardlink');fs.linkSync(file,duplicate);trace.mark('failed');assert.equal(fs.readFileSync(file,'utf8'),saved);fs.unlinkSync(duplicate);
});
