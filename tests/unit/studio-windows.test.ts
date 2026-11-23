import { StartupTrace } from '../../studio/windows/startup.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync, fork, spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer, createConnection } from 'node:net';
import { join, resolve, relative } from 'node:path';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { readLocalCredential } from '../../studio/windows/local.ts';
import { startDesktopHost, desktopControl, openDesktop, stopDesktop } from '../../studio/windows/desktop.ts';
import { desktopDirectory, desktopPaths, desktopSnapshot, removeDesktopSnapshot, recoverDesktop, processGone } from '../../studio/windows/desktop-state.ts';
import { ensureDesktopWeb } from '../../studio/windows/web-build.ts';
import { startStudioHttp } from '../../studio/server/http.ts';
import { openApp } from '../../studio/windows/app.ts';
import { ensureDesktopApp, appBuildEnvironment } from '../../studio/windows/app-build.ts';
import { encryptVault } from '../../src/core/vault/crypto.ts';

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
function copyStudio(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.isDirectory()) copyStudio(join(from, entry.name), join(to, entry.name));
    else fs.copyFileSync(join(from, entry.name), join(to, entry.name));
  }
}
async function setupHost(t: TestContext, spaced = false) {
  const originalFixture = fixture(t), store = originalFixture.store;
  const root = spaced ? join(originalFixture.root, 'M7 中文 space') : originalFixture.root;
  if (spaced) fs.mkdirSync(root);
  copyStudio('studio', join(root, 'studio'));
  assert.ok(fs.existsSync(join(root, 'studio/windows/desktop.ts')), 'Fixture source must exist at the exact requested path');
  fs.mkdirSync(join(root, 'src/modules/think/content'), { recursive: true });
  fs.copyFileSync('src/modules/think/metadata.ts', join(root, 'src/modules/think/metadata.ts'));
  fs.mkdirSync(join(root, 'src/modules/keep'), { recursive: true });
  fs.copyFileSync('src/modules/keep/bookmarks.ts', join(root, 'src/modules/keep/bookmarks.ts'));
  fs.mkdirSync(join(root, 'src/modules/me'), { recursive: true });
  fs.copyFileSync('src/modules/me/profile.ts', join(root, 'src/modules/me/profile.ts'));
  fs.mkdirSync(join(root, 'src/modules/build'), { recursive: true });
  fs.copyFileSync('src/modules/build/projects.ts', join(root, 'src/modules/build/projects.ts'));
  fs.mkdirSync(join(root, 'src/core/vault'), { recursive: true });
  copyStudio('src/core/vault', join(root, 'src/core/vault'));
  for (const module of ['think','keep','me','build']) fs.copyFileSync(`src/modules/${module}/vault.schema.ts`, join(root, `src/modules/${module}/vault.schema.ts`));
  for (const file of ['vault.client.ts','vault.markdown.ts','vault.css']) fs.copyFileSync('src/modules/think/' + file, join(root,'src/modules/think',file));
  for (const file of ['vault.client.ts','vault.css']) fs.copyFileSync('src/modules/keep/' + file, join(root,'src/modules/keep',file));
  for (const file of ['vault.client.ts','vault.css']) fs.copyFileSync('src/modules/me/' + file, join(root,'src/modules/me',file));
  for (const file of ['vault.client.ts','vault.css']) fs.copyFileSync('src/modules/build/' + file, join(root,'src/modules/build',file));
  for (const file of ['src/core/module/urls.ts','src/shell/vault/dom.ts']) { fs.mkdirSync(join(root,file,'..'),{recursive:true}); fs.copyFileSync(file,join(root,file)); }
  fs.writeFileSync(join(root, 'package.json'), '{"type":"module"}');
  const source = join(root, 'src/modules/think/content/fixture.md'); fs.writeFileSync(source, '---\nslug: fixture\n---\nNON_SENSITIVE_WINDOWS_SOURCE\n');
  const web = join(root, '.cache/studio/web'); fs.mkdirSync(web, { recursive: true });
  fs.writeFileSync(join(web, 'index.html'), '<!doctype html><!--studio-session-->'); fs.writeFileSync(join(web, 'main.js'), ''); fs.writeFileSync(join(web, 'style.css'), '');
  return { root, store, source, port: await port(), original: fs.readFileSync(source) };
}
function buildFixture(root: string) {
  fs.writeFileSync(join(root, 'package-lock.json'), '{}');
  fs.mkdirSync(join(root, 'node_modules/vite/bin'), { recursive: true });
  // The real Vite build is covered by integration/browser verification; this compiler fixture
  // exposes observable rebuilds/failures and credential inheritance for lifecycle tests.
  fs.writeFileSync(join(root, 'node_modules/vite/bin/vite.js'), `import fs from 'node:fs';
fs.appendFileSync('build-count.txt','build\\n');
if(process.env.DASHSCOPE_API_KEY||process.env.DASHSCOPE_BASE_URL)process.exit(3);
if(fs.existsSync('build-fail'))process.exit(2);
fs.mkdirSync('.cache/studio/web',{recursive:true});
fs.writeFileSync('.cache/studio/web/index.html','<!doctype html><!--studio-session-->');
fs.writeFileSync('.cache/studio/web/main.js','fixture editor');
fs.writeFileSync('.cache/studio/web/style.css','');`);
}
async function exitedPid() {
  const child = spawn(process.execPath, ['-e', ''], { windowsHide: true, stdio: 'ignore' });
  await once(child, 'exit'); assert.ok(child.pid); return child.pid;
}
async function waitGone(pid: number) {
  const until = Date.now() + 5000;
  while (!processGone(pid) && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(processGone(pid), true, 'The terminated fixture process must actually exit');
}
async function staleState(root: string, port: number) {
  desktopDirectory(root); const path = desktopPaths(root), token = randomBytes(32).toString('hex');
  const host = await exitedPid(), child = await exitedPid();
  fs.writeFileSync(path.lock, JSON.stringify({ pid: host, token }));
  fs.writeFileSync(path.state, JSON.stringify({ version: 1, origin: `http://127.0.0.1:${port}`, pipe: path.pipe, token, pid: child }));
  fs.writeFileSync(path.lease, JSON.stringify({ version: 1, pid: child, token: randomUUID() }));
  return path;
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

test('M8 desktop API loads its explicit DPAPI store even when the child has no AI environment', { skip: !supported }, async t => {
  const f = await setupHost(t); configure(f.store);
  const encrypted = fs.readFileSync(f.store), main = join(f.root, 'studio/server/main.ts');
  // Model the observed failure: the API has neither AI variable although the saved store is readable.
  const presence = join(f.root, 'ai-environment-presence.json');
  fs.writeFileSync(main, `import{writeFileSync as recordPresence}from'node:fs';recordPresence(${JSON.stringify(presence)},JSON.stringify({key:!!process.env.DASHSCOPE_API_KEY,base:!!process.env.DASHSCOPE_BASE_URL}));\ndelete process.env.DASHSCOPE_API_KEY; delete process.env.DASHSCOPE_BASE_URL;\n` + fs.readFileSync(main, 'utf8'));
  const host = await startDesktopHost({ root: f.root, store: f.store, port: f.port, build: false });
  try {
    const html = await (await fetch(host.origin)).text();
    const pairing = JSON.parse(/<script id="studio-session" type="application\/json">([^<]*)<\/script>/.exec(html)![1]!);
    const status = await (await fetch(host.origin + '/api/authoring/v1/think/suggest', { headers: { 'X-Studio-Token': pairing.token } })).json();
    assert.equal(status.value.available, true); assert.equal(status.value.issue, null);
    assert.deepEqual(JSON.parse(fs.readFileSync(presence, 'utf8')), { key: false, base: false });
    assert.ok(!JSON.stringify(status).includes(key));
    assert.deepEqual(fs.readFileSync(f.store), encrypted); assert.deepEqual(fs.readFileSync(f.source), f.original);
  } finally { await host.stop(); }
  for (const file of [desktopPaths(f.root).lock, desktopPaths(f.root).state, desktopPaths(f.root).lease]) assert.equal(fs.existsSync(file), false);
});

test('M8 private API bootstrap rejects malformed messages and a lost launcher without leaving an authoring lease', { skip: !supported }, async t => {
  const f = await setupHost(t); configure(f.store);
  const encrypted = fs.readFileSync(f.store);
  for (const message of [[], { type: 'studio:start', localCredentialStore: 'relative.json' }, { type: 'studio:start', localCredentialStore: f.store, key }, { type: 'studio:start', localCredentialStore: f.store }]) {
    const child = fork(join(f.root, 'studio/server/main.ts'), ['--port', String(f.port)], { cwd: f.root, silent: true, windowsHide: true, execArgv: ['--experimental-strip-types'] });
    let output = ''; child.stdout!.on('data', bytes => { output += bytes.toString(); }); child.stderr!.on('data', bytes => { output += bytes.toString(); });
    const exited = once(child, 'exit');
    child.send(message, () => { if (message && 'localCredentialStore' in message && !('key' in message) && message.localCredentialStore === f.store) child.disconnect(); });
    await exited;
    assert.equal(child.exitCode, 1); assert.ok(!output.includes('Studio API:')); assert.ok(!output.includes(key) && !output.includes(f.store));
    assert.match(output, /INVALID_COMMAND|DESKTOP_UNAVAILABLE/);
    assert.equal(fs.existsSync(desktopPaths(f.root).lease), false);
    assert.deepEqual(fs.readFileSync(f.store), encrypted); assert.deepEqual(fs.readFileSync(f.source), f.original);
  }
});

test('M8 desktop has one hidden launcher and migrates only its owned legacy stop shortcut', { skip: !supported }, t => {
  const { root } = fixture(t);
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', resolve('studio/windows/Install-Shortcuts.ps1'), '-DesktopPath', root], { windowsHide: true, stdio: 'pipe' });
  const code = `$ProgressPreference='SilentlyContinue'; $s=New-Object -ComObject WScript.Shell; Get-ChildItem -LiteralPath '${root.replaceAll("'", "''")}' -Filter '*.lnk' | ForEach-Object {$v=$s.CreateShortcut($_.FullName); @{name=$_.BaseName;target=$v.TargetPath;arguments=$v.Arguments;cwd=$v.WorkingDirectory;icon=$v.IconLocation}} | ConvertTo-Json -Compress`;
  const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')], { windowsHide: true, encoding: 'utf8' });
  const parsed = JSON.parse(output) as { name: string; target: string; arguments: string; cwd: string; icon: string };
  const links = [parsed];
  assert.equal(parsed.name, 'Personal Space Studio');
  assert.equal(parsed.icon, resolve('studio/desktop/assets/studio-blue-hair.ico') + ',0');
  const icon = fs.readFileSync(parsed.icon.slice(0, -2));
  assert.equal(icon.readUInt16LE(0), 0); assert.equal(icon.readUInt16LE(2), 1);
  const sizes = Array.from({ length: icon.readUInt16LE(4) }, (_, index) => icon[6 + 16 * index] || 256);
  assert.deepEqual(sizes, [16, 24, 32, 48, 64, 128, 256]);
  assert.equal(fs.existsSync(join(root, 'Stop Personal Space Studio.lnk')), false);
  for (const link of links) {
    assert.ok(link.target.endsWith('powershell.exe')); assert.ok(link.arguments.includes('-WindowStyle Hidden'));
    assert.ok(link.arguments.includes(resolve('studio/windows', link.name.startsWith('Stop') ? 'Stop.ps1' : 'Open.ps1')));
    assert.ok(link.arguments.includes('-NodePath "' + process.execPath + '"'));
    assert.equal(link.cwd, resolve('.')); assert.ok(!output.includes(key));
  }
  const legacy = join(root, 'Stop Personal Space Studio.lnk');
  const create = `$ProgressPreference='SilentlyContinue';$s=New-Object -ComObject WScript.Shell;$v=$s.CreateShortcut('${legacy.replaceAll("'", "''")}');$v.TargetPath='${links[0]!.target.replaceAll("'", "''")}';$v.Arguments='${links[0]!.arguments.replace('Open.ps1', 'Stop.ps1').replaceAll("'", "''")}';$v.WorkingDirectory='${resolve('.').replaceAll("'", "''")}';$v.Description='Personal Space Studio local launcher';$v.Save()`;
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(create, 'utf16le').toString('base64')], { windowsHide: true, stdio: 'pipe' });
  fs.writeFileSync(join(root, 'unrelated.txt'), 'keep');
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', resolve('studio/windows/Install-Shortcuts.ps1'), '-DesktopPath', root], { windowsHide: true, stdio: 'pipe' });
  assert.equal(fs.existsSync(legacy), false); assert.equal(fs.existsSync(join(root, 'Personal Space Studio.lnk')), true);
  assert.equal(fs.readFileSync(join(root, 'unrelated.txt'), 'utf8'), 'keep');
});

