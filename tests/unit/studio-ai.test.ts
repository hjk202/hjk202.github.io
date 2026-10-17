import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AI_MODEL, AI_OPERATIONS, AI_MAX_INPUT_BYTES, AI_MAX_RESPONSE_BYTES, AI_MAX_OUTPUT_BYTES, AI_MAX_REQUEST_BYTES } from '../../studio/contracts/ai.ts';
import { THINK_API, STUDIO_TOKEN_HEADER } from '../../studio/contracts/http.ts';
import { createThinkTextSuggestions, validateThinkTextInput } from '../../studio/server/ai/suggest.ts';
import { readBailianConfig } from '../../studio/server/ai/config.ts';
import { startStudioHttp } from '../../studio/server/http.ts';

const key = 'NON_SENSITIVE_BAILIAN_KEY_CANARY';
const environment = { DASHSCOPE_API_KEY: key, DASHSCOPE_BASE_URL: 'https://fixture.cn-beijing.maas.aliyuncs.com/compatible-mode/v1' };
const input = { operation: 'polish', input: '非敏感测试：这段文字只用于验证作者工具。' };
const answer = (content = '非敏感建议文本', extra = {}) => ({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content }, ...extra }] });
const response = (content: unknown) => Response.json(content);
const errorCode = (result: Awaited<ReturnType<ReturnType<typeof createThinkTextSuggestions>['suggestThinkText']>>) => { assert.ok(!result.ok); return result.error.code; };

async function upstream(t: TestContext, handler: (request: IncomingMessage, response: ServerResponse) => void) {
  const server = createServer(handler);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const origin = `http://127.0.0.1:${address.port}`;
  const fetch: typeof globalThis.fetch = (url, init) => { assert.equal(String(url), environment.DASHSCOPE_BASE_URL + '/chat/completions'); return globalThis.fetch(origin + '/chat/completions', init); };
  return { fetch, origin };
}

test('M5 pins the selected model and restricts backend-only configuration to official workspace HTTPS URLs', () => {
  assert.equal(AI_MODEL, 'deepseek-v4.1-flash');
  assert.equal(readBailianConfig({}).state, 'missing');
  for (const DASHSCOPE_BASE_URL of ['http://fixture.cn-beijing.maas.aliyuncs.com/compatible-mode/v1', 'https://evil.example/compatible-mode/v1', 'https://fixture.cn-beijing.maas.aliyuncs.com.evil.example/compatible-mode/v1', environment.DASHSCOPE_BASE_URL + '?key=x', environment.DASHSCOPE_BASE_URL + '#x', 'https://user:pass@fixture.cn-beijing.maas.aliyuncs.com/compatible-mode/v1', 'https://fixture.cn-beijing.maas.aliyuncs.com:444/compatible-mode/v1']) {
    assert.equal(readBailianConfig({ ...environment, DASHSCOPE_BASE_URL }).state, 'invalid');
  }
  assert.equal(readBailianConfig({ ...environment, DASHSCOPE_API_KEY: key + '\r\n' }).state, 'invalid');
  assert.equal(readBailianConfig(environment).state, 'ready');
});

test('M5 accepts exactly operation/input with Chinese/Markdown preserved and rejects unknown/oversized/invalid input', () => {
  for (const operation of AI_OPERATIONS) assert.deepEqual(validateThinkTextInput({ operation, input: '  中文\n```js\n// 原代码\n```\n' }), { ok: true, value: { operation, input: '  中文\n```js\n// 原代码\n```\n' } });
  for (const value of [null, [], {}, { ...input, operation: 'publish' }, { ...input, input: '' }, { ...input, input: '\ud800' }, { ...input, input: '\u0000' }, { ...input, path: 'C:/secret' }, { ...input, model: 'elsewhere' }, { ...input, apiKey: key }, { ...input, expectedRevision: '0'.repeat(64) }]) {
    const result = validateThinkTextInput(value); assert.ok(!result.ok); assert.equal(result.error.code, 'INVALID_REQUEST');
  }
  const large = validateThinkTextInput({ ...input, input: '中'.repeat(AI_MAX_INPUT_BYTES) }); assert.ok(!large.ok); assert.equal(large.error.code, 'AI_INPUT_TOO_LARGE');
});

