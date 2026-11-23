import type { StartupNote } from './startup.ts';
import { fork } from 'node:child_process';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, createConnection } from 'node:net';
import { writeFileSync, existsSync, openSync, closeSync, fsyncSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DesktopError, localStorePath } from './local.ts';
import { desktopDirectory, desktopPaths as paths, stateAt, desktopSnapshot, desktopJson, removeDesktopSnapshot, startupOwner, recoverDesktop, assertPortFree, writeDesktopJson, processGone } from './desktop-state.ts';
import { ensureDesktopWeb } from './web-build.ts';
import type { PreparedStudio } from './prepared.ts';

const defaultRoot = fileURLToPath(new URL('../../', import.meta.url));
type State = NonNullable<ReturnType<typeof stateAt>>;
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Only status/stop over an authenticated local pipe. No authoring, paths, commands or credentials. */
export async function desktopControl(root: string, action: 'status' | 'stop' | 'activate'): Promise<{ origin: string; pid: number; app?: true } | undefined> {
  desktopDirectory(root);
  const state = stateAt(root); if (!state) return undefined;
  return new Promise((resolve, reject) => {
    const socket = createConnection(state.pipe);
    let text = '';
    socket.setTimeout(action === 'stop' ? 300_000 : action === 'activate' ? 90_000 : 5000, () => socket.destroy(new Error()));
    socket.on('connect', () => socket.write(JSON.stringify({ action, token: state.token }) + '\n'));
    socket.on('data', data => {
      text += data.toString();
      if (text.length > 2048) { socket.destroy(); reject(new DesktopError('DESKTOP_STATE_INVALID')); }
    });
    socket.once('error', () => reject(new DesktopError('DESKTOP_UNAVAILABLE')));
    socket.once('end', () => {
      if (!text.trim()) { reject(new DesktopError('DESKTOP_UNAVAILABLE')); return; }
      try {
        const result = JSON.parse(text) as { ok: boolean; origin: string; pid: number; app?: boolean; code?: string };
        if (!result.ok && ['DESKTOP_CLOSE_CANCELLED', 'APP_MODE_CONFLICT', 'DESKTOP_STOP_FAILED'].includes(result.code ?? '')) throw new DesktopError(result.code!);
        if (!result.ok || result.origin !== state.origin || result.pid !== state.pid) throw new Error();
        resolve({ origin: result.origin, pid: result.pid, ...(result.app === true ? { app: true as const } : {}) });
      } catch (error) { reject(error instanceof DesktopError ? error : new DesktopError('DESKTOP_STATE_INVALID')); }
    });
  });
}