test('M8 standalone Windows startup reuses DPAPI, respects explicit environment and fails safely on bad local config', { skip: !supported }, async t => {
  const f = await setupHost(t), appData = join(f.root, 'LocalAppData'), store = join(appData, 'PersonalSpaceStudio/bailian.json');
  configure(store);
  // Keep the real user's store out of this fixture. Its canonical Windows folder differs from the launcher environment.
  fs.appendFileSync(join(f.root, 'studio/windows/Credentials.ps1'), `\nfunction Get-StudioStorePath { return '${store.replaceAll("'", "''")}' }\n`);
  const encrypted = fs.readFileSync(store);
  const execute = async (explicit = false, invalid = false) => {
    const env: NodeJS.ProcessEnv = { ...process.env, LOCALAPPDATA: join(f.root, 'redirected-launcher-appdata') };
    delete env.DASHSCOPE_API_KEY; delete env.DASHSCOPE_BASE_URL;
    if (explicit) { env.DASHSCOPE_API_KEY = key; env.DASHSCOPE_BASE_URL = 'https://fixture.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'; }
    // A private test pipe emits the same SIGINT event as terminal Ctrl+C. No native window or HTTP shutdown.
    const entry = pathToFileURL(join(f.root, 'studio/server/main.ts')).href;
    const code = `process.argv=[process.execPath,${JSON.stringify(join(f.root, 'studio/server/main.ts'))},'--port',${JSON.stringify(String(f.port))}];await import(${JSON.stringify(entry)});process.stdin.once('data',()=>{process.emit('SIGINT');process.stdin.destroy();});`;
    const child = spawn(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', code], { cwd: f.root, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', data => { output += data.toString(); }); child.stderr.on('data', data => { output += data.toString(); });
    const exited = once(child, 'exit');
    try {
      const until = Date.now() + 10000;
      while (!output.includes('Studio API:') && !output.includes('LOCAL_CONFIG_INVALID') && child.exitCode === null && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 20));
      if (invalid) { assert.match(output, /LOCAL_CONFIG_INVALID/); child.stdin.end(); await exited; assert.equal(child.exitCode, 1); }
      else {
        const origin = /Studio API: (http:\/\/127\.0\.0\.1:\d+)\//.exec(output)?.[1]; assert.ok(origin, 'Standalone API must become ready');
        const html = await (await fetch(origin)).text(), pairing = JSON.parse(/<script id="studio-session" type="application\/json">([^<]*)<\/script>/.exec(html)![1]!);
        const status = await (await fetch(origin + '/api/authoring/v1/think/suggest', { headers: { 'X-Studio-Token': pairing.token } })).json();
        assert.equal(status.value.available, true); assert.equal(status.value.issue, null);
        child.stdin.end('stop'); await exited; assert.equal(child.exitCode, 0);
      }
      assert.ok(!output.includes(key)); assert.deepEqual(fs.readFileSync(f.source), f.original);
      assert.equal(fs.existsSync(desktopPaths(f.root).lease), false);
    } finally { if (child.exitCode === null) { child.stdin.end('stop'); await exited; } }
  };
  await execute(); assert.deepEqual(fs.readFileSync(store), encrypted);
  fs.writeFileSync(store, 'invalid'); await execute(true); await execute(false, true);
});