test('M5 missing/invalid config makes no network request, and status never returns the endpoint or credential', async () => {
  let calls = 0;
  for (const environment of [{}, { DASHSCOPE_API_KEY: key, DASHSCOPE_BASE_URL: 'https://evil.example' }]) {
    const service = createThinkTextSuggestions({ environment, fetch: async () => { calls++; throw new Error('must not fetch'); } });
    assert.equal(service.status().available, false); assert.ok(!JSON.stringify(service.status()).includes(key));
    assert.match(errorCode(await service.suggestThinkText(input)), /^AI_(NOT_CONFIGURED|CONFIG_INVALID)$/);
    await service.close();
  }
  assert.equal(calls, 0);
});

test('M5 single-shot requests send only fixed instructions + explicit input; all operations return inert text with no tools/retries', async t => {
  const bodies: Record<string, unknown>[] = [];
  const remote = await upstream(t, (req, res) => {
    const chunks: Buffer[] = []; req.on('data', chunk => chunks.push(chunk)); req.on('end', () => {
      assert.equal(req.headers.authorization, 'Bearer ' + key); assert.equal(req.url, '/chat/completions');
      bodies.push(JSON.parse(Buffer.concat(chunks).toString()));
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(answer('<script>只作为文本</script>')));
    });
  });
  const service = createThinkTextSuggestions({ environment, fetch: remote.fetch });
  try {
    assert.equal(errorCode(await service.suggestThinkText({ ...input, input: key })), 'INVALID_REQUEST'); assert.equal(bodies.length, 0);
    for (const operation of AI_OPERATIONS) {
      const result = await service.suggestThinkText({ ...input, operation });
      assert.deepEqual(result, { ok: true, value: { operation, text: '<script>只作为文本</script>' } });
    }
    assert.equal(bodies.length, 5);
    const polishInstructions = (bodies[0]!.messages as { content: string }[])[0]!.content;
    for (const requirement of ['修正病句', '减少重复', '衔接', '事实', '个人语气']) assert.ok(polishInstructions.includes(requirement));
    for (const body of bodies) {
      assert.deepEqual(Object.keys(body).sort(), ['enable_thinking', 'max_tokens', 'messages', 'model', 'stream']);
      assert.equal(body.model, AI_MODEL); assert.equal(body.enable_thinking, false); assert.equal(body.stream, false); assert.equal(body.max_tokens, 4096);
      const messages = body.messages as { role: string; content: string }[];
      assert.deepEqual(messages.map(message => message.role), ['system', 'user']); assert.equal(messages[1]!.content, input.input);
      assert.ok(!JSON.stringify(messages).includes(key));
    }
  } finally { await service.close(); }
});

test('M5 errors and malformed/truncated/tool/oversized outputs are bounded and never reflect provider errors or credentials', async () => {
  const cases: [() => Response, string][] = [
    [() => new Response(key + input.input, { status: 401 }), 'AI_AUTH_FAILED'],
    [() => new Response(key, { status: 403 }), 'AI_AUTH_FAILED'],
    [() => new Response(key, { status: 429 }), 'AI_RATE_LIMITED'],
    [() => new Response(key, { status: 500 }), 'AI_FAILED'],
    [() => new Response('bad', { headers: { 'Content-Type': 'text/html' } }), 'AI_INVALID_RESPONSE'],
    [() => new Response('{', { headers: { 'Content-Type': 'application/json' } }), 'AI_INVALID_RESPONSE'],
    [() => response(answer('', {})), 'AI_INVALID_RESPONSE'],
    [() => response(answer('\ud800')), 'AI_INVALID_RESPONSE'],
    [() => response(answer('\u0000')), 'AI_INVALID_RESPONSE'],
    [() => response(answer('partial', { finish_reason: 'length' })), 'AI_INVALID_RESPONSE'],
    [() => response(answer(key)), 'AI_INVALID_RESPONSE'],
    [() => response(answer('x', { message: { role: 'assistant', content: 'x', tool_calls: [{}] } })), 'AI_INVALID_RESPONSE'],
    [() => response({ choices: [] }), 'AI_INVALID_RESPONSE'],
    [() => response(answer('中'.repeat(AI_MAX_OUTPUT_BYTES))), 'AI_TOO_LARGE'],
    [() => new Response(' '.repeat(AI_MAX_RESPONSE_BYTES + 1), { headers: { 'Content-Type': 'application/json' } }), 'AI_TOO_LARGE'],
  ];
  for (const [make, code] of cases) {
    let calls = 0;
    const service = createThinkTextSuggestions({ environment, fetch: async () => { calls++; return make(); } });
    const result = await service.suggestThinkText(input);
    assert.equal(errorCode(result), code); assert.equal(calls, 1);
    assert.ok(!JSON.stringify(result).includes(key) && !JSON.stringify(result).includes(input.input));
    await service.close();
  }
});

