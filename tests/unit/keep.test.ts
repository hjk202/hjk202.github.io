import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicBookmarks, bookmarkGroups, type Bookmark } from '../../src/modules/keep/bookmarks.ts';
import keep from '../../src/modules/keep/module.ts';

test('Keep validates sources, preserves order and excludes unpublished collections', async () => {
  const bookmark: Bookmark = { slug: 'one', title: '收藏', description: '简介', published: true, sourceUrl: 'https://example.com/', note: ['说明'] };
  assert.deepEqual(publicBookmarks([]), []);
  assert.deepEqual(publicBookmarks([{ ...bookmark, published: false }, { ...bookmark, slug: 'omitted', published: undefined }]), []);
  assert.deepEqual(publicBookmarks([{ ...bookmark, slug: 'z' }, bookmark]).map((item) => item.slug), ['z', 'one']);
  assert.throws(() => publicBookmarks([bookmark, bookmark]), /duplicate slug/);
  assert.throws(() => publicBookmarks([{ ...bookmark, slug: '../bad' }]), /slug/);
  assert.throws(() => publicBookmarks([{ ...bookmark, note: [] }]), /required/);
  assert.throws(() => publicBookmarks([{ ...bookmark, published: 'yes' as unknown as boolean }]), /published/);
  for (const sourceUrl of ['javascript:alert(1)', 'file:///secret', 'https://', '/relative']) assert.throws(() => publicBookmarks([{ ...bookmark, sourceUrl }]), /source URL/);
  assert.equal(await keep.count(), 1);
  assert.equal((await keep.search())[0].url, '/keep/missing-semester/');
  assert.equal(publicBookmarks([bookmark])[0].sourceUrl, 'https://example.com/');
});

test('Keep groups only real resources and validates category identities', () => {
  const entry: Bookmark = { slug: 'one', title: '资源', description: '用途', published: true, sourceUrl: 'https://example.com', note: ['说明'], category: { id: 'tools', label: '工具' } };
  const entries = publicBookmarks([entry, { ...entry, slug: 'two', category: { id: 'systems', label: '系统' } }, { ...entry, slug: 'three', published: false }]);
  assert.deepEqual(bookmarkGroups(entries).map((g) => [g.id, g.entries.length]), [['tools', 1], ['systems', 1]]);
  assert.deepEqual(bookmarkGroups([]), []);
  assert.equal(bookmarkGroups([{ ...entry, category: undefined }])[0].label, '未分类');
  assert.throws(() => publicBookmarks([{ ...entry, category: { id: '../x', label: '错误' } }]), /category/);
  assert.throws(() => publicBookmarks([{ ...entry, category: { id: 'all', label: '全部' } }]), /category/);
  assert.throws(() => bookmarkGroups([entry, { ...entry, slug: 'two', category: { id: 'tools', label: '其他' } }]), /inconsistent/);
});
