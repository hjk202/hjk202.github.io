import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer, createConnection } from 'node:net';
import { join, resolve, relative } from 'node:path';
import { once } from 'node:events';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { readLocalCredential } from '../../studio/windows/local.ts';
import { startDesktopHost, desktopControl } from '../../studio/windows/desktop.ts';

const supported = process.platform === 'win32';
const cache = resolve('.cache/studio-v0');
const key = 'NON_SENSITIVE_V0_KEY_CANARY';
const configure = (store: string, action = 'create') => execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', resolve('tests/studio/windows-credentials.ps1'), '-StorePath', store, '-Action', action], { windowsHide: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
function fixture(t: TestContext) {
  fs.mkdirSync(cache, { recursive: true }); const root = fs.mkdtempSync(join(cache, 'windows-'));
  t.after(() => { assert.ok(relative(cache, root).startsWith('windows-') && !relative(cache, root).includes('..')); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, store: join(root, 'local-config', 'bailian.json') };
}
async function port() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  await new Promise<void>(resolve => server.close(() => resolve())); return address.port;
}
async function setupHost(t: TestContext) {
  const { root, store } = fixture(t);
  fs.cpSync('studio', join(root, 'studio'), { recursive: true });
  fs.mkdirSync(join(root, 'src/modules/think/content'), { recursive: true });
  fs.copyFileSync('src/modules/think/metadata.ts', join(root, 'src/modules/think/metadata.ts'));
  fs.writeFileSync(join(root, 'package.json'), '{"type":"module"}');
  const source = join(root, 'src/modules/think/content/fixture.md'); fs.writeFileSync(source, '---\nslug: fixture\n---\nNON_SENSITIVE_WINDOWS_SOURCE\n');
  const web = join(root, '.cache/studio/web'); fs.mkdirSync(web, { recursive: true });
  fs.writeFileSync(join(web, 'index.html'), '<!doctype html><!--studio-session-->'); fs.writeFileSync(join(web, 'main.js'), ''); fs.writeFileSync(join(web, 'style.css'), '');
  return { root, store, source, port: await port(), original: fs.readFileSync(source) };
}

test('v0 Windows DPAPI store reads across processes, updates atomically and never stores plaintext; bad/missing/linked config is explicit', { skip: !supported }, async t => {
  const { root, store } = fixture(t);
  assert.equal(await readLocalCredential(store), undefined);
  assert.equal(configure(store), 'saved');
  const before = fs.readFileSync(store, 'utf8'); assert.ok(!before.includes(key));
  assert.match(JSON.parse(before).protectedKey, /^[a-f0-9]+$/i);
  assert.deepEqual(await readLocalCredential(store), { baseUrl: 'https://fixture.cn-beijing.maas.aliyuncs.com/compatible-mode/v1', apiKey: key });
  assert.equal(fs.readFileSync(store, 'utf8'), before);
  assert.throws(() => configure(store, 'invalid')); assert.equal(fs.readFileSync(store, 'utf8'), before);
  assert.equal(configure(store, 'update'), 'saved'); assert.equal((await readLocalCredential(store))!.apiKey, 'NON_SENSITIVE_V0_UPDATED_KEY');
  const link = join(root, 'duplicate-config'); fs.linkSync(store, link);
  await assert.rejects(readLocalCredential(store), /LOCAL_CONFIG_UNSAFE/); fs.unlinkSync(link);
  fs.writeFileSync(store, JSON.stringify({ version: 1, baseUrl: 'https://fixture.cn-beijing.maas.aliyuncs.com/compatible-mode/v1', protectedKey: key }));
  await assert.rejects(readLocalCredential(store), /LOCAL_CONFIG_INVALID/);
  assert.deepEqual(fs.readdirSync(join(root, 'local-config')), ['bailian.json']);
});

