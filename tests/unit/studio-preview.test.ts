import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { createThinkPreview } from '../../studio/server/think/preview.ts';
import { projectThinkPreview } from '../../studio/server/think/preview-html.ts';
import { openThinkAuthoring } from '../../studio/server/think/service.ts';
import { startStudioHttp } from '../../studio/server/http.ts';
import { THINK_API, STUDIO_TOKEN_HEADER } from '../../studio/contracts/http.ts';

function setup(t: TestContext) {
  const cache = resolve('.cache/studio-m4'); fs.mkdirSync(cache, { recursive: true });
  const root = fs.mkdtempSync(join(cache, 'unit-'));
  t.after(() => { assert.ok(relative(cache, root).startsWith('unit-') && !relative(cache, root).includes('..')); fs.rmSync(root, { recursive: true, force: true }); });
  return root;
}

test('M4 projection rebuilds an inert article with genuine CSS/code/formula and sanitized local SVG', t => {
  const root = setup(t); fs.mkdirSync(join(root, 'think/test'), { recursive: true });
  fs.writeFileSync(join(root, 'probe.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="#abc"/><script>leak()</script><foreignObject>unsafe</foreignObject><image href="https://evil.example/x"/></svg>');
  fs.writeFileSync(join(root, 'think/test/index.html'), '<!doctype html><html><head><style>.fraction{color:red}</style><script>HEAD_SECRET</script></head><body><article class="think-article" data-astro-cid-abc><div role="math" class="fraction">√d</div><pre><code>&lt;tag&gt; &amp; 中文</code></pre><img src="/probe.svg" alt="本地图片"><img src="https://evil.example/x"><script>PARENT_SECRET</script><iframe src="/api/authoring/v1/think/documents"></iframe><form action="/api"><input></form><a href="javascript:leak()">link</a><p onclick="leak()" style="background:url(https://evil.example)">text</p></article></body></html>');
  fs.writeFileSync(join(root, 'think/test/index.html'), fs.readFileSync(join(root, 'think/test/index.html'), 'utf8').replace('.fraction{color:red}', '.fraction{color:red}@media(width<=600px){.fraction{font-size:16px}}'));
  const projected = projectThinkPreview(root, 'test', '/');
  assert.equal(projected.blockedResources, 1);
  for (const value of ['.fraction{color:red}', '@media(width<=600px)', 'role="math"', '&lt;tag&gt; &amp; 中文', 'data:image/svg+xml;base64,']) {
    assert.ok(projected.html.includes(value), value);
  }
  assert.ok(!/PARENT_SECRET|HEAD_SECRET|<script|<iframe|<form|onclick|javascript:|background:url/.test(projected.html));
  const encoded = /data:image\/svg\+xml;base64,([^" ]+)/.exec(projected.html)![1]!;
  const svg = Buffer.from(encoded, 'base64').toString();
  assert.ok(svg.includes('<rect'));
  assert.ok(!/script|foreignObject|image|https:\/\/evil/.test(svg));
});

test('M4 projection refuses CSS imports and local resource traversal', t => {
  const parent = setup(t), root = join(parent, 'output'); fs.mkdirSync(join(root, 'think/test'), { recursive: true });
  fs.writeFileSync(join(parent, 'outside.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><text>OUTSIDE_SOURCE</text></svg>');
  fs.writeFileSync(join(root, 'think/test/index.html'), '<head><style>@import "https://evil.example/x";</style></head><article class="think-article">body</article>');
  assert.throws(() => projectThinkPreview(root, 'test', '/'), { code: 'PREVIEW_RESOURCE_BLOCKED' });
  for (const src of ['/%2e%2e%2foutside.svg', '/%2e%2e%5coutside.svg', '/C:%5coutside.svg']) {
    fs.writeFileSync(join(root, 'think/test/index.html'), `<head><style>body{color:red}</style></head><article class="think-article"><img src="${src}"></article>`);
    const result = projectThinkPreview(root, 'test', '/');
    assert.equal(result.blockedResources, 1); assert.ok(!result.html.includes('OUTSIDE_SOURCE'));
  }
  fs.writeFileSync(join(root, 'think/test/index.html'), 'x'.repeat(8 * 1024 * 1024 + 1));
  assert.throws(() => projectThinkPreview(root, 'test', '/'), { code: 'PREVIEW_TOO_LARGE' });
});

test('M4 requires readiness/strict envelopes; bounded build times out, rejects concurrent work and cleans its owned directory', async t => {
  const root = setup(t); fs.cpSync('src', join(root, 'src'), { recursive: true }); fs.cpSync('public', join(root, 'public'), { recursive: true });
  for (const file of ['package.json', 'astro.config.mjs', 'tsconfig.json']) fs.copyFileSync(file, join(root, file));
  const opened = openThinkAuthoring(root); assert.ok(opened.ok); const service = opened.value;
  const preview = createThinkPreview(service, { repositoryRoot: root, timeoutMs: 1 });
  const draft = { metadata: { slug: 'preview-only' }, body: '' };
  const incomplete = await preview.previewThink({ document: draft }); assert.ok(!incomplete.ok); assert.equal(incomplete.error.code, 'PREVIEW_NOT_READY');
  const invalid = await preview.previewThink({ document: draft, path: '../escape' }); assert.ok(!invalid.ok); assert.equal(invalid.error.code, 'INVALID_REQUEST');
  const document = { metadata: { slug: 'preview-only', title: '非敏感', summary: '隔离构建', date: '2026-10-16', published: false }, body: '\n正文\n' };
  try {
    const first = preview.previewThink({ document });
    const busy = await preview.previewThink({ document }); assert.ok(!busy.ok); assert.equal(busy.error.code, 'AUTHORING_BUSY');
    const result = await first; assert.ok(!result.ok); assert.equal(result.error.code, 'PREVIEW_TIMEOUT');
    assert.deepEqual(fs.readdirSync(join(root, '.cache/studio/preview')), []);
    assert.equal(fs.existsSync(join(root, 'src/modules/think/content/preview-only.md')), false);
  } finally { await preview.close(); service.close(); }
  const closed = await preview.previewThink({ document }); assert.ok(!closed.ok); assert.equal(closed.error.code, 'SERVICE_CLOSED');
});

test('M4 HTTP preview requires the same session and rejects paths/query/unknown input before building', async t => {
  const root = setup(t), content = join(root, 'src/modules/think/content'); fs.mkdirSync(content, { recursive: true });
  const session = await startStudioHttp({ repositoryRoot: root, port: 0 });
  const endpoint = session.origin + THINK_API + '/preview';
  try {
    const anonymous = await fetch(endpoint, { method: 'POST' });
    assert.equal(anonymous.status, 401); assert.equal((await anonymous.json()).error.code, 'UNAUTHORIZED');
    const headers = { [STUDIO_TOKEN_HEADER]: session.token, 'Content-Type': 'application/json' };
    const document = { metadata: { slug: 'not-yet-created', published: false }, body: '' };
    for (const [url, input] of [[endpoint, { document, path: '../outside.md' }], [endpoint + '?status=all', { document }]] as const) {
      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(input) });
      assert.equal(response.status, 400); assert.equal((await response.json()).error.code, 'INVALID_REQUEST');
    }
    const incomplete = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ document }) });
    assert.equal(incomplete.status, 422); assert.equal((await incomplete.json()).error.code, 'PREVIEW_NOT_READY');
    assert.deepEqual(fs.readdirSync(content), []);
    assert.equal(fs.existsSync(join(root, '.cache/studio/preview')), false);
  } finally { assert.ok((await session.close()).ok); }
});
