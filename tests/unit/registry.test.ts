import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRegistry, publicMetadata } from '../../src/core/module/registry.ts';
import { definitions } from '../fixtures/search.ts';

const definition = (id = 'sample', order = 0) => ({
  id, name: id, route: `/${id}/`, icon: 'M0 0', order,
  count: async () => 0, search: async () => [],
});

test('registry sorts unsorted exports and public metadata omits adapters', () => {
  const registry = createRegistry(Object.fromEntries([...definitions].reverse().map((module) => [`${module.id}/module.ts`, module])));
  assert.deepEqual(registry.map((module) => module.id), ['think', 'build', 'me', 'keep']);
  assert.ok(registry.every((module) => module.enabled));
  assert.ok(publicMetadata(registry).every((module) => !('count' in module) && !('search' in module)));
});

test('module order and enabled control the registry', () => {
  const registry = createRegistry({
    'z/module.ts': definition('z', 9),
    'a/module.ts': definition('a', -1),
    'hidden/module.ts': { ...definition('hidden', 4), enabled: false },
  });
  assert.deepEqual(registry.map((module) => module.id), ['a', 'z']);
});

test('invalid exports and contracts report actionable errors', () => {
  for (const value of [undefined, {}, { ...definition(), name: '' }, { ...definition(), count: 0 }]) {
    assert.throws(() => createRegistry({ 'sample/module.ts': value }), /Module sample/);
  }
  assert.throws(() => createRegistry({ 'wrong/module.ts': definition() }), /id must match/);
  assert.throws(() => createRegistry({ 'sample/module.ts': { ...definition(), route: '//external' } }), /local logical path/);
  assert.throws(() => createRegistry({ 'sample/module.ts': { ...definition(), enabled: 'false' } }), /enabled/);
  assert.throws(() => createRegistry({ 'sample/module.ts': { ...definition(), compassStatistic: 'sum' } }), /compassStatistic/);
});

test('Compass statistic declarations are serializable and disabled modules are excluded before averaging', () => {
  const registry = createRegistry({ 'sample/module.ts': { ...definition(), compassStatistic: 'peer-average' }, 'hidden/module.ts': { ...definition('hidden', 1), enabled: false } });
  assert.equal(registry.length, 1);
  assert.equal(publicMetadata(registry)[0].compassStatistic, 'peer-average');
  assert.equal(typeof publicMetadata(registry)[0].compassStatistic, 'string');
});

test('duplicate ids, normalized routes, and ambiguous order fail', () => {
  assert.throws(() => createRegistry({ 'a/sample/module.ts': definition(), 'b/sample/module.ts': definition('sample', 1) }), /duplicate id/);
  assert.throws(() => createRegistry({ 'a/module.ts': definition('a'), 'b/module.ts': { ...definition('b', 1), route: '/a' } }), /duplicate route/);
  assert.throws(() => createRegistry({ 'a/module.ts': definition('a'), 'b/module.ts': definition('b') }), /ambiguous order/);
});