/** root/store/port/build are trusted integration-test options, never frontend or Agent inputs. */
export type AppLifecycle = { prepareClose(): Promise<boolean>; activate(): Promise<void>; stopped(): void; failed(): void; closeFailed?(): void };
export async function startDesktopHost(options: { root?: string; store?: string; port?: number; build?: boolean; beforeStart?(): Promise<void>; startup?: StartupNote; app?: AppLifecycle; prepared?:PreparedStudio } = {}) {
  if (process.platform !== 'win32') throw new DesktopError('WINDOWS_ONLY');
  const root = resolve(options.root ?? defaultRoot), path = paths(root);
  desktopDirectory(root);
  let lock: number;
  try { lock = openSync(path.lock, 'wx', 0o600); }
  catch { throw new DesktopError('DESKTOP_BUSY'); }
  const token = randomBytes(32).toString('hex');
  try { writeFileSync(lock, JSON.stringify({ pid: process.pid, token })); fsyncSync(lock); } finally { closeSync(lock); }
  const ownedLock = desktopSnapshot(path.lock)!;
  let child: ReturnType<typeof fork> | undefined;
  let state: State | undefined;
  let ownedState: ReturnType<typeof desktopSnapshot>;
  let stopping: Promise<void> | undefined;
  const server = createServer();
  const sockets = new Set<import('node:net').Socket>();
  const cleanup = () => {
    // If the API died before releasing its lease, preserve the correlated desktop
    // state. A later opener may recover it only after this host has also exited.
    if (ownedState && existsSync(path.lease)) throw new DesktopError('DESKTOP_RECOVERY_REQUIRED');
    if (ownedState) removeDesktopSnapshot(ownedState);
    removeDesktopSnapshot(ownedLock);
  };
  const stop = (reply?: (error?: unknown) => void) => {
    if(stopping)return stopping;
    const attempt=(async () => {
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      await new Promise<void>((resolve, reject) => {
        const target=child!,finish=(error?:Error)=>{clearTimeout(timer);target.off('exit',exited);target.off('message',refused);if(error)reject(error);else resolve();};
        const exited=()=>finish(),refused=(value:unknown)=>{if(value&&typeof value==='object'&&!Array.isArray(value)){const v=value as Record<string,unknown>;if(Object.keys(v).sort().join()==='code,type'&&v.type==='studio:stop-refused'&&v.code==='AUTHORING_BUSY')finish(new DesktopError('DESKTOP_STOP_FAILED'));}};
        const timer = setTimeout(() => finish(new DesktopError('DESKTOP_STOP_TIMEOUT')), 15_000);
        target.once('exit',exited);target.on('message',refused);
        if (child!.connected) child!.send('studio:stop');
        else finish(new DesktopError('DESKTOP_STOP_FAILED'));
      });
    }
    const closed = server.listening ? new Promise<void>(resolve => server.close(() => resolve())) : Promise.resolve();
    for (const socket of sockets) socket.end();
    let failure: unknown;
    try { cleanup(); } catch (error) { failure = error; }
    reply?.(failure);
    await closed;
    options.app?.stopped();
    if (failure) throw failure;
    })();stopping=attempt;void attempt.catch(()=>{if(stopping===attempt)stopping=undefined;});return attempt;
  };
  try {
    if (existsSync(path.state)) throw new DesktopError('DESKTOP_STALE_SESSION');
    await options.beforeStart?.();
    const web = options.build !== false ? await ensureDesktopWeb(root, options.startup) : { rebuilt: false };
    const env = { ...process.env }; delete env.DASHSCOPE_API_KEY; delete env.DASHSCOPE_BASE_URL; delete env.GEMINI_API_KEY; delete env.STUDIO_AI_PROVIDER;
    // Node's fetch does not use inherited proxy variables until explicitly enabled.
    const proxy = process.env.https_proxy || process.env.http_proxy;
    const execArgv = options.prepared ? [] : ['--experimental-strip-types'];
    if (proxy) {
      const bypass = (process.env.no_proxy ?? '').split(',').map(value => value.trim()).filter(Boolean);
      for (const name of Object.keys(env)) if (name.toUpperCase() === 'NO_PROXY') delete env[name];
      env.NO_PROXY = [...new Set([...bypass, 'localhost', '127.0.0.1', '[::1]'])].join(',');
      execArgv.push('--use-env-proxy');
    }
    // The backend reads the explicit store after building. No plaintext AI configuration crosses the fork environment.
    options.startup?.('backend-start');
    child = fork(options.prepared?.backend??join(root, 'studio/server/main.ts'), options.port ? ['--port', String(options.port)] : [], {
      cwd: root, env, silent: true, windowsHide: true, execArgv,
    });
    let startCode = 'DESKTOP_START_FAILED';
    child.stdout!.resume();
    child.stderr!.on('data', bytes => {
      const match = /LOCAL_CONFIG_INVALID|LOCAL_CONFIG_UNSAFE|AUTHORING_BUSY|PORT_UNAVAILABLE|WEB_BUILD_UNAVAILABLE|ERR_MODULE_NOT_FOUND/.exec(bytes.toString());
      if (match) startCode = match[0] === 'ERR_MODULE_NOT_FOUND' ? 'DEPENDENCIES_MISSING' : match[0];
    });
    const origin = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new DesktopError('DESKTOP_START_TIMEOUT')), 20_000);
      child!.once('error', () => { clearTimeout(timer); reject(new DesktopError('DESKTOP_START_FAILED')); });
      child!.once('exit', () => { clearTimeout(timer); reject(new DesktopError(startCode)); });
      child!.on('message', message => {
        if(message&&typeof message==='object'&&'type'in message&&'phase'in message&&Object.keys(message).sort().join()==='phase,type'&&message.type==='studio:startup-phase'&&message.phase==='credentials')options.startup?.('credentials');
        if(message&&typeof message==='object'&&'type'in message&&'phase'in message&&Object.keys(message).sort().join()==='phase,type'&&message.type==='studio:startup-phase'&&message.phase==='ai-ready')options.startup?.('ai-ready');
        if (message && typeof message === 'object' && 'type' in message && message.type === 'studio:ready'
          && 'origin' in message && typeof message.origin === 'string' && /^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(message.origin)) {
          clearTimeout(timer); resolve(message.origin);
        }
      });
      options.startup?.('credential-location');
      child!.send(options.prepared?{type:'studio:start',repositoryRoot:root,webDirectory:options.prepared.web,deferCredentials:true,
        ...(options.store!==undefined?{localCredentialStore:options.store}:{localCredentials:true})}
        :{ type: 'studio:start', localCredentialStore: options.store ?? localStorePath() });
    });
    options.startup?.('api-ready');
    state = { version: 1, origin, token, pipe: path.pipe, pid: child.pid! };
    server.on('connection', socket => {
      sockets.add(socket); socket.once('close', () => sockets.delete(socket));
      socket.setTimeout(5000, () => socket.destroy());
      let input = '';
      socket.on('error', () => {});
      socket.on('data', bytes => {
        input += bytes.toString();
        if (input.length > 256) { socket.destroy(); return; }
        if (!input.includes('\n')) return;
        socket.removeAllListeners('data');
        try {
          const request = JSON.parse(input) as { action?: string; token?: string };
          if (Object.keys(request).sort().join() !== 'action,token' || !['status', 'stop', 'activate'].includes(request.action!)
            || typeof request.token !== 'string' || !/^[a-f0-9]{64}$/.test(request.token)
            || !timingSafeEqual(Buffer.from(request.token), Buffer.from(token))) throw new Error();
          const response = JSON.stringify({ ok: true, origin, pid: state!.pid, ...(options.app ? { app: true } : {}) });
          if (request.action === 'status') socket.end(response);
          else if (request.action === 'activate') {
            if (!options.app) socket.end(JSON.stringify({ ok: false, code: 'APP_MODE_CONFLICT' }));
            else { socket.setTimeout(90_000); void options.app.activate().then(() => socket.end(response)).catch(() => socket.end(JSON.stringify({ ok: false, code: 'DESKTOP_STOP_FAILED' }))); }
          }
          else {
            // Reply after the Authoring service releases its lease, before closing this control socket.
            const own = socket; sockets.delete(own);
            own.setTimeout(300_000, () => own.destroy());
            void (async () => {
              if (options.app && !await options.app.prepareClose()) { own.end(JSON.stringify({ ok: false, code: 'DESKTOP_CLOSE_CANCELLED' })); return; }
              await stop(error => own.end(error ? JSON.stringify({ ok: false, code: 'DESKTOP_STOP_FAILED' }) : response));
            })().catch(() => {
              if (child?.pid && !processGone(child.pid)) options.app?.closeFailed?.();
              if (!own.writableEnded) own.end(JSON.stringify({ ok: false, code: 'DESKTOP_STOP_FAILED' }));
            });
          }
        } catch { socket.end(JSON.stringify({ ok: false })); }
      });
    });
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(path.pipe, resolve); });
    writeFileSync(path.state, JSON.stringify(state), { flag: 'wx', mode: 0o600 });
    ownedState = desktopSnapshot(path.state);
    child.once('exit', () => {
      // An App keeps its window/control ownership alive so the author can copy
      // buffers and explicitly exit, even when its API has already disappeared.
      if (!stopping && options.app) { options.app.failed(); return; }
      if (!stopping) void stop().catch(error => {
        process.stderr.write(`Studio: ${error instanceof DesktopError ? error.message : 'DESKTOP_STOP_FAILED'}\n`);
      });
    });
    return { origin, pid: state.pid, webRebuilt: web.rebuilt, stop: () => stop(),
      /** Trusted native selection only; never exposed through the desktop control pipe or HTTP. */
      bindPrivateFile: (file: string, mode: 'open' | 'create' | 'export', requestId: string) => new Promise<string>((resolveBinding, rejectBinding) => {
        if (!child?.connected || !state || stopping || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(requestId)) { rejectBinding(new DesktopError('PRIVATE_FILE_SELECTION_INVALID')); return; }
        const target = child;
        const cleanup = () => { clearTimeout(timer); target.off('message', receive); target.off('exit', lost); target.off('disconnect', lost); };
        const lost = () => { cleanup(); rejectBinding(new DesktopError('PRIVATE_FILE_SELECTION_INVALID')); };
        const receive = (message: unknown) => {
          if (!message || typeof message !== 'object' || Array.isArray(message)) return;
          const value = message as Record<string, unknown>; if (value.requestId !== requestId) return;
          cleanup();
          if (value.type === 'studio:private-bound' && Object.keys(value).sort().join() === 'handle,requestId,type' && typeof value.handle === 'string'
            && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value.handle)) resolveBinding(value.handle);
          else rejectBinding(new DesktopError('PRIVATE_FILE_SELECTION_INVALID'));
        };
        const timer = setTimeout(lost, 10000);
        target.on('message', receive); target.once('exit', lost); target.once('disconnect', lost);
        target.send({ type: 'studio:private-bind', requestId, path: file, mode }, error => { if (error) lost(); });
      }),
    };
  } catch (error) {
    await stop();
    throw error instanceof DesktopError ? error : new DesktopError('DESKTOP_START_FAILED');
  }
}

