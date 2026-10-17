import assert from 'node:assert/strict';
import fs from 'node:fs';
import { request as httpRequest } from 'node:http';
import type { IncomingHttpHeaders } from 'node:http';
import { connect } from 'node:net';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { fork } from 'node:child_process';
import { BODY_TIMEOUT_MS, MAX_REQUEST_BYTES, STUDIO_TOKEN_HEADER, THINK_API } from '../../studio/contracts/http.ts';
import type { HttpResult } from '../../studio/contracts/http.ts';
import type { ThinkDocument, ThinkReadResult, ThinkSummary, ThinkWriteResult, ValidationReport } from '../../studio/contracts/think.ts';
import { startStudioHttp, StudioStartError } from '../../studio/server/http.ts';
import type { StudioHttpSession } from '../../studio/server/http.ts';

const cache = resolve('.cache/studio-m2');
const draft = (slug: string): ThinkDocument => ({ metadata: { slug }, body: '' });
const published = (slug: string): ThinkDocument => ({ metadata: { slug, title: 'HTTP 隔离样本', summary: '不含私人资料', date: '2026-10-16', published: true, kind: 'note' }, body: '\n## HTTP 正文\n' });
type Reply<T> = { status: number; data: HttpResult<T>; headers: IncomingHttpHeaders; text: string };
function value<T>(reply: Reply<T>, status = 200): T {
  assert.equal(reply.status, status);
  if (!reply.data.ok) assert.fail(reply.data.error.code);
  return reply.data.value;
}
function failure(reply: Reply<unknown>, status: number, code: string) {
  assert.equal(reply.status, status);
  assert.equal(reply.data.ok, false);
  if (!reply.data.ok) assert.equal(reply.data.error.code, code);
}
function call<T = unknown>(session: StudioHttpSession, method: string, path: string, body?: unknown, extra: { token?: string; headers?: Record<string, string> | string[]; raw?: Buffer } = {}): Promise<Reply<T>> {
  const raw = extra.raw ?? (body === undefined ? undefined : Buffer.from(JSON.stringify(body)));
  const defaults = { [STUDIO_TOKEN_HEADER]: extra.token ?? session.token, ...(raw ? { 'Content-Type': 'application/json', ...(!Array.isArray(extra.headers) && extra.headers?.['Transfer-Encoding'] ? {} : { 'Content-Length': String(raw.length) }) } : {}) };
  const headers = Array.isArray(extra.headers) ? extra.headers : { ...defaults, ...extra.headers };
  return new Promise((resolve, reject) => {
    const req = httpRequest(session.origin, { method, path, headers }, res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.once('error', reject);
      res.once('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode!, data: JSON.parse(text) as HttpResult<T>, headers: res.headers, text }); }
        catch { reject(new Error(`Expected JSON for ${method} ${path}; status ${res.statusCode} (content redacted)`)); }
      });
    });
    req.once('error', reject);
    req.end(raw);
  });
}
async function setup(t: TestContext) {
  fs.mkdirSync(cache, { recursive: true });
  const root = fs.mkdtempSync(join(cache, 'unit-'));
  const content = join(root, 'src/modules/think/content');
  fs.mkdirSync(content, { recursive: true });
  fs.writeFileSync(join(content, 'existing.md'), '---\nslug: existing\n---\nEXISTING_BYTES\n');
  const sessions: StudioHttpSession[] = [];
  const open = async (port = 0) => { const session = await startStudioHttp({ repositoryRoot: root, port }); sessions.push(session); return session; };
  t.after(async () => {
    for (const session of sessions) await session.close();
    assert.ok(relative(cache, root).startsWith('unit-') && !relative(cache, root).includes('..'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { root, content, open, session: await open() };
}

test('M2 real HTTP CRUD, validation, filters, stale revision and external edit preserve source of truth', async t => {
  const { session, content } = await setup(t);
  const original = fs.readFileSync(join(content, 'existing.md'));
  const created = value(await call<ThinkWriteResult>(session, 'POST', THINK_API + '/documents', { document: draft('http-draft') }), 201);
  const read = value(await call<ThinkReadResult>(session, 'GET', THINK_API + '/documents/' + created.key));
  assert.equal(read.document?.metadata.published, false);
  assert.equal(read.document?.metadata.kind, 'article');
  const summaries = value(await call<ThinkSummary[]>(session, 'GET', THINK_API + '/documents?status=draft'));
  assert.equal(summaries.length, 2);
  assert.ok(summaries.every(entry => !Object.hasOwn(entry, 'document') && !Object.hasOwn(entry, 'body')));
  const incomplete = value(await call<ValidationReport>(session, 'POST', THINK_API + '/validate', { document: draft('check-only') }));
  assert.equal(incomplete.canSave, true);
  assert.equal(incomplete.publishReady, false);
  const invalid = value(await call<ValidationReport>(session, 'POST', THINK_API + '/validate', { document: { ...draft('check-only'), extra: true } }));
  assert.equal(invalid.canSave, false);
  assert.equal(fs.existsSync(join(content, 'check-only.md')), false);
  failure(await call(session, 'POST', THINK_API + '/documents', { document: draft('http-draft') }), 409, 'DUPLICATE_SLUG');
  const updated = value(await call<ThinkWriteResult>(session, 'PUT', THINK_API + '/documents/' + created.key, { expectedRevision: read.revision, document: published('http-draft') }));
  assert.ok(updated.revision !== read.revision);
  assert.equal(value(await call<ThinkSummary[]>(session, 'GET', THINK_API + '/documents?status=published')).length, 1);
  const beforeConflict = fs.readFileSync(join(content, 'http-draft.md'));
  failure(await call(session, 'PUT', THINK_API + '/documents/' + created.key, { expectedRevision: read.revision, document: draft('http-draft') }), 409, 'REVISION_CONFLICT');
  failure(await call(session, 'DELETE', THINK_API + '/documents/' + created.key, { expectedRevision: read.revision }), 409, 'REVISION_CONFLICT');
  assert.deepEqual(fs.readFileSync(join(content, 'http-draft.md')), beforeConflict);
  fs.appendFileSync(join(content, 'http-draft.md'), '\n外部修改\n');
  failure(await call(session, 'DELETE', THINK_API + '/documents/' + created.key, { expectedRevision: updated.revision }), 409, 'REVISION_CONFLICT');
  const refreshed = value(await call<ThinkReadResult>(session, 'GET', THINK_API + '/documents/' + created.key));
  value(await call(session, 'DELETE', THINK_API + '/documents/' + created.key, { expectedRevision: refreshed.revision }));
  failure(await call(session, 'GET', THINK_API + '/documents/' + created.key), 404, 'NOT_FOUND');
  assert.deepEqual(fs.readFileSync(join(content, 'existing.md')), original);
});

test('M2 every content operation requires a token and rejects hostile/duplicate Host or Origin', async t => {
  const { session, content } = await setup(t);
  const key = value(await call<ThinkSummary[]>(session, 'GET', THINK_API + '/documents'))[0]!.key;
  for (const [method, path, body] of [
    ['GET', '/documents', undefined], ['GET', '/documents/' + key, undefined],
    ['POST', '/documents', { document: draft('forbidden') }], ['PUT', '/documents/' + key, {}],
    ['DELETE', '/documents/' + key, {}], ['POST', '/validate', { document: draft('forbidden') }],
  ] as const) failure(await call(session, method, THINK_API + path, body, { token: '' }), 401, 'UNAUTHORIZED');
  const hostileHeaders: Record<string, string>[] = [
    { Host: 'localhost:' + new URL(session.origin).port }, { Host: 'evil.example' }, { Origin: 'https://evil.example' },
    { Origin: 'null' }, { Origin: session.origin + '/' }, { Origin: session.origin + '.evil.example' },
    { 'Sec-Fetch-Site': 'cross-site' }, { 'Sec-Fetch-Site': 'same-site' },
  ];
  for (const headers of hostileHeaders) failure(await call(session, 'GET', THINK_API + '/documents', undefined, { headers }), 403, 'FORBIDDEN');
  const host = new URL(session.origin).host;
  for (const duplicate of [
    ['Host', host, 'Host', host, STUDIO_TOKEN_HEADER, session.token],
    ['Host', host, 'Origin', session.origin, 'Origin', session.origin, STUDIO_TOKEN_HEADER, session.token],
    ['Host', host, 'Sec-Fetch-Site', 'cross-site', 'Sec-Fetch-Site', 'none', STUDIO_TOKEN_HEADER, session.token],
  ]) failure(await call(session, 'GET', THINK_API + '/documents', undefined, { headers: duplicate }), 403, 'FORBIDDEN');
  failure(await call(session, 'GET', THINK_API + '/documents', undefined, { headers: ['Host', host, STUDIO_TOKEN_HEADER, session.token, STUDIO_TOKEN_HEADER, session.token] }), 401, 'UNAUTHORIZED');
  const allowed = await call(session, 'GET', THINK_API + '/documents', undefined, { headers: { Origin: session.origin, 'Sec-Fetch-Site': 'same-origin' } });
  value(allowed);
  assert.equal(allowed.headers['access-control-allow-origin'], undefined);
  assert.equal(allowed.headers['cache-control'], 'no-store');
  assert.deepEqual(fs.readdirSync(content), ['existing.md']);
});

test('M2 rejects invalid envelopes, route/path tricks, media, bad JSON and invalid UTF-8 without mutation', async t => {
  const { session, content, root } = await setup(t);
  const before = fs.readFileSync(join(content, 'existing.md'));
  const entry = value(await call<ThinkSummary[]>(session, 'GET', THINK_API + '/documents'))[0]!;
  const documents = THINK_API + '/documents';
  for (const body of [null, [], {}, { document: draft('no-write'), path: '../escape.md' }, { document: draft('no-write'), repositoryRoot: root }]) {
    const reply = await call(session, 'POST', documents, body);
    assert.ok([400, 422].includes(reply.status));
  }
  for (const body of [{ document: draft('existing'), expectedRevision: entry.revision, key: entry.key }, { document: draft('existing'), fileName: 'elsewhere.md' }]) failure(await call(session, 'PUT', documents + '/' + entry.key, body), 400, 'INVALID_REQUEST');
  failure(await call(session, 'DELETE', documents + '/' + entry.key, { expectedRevision: entry.revision, path: 'existing.md' }), 400, 'INVALID_REQUEST');
  failure(await call(session, 'PUT', documents + '/' + entry.key, { document: draft('existing') }), 400, 'INVALID_REQUEST');
  failure(await call(session, 'POST', documents, { document: { ...draft('no-write'), metadata: { slug: 'no-write', published: 'true' } } }), 422, 'VALIDATION_FAILED');
  for (const raw of [Buffer.from('{'), Buffer.from('{"document":null} trailing'), Buffer.from([0xff])]) failure(await call(session, 'POST', documents, undefined, { raw }), 400, 'INVALID_REQUEST');
  const mediaHeaders: Record<string, string>[] = [{ 'Content-Type': 'text/plain' }, { 'Content-Type': 'application/x-www-form-urlencoded' }, { 'Content-Encoding': 'gzip' }];
  for (const headers of mediaHeaders) failure(await call(session, 'POST', documents, { document: draft('no-write') }, { headers }), 415, 'UNSUPPORTED_MEDIA_TYPE');
  for (const path of [documents + '?root=x', documents + '?status=draft&status=all', documents + '?status=nope']) failure(await call(session, 'GET', path), 400, 'INVALID_REQUEST');
  for (const path of ['/src/modules/think/content/existing.md', '/.git/config', '/package.json', 'http://evil.example' + documents]) failure(await call(session, 'GET', path), 404, 'NOT_FOUND');
  failure(await call(session, 'GET', THINK_API + '/preview'), 405, 'METHOD_NOT_ALLOWED');
  for (const key of ['..%2Fexisting.md', 'C%3Afile', '%2e%2e', 'invalid-key']) failure(await call(session, 'GET', documents + '/' + key), 400, 'INVALID_REQUEST');
  failure(await call(session, 'OPTIONS', documents), 405, 'METHOD_NOT_ALLOWED');
  failure(await call(session, 'PATCH', documents), 405, 'METHOD_NOT_ALLOWED');
  failure(await call(session, 'POST', documents, undefined, { headers: { Expect: '100-continue' } }), 400, 'INVALID_REQUEST');
  failure(await call(session, 'GET', documents, {}), 400, 'INVALID_REQUEST');
  const error = await call(session, 'GET', documents + '/' + '0'.repeat(64));
  failure(error, 404, 'NOT_FOUND');
  assert.ok(!error.text.includes(root) && !error.text.includes(session.token) && !error.text.includes('stack'));
  assert.deepEqual(fs.readdirSync(content), ['existing.md']);
  assert.deepEqual(fs.readFileSync(join(content, 'existing.md')), before);
});

test('M2 backend exceptions return stable sanitized errors without reflecting a path, token or raw body', async t => {
  const { session, root } = await setup(t);
  const sensitive = root + session.token + 'BODY_CANARY_MUST_NOT_BE_REFLECTED';
  const method = t.mock.method(fs, 'readdirSync', () => { throw new Error(sensitive); });
  try {
    const reply = await call(session, 'GET', THINK_API + '/documents');
    failure(reply, 500, 'FILE_OPERATION_FAILED');
    assert.ok(!reply.text.includes(root) && !reply.text.includes(session.token) && !reply.text.includes('BODY_CANARY') && !reply.text.includes('stack'));
  } finally { method.mock.restore(); }
});

test('M2 request bytes and source bytes have separate enforced limits', async t => {
  const { session, content } = await setup(t);
  failure(await call(session, 'POST', THINK_API + '/documents', undefined, { headers: { 'Content-Type': 'application/json', 'Content-Length': String(MAX_REQUEST_BYTES + 1) } }), 413, 'PAYLOAD_TOO_LARGE');
  failure(await call(session, 'POST', THINK_API + '/documents', undefined, { raw: Buffer.alloc(MAX_REQUEST_BYTES + 1, 0x20), headers: { 'Transfer-Encoding': 'chunked' } }), 413, 'PAYLOAD_TOO_LARGE');
  const large = { ...draft('source-too-large'), body: 'a'.repeat(16 * 1024 * 1024) };
  failure(await call(session, 'POST', THINK_API + '/documents', { document: large }), 413, 'VALIDATION_FAILED');
  assert.deepEqual(fs.readdirSync(content), ['existing.md']);
});

test('M2 incomplete bodies time out, concurrency is bounded, shutdown and disconnect never dispatch', async t => {
  const { session, content, open } = await setup(t);
  const hold = () => {
    let started!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const reply = new Promise<number>((resolve, reject) => {
      const req = httpRequest(session.origin, { method: 'POST', path: THINK_API + '/documents', headers: { [STUDIO_TOKEN_HEADER]: session.token, 'Content-Type': 'application/json', 'Content-Length': '100' } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode!)); });
      req.on('error', error => { if ((error as NodeJS.ErrnoException).code === 'ECONNRESET') resolve(0); else reject(error); });
      req.write('{', started);
      t.after(() => req.destroy());
    });
    return { ready, reply };
  };
  const first = hold(), second = hold();
  await Promise.all([first.ready, second.ready]);
  // A later request on a separate connection is handled after the two held headers/data.
  failure(await call(session, 'GET', THINK_API + '/documents'), 503, 'AUTHORING_BUSY');
  const start = Date.now();
  assert.deepEqual(await Promise.all([first.reply, second.reply]), [408, 408]);
  assert.ok(Date.now() - start < BODY_TIMEOUT_MS + 4_000);
  assert.equal(value(await call<ThinkSummary[]>(session, 'GET', THINK_API + '/documents')).length, 1);
  const interrupted = hold();
  await interrupted.ready;
  value({ status: 200, data: await session.close(), headers: {}, text: '' });
  await interrupted.reply;
  const next = await open(Number(new URL(session.origin).port));
  assert.ok(next.token !== session.token);
  failure(await call(next, 'GET', THINK_API + '/documents', undefined, { token: session.token }), 401, 'UNAUTHORIZED');
  assert.deepEqual(fs.readdirSync(content), ['existing.md']);
});

test('M2 port conflict/singleton startup release leases, restart and idempotent close work', async t => {
  const { session, root, open } = await setup(t);
  await assert.rejects(open(), error => error instanceof StudioStartError && error.code === 'AUTHORING_BUSY');
  const other = await setup(t);
  await other.session.close();
  await assert.rejects(startStudioHttp({ repositoryRoot: other.root, port: Number(new URL(session.origin).port) }), error => error instanceof StudioStartError && error.code === 'PORT_UNAVAILABLE');
  const recovered = await other.open();
  assert.equal(value(await call<ThinkSummary[]>(recovered, 'GET', THINK_API + '/documents')).length, 1);
  for (const port of [-1, 65536, 1.2]) await assert.rejects(startStudioHttp({ repositoryRoot: root, port }), error => error instanceof StudioStartError && error.code === 'INVALID_PORT');
  const first = session.close(), second = session.close();
  assert.equal(first, second);
  assert.equal((await first).ok, true);
  const restarted = await open(Number(new URL(session.origin).port));
  assert.ok(restarted.token !== session.token);
});

test('M2 parser rejects malformed requests and slow headers without exposing raw input', async t => {
  const { session } = await setup(t);
  const raw = (bytes: string) => new Promise<string>((resolve, reject) => {
    const socket = connect(Number(new URL(session.origin).port), '127.0.0.1', () => socket.write(bytes));
    let output = '';
    socket.on('data', chunk => { output += chunk.toString(); });
    socket.once('error', reject);
    socket.once('close', () => resolve(output));
    t.after(() => socket.destroy());
  });
  const malformed = await raw(`GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nBad\0Header: ${session.token}\r\n\r\n`);
  assert.match(malformed, /400 Bad Request/);
  assert.ok(!malformed.includes(session.token));
  const slow = await raw('POST /api/authoring/v1/think/documents HTTP/1.1\r\nHost:');
  assert.match(slow, /408 Request Timeout|400 Bad Request/);
  // Upgraded sockets are excluded from Node closeAllConnections: explicitly terminate them.
  const upgrade = connect({ port: Number(new URL(session.origin).port), host: '127.0.0.1', allowHalfOpen: true });
  t.after(() => upgrade.destroy());
  const response = new Promise<string>((resolve, reject) => { upgrade.once('data', chunk => resolve(chunk.toString())); upgrade.once('error', reject); });
  upgrade.write(`GET / HTTP/1.1\r\nHost: ${new URL(session.origin).host}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n`);
  assert.match(await response, /404 Not Found/);
  const start = Date.now();
  assert.equal((await session.close()).ok, true);
  assert.ok(Date.now() - start < 2_000);
});

test('M2 actual CLI boots from its own repository, logs no credential/body, stops and restarts cleanly', async t => {
  const { session, root, content } = await setup(t);
  const port = Number(new URL(session.origin).port);
  await session.close();
  fs.cpSync(resolve('studio'), join(root, 'studio'), { recursive: true });
  const web = join(root, '.cache/studio/web');
  fs.mkdirSync(web, { recursive: true });
  fs.writeFileSync(join(web, 'index.html'), '<!doctype html><!--studio-session-->');
  fs.writeFileSync(join(web, 'main.js'), '/* isolated CLI fixture; full editor covered by browser tests */');
  fs.writeFileSync(join(web, 'style.css'), '');
  fs.mkdirSync(join(root, 'src/modules/think'), { recursive: true });
  fs.copyFileSync('src/modules/think/metadata.ts', join(root, 'src/modules/think/metadata.ts'));
  fs.writeFileSync(join(root, 'package.json'), '{"type":"module"}');
  const run = async () => {
    const child = fork(join(root, 'studio/server/main.ts'), ['--port', String(port)], { cwd: resolve('.cache'), execArgv: ['--experimental-strip-types'], silent: true });
    let output = '';
    child.stdout!.on('data', chunk => { output += chunk.toString(); });
    child.stderr!.on('data', chunk => { output += chunk.toString(); });
    t.after(() => { if (child.exitCode === null) child.kill(); });
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('CLI startup timed out (output redacted)')), 10_000);
      child.stdout!.on('data', () => { if (output.includes('Studio API:')) { clearTimeout(timeout); resolve(); } });
      child.once('exit', () => { clearTimeout(timeout); reject(new Error('CLI exited before startup (output redacted)')); });
      child.once('error', () => { clearTimeout(timeout); reject(new Error('CLI process failed')); });
    });
    const bootstrap = await fetch(`http://127.0.0.1:${port}/`);
    const html = await bootstrap.text();
    const match = /<script id="studio-session" type="application\/json">([^<]+)<\/script>/.exec(html);
    assert.ok(match);
    const pairing = JSON.parse(match[1]!) as { origin: string; token: string };
    const body = 'CLI_BODY_MUST_NOT_BE_LOGGED';
    const response = await fetch(pairing.origin + THINK_API + '/documents', { method: 'POST', headers: { [STUDIO_TOKEN_HEADER]: pairing.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ document: { metadata: { slug: 'cli-test' }, body } }) });
    assert.ok([201, 409].includes(response.status));
    await response.arrayBuffer();
    const exit = new Promise<number | null>(resolve => child.once('exit', resolve));
    child.send('studio:stop');
    assert.equal(await exit, 0);
    assert.ok(!output.includes(pairing.token) && !output.includes(body) && !output.includes(root));
    assert.ok(!/[a-f0-9]{64}/.test(output));
    assert.equal(fs.existsSync(join(root, '.cache/studio/think-authoring.lock')), false);
    return pairing.token;
  };
  const first = await run(), second = await run();
  assert.ok(first !== second);
  assert.ok(fs.readFileSync(join(content, 'cli-test.md'), 'utf8').includes('CLI_BODY_MUST_NOT_BE_LOGGED'));
});
