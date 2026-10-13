import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectPages } from '../../src/core/module/pages.ts';
import { createRegistry } from '../../src/core/module/registry.ts';
import { withBase } from '../../src/core/module/urls.ts';
import type { ModulePage } from '../../src/core/module/types.ts';

const module = { id: 'sample', name: 'Sample', route: '/sample/', order: 0, icon: 'M0 0', count: async () => 0, search: async () => [] };
const modules = createRegistry({ 'sample/module.ts': module });
const page = { path: '', component: (() => {}) as unknown as ModulePage['component'], props: {} };
test('module and content pages have stable URLs; disabled modules produce no routes', () => {
  const adapters = { 'sample/pages.ts': [page, { ...page, path: 'note' }] };
  assert.deepEqual(collectPages(modules, adapters).map((entry) => entry.url), ['/sample/', '/sample/note/']);
  assert.deepEqual(collectPages(createRegistry({ 'sample/module.ts': { ...module, enabled: false } }), adapters), []);
});
test('missing, invalid, duplicate and escaping page paths fail', () => {
  assert.throws(() => collectPages(modules, {}), /missing or invalid/);
  assert.throws(() => collectPages(modules, { 'sample/pages.ts': [] }), /missing module home/);
  assert.throws(() => collectPages(modules, { 'sample/pages.ts': [page, page] }), /Duplicate/);
  for (const path of ['../outside', '/outside', 'a/../../b', 'a%2fb']) {
    assert.throws(() => collectPages(modules, { 'sample/pages.ts': [page, { ...page, path }] }), /inside the module/);
  }
  assert.throws(() => collectPages(modules, { 'sample/pages.ts': [{ ...page, component: null }] }), /invalid page/);
});
test('logical URLs receive the deployment base exactly once', () => {
  assert.equal(withBase('/think/'), '/think/');
  assert.equal(withBase('/think/note/', '/personal-space/'), '/personal-space/think/note/');
  assert.equal(withBase('/', '/personal-space'), '/personal-space/');
  assert.equal(withBase('/search-index.json', '/personal-space/'), '/personal-space/search-index.json');
  for (const path of ['https://example.com', '//example.com', '/../outside', '/a\\b']) assert.throws(() => withBase(path));
});