test('M7 recovers only a correlated, dead legacy session and keeps content and unrelated cache intact', { skip: !supported }, async t => {
  const f = await setupHost(t), paths = await staleState(f.root, f.port);
  fs.writeFileSync(join(paths.directory, 'unrelated.txt'), 'keep');
  assert.equal(await recoverDesktop(f.root, f.port), true);
  for (const file of [paths.lock, paths.state, paths.lease]) assert.equal(fs.existsSync(file), false);
  assert.equal(fs.readFileSync(join(paths.directory, 'unrelated.txt'), 'utf8'), 'keep');
  assert.deepEqual(fs.readFileSync(f.source), f.original);
  assert.equal(await recoverDesktop(f.root, f.port), false);
});

test('M7 never removes live, unowned, malformed, linked or changed state', { skip: !supported }, async t => {
  const f = await setupHost(t), paths = await staleState(f.root, f.port);
  const original = Object.fromEntries([paths.lock, paths.state, paths.lease].map(file => [file, fs.readFileSync(file)]));
  fs.writeFileSync(paths.lock, JSON.stringify({ ...JSON.parse(original[paths.lock]!.toString()), pid: process.pid }));
  await assert.rejects(recoverDesktop(f.root, f.port), /DESKTOP_BUSY/);
  fs.writeFileSync(paths.lock, original[paths.lock]!);
  fs.writeFileSync(paths.state, JSON.stringify({ ...JSON.parse(original[paths.state]!.toString()), token: '0'.repeat(64) }));
  await assert.rejects(recoverDesktop(f.root, f.port), /DESKTOP_STATE_INVALID/);
  fs.writeFileSync(paths.state, 'bad state');
  await assert.rejects(recoverDesktop(f.root, f.port), /DESKTOP_STATE_INVALID/);
  assert.deepEqual(fs.readFileSync(paths.lock), original[paths.lock]);
  assert.deepEqual(fs.readFileSync(paths.lease), original[paths.lease]);
  fs.writeFileSync(paths.state, original[paths.state]!);
  const duplicate = join(paths.directory, 'linked-state'); fs.linkSync(paths.state, duplicate);
  await assert.rejects(recoverDesktop(f.root, f.port), /DESKTOP_STATE_INVALID/);
  fs.unlinkSync(duplicate);
  const captured = desktopSnapshot(paths.state)!;
  fs.writeFileSync(paths.state, JSON.stringify({ ...JSON.parse(original[paths.state]!.toString()), pid: process.pid }));
  assert.throws(() => removeDesktopSnapshot(captured), /DESKTOP_STATE_CHANGED/);
  fs.writeFileSync(paths.state, original[paths.state]!);
  fs.unlinkSync(paths.lock);
  await assert.rejects(recoverDesktop(f.root, f.port), /DESKTOP_RECOVERY_REQUIRED/);
  for (const file of [paths.state, paths.lease]) assert.deepEqual(fs.readFileSync(file), original[file]);
});

