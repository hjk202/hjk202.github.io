import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { createMeAuthoring } from '../../studio/server/me/service.ts';
import { startStudioHttp } from '../../studio/server/http.ts';
import type { EditorResult } from '../../studio/contracts/result.ts';
const value = <T>(r: EditorResult<T>): T => { assert.ok(r.ok, r.ok ? '' : r.error.code); return r.value; };
const profile = { name: '测试姓名', description: '非敏感介绍', paragraphs: ['第一段\n第二行', '第二段'], links: [{ label: '测试', url: 'https://example.com/' }], published: false };
function fixture(t: TestContext, empty = false) {
  const cache = resolve('.cache/studio-batch/m10'); fs.mkdirSync(cache, { recursive: true }); const root = fs.mkdtempSync(join(cache, 'unit-'));
  fs.mkdirSync(join(root, 'src/modules/me'), { recursive: true }); fs.mkdirSync(join(root, 'src/modules/think/content'), { recursive: true });
  const file = join(root, 'src/modules/me/data.ts'), source = `// OUTSIDE\r\nimport { publicProfile } from './profile.ts';\r\nexport const profile = publicProfile(${JSON.stringify(empty ? null : profile)});\r\n//TAIL\r\n`;
  fs.writeFileSync(file, source);
  const cleanup: (() => unknown | Promise<unknown>)[] = [];
  t.after(async () => { for (const close of cleanup) await close(); assert.ok(relative(cache, root).startsWith('unit-')); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, file, source, cleanup };
}
test('M10 singleton preserves absent fields, exact unchanged bytes, clear null and whole-file revision conflicts', t => {
  const f = fixture(t), service = createMeAuthoring(f.root); f.cleanup.push(() => service.close());
  const original = value(service.readProfile()); assert.deepEqual(original.profile, profile);
  value(service.saveProfile({ profile, expectedRevision: original.revision })); assert.equal(fs.readFileSync(f.file, 'utf8'), f.source);
  const minimal = { name: '修改姓名', description: '介绍', paragraphs: ['完整段落'] };
  const written = value(service.saveProfile({ profile: minimal, expectedRevision: original.revision })); assert.deepEqual(value(service.readProfile()).profile, minimal);
  const stale = service.clearProfile({ expectedRevision: original.revision }); assert.ok(!stale.ok); assert.equal(stale.error.code, 'REVISION_CONFLICT');
  assert.equal(service.saveProfile({ profile: null, expectedRevision: written.revision }).ok, false);
  value(service.clearProfile({ expectedRevision: written.revision })); assert.equal(value(service.readProfile()).profile, null);
  assert.ok(fs.readFileSync(f.file, 'utf8').startsWith('// OUTSIDE\r\n')); assert.ok(fs.readFileSync(f.file, 'utf8').endsWith('//TAIL\r\n'));
});
test('M10 empty singleton never fabricates a profile; bad fields/links and atomic write failures preserve source', t => {
  const f = fixture(t, true), service = createMeAuthoring(f.root); f.cleanup.push(() => service.close());
  const original = value(service.readProfile()); assert.equal(original.profile, null); assert.equal(fs.readFileSync(f.file, 'utf8'), f.source);
  for (const candidate of [{ ...profile, slug: 'not-a-profile' }, { ...profile, links: [{ label: 'x', url: 'javascript:bad()' }] }, { ...profile, paragraphs: 'text' }, { ...profile, published: 'true' }, { ...profile, paragraphs: [] }]) assert.equal(service.saveProfile({ profile: candidate, expectedRevision: original.revision }).ok, false);
  const rename = fs.renameSync;
  try { fs.renameSync = () => { throw new Error('M10_FIXTURE_WRITE_FAILURE'); }; assert.equal(service.saveProfile({ profile, expectedRevision: original.revision }).ok, false); }
  finally { fs.renameSync = rename; }
  assert.equal(fs.readFileSync(f.file, 'utf8'), f.source); assert.deepEqual(fs.readdirSync(join(f.root, 'src/modules/me')), ['data.ts']);
  const prepared = value(service.preparePreview({ profile })); assert.equal(prepared.module, 'me'); assert.equal(fs.readFileSync(f.file, 'utf8'), f.source);
});
test('M10 HTTP singleton is authenticated, path-free and distinguishes save from confirmed clear', async t => {
  const f = fixture(t), session = await startStudioHttp({ repositoryRoot: f.root, port: 0 }); f.cleanup.push(() => session.close());
  const url = session.origin + '/api/authoring/v1/me/', headers = { 'X-Studio-Token': session.token, 'Content-Type': 'application/json' };
  assert.equal((await fetch(url + 'profile')).status, 401);
  const state = await (await fetch(url + 'profile', { headers })).json();
  assert.equal((await fetch(url + 'profile', { method: 'POST', headers, body: '{}' })).status, 405);
  assert.equal((await fetch(url + 'clear', { method: 'POST', headers, body: JSON.stringify({ expectedRevision: state.value.revision, path: 'outside' }) })).status, 400);
  assert.equal((await fetch(url + 'profile', { method: 'PUT', headers, body: JSON.stringify({ profile: null, expectedRevision: state.value.revision }) })).status, 400);
  assert.equal((await fetch(url + 'clear', { method: 'POST', headers, body: JSON.stringify({ expectedRevision: state.value.revision }) })).status, 200);
  assert.equal((await (await fetch(url + 'profile', { headers })).json()).value.profile, null);
});
