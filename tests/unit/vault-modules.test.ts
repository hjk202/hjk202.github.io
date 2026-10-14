import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateThink } from '../../src/modules/think/vault.schema.ts';
import { validateKeep,keepVaultCount } from '../../src/modules/keep/vault.schema.ts';
import { validateBuild,buildVaultCount } from '../../src/modules/build/vault.schema.ts';
import validateBuildServer from '../../src/modules/build/vault.server.ts';
import { validateMe,meVaultCount } from '../../src/modules/me/vault.schema.ts';
import { allVaultFixture } from '../fixtures/vault.ts';
test('independent Vault schemas support empty payloads without fake content',()=>{
  assert.deepEqual(validateThink({posts:[]}),{posts:[]});assert.deepEqual(validateKeep({bookmarks:[]}),{bookmarks:[]});
  assert.deepEqual(validateBuild({projects:[],supplements:[]}),{projects:[],supplements:[]});assert.deepEqual(validateMe({paragraphs:[]}),{paragraphs:[],links:[]});
});
test('private content accumulation counts projects and bookmarks, never supplement logs or duplicate profiles',()=>{
  const build=validateBuild(allVaultFixture.modules.build);assert.equal(buildVaultCount(1,build),2);
  build.projects=[];assert.equal(buildVaultCount(1,build),1);
  assert.equal(keepVaultCount(1,validateKeep(allVaultFixture.modules.keep)),2);
  validateMe(allVaultFixture.modules.me);assert.equal(meVaultCount(1),1);assert.equal(meVaultCount(0),0);
});
test('module payloads reject extra fields, duplicates, invalid dates, links, stages and missing public parent',()=>{
  const post={id:'1'.repeat(32),title:'测试',summary:'样本',date:'2026-10-14',kind:'note',body:'测试'};
  assert.throws(()=>validateThink({posts:[post,post]}));assert.throws(()=>validateThink({posts:[{...post,date:'2026-02-30'}]}));assert.throws(()=>validateThink({posts:[{...post,script:'evil'}]}));
  assert.throws(()=>validateKeep({bookmarks:[{id:'2'.repeat(32),title:'测试',description:'样本',sourceUrl:'javascript:alert(1)',note:['样本']}]}));
  assert.throws(()=>validateMe({paragraphs:['样本'],links:[{label:'测试',url:'https://user:password@example.com'}]}));
  assert.throws(()=>validateBuild({projects:[],supplements:[{id:'3'.repeat(32),publicSlug:'nemu',title:'测试',milestones:[{title:'样本',status:'wrong'}]}]}));
  assert.throws(()=>validateBuildServer({projects:[],supplements:[{id:'3'.repeat(32),publicSlug:'missing',title:'测试',sections:[{paragraphs:['样本']}]}]}));
});
