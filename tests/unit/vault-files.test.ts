import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pack, verify, rekey, backup, restore } from '../../scripts/vault/operations.mjs';
import { outsideSource, allowedTarget, externalTarget } from '../../scripts/vault/files.mjs';
import { validateThink } from '../../src/modules/think/vault.schema.ts';
import process from 'node:process';
test('local pack/update/delete/rekey/backup/restore are verified and failed updates preserve last bundle',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'personal-space-vault-test-'));
  const source=join(directory,'source.json'), output=join(directory,'bundle.json'), copy=join(directory,'backup.json');
  const password='test-only-private-not-real', next='changed-test-only-not-real';
  const payload={version:1,modules:{think:{posts:[{id:'4'.repeat(32),title:'非敏感工具样本',summary:'验证维护',date:'2026-10-14',kind:'note',body:'CANARY_P4_FILES'}]}},assets:{}};
  writeFileSync(source,JSON.stringify(payload));await pack(source,output,password);
  assert.deepEqual(await verify(output,password),payload);
  const previous=readFileSync(output,'utf8');writeFileSync(source,'invalid json');
  await assert.rejects(pack(source,output,password));assert.equal(readFileSync(output,'utf8'),previous);
  backup(output,copy);assert.equal(readFileSync(copy,'utf8'),previous);
  await rekey(output,output,password,next);await assert.rejects(verify(output,password));await verify(output,next);
  await assert.rejects(restore(copy,output,'wrong-password'));await verify(output,next);
  await restore(copy,output,password);assert.equal(readFileSync(output,'utf8'),previous);
  payload.modules.think.posts[0].body='更新样本';writeFileSync(source,JSON.stringify(payload));await pack(source,output,password);
  assert.equal(validateThink(((await verify(output,password)).modules as Record<string,unknown>).think).posts[0].body,'更新样本');
  payload.modules.think.posts=[];writeFileSync(source,JSON.stringify(payload));await pack(source,output,password);
  assert.deepEqual(validateThink(((await verify(output,password)).modules as Record<string,unknown>).think).posts,[]);
  assert.ok(!readFileSync(output,'utf8').includes('CANARY_P4_FILES'));
});
test('local tools restrict plaintext sources and repository outputs to explicit allowed boundaries',()=>{
  assert.throws(()=>outsideSource('package.json'));
  assert.throws(()=>allowedTarget('src/core/vault/leak.json'));
  assert.throws(()=>allowedTarget('public/vault/plaintext.json'));
  assert.throws(()=>externalTarget('public/vault/bundle.json'));
  assert.match(allowedTarget('public/vault/bundle.json'),/public[/\\]vault[/\\]bundle\.json$/);
  if(process.platform==='win32') {
    assert.throws(()=>outsideSource('package.json:private'),/Alternate data streams/);
    assert.throws(()=>allowedTarget('public/vault/bundle.json:private'),/Alternate data streams/);
    assert.throws(()=>externalTarget('package.json:backup'),/Alternate data streams/);
  }
});