test('M9 recovery includes only a Keep lease correlated with the proven dead API and preserves foreign leases', { skip: !supported }, async t => {
  const f = await setupHost(t), paths = await staleState(f.root, f.port);
  const keep = join(paths.directory, 'keep-authoring.lock'), unrelated = join(paths.directory, 'unrelated-module.lock');
  const own = fs.readFileSync(paths.lease);
  fs.writeFileSync(keep, JSON.stringify({ ...JSON.parse(own.toString()), pid: process.pid }));
  fs.writeFileSync(unrelated, 'KEEP_UNRELATED');
  await assert.rejects(recoverDesktop(f.root, f.port), /DESKTOP_RECOVERY_REQUIRED/);
  for (const path of [paths.lock, paths.state, paths.lease, keep]) assert.ok(fs.existsSync(path));
  fs.writeFileSync(keep, own);
  assert.equal(await recoverDesktop(f.root, f.port), true);
  for (const path of [paths.lock, paths.state, paths.lease, keep]) assert.equal(fs.existsSync(path), false);
  assert.equal(fs.readFileSync(unrelated, 'utf8'), 'KEEP_UNRELATED');
  fs.writeFileSync(keep, own);
  await assert.rejects(recoverDesktop(f.root, f.port), /DESKTOP_RECOVERY_REQUIRED/);
  assert.deepEqual(fs.readFileSync(keep), own);
});

test('M10 Me lease recovery requires the same dead API identity and never adopts an orphan', { skip: !supported }, async t => {
  const f = await setupHost(t), paths = await staleState(f.root, f.port), me = join(paths.directory, 'me-authoring.lock');
  const lease = fs.readFileSync(paths.lease);
  fs.writeFileSync(me, JSON.stringify({ ...JSON.parse(lease.toString()), pid: process.pid }));
  await assert.rejects(recoverDesktop(f.root, f.port), /DESKTOP_RECOVERY_REQUIRED/);
  assert.ok(fs.existsSync(paths.lock)); assert.ok(fs.existsSync(me));
  fs.writeFileSync(me, lease); assert.equal(await recoverDesktop(f.root, f.port), true); assert.equal(fs.existsSync(me), false);
  fs.writeFileSync(me, lease); await assert.rejects(recoverDesktop(f.root, f.port), /DESKTOP_RECOVERY_REQUIRED/); assert.deepEqual(fs.readFileSync(me), lease);
});

