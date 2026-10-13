import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import process from 'node:process';
import { log } from 'node:console';

const snapshot = (directory) => Object.fromEntries(readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? Object.entries(snapshot(path)) : [[path, createHash('sha256').update(readFileSync(path)).digest('hex')]];
}));
const before = snapshot('src');
const isolated = resolve('.cache', `content-${Date.now()}`);
mkdirSync(isolated, { recursive: true });
cpSync('src', join(isolated, 'src'), { recursive: true });
if (existsSync('public')) cpSync('public', join(isolated, 'public'), { recursive: true });
for (const file of ['package.json', 'astro.config.mjs', 'tsconfig.json']) cpSync(file, join(isolated, file));
const directory = join(isolated, 'src/modules/think/content');
cpSync('tests/fixtures/think/published.md.fixture', join(directory, 'probe.md'));
cpSync('tests/fixtures/think/probe.svg.fixture', join(directory, 'probe.svg'));
writeFileSync(join(directory, 'draft.md'), '---\nslug: hidden-probe\npublished: false\n---\nHIDDEN_CONTENT_UNIQUE_7291');
const astroPackage = JSON.parse(readFileSync('node_modules/astro/package.json', 'utf8'));
const cli = resolve('node_modules/astro', astroPackage.bin.astro);
const run = (output) => execFileSync(process.execPath, [cli, 'build', '--base', '/personal-space/', '--outDir', output], { cwd: isolated, stdio: 'inherit', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });
const index = (output) => JSON.parse(readFileSync(join(isolated, output, 'search-index.json'), 'utf8'));
const count = (output) => index(output).modules.find((module) => module.id === 'think').count;
const scan = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? scan(path) : [readFileSync(path, 'utf8')];
}).join('\n');
run('public-dist');
assert.equal(count('public-dist'), 2);
assert.ok(index('public-dist').results.some((result) => result.url === '/think/content-probe/'));
assert.ok(readFileSync(join(isolated, 'public-dist/think/content-probe/index.html'), 'utf8').includes('Markdown bridge'));
assert.ok(!scan(join(isolated, 'public-dist')).includes('HIDDEN_CONTENT_UNIQUE_7291'));
writeFileSync('.cache/content-output.txt', join(isolated, 'public-dist'));
for (const id of ['me', 'build', 'keep']) {
  const file = join(isolated, 'src/modules', id, 'data.ts');
  writeFileSync(file, readFileSync(file, 'utf8').replaceAll('published: true', 'published: false'));
}
writeFileSync(join(directory, 'probe.md'), readFileSync(join(directory, 'probe.md'), 'utf8').replace('published: true', 'published: false'));
run('hidden-dist');
assert.equal(count('hidden-dist'), 1);
assert.deepEqual(index('hidden-dist').modules.map((module) => module.count), [1, 0, 0, 0]);
assert.deepEqual(index('hidden-dist').results.map((result) => result.url), ['/think/understanding-from-the-bottom/']);
assert.ok(!existsSync(join(isolated, 'hidden-dist/build/nemu/index.html')));
assert.ok(!existsSync(join(isolated, 'hidden-dist/keep/missing-semester/index.html')));
for (const text of ['我是韩江恺，南京大学', 'NEMU 是我在计算机', '工具本身也是计算机能力']) assert.ok(!scan(join(isolated, 'hidden-dist')).includes(text));
assert.ok(!existsSync(join(isolated, 'hidden-dist/think/content-probe/index.html')));
assert.ok(!index('hidden-dist').results.some((result) => result.url === '/think/content-probe/'));
const real = join(directory, 'understanding-from-the-bottom.md');
writeFileSync(real, readFileSync(real, 'utf8').replace('published: true', 'published: false'));
run('empty-dist');
assert.equal(count('empty-dist'), 0);
assert.deepEqual(index('empty-dist').modules.map((module) => module.count), [0, 0, 0, 0]);
assert.deepEqual(index('empty-dist').results, []);
assert.ok(readFileSync(join(isolated, 'empty-dist/think/index.html'), 'utf8').includes('暂无公开文章'));
assert.ok(!index('empty-dist').results.some((result) => result.module === 'think'));
assert.ok(!scan(join(isolated, 'empty-dist')).includes('HIDDEN_CONTENT_UNIQUE_7291'));
writeFileSync('.cache/content-empty-output.txt', join(isolated, 'empty-dist'));
// Remove only named files in this isolated checkout; never touch original src.
for (const name of ['probe.md', 'draft.md', 'understanding-from-the-bottom.md']) {
  const file = resolve(directory, name);
  assert.ok(file.startsWith(`${isolated}${sep}`));
  rmSync(file);
}
for (const [id, adapter, name, argument] of [['build', 'projects', 'projects', '[]'], ['keep', 'bookmarks', 'bookmarks', '[]'], ['me', 'profile', 'profile', 'null']]) {
  const factory = `public${adapter[0].toUpperCase()}${adapter.slice(1)}`;
  writeFileSync(join(isolated, 'src/modules', id, 'data.ts'), `import { ${factory} } from './${adapter}.ts';\nexport const ${name} = ${factory}(${argument});\n`);
}
run('deleted-dist');
assert.deepEqual(index('deleted-dist').modules.map((module) => module.count), [0, 0, 0, 0]);
assert.deepEqual(index('deleted-dist').results, []);
for (const path of ['think/understanding-from-the-bottom', 'think/content-probe', 'build/nemu', 'keep/missing-semester']) assert.ok(!existsSync(join(isolated, 'deleted-dist', path, 'index.html')));
assert.deepEqual(snapshot('src'), before, 'Content probes must never modify actual source');
log(`Content publication acceptance passed: ${isolated}`);
