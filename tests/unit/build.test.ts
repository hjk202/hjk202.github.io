import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicProjects, type Project } from '../../src/modules/build/projects.ts';
import build from '../../src/modules/build/module.ts';

test('Build preserves project order, filters drafts and validates minimal data and web links', async () => {
  const project: Project = { slug: 'one', published: true, title: '项目', summary: '简介', sections: [{ paragraphs: ['说明'] }] };
  assert.deepEqual(publicProjects([]), []);
  assert.deepEqual(publicProjects([{ ...project, published: false }, { ...project, slug: 'omitted', published: undefined }]), []);
  assert.deepEqual(publicProjects([{ ...project, slug: 'z' }, project]).map((entry) => entry.slug), ['z', 'one']);
  assert.throws(() => publicProjects([project, project]), /duplicate slug/);
  assert.throws(() => publicProjects([{ ...project, slug: '../bad' }]), /slug/);
  assert.throws(() => publicProjects([{ ...project, sections: [] }]), /required/);
  assert.throws(() => publicProjects([{ ...project, published: 1 as unknown as boolean }]), /published/);
  assert.throws(() => publicProjects([{ ...project, links: [{ label: 'Bad', url: 'javascript:alert(1)' }] }]), /link/);
  assert.equal(publicProjects([{ ...project, links: [{ label: 'Repo', url: 'https://example.com/repo' }] }])[0].links?.[0].url, 'https://example.com/repo');
  assert.equal(await build.count(), 1);
  assert.equal((await build.search())[0].url, '/build/nemu/');
});

test('Build validates author-maintained stages, dates, updates and issues without inventing progress', async () => {
  const project: Project = { slug: 'fixture', published: true, title: '项目', summary: '目标', sections: [{ paragraphs: ['说明'] }], status: 'in-progress', milestones: [{ title: '阶段一', status: 'done' }, { title: '阶段二', status: 'in-progress' }], updates: [{ date: '2026-10-13', title: '更新', accomplishments: ['成果'], challenges: ['问题'], nextSteps: ['下一步'] }], issues: [{ title: '边界情况', description: '问题说明', status: 'open' }] };
  assert.deepEqual(publicProjects([project])[0], project);
  assert.throws(() => publicProjects([{ ...project, status: 'fake' as Project['status'] }]), /status/);
  assert.throws(() => publicProjects([{ ...project, milestones: [{ title: '', status: 'done' }] }]), /milestone/);
  assert.throws(() => publicProjects([{ ...project, updates: [{ date: '2026-02-30', title: '更新', accomplishments: ['成果'] }] }]), /update/);
  assert.throws(() => publicProjects([{ ...project, updates: [{ date: '2026-10-13', title: '空更新' }] }]), /update/);
  assert.throws(() => publicProjects([{ ...project, issues: [{ title: '问题', description: '', status: 'open' }] }]), /issue/);
  assert.equal(await build.count(), 1);
  assert.equal((await build.search()).length, 1);
});
