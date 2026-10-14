import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDecipheriv, pbkdf2Sync } from 'node:crypto';
import { associatedData, decryptVault, encryptVault, parseEnvelope, readEnvelope, validatePayload } from '../../src/core/vault/crypto.ts';
const password='phase4-test-only-nonsensitive';
const payload={version:1,modules:{think:{posts:[{id:'1'.repeat(32),title:'非敏感加密验收',summary:'CANARY_P4_TEST_ONLY',date:'2026-10-14',kind:'note',body:'只用于测试。'}]}},assets:{}};
test('Web Crypto PBKDF2 agrees with RFC 7914 section 11',async()=>{
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode('passwd'),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode('salt'),iterations:1},material,512);
  assert.equal(Buffer.from(bits).toString('hex'),'55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc49ca9cccf179b645991664b39d77ef317c71b845b1e30bd509112041d3a19783');
});
test('envelope decrypts through independent Node cipher API and randomized output',async()=>{
  const first=await encryptVault(payload,password), second=await encryptVault(payload,password);
  assert.notEqual(first.salt,second.salt); assert.notEqual(first.iv,second.iv); assert.notEqual(first.ciphertext,second.ciphertext);
  const key=pbkdf2Sync(password,Buffer.from(first.salt,'base64'),first.iterations,32,'sha256');
  const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(first.iv,'base64'));
  const ciphertext=Buffer.from(first.ciphertext,'base64');
  decipher.setAAD(associatedData(first)); decipher.setAuthTag(ciphertext.subarray(-16));
  assert.deepEqual(JSON.parse(Buffer.concat([decipher.update(ciphertext.subarray(0,-16)),decipher.final()]).toString()),payload);
  assert.deepEqual(await decryptVault(first,password),payload);
  assert.ok(!JSON.stringify(first).includes('CANARY_P4_TEST_ONLY'));
});
test('wrong password, tampered ciphertext and authenticated header fail closed',async()=>{
  const envelope=await encryptVault(payload,password);
  await assert.rejects(decryptVault(envelope,'incorrect-passphrase'));
  const bytes=Buffer.from(envelope.ciphertext,'base64');bytes[0]^=1;
  await assert.rejects(decryptVault({...envelope,ciphertext:bytes.toString('base64')},password));
  await assert.rejects(decryptVault({...envelope,iterations:600001},password));
  await assert.rejects(decryptVault({...envelope,ciphertext:envelope.ciphertext.slice(0,-4)},password));
});
test('protocol rejects unsupported/expensive/extra fields, assets and unsafe limits before derivation',async()=>{
  const envelope=await encryptVault(payload,password);
  for(const change of [{version:2},{iterations:1},{iterations:1000001},{salt:'AA=='},{iv:'AA=='},{extra:'unexpected'},{ciphertext:'not base64'}]) assert.throws(()=>parseEnvelope({...envelope,...change}));
  assert.throws(()=>readEnvelope(' '.repeat(12*1024*1024+1)));
  assert.throws(()=>validatePayload({...payload,assets:{['a'.repeat(32)]:{type:'image/svg+xml',data:'PHN2Zz4='}}}));
  await assert.rejects(encryptVault(payload,'short'));
});
