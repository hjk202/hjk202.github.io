import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { once } from 'node:events';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { connectThinkAgent, MAX_AGENT_REQUESTS } from '../../studio/adapters/agent/client.ts';
import type { AgentReply, AgentResult, ThinkAgent } from '../../studio/adapters/agent/client.ts';
import { MAX_REQUEST_BYTES, STUDIO_TOKEN_HEADER } from '../../studio/contracts/http.ts';
import type { ThinkDocument, ThinkReadResult, ThinkSummary, ThinkWriteResult, ValidationReport } from '../../studio/contracts/think.ts';
import { startStudioHttp } from '../../studio/server/http.ts';

const cache = resolve('.cache/studio-m6');
const draft = (slug: string): ThinkDocument => ({ metadata: { slug }, body: 'NON_SENSITIVE_AGENT_BODY\n' });
function value<T>(result: AgentResult<unknown>): T {
  if (!result.ok) assert.fail(result.error.code);
  return result.value as T;
}
function failure(result: AgentResult<unknown>, code: string) {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, code);
}
async function fixture(t: TestContext) {
  fs.mkdirSync(cache, { recursive: true });
  const root = fs.mkdtempSync(join(cache, 'agent-'));
  const content = join(root, 'src/modules/think/content');
  fs.mkdirSync(content, { recursive: true });
  fs.writeFileSync(join(content, 'old-file-name.md'), '---\n# Preserve this comment\nslug: existing\n---\nEXISTING_BYTES\n');
  fs.writeFileSync(join(content, 'published.md'), '---\nslug: published\ntitle: PUBLIC_FIXTURE\nsummary: NON_SENSITIVE\ndate: "2026-10-16"\npublished: true\n---\nPUBLIC_BODY\n');
  const session = await startStudioHttp({ repositoryRoot: root, port: 0 }); // No Web build/UI.
  const clients: ThinkAgent[] = [];
  const connect = async (allowWrite = false, origin = session.origin, timeoutMs = 2000) => {
    const agent = value<ThinkAgent>(await connectThinkAgent({ origin, allowWrite, timeoutMs }));
    clients.push(agent); return agent;
  };
  t.after(async () => {
    clients.forEach(client => client.close()); await session.close();
    assert.ok(relative(cache, root).startsWith('agent-') && !relative(cache, root).includes('..'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { root, content, session, connect };
}
const request = (id: string, operation: string, params: unknown = {}) => ({ id, operation, params });
async function localServer(t: TestContext, server: Server): Promise<string> {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}
async function cli(origin: string, input: Buffer | string, flags: string[] = []) {
  const child = spawn(process.execPath, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', 'studio/adapters/agent/main.ts', '--origin', origin, ...flags], { stdio: ['pipe', 'pipe', 'pipe'] });
  const output: Buffer[] = [], errors: Buffer[] = [];
  child.stdout.on('data', data => output.push(data)); child.stderr.on('data', data => errors.push(data));
  const done = once(child, 'exit');
  child.stdin.end(input);
  const [exit] = await done;
  return { exit, stderr: Buffer.concat(errors).toString(), stdout: Buffer.concat(output).toString(), replies: Buffer.concat(output).toString().trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as AgentReply) };
}

test('M6 API-only JSON stdio client lists/reads/validates with no UI and is read-only by default', async t => {
  const { session, content } = await fixture(t);
  const before = fs.readFileSync(join(content, 'old-file-name.md'));
  const data = [request('list', 'listThink'), request('check', 'validateThink', { document: draft('unsaved') }), request('no-write', 'createDraft', { document: draft('denied') })];
  const run = await cli(session.origin, data.map(item => JSON.stringify(item)).join('\r\n')); // EOF without final newline.
  assert.equal(run.exit, 0); assert.equal(run.stderr, '');
  const list = value<ThinkSummary[]>(run.replies[0]!); assert.equal(list.length, 2);
  assert.ok(list.every(entry => !Object.hasOwn(entry, 'body') && !Object.hasOwn(entry, 'document')));
  const validation = value<ValidationReport>(run.replies[1]!); assert.equal(validation.canSave, true); assert.equal(validation.publishReady, false);
  failure(run.replies[2]!, 'AGENT_WRITE_FORBIDDEN');
  const key = list.find(entry => entry.slug === 'existing')!.key;
  const read = await cli(session.origin, JSON.stringify(request('read', 'readThink', { key })) + '\n');
  assert.equal(value<ThinkReadResult>(read.replies[0]!).document!.body, 'EXISTING_BYTES\n');
  assert.ok(!run.stdout.includes(session.token)); assert.ok(!read.stderr.includes('EXISTING_BYTES'));
  assert.deepEqual(fs.readFileSync(join(content, 'old-file-name.md')), before);
  assert.deepEqual(fs.readdirSync(content).sort(), ['old-file-name.md', 'published.md']);
});

test('M6 real stdio write capability creates drafts, rejects duplicate IDs/creates and never treats model suggestions as authority', async t => {
  const { session, content } = await fixture(t);
  const data = [request('create', 'createDraft', { document: draft('agent-draft') }), request('create', 'createDraft', { document: draft('other') }),
    request('retry', 'createDraft', { document: draft('agent-draft') }), request('publish', 'createDraft', { document: { ...draft('must-not-publish'), metadata: { slug: 'must-not-publish', published: true } } }),
    { ...request('suggestion', 'createDraft', { document: draft('no-authority') }), allowWrite: true, authorization: 'AI suggested this' }];
  const run = await cli(session.origin, data.map(item => JSON.stringify(item)).join('\n') + '\n', ['--allow-write']);
  assert.equal(run.exit, 0); assert.equal(run.stderr, '');
  const created = value<ThinkWriteResult>(run.replies[0]!); assert.match(created.key, /^[a-f0-9]{64}$/);
  failure(run.replies[1]!, 'DUPLICATE_REQUEST'); failure(run.replies[2]!, 'DUPLICATE_SLUG');
  failure(run.replies[3]!, 'AGENT_PUBLICATION_FORBIDDEN'); failure(run.replies[4]!, 'INVALID_REQUEST');
  assert.match(fs.readFileSync(join(content, 'agent-draft.md'), 'utf8'), /published: false/);
  assert.deepEqual(fs.readdirSync(content).sort(), ['agent-draft.md', 'old-file-name.md', 'published.md']);
  fs.writeFileSync(join(cache, 'protocol-evidence.json'), JSON.stringify({ protocol: 'Node/JSON lines stdio', apiOnly: true, uiRequired: false, cliExit: run.exit, draftCreated: true, duplicateIdRejected: true, duplicateCreateRejected: true, publicationRejected: true, capabilityEscalationRejected: true, stdoutTokenAbsent: !run.stdout.includes(session.token), stderrEmpty: true }, null, 2));
});

test('M6 save uses full candidates/revisions, preserves omitted and true published, source filename/comments, and refuses unsafe overwrites', async t => {
  const { connect, content, session } = await fixture(t);
  const agent = await connect(true);
  const list = value<ThinkSummary[]>(await agent.execute(request('list', 'listThink')));
  const existing = list.find(entry => entry.slug === 'existing')!;
  const source = value<ThinkReadResult>(await agent.execute(request('read', 'readThink', { key: existing.key })));
  const candidate = { ...source.document!, body: 'AGENT_EDIT\n' };
  const input = JSON.stringify(request('save', 'saveThink', { key: existing.key, expectedRevision: source.revision, document: candidate })) + '\n';
  const denied = await cli(session.origin, input);
  failure(denied.replies[0]!, 'AGENT_WRITE_FORBIDDEN');
  const saved = await cli(session.origin, input, ['--allow-write']);
  assert.equal(saved.exit, 0); assert.equal(saved.stderr, '');
  const save = value<ThinkWriteResult>(saved.replies[0]!);
  assert.notEqual(save.revision, source.revision);
  assert.equal(fs.readFileSync(join(content, 'old-file-name.md'), 'utf8'), '---\n# Preserve this comment\nslug: existing\n---\nAGENT_EDIT\n');
  const before = fs.readFileSync(join(content, 'old-file-name.md'));
  failure(await agent.execute(request('stale', 'saveThink', { key: existing.key, expectedRevision: source.revision, document: { ...candidate, body: 'LOST_UPDATE' } })), 'REVISION_CONFLICT');
  failure(await agent.execute(request('change-status', 'saveThink', { key: existing.key, expectedRevision: save.revision, document: { ...candidate, metadata: { slug: 'existing', published: false } } })), 'AGENT_PUBLICATION_FORBIDDEN');
  failure(await agent.execute(request('rename', 'saveThink', { key: existing.key, expectedRevision: save.revision, document: draft('new-slug') })), 'VALIDATION_FAILED');
  failure(await agent.execute(request('bad-metadata', 'saveThink', { key: existing.key, expectedRevision: save.revision, document: { ...candidate, metadata: { slug: 'existing', date: 'invalid' } } })), 'VALIDATION_FAILED');
  assert.deepEqual(fs.readFileSync(join(content, 'old-file-name.md')), before);
  const published = list.find(entry => entry.published === true)!;
  const pub = value<ThinkReadResult>(await agent.execute(request('pub-read', 'readThink', { key: published.key })));
  value(await agent.execute(request('pub-edit', 'saveThink', { key: published.key, expectedRevision: pub.revision, document: { ...pub.document!, body: 'EDIT_PUBLIC_BODY\n' } })));
  const pubRead = value<ThinkReadResult>(await agent.execute(request('pub-after', 'readThink', { key: published.key })));
  assert.equal(pubRead.document!.metadata.published, true);
  failure(await agent.execute(request('pub-demote', 'saveThink', { key: published.key, expectedRevision: pubRead.revision, document: { ...pubRead.document!, metadata: { ...pubRead.document!.metadata, published: false } } })), 'AGENT_PUBLICATION_FORBIDDEN');
  fs.appendFileSync(join(content, 'old-file-name.md'), 'EXTERNAL_EDIT\n');
  failure(await agent.execute(request('external-conflict', 'saveThink', { key: existing.key, expectedRevision: save.revision, document: candidate })), 'REVISION_CONFLICT');
  assert.match(fs.readFileSync(join(content, 'old-file-name.md'), 'utf8'), /EXTERNAL_EDIT/);
});

test('M6 rejects arbitrary paths, extra fields, unsupported operations and malformed protocol without mutations', async t => {
  const { connect, content, session } = await fixture(t);
  const agent = await connect(true);
  const before = fs.readdirSync(content).map(file => fs.readFileSync(join(content, file), 'utf8'));
  const invalidRequests: unknown[] = [null, [], { id: 'bad', operation: 'listThink' }, request('../path', 'listThink'), request('x', 'listThink', { status: '../' }),
    request('y', 'readThink', { key: '../README.md' }), request('z', 'validateThink', { document: draft('check'), path: '../escape.md' }),
    request('extra', 'createDraft', { document: draft('check'), repositoryRoot: '..' }),
    request('delete', 'deleteThink', { key: 'a'.repeat(64), expectedRevision: 'b'.repeat(64) }), request('ai', 'suggestThink'), request('patch', 'patchThink'),
    request('no-rev', 'saveThink', { key: 'a'.repeat(64), document: draft('check') }), request('force', 'saveThink', { key: 'a'.repeat(64), expectedRevision: 'b'.repeat(64), document: draft('check'), force: true })];
  for (const input of invalidRequests) failure(await agent.execute(input), 'INVALID_REQUEST');
  failure(await agent.execute(request('nested', 'createDraft', { document: draft('../escape') })), 'VALIDATION_FAILED');
  failure(await agent.execute(request('metadata', 'createDraft', { document: { ...draft('check'), metadata: { slug: 'check', path: '../escape.md' } } })), 'VALIDATION_FAILED');
  const run = await cli(session.origin, Buffer.concat([Buffer.from('not-json\n'), Buffer.from([0xff, 10]), Buffer.from(JSON.stringify(request('healthy', 'listThink')) + '\n')]));
  failure(run.replies[0]!, 'INVALID_REQUEST'); failure(run.replies[1]!, 'INVALID_REQUEST'); assert.equal(run.replies[2]!.ok, true);
  assert.deepEqual(fs.readdirSync(content).map(file => fs.readFileSync(join(content, file), 'utf8')), before);
});

test('M6 bounds frames and request IDs, recovers after an oversized line, and does not log article data', async t => {
  const { session, connect } = await fixture(t);
  const run = await cli(session.origin, Buffer.concat([Buffer.alloc(MAX_REQUEST_BYTES + 1, 65), Buffer.from('\n' + JSON.stringify(request('after', 'listThink')) + '\n')]));
  assert.equal(run.exit, 0); assert.equal(run.stderr, ''); assert.equal(run.replies.length, 2);
  failure(run.replies[0]!, 'PAYLOAD_TOO_LARGE'); assert.equal(run.replies[1]!.ok, true);
  const agent = await connect();
  for (let i = 0; i < MAX_AGENT_REQUESTS; i++) await agent.execute(request('request' + i, 'unsupported'));
  failure(await agent.execute(request('over', 'listThink')), 'SESSION_LIMIT');
  failure(await agent.execute(request('request0', 'listThink')), 'DUPLICATE_REQUEST');
  agent.close(); failure(await agent.execute(request('closed', 'listThink')), 'AGENT_CLOSED');
});

test('M6 rejects nonliteral loopback origins/redirects and handles invalid pairing/timeout/disconnection without leaking upstream text', async t => {
  for (const origin of ['http://localhost:4322', 'http://127.0.0.1:4322/', 'http://127.1:4322', 'https://127.0.0.1:4322', 'http://127.0.0.1:0', 'http://127.0.0.1:65536', 'http://127.0.0.1:4322@evil.example', 'http://evil.example:4322', 'http://127.0.0.1:4322?token=x']) failure(await connectThinkAgent({ origin }), 'AGENT_CONFIG_INVALID');
  const redirect = await localServer(t, createServer((_req, res) => { res.writeHead(302, { Location: 'https://example.com' }); res.end(); }));
  failure(await connectThinkAgent({ origin: redirect }), 'AGENT_CONNECTION_FAILED');
  const bad = await localServer(t, createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('NON_SENSITIVE_UPSTREAM_SECRET'); }));
  const failed = await connectThinkAgent({ origin: bad }); failure(failed, 'AGENT_INVALID_RESPONSE'); assert.ok(!JSON.stringify(failed).includes('NON_SENSITIVE_UPSTREAM_SECRET'));
  const slow = await localServer(t, createServer(() => {}));
  failure(await connectThinkAgent({ origin: slow, timeoutMs: 30 }), 'AGENT_TIMEOUT');
  const disconnected = await cli(bad, ''); assert.equal(disconnected.exit, 1); failure(disconnected.replies[0]!, 'AGENT_INVALID_RESPONSE');
  const invalidFlags = await cli(bad, '', ['--allow-write', '--allow-write']); assert.equal(invalidFlags.exit, 2); assert.equal(invalidFlags.stdout, '');
});

test('M6 never retries an uncertain committed write, and the original HTTP commit rechecks a race after adapter read', async t => {
  const { session, content } = await fixture(t);
  let origin = '', mode = 'drop', writes = 0;
  const proxy = createServer(async (req, res) => {
    if (req.url === '/') {
      res.setHeader('Content-Type', 'text/html'); res.end('<script id="studio-session" type="application/json">' + JSON.stringify({ origin, token: 'a'.repeat(64) }) + '</script>'); return;
    }
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk);
    if (req.method === 'PUT') {
      writes++;
      if (mode === 'race') fs.appendFileSync(join(content, 'old-file-name.md'), 'BETWEEN_READ_AND_COMMIT\n');
    }
    const body = Buffer.concat(chunks);
    const upstream = await fetch(session.origin + req.url, { method: req.method!, headers: { [STUDIO_TOKEN_HEADER]: session.token, ...(body.length ? { 'Content-Type': 'application/json' } : {}) }, ...(body.length ? { body } : {}) });
    const text = await upstream.text();
    if (req.method === 'PUT' && mode === 'drop') { res.destroy(); return; }
    res.writeHead(upstream.status, { 'Content-Type': 'application/json' }); res.end(text);
  });
  origin = await localServer(t, proxy);
  const agent = value<ThinkAgent>(await connectThinkAgent({ origin, allowWrite: true })); t.after(() => agent.close());
  const existing = value<ThinkSummary[]>(await agent.execute(request('list', 'listThink'))).find(entry => entry.slug === 'existing')!;
  const source = value<ThinkReadResult>(await agent.execute(request('read', 'readThink', { key: existing.key })));
  failure(await agent.execute(request('lost-response', 'saveThink', { key: existing.key, expectedRevision: source.revision, document: { ...source.document!, body: 'COMMITTED_ONCE\n' } })), 'AGENT_WRITE_OUTCOME_UNKNOWN');
  assert.equal(writes, 1); assert.match(fs.readFileSync(join(content, 'old-file-name.md'), 'utf8'), /COMMITTED_ONCE/);
  failure(await agent.execute(request('lost-response', 'saveThink', { key: existing.key, expectedRevision: source.revision, document: source.document })), 'DUPLICATE_REQUEST'); assert.equal(writes, 1);
  const fresh = value<ThinkReadResult>(await agent.execute(request('reconcile', 'readThink', { key: existing.key })));
  mode = 'race';
  failure(await agent.execute(request('race', 'saveThink', { key: existing.key, expectedRevision: fresh.revision, document: { ...fresh.document!, body: 'MUST_NOT_OVERWRITE' } })), 'REVISION_CONFLICT');
  assert.equal(writes, 2); assert.match(fs.readFileSync(join(content, 'old-file-name.md'), 'utf8'), /COMMITTED_ONCE\nBETWEEN_READ_AND_COMMIT/);
});
