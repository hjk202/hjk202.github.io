import assert from 'node:assert/strict';
import { test } from 'node:test';
import { privateBuild,newPrivateProject,newPrivateSupplement } from '../../studio/private/build.ts';
import { validatePrivatePayload } from '../../studio/private/payload.ts';
const snapshot={revision:'1'.repeat(64),slugs:['parent']};
test('M14.3 Build raw optional fields are preserved and distinct supplements may share a current public parent',()=>{
  const project=newPrivateProject();Object.assign(project,{title:'非敏感项目',summary:'说明',sections:[{code:'非敏感代码\nline two'}]});const supplement=newPrivateSupplement();Object.assign(supplement,{publicSlug:'parent',title:'非敏感补充',sections:[{paragraphs:['非敏感内容']}]});
  const original={version:1 as const,modules:{build:{projects:[project],supplements:[supplement,{...supplement,id:'f'.repeat(32)}]},me:{paragraphs:['保持']}},assets:{}};assert.deepEqual(validatePrivatePayload(original,snapshot),original);assert.equal(privateBuild(original).projects[0]!.id,project.id);assert.equal(Object.hasOwn(privateBuild(original).projects[0]!,'updates'),false);
});
test('M14.3 Build rejects public DTO fields, duplicate ids, missing parents/assets and invalid nested dates/states',()=>{
  const project={id:'a'.repeat(32),title:'非敏感项目',summary:'说明',sections:[{paragraphs:['内容']}]},supplement={id:'b'.repeat(32),publicSlug:'parent',title:'补充',sections:[{paragraphs:['内容']}]};
  const check=(build:unknown)=>validatePrivatePayload({version:1,modules:{build},assets:{}},snapshot);
  for(const invalid of [{...project,published:false},{...project,slug:'public'},{...project,status:'bad'},{...project,updates:[{title:'坏日期',date:'2026-02-30',accomplishments:['内容']}]},{...project,milestones:[{title:'坏状态',status:'done-ish'}]},{...project,sections:[{paragraphs:['asset:'+'d'.repeat(32)]}]}])assert.throws(()=>check({projects:[invalid],supplements:[]}));
  assert.throws(()=>check({projects:[project],supplements:[{...supplement,id:project.id}]}));assert.throws(()=>check({projects:[project],supplements:[{...supplement,publicSlug:'missing'}]}),/PRIVATE_PUBLIC_REFERENCE/);
});
