import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { startStudioHttp, StudioStartError } from '../../studio/server/http.ts';

function fixture(t: TestContext) {
  const cache = resolve('.cache/studio-m3');
  fs.mkdirSync(cache, { recursive: true });
  const root = fs.mkdtempSync(join(cache, 'unit-'));
  fs.mkdirSync(join(root, 'src/modules/think/content'), { recursive: true });
  const web = join(root, 'web'); fs.mkdirSync(web);
  fs.writeFileSync(join(web, 'index.html'), '<!doctype html><title>Fixture</title><!--studio-session-->');
  fs.writeFileSync(join(web, 'main.js'), '// STATIC_FIXTURE_ONLY');
  fs.writeFileSync(join(web, 'style.css'), 'body{color:black}');
  fs.writeFileSync(join(web, 'private.txt'), 'MUST_NOT_BE_SERVED');
  t.after(() => {
    assert.ok(relative(cache, root).startsWith('unit-') && !relative(cache, root).includes('..'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { root, web };
}

test('M3 serves only explicit immutable UI assets; root pairs securely and API still needs authentication', async t => {
  const { root, web } = fixture(t);
  const session = await startStudioHttp({ repositoryRoot: root, port: 0, webDirectory: web });
  try {
    const response = await fetch(session.origin);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.ok(html.includes('<title>Fixture</title>') && html.includes('id="studio-session"'));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok(response.headers.get('content-security-policy')?.includes("script-src 'self'"));
    const asset = await fetch(session.origin + '/studio-assets/main.js');
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type')!, /text\/javascript/);
    assert.equal(await asset.text(), '// STATIC_FIXTURE_ONLY');
    fs.writeFileSync(join(web, 'main.js'), 'CHANGED_AFTER_STARTUP');
    assert.equal(await (await fetch(session.origin + '/studio-assets/main.js')).text(), '// STATIC_FIXTURE_ONLY');
    for (const path of ['/studio-assets/private.txt', '/studio-assets/main.js?path=private.txt', '/studio-assets/%2e%2e/private.txt', '/web/private.txt', '/api/authoring/v1/think/documents']) {
      assert.equal((await fetch(session.origin + path)).status, 401);
    }
    assert.equal((await fetch(session.origin + '/studio-assets/main.js', { headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await fetch(session.origin, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  } finally { await session.close(); }
});

test('M3 missing/unsafe build fails before acquiring a lease without printing filesystem details', async t => {
  const { root, web } = fixture(t);
  const rejects = () => assert.rejects(startStudioHttp({ repositoryRoot: root, port: 0, webDirectory: web }), error => error instanceof StudioStartError && error.code === 'WEB_BUILD_UNAVAILABLE' && !error.message.includes(root));
  fs.writeFileSync(join(web, 'index.html'), 'missing session injection point');
  await rejects();
  assert.equal(fs.existsSync(join(root, '.cache/studio/think-authoring.lock')), false);
  fs.writeFileSync(join(web, 'index.html'), '<!--studio-session-->');
  fs.unlinkSync(join(web, 'main.js'));
  fs.linkSync(join(web, 'private.txt'), join(web, 'main.js'));
  await rejects();
  fs.unlinkSync(join(web, 'main.js'));
  fs.mkdirSync(join(web, 'main.js'));
  await rejects();
});
