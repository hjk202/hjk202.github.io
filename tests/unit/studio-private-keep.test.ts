import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newPrivateBookmark, privateBookmarks } from '../../studio/private/keep.ts';
import { validatePrivatePayload } from '../../studio/private/payload.ts';
test('M14.1 private Keep uses opaque identities and rejects public fields, bad categories and URLs without mutating other modules',()=>{
  const bookmark=newPrivateBookmark();Object.assign(bookmark,{title:'非敏感',description:'测试',sourceUrl:'https://example.com/',note:['说明']});assert.match(bookmark.id,/^[a-f0-9]{32}$/);
  const source={version:1 as const,modules:{keep:{bookmarks:[bookmark]},me:{paragraphs:['保持原样']}},assets:{}};assert.deepEqual(validatePrivatePayload(source,{revision:'1'.repeat(64),slugs:[]}),source);assert.equal(privateBookmarks(source)[0]!.id,bookmark.id);
  for(const extra of [{published:false},{slug:'public'},{sourceUrl:'javascript:alert(1)'},{category:{id:'bad-slug',label:'分类'}}])assert.throws(()=>validatePrivatePayload({...source,modules:{...source.modules,keep:{bookmarks:[{...bookmark,...extra}]}}},{revision:'1'.repeat(64),slugs:[]}));
  const conflicting={...bookmark,id:'b'.repeat(32),category:{id:'c'.repeat(32),label:'第二名称'}};assert.throws(()=>validatePrivatePayload({...source,modules:{keep:{bookmarks:[{...bookmark,category:{id:'c'.repeat(32),label:'第一名称'}},conflicting]}}},{revision:'1'.repeat(64),slugs:[]}));
});