test('M11 Build lease recovery preserves foreign owners and removes only correlated dead-instance state', { skip: !supported }, async t => {
  const f = await setupHost(t), paths = await staleState(f.root, f.port), build = join(paths.directory, 'build-authoring.lock');
  const lease = fs.readFileSync(paths.lease);
  fs.writeFileSync(build, JSON.stringify({ ...JSON.parse(lease.toString()), pid: process.pid }));
  await assert.rejects(recoverDesktop(f.root, f.port), /DESKTOP_RECOVERY_REQUIRED/);
  assert.ok(fs.existsSync(paths.lock)); assert.ok(fs.existsSync(build));
  fs.writeFileSync(build, lease); assert.equal(await recoverDesktop(f.root, f.port), true); assert.equal(fs.existsSync(build), false);
  fs.writeFileSync(build, lease); await assert.rejects(recoverDesktop(f.root, f.port), /DESKTOP_RECOVERY_REQUIRED/); assert.deepEqual(fs.readFileSync(build), lease);
});

test('M12 trusted private selection binds only an outside encrypted-file capability through IPC; HTTP and control pipe gain no path access', { skip: !supported }, async t => {
  const f = await setupHost(t), external = join(f.root, '..', 'm12-external-' + randomUUID()); fs.mkdirSync(external);
  t.after(() => fs.rmSync(external, { recursive: true }));
  const host = await startDesktopHost({ root: f.root, store: f.store, port: f.port, build: false });
  try {
    const target = join(external, '中文主文件.json');
    const handle = await host.bindPrivateFile(target, 'create', randomUUID()); assert.match(handle, /^[a-f0-9-]{36}$/);
    assert.equal(fs.existsSync(target), false);
    await assert.rejects(host.bindPrivateFile(join(f.root, 'inside.json'), 'create', randomUUID()), /PRIVATE_FILE_SELECTION_INVALID/);
    assert.equal((await fetch(host.origin + '/api/authoring/v1/private/files/' + handle)).status, 401);
    assert.deepEqual(fs.readFileSync(f.source), f.original);
  } finally { await host.stop(); }
});

test('M12 native/build environments strip inherited WebView2 profile/debug/security overrides', () => {
  const name = 'WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS', old = process.env[name]; process.env[name] = 'NON_SENSITIVE_OVERRIDE';
  try { assert.equal(appBuildEnvironment(resolve('.'))[name], undefined); }
  finally { if (old === undefined) delete process.env[name]; else process.env[name] = old; }
});

test('M15 trusted native export binding preserves the active master capability and cannot select a repository output', {skip:!supported},async t=>{
  const f=await setupHost(t),external=join(f.root,'..','m15-external-'+randomUUID());fs.mkdirSync(external);t.after(()=>{assert.ok(relative(cache,external).startsWith('m15-external-'));fs.rmSync(external,{recursive:true});});
  const file=join(external,'master.json');fs.writeFileSync(file,JSON.stringify(await encryptVault({version:1,modules:{},assets:{}},'NON_SENSITIVE_NATIVE_EXPORT_PASSWORD')));const host=await startDesktopHost({root:f.root,store:f.store,port:f.port,build:false});
  try{
    const master=await host.bindPrivateFile(file,'open',randomUUID()),candidate=await host.bindPrivateFile(join(external,'candidate.json'),'export',randomUUID());assert.notEqual(master,candidate);assert.equal(fs.existsSync(join(external,'candidate.json')),false);
    const text=await(await fetch(host.origin)).text(),paired=JSON.parse(/<script id="studio-session" type="application\/json">([^<]+)<\/script>/.exec(text)![1]!) as {token:string};const response=await fetch(host.origin+'/api/studio-private/files/'+master,{headers:{'X-Studio-Token':paired.token}});assert.equal(response.status,200);assert.equal((await response.json()).ok,true);
    await assert.rejects(host.bindPrivateFile(join(f.root,'public/vault/bundle.json'),'export',randomUUID()),/PRIVATE_FILE_SELECTION_INVALID/);assert.deepEqual(fs.readFileSync(f.source),f.original);
  }finally{await host.stop();}
});

test('M7 recovery refuses an occupied port, even when recorded owners have exited', { skip: !supported }, async t => {
  const f = await setupHost(t), paths = await staleState(f.root, f.port);
  const bytes = [paths.lock, paths.state, paths.lease].map(file => fs.readFileSync(file));
  const occupied = createServer(); occupied.listen(f.port, '127.0.0.1'); await once(occupied, 'listening');
  try { await assert.rejects(recoverDesktop(f.root, f.port), /PORT_UNAVAILABLE/); }
  finally { await new Promise<void>(resolve => occupied.close(() => resolve())); }
  [paths.lock, paths.state, paths.lease].forEach((file, index) => assert.deepEqual(fs.readFileSync(file), bytes[index]));
  assert.equal(await recoverDesktop(f.root, f.port), true);
});

