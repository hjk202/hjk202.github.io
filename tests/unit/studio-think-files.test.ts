import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import type { EditorErrorCode, EditorResult, ThinkDocument } from '../../studio/contracts/think.ts';
import { allowedThinkFileName, MAX_THINK_SOURCE_BYTES, revisionOf } from '../../studio/server/think/files.ts';
import { openThinkAuthoring } from '../../studio/server/think/service.ts';
import type { ThinkAuthoring } from '../../studio/server/think/service.ts';

const cache = resolve('.cache/studio-m1');
function unwrap<T>(result: EditorResult<T>): T {
  if (!result.ok) assert.fail(JSON.stringify(result.error));
  return result.value;
}
function fails(result: EditorResult<unknown>, code: EditorErrorCode): void {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, code, JSON.stringify(result.error));
}
function setup(t: TestContext) {
  fs.mkdirSync(cache, { recursive: true });
  const root = fs.mkdtempSync(join(cache, 'unit-'));
  const content = join(root, 'src/modules/think/content');
  fs.mkdirSync(content, { recursive: true });
  const sessions: ThinkAuthoring[] = [];
  const open = () => { const service = unwrap(openThinkAuthoring(root)); sessions.push(service); return service; };
  t.after(() => {
    for (const service of sessions) service.close();
    assert.ok(relative(cache, root).startsWith('unit-') && !relative(cache, root).includes('..'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { root, content, open };
}
const draft = (slug: string): ThinkDocument => ({ metadata: { slug }, body: '' });
const published = (slug: string): ThinkDocument => ({ metadata: { slug, title: `文章 ${slug}`, summary: '非敏感文件测试', date: '2026-10-15', published: true }, body: '\n## 正文\n\n只用于隔离验证。\n' });
const temps = (content: string) => fs.readdirSync(content).filter(name => name.endsWith('.tmp'));

test('M1 CRUD uses source bytes, keeps original filename/comments, survives restart and deletes only its target', t => {
  const { content, open } = setup(t);
  fs.writeFileSync(join(content, 'different-name.md'), '---\r\n# 保留注释\r\nslug: stable-url\r\npublished: false\r\n---\r\n\r\n原文  \r\n');
  fs.mkdirSync(join(content, 'assets'));
  fs.writeFileSync(join(content, 'assets/shared.txt'), 'ASSET');
  fs.writeFileSync(join(content, 'assets/not-an-article.md'), 'NESTED_FILE_MUST_NOT_BE_ENUMERATED');
  const other = join(content, 'other.md');
  fs.writeFileSync(other, '---\nslug: other\n---\n');
  const otherBytes = fs.readFileSync(other);
  let service = open();
  assert.equal(unwrap(service.listThink()).length, 2);
  const summary = unwrap(service.listThink()).find(entry => entry.slug === 'stable-url')!;
  const read = unwrap(service.readThink({ key: summary.key }));
  assert.equal(read.fileName, 'different-name.md');
  assert.equal(read.revision, revisionOf(fs.readFileSync(join(content, read.fileName))));
  assert.equal(read.editable, true);
  const document = read.document!;
  const noOp = unwrap(service.saveThink({ key: read.key, expectedRevision: read.revision, document }));
  assert.equal(noOp.revision, read.revision);
  document.body += '新正文。\n';
  const saved = unwrap(service.saveThink({ key: read.key, expectedRevision: read.revision, document }));
  assert.notEqual(saved.revision, read.revision);
  assert.match(fs.readFileSync(join(content, 'different-name.md'), 'utf8'), /# 保留注释\r\n/);
  assert.equal(fs.existsSync(join(content, 'stable-url.md')), false);
  const created = unwrap(service.createThink({ document: draft('new-draft') }));
  const createdRead = unwrap(service.readThink({ key: created.key }));
  assert.equal(createdRead.published, false);
  assert.equal(createdRead.kind, 'article');
  assert.equal(unwrap(service.listThink({ status: 'draft' })).length, 3);
  assert.deepEqual(unwrap(service.listThink({ status: 'published' })), []);
  unwrap(service.close());
  service = open();
  assert.equal(unwrap(service.readThink({ key: read.key })).revision, saved.revision);
  unwrap(service.deleteThink({ key: created.key, expectedRevision: created.revision }));
  fails(service.readThink({ key: created.key }), 'NOT_FOUND');
  assert.deepEqual(fs.readFileSync(other), otherBytes);
  assert.equal(fs.readFileSync(join(content, 'assets/shared.txt'), 'utf8'), 'ASSET');
  assert.deepEqual(temps(content), []);
});

test('M1 empty directory, publication changes, validation and stable key are independent of UI', t => {
  const { open } = setup(t);
  const service = open();
  assert.deepEqual(unwrap(service.listThink()), []);
  const created = unwrap(service.createThink({ document: draft('one') }));
  const report = unwrap(service.validateThink({ key: created.key, document: draft('one') }));
  assert.equal(report.canSave, true);
  assert.equal(report.publishReady, false);
  const saved = unwrap(service.saveThink({ key: created.key, expectedRevision: created.revision, document: published('one') }));
  assert.equal(saved.key, created.key);
  assert.equal(unwrap(service.listThink({ status: 'published' })).length, 1);
  assert.deepEqual(unwrap(service.listThink({ status: 'draft' })), []);
  const unpublish = published('one'); unpublish.metadata.published = false;
  const hidden = unwrap(service.saveThink({ key: saved.key, expectedRevision: saved.revision, document: unpublish }));
  assert.equal(unwrap(service.readThink({ key: hidden.key })).published, false);
  unwrap(service.deleteThink({ key: hidden.key, expectedRevision: hidden.revision }));
  assert.deepEqual(unwrap(service.listThink()), []);
  unwrap(service.close());
  fails(service.listThink(), 'SERVICE_CLOSED');
  unwrap(service.close());
});

test('M1 rejects duplicate draft slugs, occupied filenames, immutable slugs and malformed operation inputs', t => {
  const { content, open } = setup(t);
  const service = open();
  const created = unwrap(service.createThink({ document: draft('one') }));
  fails(service.createThink({ document: published('one') }), 'DUPLICATE_SLUG');
  const report = unwrap(service.validateThink({ document: draft('one') }));
  assert.equal(report.canSave, false);
  assert.ok(report.issues.some(issue => issue.code === 'DUPLICATE_SLUG'));
  fails(service.saveThink({ key: created.key, expectedRevision: created.revision, document: draft('new-url') }), 'VALIDATION_FAILED');
  fs.writeFileSync(join(content, 'occupied.md'), '---\nslug: another-slug\n---\n');
  fails(service.createThink({ document: draft('occupied') }), 'FILE_EXISTS');
  for (const input of [null, [], { status: 1 }, { status: 'unknown' }, { path: '../secret' }]) fails(service.listThink(input), 'INVALID_REQUEST');
  for (const key of ['../one.md', 'D:\\secret.md', 'one.md:stream', '%2e%2e%2f', '%252e%252e', 'file://one', 'a'.repeat(63), 'A'.repeat(64)]) {
    fails(service.readThink({ key }), 'INVALID_REQUEST');
    fails(service.deleteThink({ key, expectedRevision: created.revision }), 'INVALID_REQUEST');
  }
  fails(service.readThink({ key: '0'.repeat(64) }), 'NOT_FOUND');
  fails(service.createThink({ document: draft('valid'), fileName: '../escape.md' }), 'INVALID_REQUEST');
  fails(service.saveThink({ key: created.key, document: draft('one') }), 'INVALID_REQUEST');
  fails(service.deleteThink({ key: created.key, expectedRevision: null }), 'INVALID_REQUEST');
  fails(service.createThink({ document: { ...draft('valid'), extra: true } }), 'VALIDATION_FAILED');
  if (process.platform === 'win32') {
    fs.writeFileSync(join(content, 'one.md:stream'), 'ADS_MUST_NOT_BECOME_ARTICLE_CONTENT');
    const read = unwrap(service.readThink({ key: created.key }));
    assert.equal(read.revision, created.revision);
    assert.ok(!JSON.stringify(read).includes('ADS_MUST_NOT_BECOME_ARTICLE_CONTENT'));
    assert.equal(unwrap(service.listThink()).some(entry => entry.fileName.includes(':')), false);
  }
  for (const slug of ['con', 'aux', 'prn', 'nul', 'com1', 'lpt9', 'a'.repeat(253)]) fails(service.createThink({ document: draft(slug) }), 'VALIDATION_FAILED');
  for (const name of ['CON.md', 'con.any.md', 'COM¹.md', 'LPT².md', 'name.md:ads', 'trailing.md ', 'name.md.', '.hidden.md', '../x.md', 'a/b.md', 'a\\b.md', 'one.MD']) assert.equal(allowedThinkFileName(name), false, name);
  assert.equal(allowedThinkFileName('原始文章名.md'), true);
  const large = { ...draft('oversize'), body: 'x'.repeat(MAX_THINK_SOURCE_BYTES) };
  const largeReport = unwrap(service.validateThink({ document: large }));
  assert.equal(largeReport.canSave, false);
  assert.ok(largeReport.issues.some(issue => issue.code === 'SOURCE_TOO_LARGE'));
  fails(service.createThink({ document: large }), 'VALIDATION_FAILED');
  assert.equal(fs.existsSync(join(content, 'oversize.md')), false);
});

test('M1 damaged sources remain visible, block creation/save, and can be explicitly deleted by exact revision', t => {
  const { content, open } = setup(t);
  const service = open();
  const good = unwrap(service.createThink({ document: draft('good') }));
  fs.writeFileSync(join(content, 'unknown.md'), '---\nslug: unknown\nextra: DO_NOT_RETURN_SOURCE\n---\n');
  fs.writeFileSync(join(content, 'bad.md'), '---\nslug: [broken\n---\n');
  fs.writeFileSync(join(content, 'utf8.md'), Buffer.from([0xff, 0xfe]));
  const list = unwrap(service.listThink());
  assert.equal(list.length, 4);
  const broken = list.filter(item => !item.editable);
  assert.equal(broken.length, 3);
  assert.ok(!JSON.stringify(list).includes('DO_NOT_RETURN_SOURCE'));
  for (const item of broken) {
    const read = unwrap(service.readThink({ key: item.key }));
    assert.ok(!Object.hasOwn(read, 'document'));
    assert.equal(read.deletable, true);
  }
  fails(service.createThink({ document: draft('new') }), 'DIRECTORY_INVALID');
  fails(service.saveThink({ key: good.key, expectedRevision: good.revision, document: draft('good') }), 'DIRECTORY_INVALID');
  for (const item of broken) unwrap(service.deleteThink({ key: item.key, expectedRevision: item.revision }));
  unwrap(service.createThink({ document: draft('new') }));
  fs.writeFileSync(join(content, 'duplicate.md'), '---\nslug: good\n---\n');
  const duplicates = unwrap(service.listThink()).filter(item => item.slug === 'good');
  assert.equal(duplicates.length, 2);
  assert.ok(duplicates.every(item => !item.editable && item.issues.some(issue => issue.code === 'DUPLICATE_SLUG')));
  const duplicate = duplicates.find(item => item.fileName === 'duplicate.md')!;
  unwrap(service.deleteThink({ key: duplicate.key, expectedRevision: duplicate.revision }));
  assert.equal(unwrap(service.readThink({ key: good.key })).editable, true);
});

test('M1 revisions detect byte/comment changes, deletion and same-byte file replacement without overwriting', t => {
  const { content, open } = setup(t);
  const service = open();
  const created = unwrap(service.createThink({ document: draft('one') }));
  const file = join(content, 'one.md');
  const original = fs.readFileSync(file);
  fs.appendFileSync(file, '\nEXTERNAL_CHANGE');
  const external = fs.readFileSync(file);
  fails(service.saveThink({ key: created.key, expectedRevision: created.revision, document: draft('one') }), 'REVISION_CONFLICT');
  fails(service.deleteThink({ key: created.key, expectedRevision: created.revision }), 'REVISION_CONFLICT');
  assert.deepEqual(fs.readFileSync(file), external);
  const fresh = unwrap(service.readThink({ key: created.key }));
  unwrap(service.saveThink({ key: fresh.key, expectedRevision: fresh.revision, document: draft('one') }));
  const replace = t.mock.method(fs, 'fsyncSync', (...args: Parameters<typeof fs.fsyncSync>) => {
    replace.mock.restore(); fs.fsyncSync(...args);
    fs.renameSync(file, join(content, 'old.tmp'));
    fs.writeFileSync(file, original);
  });
  const revision = unwrap(service.readThink({ key: created.key })).revision;
  fails(service.saveThink({ key: created.key, expectedRevision: revision, document: { ...draft('one'), body: 'new text' } }), 'REVISION_CONFLICT');
  assert.deepEqual(fs.readFileSync(file), original);
  fs.unlinkSync(file);
  fails(service.readThink({ key: created.key }), 'NOT_FOUND');
});

test('M1 synchronous calls serialize competing create/save/delete and reject reentrant writes', async t => {
  const { content, open } = setup(t);
  const service = open();
  const creates = await Promise.all([0, 1].map(() => Promise.resolve().then(() => service.createThink({ document: draft('race') }))));
  assert.equal(creates.filter(r => r.ok).length, 1);
  const first = unwrap(creates.find(r => r.ok)!);
  const results = await Promise.all([
    Promise.resolve().then(() => service.saveThink({ key: first.key, expectedRevision: first.revision, document: { ...draft('race'), body: 'saved' } })),
    Promise.resolve().then(() => service.deleteThink({ key: first.key, expectedRevision: first.revision })),
  ]);
  assert.equal(results.filter(r => r.ok).length, 1);
  fails(results[1], 'REVISION_CONFLICT');
  let nested: EditorResult<unknown> | undefined;
  const rename = t.mock.method(fs, 'renameSync', (...args: Parameters<typeof fs.renameSync>) => {
    rename.mock.restore();
    nested = service.createThink({ document: draft('nested') });
    fs.renameSync(...args);
  });
  const current = unwrap(service.readThink({ key: first.key }));
  unwrap(service.saveThink({ key: first.key, expectedRevision: current.revision, document: { ...draft('race'), body: 'updated' } }));
  fails(nested!, 'AUTHORING_BUSY');
  assert.equal(fs.existsSync(join(content, 'nested.md')), false);
});

test('M1 lease excludes other objects/processes, close releases it, and a stale lease is never silently stolen', t => {
  const { root, open } = setup(t);
  const service = open();
  fails(openThinkAuthoring(root), 'AUTHORING_BUSY');
  const script = "import {openThinkAuthoring} from './studio/server/think/service.ts'; const result=openThinkAuthoring(process.argv[1]); console.log(result.ok?'OPEN':result.error.code); if(result.ok)result.value.close();";
  const child = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script, root], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), 'AUTHORING_BUSY');
  unwrap(service.close());
  const second = open();
  unwrap(second.close());
  const lock = join(root, '.cache/studio/think-authoring.lock');
  fs.writeFileSync(lock, JSON.stringify({ pid: 0, token: 'stale' }));
  fails(openThinkAuthoring(root), 'AUTHORING_BUSY');
  assert.match(fs.readFileSync(lock, 'utf8'), /stale/);
});

test('M1 write/flush/rename failures preserve the old source and leave no article temporary', t => {
  const { content, open } = setup(t);
  const service = open();
  const created = unwrap(service.createThink({ document: draft('one') }));
  const file = join(content, 'one.md'), bytes = fs.readFileSync(file);
  for (const operation of ['writeSync', 'fsyncSync', 'renameSync'] as const) {
    const injected = t.mock.method(fs, operation, () => { throw Object.assign(new Error('SECRET_PATH_MUST_NOT_ESCAPE'), { code: 'EPERM' }); });
    const result = service.saveThink({ key: created.key, expectedRevision: created.revision, document: { ...draft('one'), body: 'changed' } });
    injected.mock.restore();
    fails(result, 'FILE_OPERATION_FAILED');
    assert.ok(!JSON.stringify(result).includes('SECRET_PATH'));
    assert.deepEqual(fs.readFileSync(file), bytes);
    assert.deepEqual(temps(content), []);
  }
  const unlink = t.mock.method(fs, 'unlinkSync', () => { throw new Error('delete failure'); });
  fails(service.deleteThink({ key: created.key, expectedRevision: created.revision }), 'FILE_OPERATION_FAILED');
  unlink.mock.restore();
  assert.deepEqual(fs.readFileSync(file), bytes);
});

test('M1 final checks catch external writes and concurrent target creation while temp files remain unlisted', t => {
  const { content, open } = setup(t);
  const service = open();
  const created = unwrap(service.createThink({ document: draft('one') }));
  const file = join(content, 'one.md');
  const flush = t.mock.method(fs, 'fsyncSync', (...args: Parameters<typeof fs.fsyncSync>) => {
    flush.mock.restore(); fs.fsyncSync(...args); fs.appendFileSync(file, '\nexternal');
  });
  fails(service.saveThink({ key: created.key, expectedRevision: created.revision, document: { ...draft('one'), body: 'studio' } }), 'REVISION_CONFLICT');
  assert.match(fs.readFileSync(file, 'utf8'), /external$/);
  const link = t.mock.method(fs, 'linkSync', (...args: Parameters<typeof fs.linkSync>) => {
    link.mock.restore(); fs.writeFileSync(join(content, 'two.md'), 'EXTERNAL_TARGET'); fs.linkSync(...args);
  });
  fails(service.createThink({ document: draft('two') }), 'FILE_EXISTS');
  assert.equal(fs.readFileSync(join(content, 'two.md'), 'utf8'), 'EXTERNAL_TARGET');
  assert.deepEqual(temps(content), []);
  assert.equal(unwrap(service.listThink()).length, 2);
});

test('M1 refuses symlink/junction ancestors, symbolic source files, hardlinks and oversized inputs', t => {
  const { root, content, open } = setup(t);
  const outside = join(root, 'outside'); fs.mkdirSync(outside);
  fs.writeFileSync(join(outside, 'sentinel.md'), 'OUTSIDE_SENTINEL');
  const service = open();
  fs.linkSync(join(outside, 'sentinel.md'), join(content, 'hard.md'));
  fs.symlinkSync(outside, join(content, 'directory.md'), 'junction');
  const tooLarge = join(content, 'large.md');
  const fd = fs.openSync(tooLarge, 'wx'); fs.ftruncateSync(fd, MAX_THINK_SOURCE_BYTES + 1); fs.closeSync(fd);
  const list = unwrap(service.listThink());
  assert.equal(list.length, 3);
  assert.ok(list.every(item => !item.editable && !item.deletable && item.revision === null));
  assert.equal(fs.readFileSync(join(outside, 'sentinel.md'), 'utf8'), 'OUTSIDE_SENTINEL');
  fails(service.createThink({ document: draft('new') }), 'DIRECTORY_INVALID');
  unwrap(service.close());
  fs.renameSync(content, join(root, 'held-content'));
  fs.symlinkSync(outside, content, 'junction');
  fails(openThinkAuthoring(root), 'PROTECTED_PATH');
  fs.unlinkSync(content); fs.renameSync(join(root, 'held-content'), content);
  fs.renameSync(join(root, '.cache/studio'), join(root, '.cache/held-studio'));
  fs.symlinkSync(outside, join(root, '.cache/studio'), 'junction');
  fails(openThinkAuthoring(root), 'PROTECTED_PATH');
});

test('M1 ancestor replacement during write aborts without cleanup following a junction', t => {
  const { root, content, open } = setup(t);
  const service = open();
  const created = unwrap(service.createThink({ document: draft('one') }));
  const outside = join(root, 'outside'); fs.mkdirSync(outside);
  fs.writeFileSync(join(outside, 'one.md'), 'OUTSIDE');
  const held = join(root, 'held');
  const originalClose = fs.closeSync;
  const close = t.mock.method(fs, 'closeSync', (fd: number) => {
    originalClose(fd);
    if (temps(content).length) {
      close.mock.restore(); fs.renameSync(content, held); fs.symlinkSync(outside, content, 'junction');
    }
  });
  const result = service.saveThink({ key: created.key, expectedRevision: created.revision, document: { ...draft('one'), body: 'change' } });
  fails(result, 'PROTECTED_PATH');
  assert.equal(result.ok ? false : result.error.cleanupPending, true);
  assert.equal(fs.readFileSync(join(outside, 'one.md'), 'utf8'), 'OUTSIDE');
  fs.unlinkSync(content); fs.renameSync(held, content);
});

test('M1 case-variant extensions stay diagnosed; file symlinks are checked when the host permits creation', async t => {
  const { root, content, open } = setup(t);
  const outside = join(root, 'outside.md'); fs.writeFileSync(outside, 'FILE_SYMLINK_SENTINEL');
  fs.writeFileSync(join(content, 'Case.MD'), '---\nslug: case\n---\n');
  const service = open();
  const list = unwrap(service.listThink());
  assert.equal(list.length, 1);
  assert.ok(list.every(entry => !entry.editable && !entry.deletable));
  fails(service.createThink({ document: draft('case') }), 'FILE_EXISTS');
  await t.test('ordinary file symlink must never expose its outside target', sub => {
    try { fs.symlinkSync(outside, join(content, 'link.md'), 'file'); }
    catch (error) {
      if (process.platform === 'win32' && (error as NodeJS.ErrnoException).code === 'EPERM') {
        sub.skip('Windows account cannot create ordinary file symlinks; real junction/hardlink checks run separately.');
        return;
      }
      throw error;
    }
    const entries = unwrap(service.listThink());
    const link = entries.find(entry => entry.fileName === 'link.md')!;
    assert.equal(link.editable, false);
    assert.equal(link.revision, null);
    assert.ok(!JSON.stringify(unwrap(service.readThink({ key: link.key }))).includes('FILE_SYMLINK_SENTINEL'));
  });
  assert.equal(fs.readFileSync(outside, 'utf8'), 'FILE_SYMLINK_SENTINEL');
});

test('M1 partial temporary writes and precommit temp tampering cannot replace the old file', t => {
  const { content, open } = setup(t);
  const service = open();
  const created = unwrap(service.createThink({ document: draft('one') }));
  const file = join(content, 'one.md'), before = fs.readFileSync(file);
  const partial = t.mock.method(fs, 'writeSync', (fd: number, bytes: Buffer, offset: number, length: number) => {
    partial.mock.restore(); fs.writeSync(fd, bytes, offset, Math.min(length, 3)); throw new Error('partial write failure');
  });
  fails(service.saveThink({ key: created.key, expectedRevision: created.revision, document: { ...draft('one'), body: 'new' } }), 'FILE_OPERATION_FAILED');
  assert.deepEqual(fs.readFileSync(file), before);
  const originalClose = fs.closeSync;
  const close = t.mock.method(fs, 'closeSync', (fd: number) => {
    originalClose(fd);
    const temporary = temps(content)[0];
    if (temporary) { close.mock.restore(); fs.writeFileSync(join(content, temporary), 'TAMPERED'); }
  });
  fails(service.saveThink({ key: created.key, expectedRevision: created.revision, document: { ...draft('one'), body: 'new' } }), 'REVISION_CONFLICT');
  assert.deepEqual(fs.readFileSync(file), before);
  assert.deepEqual(temps(content), []);
});

test('M1 postcommit cleanup failure is reported as committed, and a lost lease is never removed', t => {
  const { root, content, open } = setup(t);
  const service = open();
  const unlink = t.mock.method(fs, 'unlinkSync', () => { throw new Error('temp cleanup failure'); });
  const result = unwrap(service.createThink({ document: draft('committed') }));
  unlink.mock.restore();
  assert.equal(result.cleanupPending, true);
  assert.equal(revisionOf(fs.readFileSync(join(content, 'committed.md'))), result.revision);
  for (const temporary of temps(content)) fs.unlinkSync(join(content, temporary));
  assert.equal(unwrap(service.readThink({ key: result.key })).editable, true);
  const lock = join(root, '.cache/studio/think-authoring.lock');
  fs.writeFileSync(lock, 'REPLACED_LEASE');
  fails(service.close(), 'AUTHORING_BUSY');
  fails(service.createThink({ document: draft('blocked') }), 'AUTHORING_BUSY');
  assert.equal(fs.readFileSync(lock, 'utf8'), 'REPLACED_LEASE');
  assert.equal(fs.existsSync(join(content, 'blocked.md')), false);
});
