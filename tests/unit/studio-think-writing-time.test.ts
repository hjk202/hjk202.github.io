import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { openThinkAuthoring } from '../../studio/server/think/service.ts';
import { createWritingTime } from '../../studio/server/think/writing-time.ts';
import type { EditorResult } from '../../studio/contracts/result.ts';

function value<T>(result: EditorResult<T>) {
  assert.ok(result.ok, result.ok ? '' : result.error.code);
  return result.value;
}
test('writing ledger persists deduplicated time and follows a draft, a file rename and a slug-only rename', async t => {
  const cache = resolve('.cache/studio-think-writing'), base = join(cache,'ledger-');
  fs.mkdirSync(cache,{recursive:true});
  const root = fs.mkdtempSync(base), directory = join(root,'ledger'), content = join(root,'src/modules/think/content');
  fs.mkdirSync(content,{recursive:true});
  const author = value(openThinkAuthoring(root));
  t.after(()=>{author.close();assert.ok(root.startsWith(base));fs.rmSync(root,{recursive:true});});
  const article = value(author.createThink({document:{metadata:{slug:'original'},body:'非敏感'}}));
  const entry = createWritingTime(root,author,directory);
  const draftId = randomUUID(), batch = randomUUID();
  assert.equal(value(await entry({draftId,elapsedMs:2400,batch})).ms,2400);
  assert.equal(value(await entry({draftId,elapsedMs:2400,batch})).ms,2400);
  assert.equal(value(await entry({sourceKey:article.key,draftId,elapsedMs:0})).ms,2400);
  const recovered = createWritingTime(root,author,directory);
  fs.renameSync(join(content,'original.md'),join(content,'renamed.md'));
  const key = value(author.listThink())[0]!.key;
  assert.notEqual(key,article.key);
  assert.equal(value(await recovered({sourceKey:key,elapsedMs:0})).ms,2400);
  const file = join(content,'renamed.md');
  fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('original','new-slug'));
  assert.equal(value(await recovered({sourceKey:key,elapsedMs:0})).ms,2400);
  assert.equal(value(await recovered({draftId,elapsedMs:600,batch:randomUUID()})).ms,3000);
  assert.equal(value(await recovered({sourceKey:key,elapsedMs:0})).ms,3000);
  assert.equal(value(author.readThink({key})).document!.body,'非敏感');
  assert.equal((await recovered({draftId,elapsedMs:120001,batch:randomUUID()})).ok,false);
});
