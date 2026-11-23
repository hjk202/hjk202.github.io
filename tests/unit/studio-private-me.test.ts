import assert from 'node:assert/strict';
import { test } from 'node:test';
import { privateProfile } from '../../studio/private/me.ts';
import { validatePrivatePayload } from '../../studio/private/payload.ts';
test('M14.2 private Me accepts only paragraphs/optional links and preserves omitted links and absent profile',()=>{
  const snapshot={revision:'a'.repeat(64),slugs:[]},empty={version:1 as const,modules:{},assets:{}};assert.equal(privateProfile(empty),undefined);assert.deepEqual(validatePrivatePayload(empty,snapshot),empty);
  const source={...empty,modules:{me:{paragraphs:[]}}};assert.deepEqual(validatePrivatePayload(source,snapshot),source);assert.equal(Object.hasOwn(privateProfile(source)!,'links'),false);
  for(const me of [null,{paragraphs:[],name:'不应混用'},{paragraphs:[],description:'公开字段'},{paragraphs:[],published:false},{paragraphs:[],links:[{label:'非法',url:'file:///outside'}]}])assert.throws(()=>validatePrivatePayload({...empty,modules:{me}},snapshot));
});