export async function existingStudio(port = 4322): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, { redirect: 'error', signal: AbortSignal.timeout(1000) });
    const text = await response.text();
    const match = /<script id="studio-session" type="application\/json">([^<]*)<\/script>/.exec(text);
    const value = JSON.parse(match?.[1] ?? 'null');
    return response.ok && value?.origin === `http://127.0.0.1:${port}` && /^[a-f0-9]{64}$/.test(value?.token);
  } catch { return false; }
}

type LaunchOptions = { root?: string; store?: string; port?: number };
function launchHost(root: string, options: LaunchOptions): Promise<void> {
  const env = { ...process.env }; delete env.DASHSCOPE_API_KEY; delete env.DASHSCOPE_BASE_URL; delete env.GEMINI_API_KEY; delete env.STUDIO_AI_PROVIDER;
  const child = fork(join(root, 'studio/windows/desktop.ts'), ['host'], { cwd: root, env, detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true, execArgv: ['--experimental-strip-types'] });
  child.unref();
  return new Promise((resolve, reject) => {
    const finish = (error?: DesktopError) => {
      clearTimeout(timer); child.removeAllListeners('message');
      if (child.connected) child.disconnect();
      if (error) reject(error); else resolve();
    };
    const timer = setTimeout(() => finish(new DesktopError('DESKTOP_START_TIMEOUT')), 90_000);
    child.once('error', () => finish(new DesktopError('DESKTOP_START_FAILED')));
    child.once('exit', () => finish(new DesktopError('DESKTOP_START_FAILED')));
    child.on('message', value => {
      if (!value || typeof value !== 'object' || !('type' in value)) return;
      if (value.type === 'studio:desktop-ready') finish();
      else if (value.type === 'studio:desktop-error' && 'code' in value && typeof value.code === 'string' && /^[A-Z_]+$/.test(value.code)) finish(new DesktopError(value.code));
    });
    child.send({ type: 'studio:desktop-start', ...(options.port ? { port: options.port } : {}), ...(options.store ? { store: options.store } : {}) });
  });
}
/** Programmatic options are trusted local/test inputs, never HTTP or browser configuration. */
export async function openDesktop(options: LaunchOptions = {}): Promise<{ origin: string; pid: number }> {
  const root = resolve(options.root ?? defaultRoot), port = options.port ?? 4322, started = Date.now();
  desktopDirectory(root);
  let waitingFor: number | undefined;
  let portBusySince: number | undefined;
  while (Date.now() - started < 90_000) {
    try { const current = await desktopControl(root, 'status'); if (current && !processGone(current.pid)) return current; }
    catch (error) { if (!(error instanceof DesktopError) || error.message !== 'DESKTOP_UNAVAILABLE') throw error; }
    const owner = startupOwner(root);
    if (owner || existsSync(paths(root).state) || existsSync(paths(root).lease)) {
      try { await recoverDesktop(root, port); }
      catch (error) {
        // Windows may report EADDRINUSE briefly after both recorded processes
        // have exited. Re-probe the same evidence, never remove it while busy.
        if (error instanceof DesktopError && error.message === 'PORT_UNAVAILABLE' && owner && processGone(owner.pid)) {
          portBusySince ??= Date.now();
          if (Date.now() - portBusySince < 3000) { await delay(100); continue; }
        }
        if (!(error instanceof DesktopError) || error.message !== 'DESKTOP_BUSY') {
          if (!owner && await existingStudio(port)) throw new DesktopError('USE_TERMINAL_CTRL_C');
          throw error;
        }
        waitingFor = owner?.pid; await delay(200); continue;
      }
    }
    portBusySince = undefined;
    if (waitingFor) {
      const file = desktopSnapshot(paths(root).error);
      if (file) {
        const failed = desktopJson(file);
        if (failed.pid === waitingFor && typeof failed.date === 'number' && failed.date >= started && typeof failed.code === 'string' && /^[A-Z_]+$/.test(failed.code)) throw new DesktopError(failed.code);
      }
      waitingFor = undefined;
    }
    if (await existingStudio(port)) throw new DesktopError('USE_TERMINAL_CTRL_C');
    await assertPortFree(port);
    try { await launchHost(root, options); }
    catch (error) { if (!(error instanceof DesktopError) || error.message !== 'DESKTOP_BUSY') throw error; await delay(200); }
  }
  throw new DesktopError('DESKTOP_START_TIMEOUT');
}
export async function stopDesktop(root = resolve(defaultRoot), port = 4322): Promise<void> {
  desktopDirectory(root);
  const owner = startupOwner(root);
  try {
    if (await desktopControl(root, 'stop')) {
      if (owner && owner.pid !== process.pid) {
        const until = Date.now() + 5000;
        while (!processGone(owner.pid) && Date.now() < until) await delay(50);
        if (!processGone(owner.pid)) throw new DesktopError('DESKTOP_STOP_TIMEOUT');
      }
      return;
    }
  }
  catch (error) { if (!(error instanceof DesktopError) || error.message !== 'DESKTOP_UNAVAILABLE') throw error; }
  if (await existingStudio(port)) throw new DesktopError('USE_TERMINAL_CTRL_C');
  await recoverDesktop(root, port);
}

