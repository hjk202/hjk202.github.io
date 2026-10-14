import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VaultSession } from '../../src/core/vault/session.ts';
import { encryptVault } from '../../src/core/vault/crypto.ts';
import { targetHref, targetId, vaultTarget } from '../../src/core/vault/targets.ts';
test('cancel/lock cannot be undone by late decryption; failed module validation remains locked',async()=>{
  const password='session-test-only-not-real';
  const envelope=await encryptVault({version:1,modules:{},assets:{}},password);
  const session=new VaultSession();const pending=session.unlock(envelope,password);session.lock();
  assert.equal(await pending,false);assert.equal(session.state,'locked');assert.equal(session.payload,null);
  assert.equal(await session.unlock(envelope,password),true);session.lock();assert.equal(session.payload,null);
  const invalid=new VaultSession(()=>{throw new Error('Invalid adapter');});
  await assert.rejects(invalid.unlock(envelope,password));assert.equal(invalid.state,'locked');
});
test('private target framing preserves strict public URLs and base exactly once',()=>{
  const id='a'.repeat(32),logical=vaultTarget('/think/',id);
  assert.equal(targetHref(logical,'/personal-space/'),`/personal-space/think/#vault=${id}`);
  assert.equal(targetId(`#vault=${id}`),id);assert.equal(targetId('#normal-heading'),undefined);
  for(const value of ['//evil.example/#vault='+id,'/think/#bad','/think/?secret=name#vault='+id]) assert.throws(()=>targetHref(value));
  assert.throws(()=>targetId('#vault=private-title'));assert.throws(()=>vaultTarget('/think/','title'));
});