test('v0 Windows host loads persisted key without a prompt, reuses authenticated control, rejects commands and stops/restarts without stale authoring lease', { skip: !supported }, async t => {
  const fixture = await setupHost(t); const { root, store, source, original } = fixture;
  configure(store);
  const host = await startDesktopHost({ root, store, port: fixture.port, build: false });
  t.after(() => host.stop());
  const running = await desktopControl(root, 'status'); assert.deepEqual(running, { origin: host.origin, pid: host.pid });
  const rootHtml = await (await fetch(host.origin)).text();
  const session = JSON.parse(/<script id="studio-session" type="application\/json">([^<]*)<\/script>/.exec(rootHtml)![1]!);
  const status = await (await fetch(host.origin + '/api/authoring/v1/think/suggest', { headers: { 'X-Studio-Token': session.token } })).json();
  assert.equal(status.value.available, true); assert.ok(!JSON.stringify(status).includes(key));
  await assert.rejects(startDesktopHost({ root, store, port: fixture.port, build: false }), /DESKTOP_BUSY/);
  const state = JSON.parse(fs.readFileSync(join(root, '.cache/studio/desktop-session.json'), 'utf8'));
  for (const input of [{ action: 'saveThink', token: state.token }, { action: 'stop', token: '0'.repeat(64) }, { action: 'status', token: state.token, path: root }]) {
    const reply = await new Promise<string>((resolve, reject) => {
      const socket = createConnection(state.pipe); let output = '';
      socket.on('connect', () => socket.write(JSON.stringify(input) + '\n'));
      socket.on('data', data => output += data.toString()); socket.once('end', () => resolve(output)); socket.once('error', reject);
    });
    assert.deepEqual(JSON.parse(reply), { ok: false });
  }
  assert.equal((await desktopControl(root, 'status'))!.pid, host.pid);
  await desktopControl(root, 'stop'); await host.stop();
  for (const name of ['desktop-start.lock', 'desktop-session.json', 'think-authoring.lock']) assert.equal(fs.existsSync(join(root, '.cache/studio', name)), false);
  const restarted = await startDesktopHost({ root, store, port: fixture.port, build: false });
  assert.notEqual(restarted.pid, host.pid); await restarted.stop();
  assert.deepEqual(fs.readFileSync(source), original);
});

test('v0 Windows missing credentials keeps ordinary Studio available; corrupt credentials fail before claiming an authoring service', { skip: !supported }, async t => {
  const fixture = await setupHost(t); const { root, store } = fixture;
  const host = await startDesktopHost({ root, store, port: fixture.port, build: false });
  t.after(() => host.stop());
  const html = await (await fetch(host.origin)).text(); const session = JSON.parse(/<script id="studio-session" type="application\/json">([^<]*)<\/script>/.exec(html)![1]!);
  const status = await (await fetch(host.origin + '/api/authoring/v1/think/suggest', { headers: { 'X-Studio-Token': session.token } })).json();
  assert.equal(status.value.available, false); assert.equal(status.value.issue, 'AI_NOT_CONFIGURED');
  assert.equal((await fetch(host.origin + '/api/authoring/v1/think/documents', { headers: { 'X-Studio-Token': session.token } })).status, 200);
  await host.stop(); fs.mkdirSync(join(root, 'local-config')); fs.writeFileSync(store, 'broken');
  await assert.rejects(startDesktopHost({ root, store, port: fixture.port, build: false }), /LOCAL_CONFIG_INVALID/);
  assert.equal(fs.existsSync(join(root, '.cache/studio/desktop-start.lock')), false);
  assert.equal(fs.existsSync(join(root, '.cache/studio/think-authoring.lock')), false);
});

test('v0 Windows shortcuts point to fixed hidden open/stop launchers and contain no credential', { skip: !supported }, t => {
  const { root } = fixture(t);
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', resolve('studio/windows/Install-Shortcuts.ps1'), '-DesktopPath', root], { windowsHide: true, stdio: 'pipe' });
  const code = `$ProgressPreference='SilentlyContinue'; $s=New-Object -ComObject WScript.Shell; Get-ChildItem -LiteralPath '${root.replaceAll("'", "''")}' -Filter '*.lnk' | ForEach-Object {$v=$s.CreateShortcut($_.FullName); @{name=$_.BaseName;target=$v.TargetPath;arguments=$v.Arguments;cwd=$v.WorkingDirectory}} | ConvertTo-Json -Compress`;
  const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')], { windowsHide: true, encoding: 'utf8' });
  const links = JSON.parse(output) as { name: string; target: string; arguments: string; cwd: string }[];
  assert.equal(links.length, 2);
  assert.deepEqual(links.map(link => link.name).sort(), ['Personal Space Studio', 'Stop Personal Space Studio']);
  for (const link of links) {
    assert.ok(link.target.endsWith('powershell.exe')); assert.ok(link.arguments.includes('-WindowStyle Hidden'));
    assert.ok(link.arguments.includes(resolve('studio/windows', link.name.startsWith('Stop') ? 'Stop.ps1' : 'Open.ps1')));
    assert.equal(link.cwd, resolve('.')); assert.ok(!output.includes(key));
  }
});
