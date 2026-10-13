import assert from 'node:assert/strict';
import { test } from 'node:test';
import { search } from '../../src/core/search/search.ts';
import { buildPublicData } from '../../src/core/search/build.ts';
import { createRegistry } from '../../src/core/module/registry.ts';
import type { SearchIndex } from '../../src/core/search/types.ts';
import { definitions } from '../fixtures/search.ts';
const [think, build, me, keep] = definitions;

const registry = createRegistry(Object.fromEntries([think, build, me, keep].map((module) => [`${module.id}/module.ts`, module])));
test('public snapshot preserves fixture counts and projects only public fields', async () => {
  const urls = new Set((await Promise.all(registry.map((module) => module.search()))).flat().map((result) => result.url));
  const index = await buildPublicData(registry, urls);
  assert.deepEqual(index.modules.map((module) => module.count), [2, 1, 1, 2]);
  assert.equal(index.results.length, 6);
  assert.ok(index.results.every((result) => Object.keys(result).sort().join() === 'description,module,title,url'));
  assert.deepEqual(search('  ThInK ', index).map((result) => result.url)[0], '/think/');
  assert.equal(search('留白', index)[0].url, '/keep/space/');
  assert.equal(search('微小', index)[0].url, '/think/observations/');
  assert.equal(search('  ', index).length, 4);
  assert.deepEqual(search('absent xyz', index), []);
});

test('ranking is exact, prefix, title substring, description; ties stable and URL deduplicated', () => {
  const index: SearchIndex = {
    modules: [{ ...think, count: 2 }, { ...build, count: 1 }],
    results: [
      { title: 'Other', description: 'space', url: '/think/d/', module: 'think' },
      { title: 'A space', description: '', url: '/think/c/', module: 'think' },
      { title: 'Space start', description: '', url: '/build/b/', module: 'build' },
      { title: 'Space', description: '', url: '/think/a/', module: 'think' },
      { title: 'Space start', description: '', url: '/think/b/', module: 'think' },
      { title: 'Space', description: '', url: '/think/a/', module: 'think' },
    ],
  };
  const expected = ['/think/a/', '/think/b/', '/build/b/', '/think/c/', '/think/d/'];
  assert.deepEqual(search('space', index).map((result) => result.url), expected);
  index.results.reverse();
  assert.deepEqual(search('space', index).map((result) => result.url), expected);
});

test('invalid counts, failed adapters, and non-generated search targets fail clearly', async () => {
  for (const count of [-1, 1.5, NaN, Infinity]) await assert.rejects(buildPublicData([{ ...registry[0], count: async () => count }], new Set()), /count must/);
  await assert.rejects(buildPublicData([{ ...registry[0], search: async () => { throw new Error('adapter failed'); } }], new Set()), /Module think.*adapter failed/);
  await assert.rejects(buildPublicData([registry[0]], new Set()), /generated page/);
});