test('M7 refuses a redirected cache directory before creating state outside the repository', { skip: !supported }, t => {
  const { root } = fixture(t), outside = join(root, 'external'), redirected = join(root, '.cache');
  fs.mkdirSync(outside); fs.writeFileSync(join(outside, 'keep.txt'), 'NON_SENSITIVE_OUTSIDE');
  fs.symlinkSync(outside, redirected, 'junction');
  try {
    assert.throws(() => desktopDirectory(root), /DESKTOP_STATE_INVALID/);
    assert.deepEqual(fs.readdirSync(outside), ['keep.txt']);
    assert.equal(fs.readFileSync(join(outside, 'keep.txt'), 'utf8'), 'NON_SENSITIVE_OUTSIDE');
  } finally { fs.unlinkSync(redirected); }
});

test('M7 concurrent open, immediate stop/reopen and a spaced Chinese repository use one authenticated instance', { skip: !supported }, async t => {
  const f = await setupHost(t, true); buildFixture(f.root);
  const options = { root: f.root, store: f.store, port: f.port };
  try {
    const [one, two] = await Promise.all([openDesktop(options), openDesktop(options)]);
    assert.deepEqual(one, two);
    assert.equal(fs.readFileSync(join(f.root, 'build-count.txt'), 'utf8'), 'build\n');
    assert.deepEqual(await openDesktop(options), one);
    await stopDesktop(f.root, f.port);
    for (const file of [desktopPaths(f.root).lock, desktopPaths(f.root).state, desktopPaths(f.root).lease]) assert.equal(fs.existsSync(file), false);
    const reopened = await openDesktop(options); assert.notEqual(reopened.pid, one.pid);
    assert.equal(fs.readFileSync(join(f.root, 'build-count.txt'), 'utf8'), 'build\n');
    assert.deepEqual(fs.readFileSync(f.source), f.original);
  } finally { await stopDesktop(f.root, f.port); }
});

test('M7 build receipts invalidate on input/output changes, fail closed, and never give the compiler an AI key', { skip: !supported }, async t => {
  const f = await setupHost(t); buildFixture(f.root);
  const originalKey = process.env.DASHSCOPE_API_KEY, originalBase = process.env.DASHSCOPE_BASE_URL;
  process.env.DASHSCOPE_API_KEY = key; process.env.DASHSCOPE_BASE_URL = 'NON_SENSITIVE_BUILD_BASE';
  try {
    assert.deepEqual(await ensureDesktopWeb(f.root), { rebuilt: true });
    assert.deepEqual(await ensureDesktopWeb(f.root), { rebuilt: false });
    fs.writeFileSync(join(f.root, 'src/modules/think/content/another-draft.md'), '---\nslug: another-draft\n---\nNON_SENSITIVE_CACHE_DRAFT\n');
    fs.appendFileSync(join(f.root, 'studio/desktop/Program.cs'), '\n// independent native source change\n');
    assert.deepEqual(await ensureDesktopWeb(f.root), { rebuilt: false }, 'Content and C# edits must not rebuild the Web editor');
    const webOutput = join(f.root, '.cache/studio/web/main.js'), linkedOutput = join(f.root, 'linked-web-output');
    fs.linkSync(webOutput, linkedOutput);
    try { await assert.rejects(ensureDesktopWeb(f.root), /DESKTOP_STATE_INVALID/); }
    finally { fs.unlinkSync(linkedOutput); }
    fs.appendFileSync(webOutput, 'NON_SENSITIVE_TAMPER');
    assert.deepEqual(await ensureDesktopWeb(f.root), { rebuilt: true }, 'Tampered Web output cannot use a valid receipt');
    fs.appendFileSync(join(f.root, 'studio/private/session.ts'), '\n// private session changed\n');
    assert.deepEqual(await ensureDesktopWeb(f.root), { rebuilt: true });
    fs.appendFileSync(join(f.root, 'src/modules/think/vault.css'), '\n/* private preview changed */\n');
    assert.deepEqual(await ensureDesktopWeb(f.root), { rebuilt: true });
    fs.appendFileSync(join(f.root, 'studio/web/main.ts'), '\n// changed input\n');
    assert.deepEqual(await ensureDesktopWeb(f.root), { rebuilt: true });
    fs.unlinkSync(join(f.root, '.cache/studio/web/main.js'));
    assert.deepEqual(await ensureDesktopWeb(f.root), { rebuilt: true });
    fs.writeFileSync(join(f.root, '.cache/studio/web-build.json'), 'corrupt regular receipt');
    assert.deepEqual(await ensureDesktopWeb(f.root), { rebuilt: true });
    fs.appendFileSync(join(f.root, 'studio/web/main.ts'), '\n// failed build input\n');
    fs.writeFileSync(join(f.root, 'build-fail'), '');
    await assert.rejects(ensureDesktopWeb(f.root), /WEB_BUILD_FAILED/);
    fs.unlinkSync(join(f.root, 'build-fail'));
    assert.deepEqual(await ensureDesktopWeb(f.root), { rebuilt: true });
    fs.unlinkSync(join(f.root, 'node_modules/vite/bin/vite.js'));
    await assert.rejects(ensureDesktopWeb(f.root), /DEPENDENCIES_MISSING/);
    assert.deepEqual(fs.readFileSync(f.source), f.original);
  } finally {
    if (originalKey === undefined) delete process.env.DASHSCOPE_API_KEY; else process.env.DASHSCOPE_API_KEY = originalKey;
    if (originalBase === undefined) delete process.env.DASHSCOPE_BASE_URL; else process.env.DASHSCOPE_BASE_URL = originalBase;
  }
});

