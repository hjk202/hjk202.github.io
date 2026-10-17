import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
import process from 'node:process';
import { log } from 'node:console';
import { openThinkAuthoring } from '../studio/server/think/service.ts';
import { parseThinkSource } from '../studio/server/think/document.ts';

const cache = resolve('.cache/studio-m1');
fs.mkdirSync(cache, { recursive: true });
const root = fs.mkdtempSync(join(cache, 'integration-'));
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]);
const hashes = directory => Object.fromEntries(walk(directory).map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const before = hashes('src');
const unwrap = result => { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; };
fs.cpSync('src', join(root, 'src'), { recursive: true });
if (fs.existsSync('public')) fs.cpSync('public', join(root, 'public'), { recursive: true });
for (const file of ['package.json', 'astro.config.mjs', 'tsconfig.json']) fs.copyFileSync(file, join(root, file));
const content = join(root, 'src/modules/think/content');
for (const name of fs.readdirSync(content).filter(name => name.endsWith('.md') && name !== 'understanding-from-the-bottom.md')) {
  const target = resolve(content, name);
  assert.ok(!relative(root, target).startsWith('..') && relative(root, target) !== ''); fs.unlinkSync(target);
}

fs.copyFileSync('tests/fixtures/think/probe.svg.fixture', join(content, 'probe.svg'));
const cli = resolve('node_modules/astro/bin/astro.mjs');
const outputs = {};
const build = (name, base, count, probe, note) => {
  execFileSync(process.execPath, [cli, 'build', '--base', base, '--outDir', name], { cwd: root, stdio: 'inherit', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });
  const directory = join(root, name);
  const index = JSON.parse(fs.readFileSync(join(directory, 'search-index.json'), 'utf8'));
  assert.equal(index.modules.find(module => module.id === 'think').count, count);
  assert.equal(index.results.some(item => item.url === '/think/content-probe/'), probe);
  assert.equal(index.results.some(item => item.url === '/think/authoring-note/'), note);
  assert.equal(fs.existsSync(join(directory, 'think/content-probe/index.html')), probe);
  assert.equal(fs.existsSync(join(directory, 'think/authoring-note/index.html')), note);
  const text = walk(directory).map(file => fs.readFileSync(file, 'utf8')).join('\n');
  assert.ok(!text.includes('M1_DRAFT_NOT_PUBLIC'));
  assert.ok(!text.includes('studio/server/think'));
  outputs[name] = { directory, base, count, probe, note };
};
const service = unwrap(openThinkAuthoring(root));
try {
  const original = unwrap(service.listThink());
  assert.equal(original.length, 1);
  const originalBytes = fs.readFileSync(join(content, original[0].fileName));
  const article = unwrap(parseThinkSource(fs.readFileSync('tests/fixtures/think/published.md.fixture', 'utf8'))).document;
  const first = unwrap(service.createThink({ document: article }));
  const note = { metadata: { slug: 'authoring-note', title: 'M1 非敏感随记', summary: '隔离 CRUD 样本', date: '2026-10-15', kind: 'note', published: true }, body: '\nM1_NOTE_INITIAL\n' };
  const noteFirst = unwrap(service.createThink({ document: note }));
  const draft = unwrap(service.createThink({ document: { metadata: { slug: 'authoring-draft' }, body: 'M1_DRAFT_NOT_PUBLIC' } }));
  build('created-root', '/', 3, true, true);
  article.metadata.title = 'Studio M1 内容验证';
  article.body += '\nM1_UPDATED_BODY\n';
  const updated = unwrap(service.saveThink({ key: first.key, expectedRevision: first.revision, document: article }));
  note.body = '\nM1_NOTE_UPDATED_INLINE\n';
  const noteUpdated = unwrap(service.saveThink({ key: noteFirst.key, expectedRevision: noteFirst.revision, document: note }));
  for (const [name, base] of [['updated-root', '/'], ['updated-base', '/personal-space/']]) {
    build(name, base, 3, true, true);
    assert.ok(fs.readFileSync(join(root, name, 'think/index.html'), 'utf8').includes('M1_NOTE_UPDATED_INLINE'));
    assert.ok(fs.readFileSync(join(root, name, 'think/content-probe/index.html'), 'utf8').includes('M1_UPDATED_BODY'));
  }
  assert.deepEqual(fs.readFileSync(join(content, original[0].fileName)), originalBytes);
  article.metadata.published = false;
  const hidden = unwrap(service.saveThink({ key: updated.key, expectedRevision: updated.revision, document: article }));
  unwrap(service.deleteThink({ key: noteUpdated.key, expectedRevision: noteUpdated.revision }));
  for (const [name, base] of [['hidden-root', '/'], ['hidden-base', '/personal-space/']]) build(name, base, 1, false, false);
  assert.deepEqual(fs.readFileSync(join(content, original[0].fileName)), originalBytes);
  unwrap(service.deleteThink({ key: hidden.key, expectedRevision: hidden.revision }));
  unwrap(service.deleteThink({ key: draft.key, expectedRevision: draft.revision }));
  // Only the explicitly isolated copy is emptied; the real author source is hashed below.
  assert.ok(relative(cache, root).startsWith('integration-'));
  unwrap(service.deleteThink({ key: original[0].key, expectedRevision: original[0].revision }));
  assert.deepEqual(unwrap(service.listThink()), []);
  for (const [name, base] of [['empty-root', '/'], ['empty-base', '/personal-space/']]) {
    build(name, base, 0, false, false);
    assert.ok(fs.readFileSync(join(root, name, 'think/index.html'), 'utf8').includes('暂无公开文章'));
  }
  assert.equal(fs.existsSync(join(content, 'probe.svg')), true, 'deletion must not remove shared assets');
} finally { unwrap(service.close()); }
assert.deepEqual(hashes('src'), before, 'Studio probes must never change actual source');
fs.writeFileSync(join(cache, 'integration-output.json'), JSON.stringify({ root, outputs, realSourceUnchanged: true }, null, 2));
log(`Studio M1 isolated CRUD/build passed: ${root}`);
