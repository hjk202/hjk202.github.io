import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { sourceExpression } from '../../studio/server/source-expression.ts';
import { createBuildAuthoring } from '../../studio/server/build/service.ts';
import { startStudioHttp } from '../../studio/server/http.ts';
import type { EditorResult } from '../../studio/contracts/result.ts';

const project = (slug: string, published = false) => ({ slug, title: '非敏感项目', summary: '测试摘要', sections: [{ title: '章节', paragraphs: ['第一段\n第二行'], items: ['列表内容'], code: 'line1\nline2' }], keywords: ['代码'], links: [{ label: '测试', url: 'https://example.com/' }], status: 'in-progress' as const, milestones: [{ title: '阶段', status: 'planned' as const }], updates: [{ date: '2026-10-23', title: '更新', accomplishments: ['完成项'] }], issues: [{ title: '问题', description: '问题说明', status: 'open' as const }], published });
const value = <T>(result: EditorResult<T>): T => { assert.ok(result.ok, result.ok ? '' : result.error.code); return result.value; };
function fixture(t: TestContext) {
  const cache = resolve('.cache/studio-batch/m11'); fs.mkdirSync(cache, { recursive: true }); const root = fs.mkdtempSync(join(cache, 'unit-'));
  fs.mkdirSync(join(root, 'src/modules/build'), { recursive: true }); fs.mkdirSync(join(root, 'src/modules/think/content'), { recursive: true });
  const file = join(root, 'src/modules/build/data.ts');
  const source = `// OUTER_COMMENT\r\nimport { publicProjects } from './projects.ts';\r\nexport const projects = publicProjects(${JSON.stringify([project('public', true), project('draft')])});\r\n// OUTER_TRAILER\r\n`;
  fs.writeFileSync(file, source);
  const cleanup: (() => unknown | Promise<unknown>)[] = [];
  t.after(async () => { for (const close of cleanup) await close(); assert.ok(relative(cache, root).startsWith('unit-')); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, file, source, cleanup };
}

test('M11 AST never executes expressions; comments block lossy edits, unchanged source keeps exact bytes', () => {
  const prefix = "import { publicProjects } from './projects.ts';\nexport const projects = publicProjects(";
  const original = prefix + '[/*keep*/' + JSON.stringify(project('one')) + ']);\n//end';
  const parsed = sourceExpression(original, 'projects', 'publicProjects', './projects.ts');
  assert.equal(parsed.serialize(parsed.value), original);
  assert.throws(() => parsed.serialize([]), { code: 'UNSUPPORTED_FORMAT' });
  for (const expression of ['evil()', '[...other]', '[{...other}]', '[{slug: getSlug()}]', '[{slug:"one",slug:"two"}]', '[{__proto__:{}}]', '[{get slug(){return "one"}}]', '[`prefix${evil()}`]']) {
    assert.throws(() => sourceExpression(prefix + expression + ');', 'projects', 'publicProjects', './projects.ts'), { code: 'UNSUPPORTED_FORMAT' });
  }
  assert.throws(() => sourceExpression(prefix + '[]); export const projects=publicProjects([]);', 'projects', 'publicProjects', './projects.ts'));
});

test('M11 complete collection preserves drafts/order/optional fields and enforces whole-file revisions', t => {
  const f = fixture(t), service = createBuildAuthoring(f.root); f.cleanup.push(() => service.close());
  const original = value(service.listBuild()); assert.equal(original.entries.length, 2);
  value(service.saveBuild({ key: 'draft', project: original.entries[1], expectedRevision: original.revision }));
  assert.equal(fs.readFileSync(f.file, 'utf8'), f.source);
  const changed = { ...original.entries[0]!, title: '修改的标题' };
  value(service.saveBuild({ key: 'public', project: changed, expectedRevision: original.revision }));
  const current = value(service.listBuild()); assert.deepEqual(current.entries[1], original.entries[1]); assert.equal(current.entries[0]!.title, changed.title);
  const stale = service.saveBuild({ key: 'draft', project: original.entries[1], expectedRevision: original.revision });
  assert.ok(!stale.ok); assert.equal(stale.error.code, 'REVISION_CONFLICT');
  const raw = fs.readFileSync(f.file, 'utf8'); assert.ok(raw.startsWith('// OUTER_COMMENT\r\n')); assert.ok(raw.endsWith('// OUTER_TRAILER\r\n'));
  const duplicate = service.createBuild({ project: project('draft'), expectedRevision: current.revision }); assert.ok(!duplicate.ok); assert.equal(duplicate.error.code, 'DUPLICATE_SLUG');
  value(service.deleteBuild({ key: 'public', expectedRevision: current.revision }));
  const remaining = value(service.listBuild()); value(service.deleteBuild({ key: 'draft', expectedRevision: remaining.revision })); assert.deepEqual(value(service.listBuild()).entries, []);
});

test('M11 refuses bad nested fields/dates/URLs, renamed keys and source replacement failures without touching source', t => {
  const f = fixture(t), service = createBuildAuthoring(f.root); f.cleanup.push(() => service.close());
  const state = value(service.listBuild());
  for (const item of [{ ...project('new'), links: [{ label: 'bad', url: 'javascript:bad()' }] }, { ...project('new'), updates: [{ title: 'bad', date: '2026-02-30', accomplishments: ['x'] }] }, { ...project('new'), unknown: true }, { ...project('new'), published: 'true' }, { ...project('new'), sections: [{}] }]) assert.equal(service.createBuild({ project: item, expectedRevision: state.revision }).ok, false);
  assert.equal(service.saveBuild({ key: 'public', project: project('renamed'), expectedRevision: state.revision }).ok, false);
  assert.equal(service.readBuild('../data.ts').ok, false);
  assert.equal(fs.readFileSync(f.file, 'utf8'), f.source);
  const rename = fs.renameSync;
  try { fs.renameSync = () => { throw new Error('NON_SENSITIVE_WRITE_FAILURE'); }; assert.equal(service.saveBuild({ key: 'public', project: { ...state.entries[0]!, title: '修改' }, expectedRevision: state.revision }).ok, false); }
  finally { fs.renameSync = rename; }
  assert.equal(fs.readFileSync(f.file, 'utf8'), f.source);
  assert.deepEqual(fs.readdirSync(join(f.root, 'src/modules/build')), ['data.ts']);
});

test('M11 fixed source adapter rejects redirected content directories', t => {
  const f = fixture(t), directory = join(f.root, 'src/modules/build'), outside = join(f.root, 'outside');
  fs.renameSync(directory, outside); fs.symlinkSync(outside, directory, process.platform === 'win32' ? 'junction' : 'dir');
  f.cleanup.push(() => fs.unlinkSync(directory));
  const service = createBuildAuthoring(f.root); f.cleanup.push(() => service.close());
  const result = service.listBuild(); assert.ok(!result.ok); assert.equal(result.error.code, 'PROTECTED_PATH'); assert.equal(fs.readFileSync(join(outside, 'data.ts'), 'utf8'), f.source);
});

test('M11 HTTP uses existing auth, rejects arbitrary paths/input, and keeps CRUD independent of UI', async t => {
  const f = fixture(t), session = await startStudioHttp({ repositoryRoot: f.root, port: 0 });
  f.cleanup.push(() => session.close()); const url = session.origin + '/api/authoring/v1/build/';
  assert.equal((await fetch(url + 'documents')).status, 401);
  const headers = { 'X-Studio-Token': session.token, 'Content-Type': 'application/json' };
  const listed = await (await fetch(url + 'documents', { headers })).json(); assert.equal(listed.ok, true);
  const bad = await fetch(url + 'documents', { method: 'POST', headers, body: JSON.stringify({ project: project('new'), expectedRevision: listed.value.revision, path: 'elsewhere' }) }); assert.equal(bad.status, 400);
  const cross = await fetch(url + 'documents', { headers: { ...headers, Origin: 'https://example.com' } }); assert.equal(cross.status, 403);
  const created = await fetch(url + 'documents', { method: 'POST', headers, body: JSON.stringify({ project: project('new'), expectedRevision: listed.value.revision }) }); assert.equal(created.status, 201);
  const read = await (await fetch(url + 'documents/new', { headers })).json(); assert.equal(read.value.project.slug, 'new');
  const validated = await fetch(url + 'validate', { method: 'POST', headers, body: JSON.stringify({ project: read.value.project, key: 'new' }) }); assert.equal(validated.status, 200);
  const removed = await fetch(url + 'documents/new', { method: 'DELETE', headers, body: JSON.stringify({ expectedRevision: read.value.revision }) }); assert.equal(removed.status, 200);
});

test('M11 a formal Vault blocks deleting or unpublishing a public parent without decrypting it', t => {
  const f = fixture(t), service = createBuildAuthoring(f.root); f.cleanup.push(() => service.close());
  const state = value(service.listBuild());
  fs.mkdirSync(join(f.root, 'public/vault'), { recursive: true });
  const bundle = join(f.root, 'public/vault/bundle.json'); fs.writeFileSync(bundle, 'NON_SENSITIVE_PRESENCE_FIXTURE');
  for (const result of [service.deleteBuild({ key: 'public', expectedRevision: state.revision }), service.saveBuild({ key: 'public', project: project('public', false), expectedRevision: state.revision }), service.validateBuild({ key: 'public', project: project('public', false) })]) {
    assert.ok(!result.ok); assert.equal(result.error.code, 'PRIVATE_REFERENCES_UNKNOWN');
  }
  assert.equal(fs.readFileSync(f.file, 'utf8'), f.source); assert.equal(fs.readFileSync(bundle, 'utf8'), 'NON_SENSITIVE_PRESENCE_FIXTURE');
  value(service.saveBuild({ key: 'public', project: { ...project('public', true), title: '只改标题，保留公开父级' }, expectedRevision: state.revision }));
  const next = value(service.listBuild()); value(service.deleteBuild({ key: 'draft', expectedRevision: next.revision }));
});

test('M11 nested optional/empty arrays/code and record order survive unrelated field edits', t => {
  const f = fixture(t), service = createBuildAuthoring(f.root); f.cleanup.push(() => service.close());
  const state = value(service.listBuild()), original = state.entries[0]!;
  const candidate = { ...original, sections: [{ paragraphs: ['段落'], code: '  one\n\n  two\n', items: [] }], keywords: [], links: [], updates: [{ date: '2026-10-22', title: '较旧', challenges: ['问题'] }, { date: '2026-10-23', title: '较新', nextSteps: ['下一步'] }] };
  value(service.saveBuild({ key: 'public', project: candidate, expectedRevision: state.revision }));
  const read = value(service.readBuild('public')); assert.deepEqual(read.project, candidate);
  value(service.saveBuild({ key: 'public', project: { ...read.project, summary: '只改摘要' }, expectedRevision: read.revision }));
  const after = value(service.readBuild('public')).project;
  assert.deepEqual(after.sections, candidate.sections); assert.deepEqual(after.updates, candidate.updates); assert.deepEqual(after.issues, original.issues); assert.deepEqual(value(service.listBuild()).entries[1], state.entries[1]);
  assert.equal(service.createBuild({ project: { ...project('private-id'), id: 'private-model-not-accepted' }, expectedRevision: value(service.listBuild()).revision }).ok, false);
  const before = fs.readFileSync(f.file, 'utf8');
  const sparse = service.createBuild({ project: { ...project('sparse-keywords'), keywords: Array(1) }, expectedRevision: value(service.listBuild()).revision });
  assert.ok(!sparse.ok); assert.equal(sparse.error.code, 'VALIDATION_FAILED'); assert.equal(fs.readFileSync(f.file, 'utf8'), before);
});
