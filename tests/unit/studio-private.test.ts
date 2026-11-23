import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, resolve, relative } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { encryptVault, decryptVault } from '../../src/core/vault/crypto.ts';
import { validatePrivatePayload } from '../../studio/private/payload.ts';
import { PrivateSession } from '../../studio/private/session.ts';
import { CipherFiles } from '../../studio/server/private/files.ts';
import { privateSelection } from '../../studio/contracts/private.ts';

const password = 'NON_SENSITIVE_PRIVATE_FIXTURE_2026';
const snapshot = { revision: '1'.repeat(64), slugs: ['parent'] };
function payload() {
  return { version: 1, modules: {
    think: { posts: [{ id: 'a'.repeat(32), title: '非敏感', summary: '测试', date: '2026-10-23', kind: 'article', body: '非敏感正文' }] },
    keep: { bookmarks: [{ id: 'b'.repeat(32), title: '非敏感收藏', description: '说明', sourceUrl: 'https://example.com/', note: ['段落'] }] },
    me: { paragraphs: ['非敏感介绍'] },
    build: { projects: [], supplements: [{ id: 'c'.repeat(32), publicSlug: 'parent', title: '非敏感补充', sections: [{ paragraphs: ['补充'] }] }] },
  }, assets: {} };
}
function fixture(t: TestContext) {
  const cache = resolve('.cache/studio-batch/m12'); fs.mkdirSync(cache, { recursive: true }); const directory = fs.mkdtempSync(join(cache, 'unit-'));
  const root = join(directory, 'repository'), external = join(directory, 'external'); fs.mkdirSync(root); fs.mkdirSync(external);
  t.after(() => { assert.ok(relative(cache, directory).startsWith('unit-')); fs.rmSync(directory, { recursive: true, force: true }); });
  return { root, external, file: join(external, 'master.json'), directory };
}
test('M12 validates full packages/assets/relations while preserving optional fields and every untouched module', () => {
  const original = payload(); assert.deepEqual(validatePrivatePayload(original, snapshot), original);
  for (const invalid of [
    { ...original, modules: { ...original.modules, unknown: {} } },
    { ...original, modules: { ...original.modules, think: { posts: [{ ...original.modules.think.posts[0], published: false }] } } },
    { ...original, modules: { ...original.modules, think: { posts: [{ ...original.modules.think.posts[0], body: `![test](asset:${'d'.repeat(32)})` }] } } },
  ]) assert.throws(() => validatePrivatePayload(invalid, snapshot));
  assert.throws(() => validatePrivatePayload(original, { revision: snapshot.revision, slugs: [] }), /PRIVATE_PUBLIC_REFERENCE/);
  const assets = { ['d'.repeat(32)]: { type: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6lSAAAAAASUVORK5CYII=' } };
  const complete = { ...original, assets, modules: { ...original.modules, think: { posts: [{ ...original.modules.think.posts[0], body: `![test](asset:${'d'.repeat(32)})` }] } } };
  assert.deepEqual(validatePrivatePayload(complete, snapshot), complete);
});
test('M12 volatile session refuses late unlock/encryption, validates entire candidates and retains no unlocked state after lock', async () => {
  const session = new PrivateSession(), original = payload(), envelope = await encryptVault(original, password);
  const late = session.unlock(envelope, password, snapshot); session.lock(); await assert.rejects(late, /PRIVATE_STALE/); assert.equal(session.unlocked, false);
  await assert.rejects(session.unlock(envelope, 'NON_SENSITIVE_WRONG_PASSWORD', snapshot), /PRIVATE_UNLOCK_FAILED/); assert.equal(session.unlocked, false);
  await session.unlock(envelope, password, snapshot); assert.equal(session.dirty, false); assert.deepEqual(session.snapshot(), original);
  const changed = session.snapshot(); (changed.modules.think as typeof original.modules.think).posts[0]!.title = '只改目标标题'; session.replaceCandidate(changed);
  assert.equal(session.dirty, true); assert.deepEqual(session.snapshot().modules.keep, original.modules.keep); assert.deepEqual(session.snapshot().assets, original.assets);
  const pending = session.seal(password, snapshot); session.lock(); await assert.rejects(pending, /PRIVATE_STALE/); assert.throws(() => session.snapshot(), /PRIVATE_LOCKED/);
  await session.unlock(envelope, password, snapshot); const sealed = await session.seal(password, snapshot); assert.deepEqual(await decryptVault(sealed.envelope, password), original);
  assert.equal(sealed.envelope.iterations, 600000); session.markSaved(sealed.version); session.lock(); assert.equal(session.dirty, false);
});
test('M12 cipher handles restrict writes, enforce revision, preserve old ciphertext backups and clean failed atomics', async t => {
  const f = fixture(t), store = new CipherFiles(f.root);
  const envelope = await encryptVault(payload(), password), selected = store.bind(f.file, 'create');
  const first = store.save(selected.handle, null, envelope); assert.equal(store.read(selected.handle).revision, first.revision);
  const original = fs.readFileSync(f.file), canary = 'NON_SENSITIVE_' + randomUUID();
  assert.throws(() => store.save(selected.handle, first.revision, { version: 1, modules: { think: { body: canary } } }), /PRIVATE_ENVELOPE_INVALID/);
  assert.equal(fs.readFileSync(f.file).equals(original), true);
  const next = await encryptVault(payload(), password);
  const written = store.save(selected.handle, first.revision, next); assert.equal(written.backupCreated, true);
  const backups = fs.readdirSync(f.external).filter(name => name.startsWith('.studio-vault-backup-')); assert.equal(backups.length, 1); assert.equal(fs.readFileSync(join(f.external, backups[0]!)).equals(original), true);
  assert.throws(() => store.save(selected.handle, first.revision, envelope), /PRIVATE_CONFLICT/);
  const before = fs.readFileSync(f.file), rename = fs.renameSync;
  try { fs.renameSync = () => { throw new Error('NON_SENSITIVE_ATOMIC_FAILURE'); }; assert.throws(() => store.save(selected.handle, written.revision, envelope)); }
  finally { fs.renameSync = rename; }
  assert.equal(fs.readFileSync(f.file).equals(before), true); assert.equal(fs.readdirSync(f.external).some(name => name.endsWith('.tmp')), false);
  const other = store.bind(join(f.external, 'second.json'), 'create'); assert.notEqual(other.handle, selected.handle); assert.throws(() => store.read(selected.handle), /PRIVATE_HANDLE_INVALID/);
  store.close(); assert.throws(() => store.read(other.handle), /PRIVATE_HANDLE_INVALID/);
});
test('M12 chosen paths reject repository writes, traversal through junctions, hardlinks and non-envelopes', async t => {
  const f = fixture(t), store = new CipherFiles(f.root);
  for (const path of [join(f.root, 'private.json'), '../relative.json', join(f.external, 'master.json:stream'), join(f.external, 'con.json')]) assert.throws(() => store.bind(path, 'create'));
  fs.writeFileSync(f.file, JSON.stringify(await encryptVault(payload(), password)));
  const link = join(f.directory, 'redirect'); fs.symlinkSync(f.external, link, process.platform === 'win32' ? 'junction' : 'dir');
  try { assert.throws(() => store.bind(join(link, 'master.json'), 'open'), /PRIVATE_FILE_UNSAFE/); } finally { fs.unlinkSync(link); }
  const hard = join(f.external, 'linked.json'); fs.linkSync(f.file, hard); assert.throws(() => store.bind(hard, 'open'), /PRIVATE_FILE_UNSAFE/); fs.unlinkSync(hard);
  fs.writeFileSync(join(f.external, 'plain.json'), '{"version":1,"modules":{},"assets":{}}'); assert.throws(() => store.bind(join(f.external, 'plain.json'), 'open'), /PRIVATE_ENVELOPE_INVALID/);
  store.close();
});
test('M12 file-selection requests carry only operation/nonce, never paths, passwords, payloads or unsupported modes', () => {
  const valid = { type: 'studio:private-select', requestId: randomUUID(), mode: 'open' };
  assert.equal(privateSelection(valid), true);
  for (const invalid of [{ ...valid, path: 'C:/outside' }, { ...valid, password: 'NON_SENSITIVE' }, { ...valid, payload: {} }, { ...valid, mode: 'remote' }, { ...valid, requestId: 'invalid' }, []]) assert.equal(privateSelection(invalid), false);
});
