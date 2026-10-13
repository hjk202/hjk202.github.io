import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import process from 'node:process';
import { log } from 'node:console';

const snapshot = (directory) => Object.fromEntries(readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? Object.entries(snapshot(path)) : [[path, createHash('sha256').update(readFileSync(path)).digest('hex')]];
}));
const before = snapshot('src');
const isolated = resolve('.cache', `design-${Date.now()}`);
mkdirSync(isolated, { recursive: true });
cpSync('src', join(isolated, 'src'), { recursive: true });
if (existsSync('public')) cpSync('public', join(isolated, 'public'), { recursive: true });
for (const file of ['package.json', 'astro.config.mjs', 'tsconfig.json']) cpSync(file, join(isolated, file));
const bookmarks = [
  { slug: 'one', title: '工具资源一', description: '工具说明', published: true, sourceUrl: 'https://example.com/one', note: ['个人说明'], category: { id: 'tools', label: '工具' } },
  { slug: 'two', title: '工具资源二', description: '工具说明', published: true, sourceUrl: 'https://example.com/two', note: ['个人说明'], category: { id: 'tools', label: '工具' } },
  { slug: 'three', title: '系统资源', description: '系统说明', published: true, sourceUrl: 'https://example.com/three', note: ['个人说明'], category: { id: 'systems', label: 'SystemsDocumentationResourcesWithLongNames' } },
];
writeFileSync(join(isolated, 'src/modules/keep/data.ts'), `import { publicBookmarks } from './bookmarks.ts';\nexport const bookmarks = publicBookmarks(${JSON.stringify(bookmarks)});\n`);
writeFileSync(join(isolated, 'src/modules/think/content/design-note.md'), '---\nslug: design-note\ntitle: 一个测试中的小问题\nsummary: 随记测试\ndate: "2026-10-13"\npublished: true\nkind: note\n---\n\n测试中的想法正文，可以在列表直接读完。\n');
const project = { slug: 'record-probe', title: '项目记录测试', summary: '隔离测试项目', published: true, sections: [{ paragraphs: ['项目概览正文'] }], status: 'in-progress', milestones: [{ title: '实现核心', status: 'done' }, { title: '检查边界', status: 'in-progress' }], updates: [{ date: '2026-10-12', title: '早期更新', accomplishments: ['完成核心逻辑'] }, { date: '2026-10-13', title: '最新更新', challenges: ['发现边界问题'], nextSteps: ['验证修复'] }], issues: [{ title: '开放问题', description: '仍需调查', status: 'open' }, { title: '已经解决', description: '复现的错误', status: 'resolved', resolution: '增加边界检查' }] };
project.sections[0].code = 'LongCodeLine_' + 'recorded_field_'.repeat(30);
project.milestones[0].title = '实现核心并验证较长阶段目标在手机上的阅读';
writeFileSync(join(isolated, 'src/modules/build/data.ts'), `import { publicProjects } from './projects.ts';\nexport const projects = publicProjects(${JSON.stringify([project])});\n`);
const astro = JSON.parse(readFileSync('node_modules/astro/package.json', 'utf8'));
execFileSync(process.execPath, [resolve('node_modules/astro', astro.bin.astro), 'build', '--base', '/personal-space/'], { cwd: isolated, stdio: 'inherit', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });
const output = join(isolated, 'dist');
writeFileSync('.cache/design-probe-output.txt', output);
const index = JSON.parse(readFileSync(join(output, 'search-index.json'), 'utf8'));
assert.equal(index.modules.find((module) => module.id === 'keep').count, 3);
assert.equal(index.results.filter((result) => result.module === 'keep').length, 3);
assert.equal(index.modules.find((module) => module.id === 'think').count, 2);
assert.equal(index.modules.find((module) => module.id === 'build').count, 1);
assert.equal(index.results.filter((result) => result.module === 'build').length, 1);
assert.deepEqual(snapshot('src'), before, 'Design fixtures must not change real source');
log(`Design fixture build passed: ${output}`);
