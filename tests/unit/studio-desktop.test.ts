import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { prepareClose, closeFailed } from '../../studio/contracts/desktop.ts';
import { startDesktopHost } from '../../studio/windows/desktop.ts';

test('M8 lifecycle contract accepts only a bounded close request with an independent request ID', () => {
  const valid = { type: 'studio:prepare-close', requestId: randomUUID() };
  assert.equal(prepareClose(valid), true);
  for (const value of [null, [], true, 'studio:prepare-close', { ...valid, path: 'C:/outside' }, { ...valid, token: 'a'.repeat(64) }, { ...valid, requestId: 'a'.repeat(64) }, { ...valid, type: 'saveThink' }, { type: valid.type }]) assert.equal(prepareClose(value), false);
});

test('M8 shutdown failure accepts only the exact content-free lifecycle message', () => {
  const value = { type: 'studio:close-failed', requestId: randomUUID() };
  assert.equal(closeFailed(value), true); assert.equal(prepareClose(value), false);
  for (const invalid of [null, [], {}, { ...value, path: 'C:/outside' }, { ...value, type: 'studio:prepare-close' }, { ...value, requestId: 'invalid' }]) assert.equal(closeFailed(invalid), false);
});

test('Windows authoring backend uses the trusted HTTP proxy and always bypasses it on loopback', { skip: process.platform !== 'win32' }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'studio-proxy-'));
  const backend = join(root, 'backend.mjs');
  writeFileSync(backend, `import {createServer} from 'node:http';
const server = createServer((request,response) => response.end('local'));
process.once('message', () => server.listen(0, '127.0.0.1', async () => {
  const origin = 'http://127.0.0.1:' + server.address().port;
  const loopback = await (await fetch(origin)).text();
  const external = await (await fetch('http://studio-proxy.test/')).text();
  if (loopback !== 'local' || external !== 'proxy') process.exit(1);
  process.send({type:'studio:ready',origin});
}));
process.on('message', message => {
  if (message === 'studio:stop') server.close(() => process.disconnect());
});
`);
  const requests: string[] = [];
  const proxy = createServer((request, response) => {
    requests.push(new URL(request.url ?? '', 'http://unexpected.test').hostname);
    response.end('proxy');
  });
  proxy.on('connect', (request, socket) => {
    requests.push(new URL(`http://${request.url}`).hostname);
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    socket.once('data', () => socket.end('HTTP/1.1 200 OK\r\nContent-Length: 5\r\nConnection: close\r\n\r\nproxy'));
  });
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const address = proxy.address();
  assert.ok(address && typeof address !== 'string');
  const names = ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'NODE_USE_ENV_PROXY'];
  const original = names.map(name => process.env[name]);
  for (const name of names) delete process.env[name];
  process.env.HTTP_PROXY = `http://127.0.0.1:${address.port}`;
  process.env.NO_PROXY = 'bypass.test';
  try {
    const host = await startDesktopHost({ root, build: false, prepared: {
      id: 'fixture', directory: root, executable: backend, backend, host: backend, web: root,
    } });
    try {
      assert.deepEqual(requests, ['studio-proxy.test']);
      assert.equal(await (await fetch(host.origin)).text(), 'local');
    } finally { await host.stop(); }
  } finally {
    for (const [index, name] of names.entries()) {
      const value = original[index];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await new Promise<void>(resolve => proxy.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
  }
});