test('M5 actual HTTP timeout, concurrent calls, cancellation and close release work without automatic retry', async t => {
  let calls = 0;
  const remote = await upstream(t, (req, res) => { calls++; req.resume(); res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{'); });
  const service = createThinkTextSuggestions({ environment, fetch: remote.fetch, timeoutMs: 100 });
  const pending = service.suggestThinkText(input);
  assert.equal(errorCode(await service.suggestThinkText(input)), 'AUTHORING_BUSY');
  assert.equal(errorCode(await pending), 'AI_TIMEOUT');
  assert.equal(calls, 1);
  const controller = new AbortController(), cancelled = service.suggestThinkText(input, controller.signal);
  controller.abort(); assert.equal(errorCode(await cancelled), 'AI_CANCELLED');
  const closing = service.suggestThinkText(input); await service.close(); assert.equal(errorCode(await closing), 'AI_CANCELLED');
  assert.equal(errorCode(await service.suggestThinkText(input)), 'SERVICE_CLOSED');
});

test('M5 authenticated local HTTP status/suggest reject paths and excess input, preserve source and keep model auth distinct', async t => {
  const cache = resolve('.cache/studio-m5'); fs.mkdirSync(cache, { recursive: true });
  const root = fs.mkdtempSync(join(cache, 'unit-')), content = join(root, 'src/modules/think/content'); fs.mkdirSync(content, { recursive: true });
  const original = '---\nslug: keep-me\n---\nNON_SENSITIVE_SOURCE\n'; fs.writeFileSync(join(content, 'keep-me.md'), original);
  let calls = 0, status = 200;
  const remote = await upstream(t, (req, res) => { calls++; req.resume(); res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(status === 200 ? JSON.stringify(answer()) : key); });
  const session = await startStudioHttp({ repositoryRoot: root, port: 0, ai: { environment, fetch: remote.fetch } });
  try {
    const url = session.origin + THINK_API + '/suggest', headers = { [STUDIO_TOKEN_HEADER]: session.token, 'Content-Type': 'application/json' };
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).status, 401);
    const config = await (await fetch(url, { headers })).text(); assert.ok(!config.includes(key) && !config.includes('maas.aliyuncs.com'));
    assert.equal((await fetch(url, { method: 'POST', headers: { ...headers, Origin: 'https://evil.example' }, body: JSON.stringify(input) })).status, 403);
    for (const payload of [{ ...input, path: root }, { ...input, model: 'override' }]) assert.equal((await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })).status, 400);
    assert.equal((await fetch(url + '?status=all', { headers })).status, 400);
    assert.equal((await fetch(url, { method: 'POST', headers, body: ' '.repeat(AI_MAX_REQUEST_BYTES + 1) })).status, 413);
    assert.equal((await fetch(url, { method: 'POST', headers, body: JSON.stringify({ ...input, input: 'x'.repeat(AI_MAX_INPUT_BYTES + 1) }) })).status, 413);
    assert.equal(calls, 0);
    const good = await fetch(url, { method: 'POST', headers, body: JSON.stringify(input) }); assert.equal(good.status, 200); assert.equal((await good.json()).value.text, '非敏感建议文本');
    status = 401;
    const bad = await fetch(url, { method: 'POST', headers, body: JSON.stringify(input) }); assert.equal(bad.status, 502); assert.equal((await bad.json()).error.code, 'AI_AUTH_FAILED'); assert.equal(calls, 2);
    assert.equal(fs.readFileSync(join(content, 'keep-me.md'), 'utf8'), original); assert.deepEqual(fs.readdirSync(content), ['keep-me.md']);
  } finally {
    assert.ok((await session.close()).ok);
    assert.ok(relative(cache, root).startsWith('unit-') && !relative(cache, root).includes('..')); fs.rmSync(root, { recursive: true });
  }
});