test('M7 startup reports build/dependency failures and preserves an independently started authoring server', { skip: !supported }, async t => {
  const f = await setupHost(t); buildFixture(f.root);
  const options = { root: f.root, store: f.store, port: f.port };
  fs.writeFileSync(join(f.root, 'build-fail'), '');
  await assert.rejects(openDesktop(options), /WEB_BUILD_FAILED/);
  for (const file of [desktopPaths(f.root).lock, desktopPaths(f.root).state, desktopPaths(f.root).lease]) assert.equal(fs.existsSync(file), false);
  fs.unlinkSync(join(f.root, 'build-fail'));
  const manual = await startStudioHttp({ repositoryRoot: f.root, port: f.port });
  try {
    await assert.rejects(openDesktop(options), /USE_TERMINAL_CTRL_C/);
    await assert.rejects(stopDesktop(f.root, f.port), /USE_TERMINAL_CTRL_C/);
    assert.equal((await fetch(manual.origin)).status, 200);
  } finally { await manual.close(); }
});

test('M7 a lost fixture host closes its owned API through IPC disconnect and the next open recovers its correlated state', { skip: !supported }, async t => {
  const f = await setupHost(t); buildFixture(f.root);
  const options = { root: f.root, store: f.store, port: f.port };
  try {
    const before = await openDesktop(options);
    const owner = JSON.parse(fs.readFileSync(desktopPaths(f.root).lock, 'utf8')) as {pid:number};
    assert.notEqual(owner.pid, process.pid); assert.notEqual(owner.pid, before.pid);
    // Only this test's authenticated, freshly spawned fixture host is terminated to simulate a crash.
    process.kill(owner.pid);
    await waitGone(owner.pid);
    const after = await openDesktop(options);
    assert.notEqual(after.pid, before.pid);
    assert.deepEqual(fs.readFileSync(f.source), f.original);
    assert.equal(fs.readFileSync(join(f.root, 'build-count.txt'), 'utf8'), 'build\n');
  } finally { await stopDesktop(f.root, f.port); }
});

test('M7 an unexpectedly exited fixture API keeps the ownership evidence needed for a safe reopen', { skip: !supported }, async t => {
  const f = await setupHost(t); buildFixture(f.root);
  const options = { root: f.root, store: f.store, port: f.port };
  try {
    const before = await openDesktop(options);
    const state = JSON.parse(fs.readFileSync(desktopPaths(f.root).state, 'utf8'));
    assert.equal(state.pid, before.pid); assert.notEqual(before.pid, process.pid);
    // Terminate only the API spawned by this non-sensitive fixture, never a user instance.
    process.kill(before.pid);
    await waitGone(before.pid);
    const after = await openDesktop(options);
    assert.notEqual(after.pid, before.pid);
    assert.deepEqual(fs.readFileSync(f.source), f.original);
    assert.equal(fs.readFileSync(join(f.root, 'build-count.txt'), 'utf8'), 'build\n');
  } finally { await stopDesktop(f.root, f.port); }
});

test('M8 authenticated activation and cooperative stop preserve the API and source on cancellation', { skip: !supported }, async t => {
  const f = await setupHost(t); let accepted = false, activated = 0, stopped = 0;
  const host = await startDesktopHost({ root: f.root, store: f.store, port: f.port, build: false,
    app: { prepareClose: async () => accepted, activate: async () => { activated++; }, stopped: () => { stopped++; }, failed: () => assert.fail('API unexpectedly failed') },
  });
  try {
    assert.deepEqual(await desktopControl(f.root, 'activate'), { origin: host.origin, pid: host.pid, app: true });
    assert.equal(activated, 1);
    await assert.rejects(desktopControl(f.root, 'stop'), /DESKTOP_CLOSE_CANCELLED/);
    assert.equal(stopped, 0); assert.equal((await fetch(host.origin)).status, 200);
    assert.deepEqual(fs.readFileSync(f.source), f.original);
    accepted = true; await desktopControl(f.root, 'stop');
    assert.equal(stopped, 1);
    for (const file of [desktopPaths(f.root).lock, desktopPaths(f.root).state, desktopPaths(f.root).lease]) assert.equal(fs.existsSync(file), false);
  } finally { await host.stop(); }
});

test('M8 refuses to adopt browser or terminal services and preserves their authoring ownership', { skip: !supported }, async t => {
  const f = await setupHost(t), options = { root: f.root, store: f.store, port: f.port };
  const host = await startDesktopHost({ ...options, build: false });
  try {
    await assert.rejects(openApp(options), /APP_MODE_CONFLICT/);
    assert.equal((await desktopControl(f.root, 'status'))!.pid, host.pid);
    assert.equal((await fetch(host.origin)).status, 200);
  } finally { await host.stop(); }
  const manual = await startStudioHttp({ repositoryRoot: f.root, port: f.port });
  try {
    await assert.rejects(openApp(options), /USE_TERMINAL_CTRL_C/);
    assert.equal((await fetch(manual.origin)).status, 200);
    assert.deepEqual(fs.readFileSync(f.source), f.original);
  } finally { await manual.close(); }
});

