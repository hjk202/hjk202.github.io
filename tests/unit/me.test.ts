import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicProfile, type Profile } from '../../src/modules/me/profile.ts';
import me from '../../src/modules/me/module.ts';

test('Me only exposes explicitly published valid profiles and optional web links', async () => {
  const profile: Profile = { published: true, name: '名字', description: '简介', paragraphs: ['正文'] };
  assert.equal(publicProfile(null), null);
  assert.equal(publicProfile({ ...profile, published: false }), null);
  assert.equal(publicProfile({ ...profile, published: undefined }), null);
  assert.equal(publicProfile(profile)?.name, '名字');
  assert.throws(() => publicProfile({ ...profile, name: '' }), /Me:/);
  assert.throws(() => publicProfile({ ...profile, published: 'yes' as unknown as boolean }), /published/);
  assert.throws(() => publicProfile({ ...profile, links: [{ label: 'Bad', url: 'javascript:alert(1)' }] }), /link/);
  assert.equal(publicProfile({ ...profile, links: [{ label: 'Site', url: 'https://example.com/' }] })?.links?.[0].url, 'https://example.com/');
  assert.equal(await me.count(), 1);
  assert.deepEqual((await me.search()).map((result) => [result.title, result.url]), [['韩江恺', '/me/']]);
});