// The prepared app bundle imports this module and shares its import.meta.url.
// Only the standalone desktop.ts entry owns the legacy CLI and its IPC listener.
if (process.argv[1] && basename(process.argv[1]) === 'desktop.ts' && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const command = process.argv[2], root = resolve(defaultRoot);
  try {
    if (process.platform !== 'win32') throw new DesktopError('WINDOWS_ONLY');
    if (process.argv.length !== 3 || !['open', 'stop', 'host'].includes(command!)) throw new DesktopError('INVALID_COMMAND');
    if (command === 'host') {
      if (!process.send) throw new DesktopError('INVALID_COMMAND');
      const options = await new Promise<{ port?: number; store?: string }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new DesktopError('DESKTOP_START_TIMEOUT')), 10_000);
        process.once('message', value => {
          clearTimeout(timer);
          if (!value || typeof value !== 'object' || !('type' in value) || value.type !== 'studio:desktop-start'
            || Object.keys(value).some(key => !['type', 'port', 'store'].includes(key))
            || ('port' in value && (!Number.isSafeInteger(value.port) || Number(value.port) < 1 || Number(value.port) > 65535))
            || ('store' in value && typeof value.store !== 'string')) reject(new DesktopError('INVALID_COMMAND'));
          else resolve(value as { port?: number; store?: string });
        });
      });
      await startDesktopHost(options);
      if (process.connected) process.send?.({ type: 'studio:desktop-ready' }, () => {});
    } else if (command === 'stop') {
      await stopDesktop(root); process.stdout.write('Studio stopped.\n');
    } else {
      await openDesktop(); process.stdout.write('Studio ready.\n');
    }
  } catch (error) {
    const code = error instanceof DesktopError ? error.message : 'DESKTOP_FAILED';
    if (code === 'DESKTOP_CLOSE_CANCELLED' && command === 'stop') { process.stdout.write('Studio close cancelled.\n'); process.exit(0); }
    if (command === 'host') {
      if (code !== 'DESKTOP_BUSY') {
        try { desktopDirectory(root); writeDesktopJson(paths(root).error, { date: Date.now(), pid: process.pid, code }); } catch { /* Never overwrite unsafe state to report an error. */ }
      }
      if (process.connected) process.send?.({ type: 'studio:desktop-error', code }, () => {});
    } else process.stderr.write(`Studio: ${code}\n`);
    process.exitCode = 1;
  }
}