test('M8 a failed App API preserves window activation until an explicit close and retains safe recovery evidence', { skip: !supported }, async t => {
  const f = await setupHost(t); let failed = 0, activated = 0, stopped = 0;
  const host = await startDesktopHost({ root: f.root, store: f.store, port: f.port, build: false,
    app: { prepareClose: async () => true, activate: async () => { activated++; }, stopped: () => { stopped++; }, failed: () => { failed++; } },
  });
  process.kill(host.pid); await waitGone(host.pid);
  const until = Date.now() + 3000; while (!failed && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(failed, 1); assert.equal(stopped, 0);
  await desktopControl(f.root, 'activate'); assert.equal(activated, 1);
  await assert.rejects(desktopControl(f.root, 'stop'), /DESKTOP_STOP_FAILED/);
  assert.equal(stopped, 1);
  assert.equal(fs.existsSync(desktopPaths(f.root).lock), true);
  assert.equal(fs.existsSync(desktopPaths(f.root).state), true);
  assert.deepEqual(fs.readFileSync(f.source), f.original);
  await assert.rejects(host.stop(), /DESKTOP_RECOVERY_REQUIRED/);
});

test('M8 App builds keep key-free environments and reject redirected output before compiling', { skip: !supported }, async t => {
  const f = await setupHost(t), outside = join(f.root, 'outside');
  fs.mkdirSync(outside); fs.writeFileSync(join(outside, 'keep'), 'NON_SENSITIVE');
  const directory = join(f.root, '.cache/studio/desktop'); fs.mkdirSync(directory); fs.symlinkSync(outside, join(directory, 'app'), 'junction');
  try { await assert.rejects(ensureDesktopApp(f.root), /DESKTOP_STATE_INVALID/); }
  finally { fs.unlinkSync(join(directory, 'app')); }
  assert.deepEqual(fs.readdirSync(outside), ['keep']);
  const env = appBuildEnvironment(f.root); assert.equal(env.DASHSCOPE_API_KEY, undefined); assert.equal(env.DASHSCOPE_BASE_URL, undefined);
  assert.ok(env.DOTNET_CLI_HOME!.startsWith(f.root));
  const code = `import{ensureDesktopApp}from${JSON.stringify(pathToFileURL(resolve('studio/windows/app-build.ts')).href)};try{await ensureDesktopApp(${JSON.stringify(f.root)})}catch(e){console.log(e.message)}`;
  const result = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', code], { windowsHide: true, encoding: 'utf8', env: { ...process.env, Path: '', PATH: '' } });
  assert.equal(result.trim(), 'DOTNET_SDK_MISSING'); assert.deepEqual(fs.readFileSync(f.source), f.original);
});

test('M7 shortcuts preflight foreign destinations and launchers diagnose missing Node without a modal', { skip: !supported }, t => {
  const { root } = fixture(t);
  const ps = join(process.env.SystemRoot!, 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const foreign = join(root, 'Stop Personal Space Studio.lnk');
  const code = `$ProgressPreference='SilentlyContinue';$s=New-Object -ComObject WScript.Shell;$v=$s.CreateShortcut('${foreign.replaceAll("'", "''")}');$v.TargetPath='notepad.exe';$v.Description='unrelated shortcut';$v.Save()`;
  execFileSync(ps, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')], { windowsHide: true });
  const before = fs.readFileSync(foreign);
  assert.throws(() => execFileSync(ps, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', resolve('studio/windows/Install-Shortcuts.ps1'), '-DesktopPath', root], { windowsHide: true, stdio: 'pipe' }));
  assert.deepEqual(fs.readFileSync(foreign), before);
  assert.equal(fs.existsSync(join(root, 'Personal Space Studio.lnk')), false);
  try {
    execFileSync(ps, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', resolve('studio/windows/Stop.ps1'), '-NodePath', join(root, 'missing.exe'), '-NoDialog'], { windowsHide: true, stdio: 'pipe', env: { ...process.env, Path: '', PATH: '' } });
    assert.fail('missing Node must fail');
  } catch (error) {
    assert.equal((error as {status: number}).status, 1);
    assert.match((error as {stderr: Buffer}).stderr.toString(), /Studio: NODE_NOT_FOUND/);
  }
});

test('M16.1 ten isolated API starts record ordered bounded stages without UI or real credentials', {skip:!supported}, async t=>{
 const f=await setupHost(t);
 for(let i=0;i<10;i++){const trace=new StartupTrace(f.root);const host=await startDesktopHost({root:f.root,store:f.store,port:f.port,build:false,startup:trace.mark});
 try{const phases=trace.snapshot().stages;assert.ok(phases.some(event=>event.phase==='credentials'));assert.equal(phases.at(-1)!.phase,'api-ready');assert.ok(!phases.some(event=>event.phase==='window-visible'));assert.ok(phases.at(-1)!.atMs>=0);assert.ok(!JSON.stringify(trace.snapshot()).includes(f.store));}finally{await host.stop();}}
 // Regression runs must not replace the historical M16.1 measurement artifact.
});
