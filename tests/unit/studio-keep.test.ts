import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { sourceExpression } from '../../studio/server/source-expression.ts';
import { createKeepAuthoring } from '../../studio/server/keep/service.ts';
import { startStudioHttp } from '../../studio/server/http.ts';
import type { EditorResult } from '../../studio/contracts/result.ts';

const bookmark = (slug: string, published = false) => ({ slug, title: '非敏感标题', description: '测试说明', sourceUrl: 'https://example.com/', note: ['第一段\n第二行', '第二段'], published, category: { id: 'tools', label: '工具' }, kind: '测试' });
const value = <T>(result: EditorResult<T>): T => { assert.ok(result.ok, result.ok ? '' : result.error.code); return result.value; };
function fixture(t: TestContext) {
  const cache = resolve('.cache/studio-batch/m9'); fs.mkdirSync(cache, { recursive: true }); const root = fs.mkdtempSync(join(cache, 'unit-'));
  fs.mkdirSync(join(root, 'src/modules/keep'), { recursive: true }); fs.mkdirSync(join(root, 'src/modules/think/content'), { recursive: true });
  const file = join(root, 'src/modules/keep/data.ts');
  const source = `// OUTER_COMMENT\r\nimport { publicBookmarks } from './bookmarks.ts';\r\nexport const bookmarks = publicBookmarks(${JSON.stringify([bookmark('public', true), bookmark('draft')])});\r\n// OUTER_TRAILER\r\n`;
  fs.writeFileSync(file, source);
  const cleanup: (() => unknown | Promise<unknown>)[] = [];
  t.after(async () => { for (const close of cleanup) await close(); assert.ok(relative(cache, root).startsWith('unit-')); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, file, source, cleanup };
}

test('M9 AST never executes expressions; comments block lossy edits, unchanged source keeps exact bytes', () => {
  const prefix = "import { publicBookmarks } from './bookmarks.ts';\nexport const bookmarks = publicBookmarks(";
  const original = prefix + '[/*keep*/' + JSON.stringify(bookmark('one')) + ']);\n//end';
  const parsed = sourceExpression(original, 'bookmarks', 'publicBookmarks', './bookmarks.ts');
  assert.equal(parsed.serialize(parsed.value), original);
  assert.throws(() => parsed.serialize([]), { code: 'UNSUPPORTED_FORMAT' });
  for (const expression of ['evil()', '[...other]', '[{...other}]', '[{slug: getSlug()}]', '[{slug:"one",slug:"two"}]', '[{__proto__:{}}]', '[{get slug(){return "one"}}]', '[`prefix${evil()}`]']) {
    assert.throws(() => sourceExpression(prefix + expression + ');', 'bookmarks', 'publicBookmarks', './bookmarks.ts'), { code: 'UNSUPPORTED_FORMAT' });
  }
  assert.throws(() => sourceExpression(prefix + '[]); export const bookmarks=publicBookmarks([]);', 'bookmarks', 'publicBookmarks', './bookmarks.ts'));
});

test('M9 complete collection preserves drafts/order/optional fields and enforces whole-file revisions', t => {
  const f = fixture(t), service = createKeepAuthoring(f.root); f.cleanup.push(() => service.close());
  const original = value(service.listKeep()); assert.equal(original.entries.length, 2);
  value(service.saveKeep({ key: 'draft', bookmark: original.entries[1], expectedRevision: original.revision }));
  assert.equal(fs.readFileSync(f.file, 'utf8'), f.source);
  const changed = { ...original.entries[0]!, title: '修改的标题' };
  value(service.saveKeep({ key: 'public', bookmark: changed, expectedRevision: original.revision }));
  const current = value(service.listKeep()); assert.deepEqual(current.entries[1], original.entries[1]); assert.equal(current.entries[0]!.title, changed.title);
  const stale = service.saveKeep({ key: 'draft', bookmark: original.entries[1], expectedRevision: original.revision });
  assert.ok(!stale.ok); assert.equal(stale.error.code, 'REVISION_CONFLICT');
  const raw = fs.readFileSync(f.file, 'utf8'); assert.ok(raw.startsWith('// OUTER_COMMENT\r\n')); assert.ok(raw.endsWith('// OUTER_TRAILER\r\n'));
  const duplicate = service.createKeep({ bookmark: bookmark('draft'), expectedRevision: current.revision }); assert.ok(!duplicate.ok); assert.equal(duplicate.error.code, 'DUPLICATE_SLUG');
  value(service.deleteKeep({ key: 'public', expectedRevision: current.revision }));
  const remaining = value(service.listKeep()); value(service.deleteKeep({ key: 'draft', expectedRevision: remaining.revision })); assert.deepEqual(value(service.listKeep()).entries, []);
});

test('M9 refuses bad fields/categories/URLs, renamed keys and source replacement failures without touching source', t => {
  const f = fixture(t), service = createKeepAuthoring(f.root); f.cleanup.push(() => service.close());
  const state = value(service.listKeep());
  for (const item of [{ ...bookmark('new'), sourceUrl: 'javascript:alert(1)' }, { ...bookmark('new'), category: { id: 'tools', label: '冲突分类' } }, { ...bookmark('new'), unknown: true }, { ...bookmark('new'), published: 'true' }]) assert.equal(service.createKeep({ bookmark: item, expectedRevision: state.revision }).ok, false);
  assert.equal(service.saveKeep({ key: 'public', bookmark: bookmark('renamed'), expectedRevision: state.revision }).ok, false);
  assert.equal(service.readKeep('../data.ts').ok, false);
  assert.equal(fs.readFileSync(f.file, 'utf8'), f.source);
  const rename = fs.renameSync;
  try { fs.renameSync = () => { throw new Error('NON_SENSITIVE_WRITE_FAILURE'); }; assert.equal(service.saveKeep({ key: 'public', bookmark: { ...state.entries[0]!, title: '修改' }, expectedRevision: state.revision }).ok, false); }
  finally { fs.renameSync = rename; }
  assert.equal(fs.readFileSync(f.file, 'utf8'), f.source);
  assert.deepEqual(fs.readdirSync(join(f.root, 'src/modules/keep')), ['data.ts']);
});

test('M9 fixed source adapter rejects redirected content directories', t => {
  const f = fixture(t), directory = join(f.root, 'src/modules/keep'), outside = join(f.root, 'outside');
  fs.renameSync(directory, outside); fs.symlinkSync(outside, directory, process.platform === 'win32' ? 'junction' : 'dir');
  f.cleanup.push(() => fs.unlinkSync(directory));
  const service = createKeepAuthoring(f.root); f.cleanup.push(() => service.close());
  const result = service.listKeep(); assert.ok(!result.ok); assert.equal(result.error.code, 'PROTECTED_PATH'); assert.equal(fs.readFileSync(join(outside, 'data.ts'), 'utf8'), f.source);
});

test('M9 HTTP uses existing auth, rejects arbitrary paths/input, and keeps CRUD independent of UI', async t => {
  const f = fixture(t), session = await startStudioHttp({ repositoryRoot: f.root, port: 0 });
  f.cleanup.push(() => session.close()); const url = session.origin + '/api/authoring/v1/keep/';
  assert.equal((await fetch(url + 'documents')).status, 401);
  const headers = { 'X-Studio-Token': session.token, 'Content-Type': 'application/json' };
  const listed = await (await fetch(url + 'documents', { headers })).json(); assert.equal(listed.ok, true);
  const bad = await fetch(url + 'documents', { method: 'POST', headers, body: JSON.stringify({ bookmark: bookmark('new'), expectedRevision: listed.value.revision, path: 'elsewhere' }) }); assert.equal(bad.status, 400);
  const cross = await fetch(url + 'documents', { headers: { ...headers, Origin: 'https://example.com' } }); assert.equal(cross.status, 403);
  const created = await fetch(url + 'documents', { method: 'POST', headers, body: JSON.stringify({ bookmark: bookmark('new'), expectedRevision: listed.value.revision }) }); assert.equal(created.status, 201);
  const read = await (await fetch(url + 'documents/new', { headers })).json(); assert.equal(read.value.bookmark.slug, 'new');
  const validated = await fetch(url + 'validate', { method: 'POST', headers, body: JSON.stringify({ bookmark: read.value.bookmark, key: 'new' }) }); assert.equal(validated.status, 200);
  const removed = await fetch(url + 'documents/new', { method: 'DELETE', headers, body: JSON.stringify({ expectedRevision: read.value.revision }) }); assert.equal(removed.status, 200);
});
