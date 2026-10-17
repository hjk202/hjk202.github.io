import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { join, relative, resolve } from 'node:path';
import { log } from 'node:console';
import { chromium, webkit } from '@playwright/test';
import { THINK_API, STUDIO_TOKEN_HEADER } from '../../studio/contracts/http.ts';
import { startStudioHttp } from '../../studio/server/http.ts';

/* global document, fetch, localStorage, sessionStorage -- callbacks execute in browser pages */

const cache = resolve('.cache/studio-m2');
fs.mkdirSync(cache, { recursive: true });
const root = fs.mkdtempSync(join(cache, 'browser-'));
const content = join(root, 'src/modules/think/content');
fs.mkdirSync(content, { recursive: true });
const session = await startStudioHttp({ repositoryRoot: root, port: 0 });
const attacker = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><title>Cross-site fixture</title><p>Non-sensitive security fixture</p>');
});
await new Promise(resolve => attacker.listen(0, '127.0.0.1', resolve));
const hostileOrigin = `http://localhost:${attacker.address().port}`;
const results = [];
try {
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch();
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      const pageerrors = [], failedRequests = [], responses = [];
      page.on('pageerror', error => pageerrors.push(error.message));
      page.on('requestfailed', request => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText }));
      page.on('response', response => { if (response.url().startsWith(session.origin)) responses.push({ url: response.url(), status: response.status() }); });
      assert.equal((await page.goto(session.origin)).status(), 200);
      assert.ok((await page.locator('body').innerText()).includes('本机 API 配对入口'));
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      assert.equal((await context.cookies()).length, 0);
      const request = async (method, suffix, body) => page.evaluate(async ({ method, suffix, body, api, header }) => {
        const pairing = JSON.parse(document.querySelector('#studio-session').textContent);
        const response = await fetch(api + suffix, { method, headers: { [header]: pairing.token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
        return { status: response.status, result: await response.json() };
      }, { method, suffix, body, api: THINK_API, header: STUDIO_TOKEN_HEADER });
      const slug = 'browser-' + name;
      const created = await request('POST', '/documents', { document: { metadata: { slug }, body: '\n浏览器正文\n' } });
      assert.equal(created.status, 201);
      const { key, revision } = created.result.value;
      const read = await request('GET', '/documents/' + key);
      assert.equal(read.result.value.document.metadata.published, false);
      const saved = await request('PUT', '/documents/' + key, { expectedRevision: revision, document: { metadata: { slug, title: '修改标题' }, body: '\n浏览器更新\n' } });
      assert.equal(saved.status, 200);
      const conflict = await request('DELETE', '/documents/' + key, { expectedRevision: revision });
      assert.equal(conflict.status, 409);
      assert.equal((await request('POST', '/validate', { document: { metadata: { slug: 'check' }, body: '' } })).result.value.canSave, true);
      assert.equal((await request('GET', '/documents?status=draft')).result.value.length, 1);
      const unauthenticated = await page.evaluate(async api => ({ status: (await fetch(api + '/documents')).status }), THINK_API);
      assert.equal(unauthenticated.status, 401);
      await page.screenshot({ path: join(cache, 'pairing-' + name + '.png'), fullPage: true });
      const bytes = fs.readFileSync(join(content, slug + '.md'));
      assert.deepEqual(pageerrors, []);

      // An unrelated web origin cannot pair, read drafts or submit a simple CSRF form.
      const hostile = await context.newPage();
      hostile.on('pageerror', error => pageerrors.push(error.message));
      await hostile.goto(hostileOrigin);
      const attacks = await hostile.evaluate(async ({ origin, api, header, token }) => {
        const attempt = async (path, options = {}) => {
          try { const response = await fetch(origin + path, options); return { readable: response.type !== 'opaque', status: response.status }; }
          catch { return { readable: false, status: 0 }; }
        };
        return [
          await attempt('/'), await attempt(api + '/documents'),
          await attempt(api + '/documents', { headers: { [header]: token } }),
          await attempt(api + '/documents', { method: 'POST', headers: { 'Content-Type': 'application/json', [header]: token }, body: JSON.stringify({ document: { metadata: { slug: 'csrf' }, body: '' } }) }),
          await attempt(api + '/documents', { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: '{"document":{"metadata":{"slug":"csrf"},"body":""}}' }),
        ];
      }, { origin: session.origin, api: THINK_API, header: STUDIO_TOKEN_HEADER, token: session.token });
      assert.ok(attacks.every(attack => attack.readable === false));
      const form = await context.newPage();
      form.on('pageerror', error => pageerrors.push(error.message));
      await form.goto(hostileOrigin);
      await form.evaluate(({ origin, api }) => {
        const element = document.createElement('form');
        element.method = 'POST'; element.action = origin + api + '/documents';
        const input = document.createElement('input'); input.name = 'document'; input.value = 'csrf';
        element.append(input); document.body.append(element); element.submit();
      }, { origin: session.origin, api: THINK_API });
      await form.waitForURL(session.origin + THINK_API + '/documents');
      assert.ok((await form.locator('body').innerText()).includes('FORBIDDEN'));
      // Cross-site top-level pairing navigation is rejected too (no credential delivery).
      const crossPair = await context.newPage();
      crossPair.on('pageerror', error => pageerrors.push(error.message));
      await crossPair.goto(hostileOrigin);
      await crossPair.evaluate(origin => { const a = document.createElement('a'); a.href = origin; a.textContent = 'Pair'; document.body.append(a); }, session.origin);
      await crossPair.getByRole('link', { name: 'Pair' }).click();
      await crossPair.waitForURL(session.origin + '/');
      assert.equal(await crossPair.locator('#studio-session').count(), 0);
      assert.ok((await crossPair.locator('body').innerText()).includes('FORBIDDEN'));
      assert.deepEqual(fs.readFileSync(join(content, slug + '.md')), bytes);
      assert.deepEqual(fs.readdirSync(content), [slug + '.md']);
      assert.equal((await request('DELETE', '/documents/' + key, { expectedRevision: saved.result.value.revision })).status, 200);
      assert.deepEqual(fs.readdirSync(content), []);
      // WebKit reports even caught, deliberately denied CORS fetches as pageerror.
      // Keep every error in evidence and assert their count/targets; never filter them out.
      assert.equal(pageerrors.length, name === 'webkit' ? 5 : 0);
      assert.ok(pageerrors.every(message => /^.*127\.0\.0\.1:\d+\/(?:api\/authoring\/v1\/think\/documents)? due to access control checks\.$/.test(message)));
      assert.ok(failedRequests.length === 0); // Only trusted page traffic: hostile CORS failures are intentional.
      results.push({ engine: name, crud: true, revisionConflict: true, noPersistentCredentials: true, crossOriginDenied: attacks.length, csrfFormDenied: true, crossSitePairingDenied: true, pageerrors, trustedFailedRequests: failedRequests, responses });
      await context.close();
    } finally { await browser.close(); }
  }
  fs.writeFileSync(join(cache, 'http-browser.json'), JSON.stringify(results, null, 2));
  log('M2 browser HTTP/security smoke: 2 engines passed; all pageerrors recorded (WebKit: 5 expected CORS denials). Evidence: .cache/studio-m2/http-browser.json');
} finally {
  await session.close();
  await new Promise(resolve => attacker.close(resolve));
  attacker.closeAllConnections();
  assert.ok(relative(cache, root).startsWith('browser-') && !relative(cache, root).includes('..'));
  fs.rmSync(root, { recursive: true, force: true });
}
