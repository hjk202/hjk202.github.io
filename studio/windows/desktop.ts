import { fork, execFile, spawn } from 'node:child_process';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, createConnection } from 'node:net';
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, existsSync, lstatSync, realpathSync, openSync, closeSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DesktopError, readLocalCredential, localStorePath } from './local.ts';

const defaultRoot = fileURLToPath(new URL('../../', import.meta.url));
type State = { version: 1; origin: string; token: string; pipe: string; pid: number };
const paths = (root: string) => {
  const directory = join(root, '.cache/studio');
  return { directory, state: join(directory, 'desktop-session.json'), lock: join(directory, 'desktop-start.lock'), error: join(directory, 'desktop-error.json'),
    pipe: '\\\\.\\pipe\\personal-space-studio-' + createHash('sha256').update(realpathSync(root)).digest('hex').slice(0, 24) };
};
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
function stateAt(root: string): State | undefined {
  const path = paths(root);
  if (!existsSync(path.state)) return undefined;
  const stat = lstatSync(path.state);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 2048) throw new DesktopError('DESKTOP_STATE_INVALID');
  try {
    const state = JSON.parse(readFileSync(path.state, 'utf8')) as State;
    if (state.version !== 1 || state.pipe !== path.pipe || !/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(state.origin)
      || !/^[a-f0-9]{64}$/.test(state.token) || !Number.isSafeInteger(state.pid) || state.pid < 1) throw new Error();
    return state;
  } catch { throw new DesktopError('DESKTOP_STATE_INVALID'); }
}

/** Only status/stop over an authenticated local pipe. No authoring, paths, commands or credentials. */
export async function desktopControl(root: string, action: 'status' | 'stop'): Promise<{ origin: string; pid: number } | undefined> {
  const state = stateAt(root); if (!state) return undefined;
  return new Promise((resolve, reject) => {
    const socket = createConnection(state.pipe);
    let text = '';
    socket.setTimeout(action === 'stop' ? 20_000 : 5000, () => socket.destroy(new Error()));
    socket.on('connect', () => socket.write(JSON.stringify({ action, token: state.token }) + '\n'));
    socket.on('data', data => {
      text += data.toString();
      if (text.length > 2048) { socket.destroy(); reject(new DesktopError('DESKTOP_STATE_INVALID')); }
    });
    socket.once('error', () => reject(new DesktopError('DESKTOP_UNAVAILABLE')));
    socket.once('end', () => {
      try {
        const result = JSON.parse(text) as { ok: boolean; origin: string; pid: number };
        if (!result.ok || result.origin !== state.origin || result.pid !== state.pid) throw new Error();
        resolve({ origin: result.origin, pid: result.pid });
      } catch { reject(new DesktopError('DESKTOP_STATE_INVALID')); }
    });
  });
}

async function buildWeb(root: string): Promise<void> {
  const env = { ...process.env }; delete env.DASHSCOPE_API_KEY; delete env.DASHSCOPE_BASE_URL;
  await new Promise<void>((resolve, reject) => {
    execFile(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build', '--config', join(root, 'studio/vite.config.ts')],
      { cwd: root, env, windowsHide: true, timeout: 60_000, maxBuffer: 2 * 1024 * 1024 }, error => error ? reject(new DesktopError('WEB_BUILD_FAILED')) : resolve());
  });
}

/** root/store/port/build are trusted integration-test options, never frontend or Agent inputs. */
export async function startDesktopHost(options: { root?: string; store?: string; port?: number; build?: boolean } = {}) {
  if (process.platform !== 'win32') throw new DesktopError('WINDOWS_ONLY');
  const root = resolve(options.root ?? defaultRoot), path = paths(root);
  mkdirSync(path.directory, { recursive: true });
  if (lstatSync(path.directory).isSymbolicLink() || realpathSync(path.directory) !== path.directory) throw new DesktopError('DESKTOP_STATE_INVALID');
  let lock: number;
  try { lock = openSync(path.lock, 'wx', 0o600); }
  catch { throw new DesktopError('DESKTOP_BUSY'); }
  const token = randomBytes(32).toString('hex');
  writeFileSync(lock, JSON.stringify({ pid: process.pid, token })); closeSync(lock);
  let child: ReturnType<typeof fork> | undefined;
  let state: State | undefined;
  let stopping: Promise<void> | undefined;
  const server = createServer();
  const sockets = new Set<import('node:net').Socket>();
  const cleanup = () => {
    if (stateAt(root)?.token === token) unlinkSync(path.state);
    if (existsSync(path.lock) && JSON.parse(readFileSync(path.lock, 'utf8')).token === token) unlinkSync(path.lock);
  };
  const stop = (reply?: () => void) => stopping ??= (async () => {
    if (child?.pid && child.exitCode === null) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new DesktopError('DESKTOP_STOP_TIMEOUT')), 15_000);
        child!.once('exit', () => { clearTimeout(timer); resolve(); });
        if (child!.connected) child!.send('studio:stop');
        else { clearTimeout(timer); reject(new DesktopError('DESKTOP_STOP_FAILED')); }
      });
    }
    reply?.();
    for (const socket of sockets) socket.end();
    if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    cleanup();
  })();
  try {
    if (existsSync(path.state)) throw new DesktopError('DESKTOP_STALE_SESSION');
    if (options.build !== false) await buildWeb(root);
    const credential = await readLocalCredential(options.store ?? localStorePath());
    const env = { ...process.env };
    delete env.DASHSCOPE_API_KEY; delete env.DASHSCOPE_BASE_URL;
    if (credential) { env.DASHSCOPE_API_KEY = credential.apiKey; env.DASHSCOPE_BASE_URL = credential.baseUrl; }
    // Build finishes before decryption; only this child gets the plaintext credential in memory.
    child = fork(join(root, 'studio/server/main.ts'), options.port ? ['--port', String(options.port)] : [], {
      cwd: root, env, silent: true, windowsHide: true, execArgv: ['--experimental-strip-types'],
    });
    delete env.DASHSCOPE_API_KEY;
    let startCode = 'DESKTOP_START_FAILED';
    child.stdout!.resume();
    child.stderr!.on('data', bytes => {
      const match = /AUTHORING_BUSY|PORT_UNAVAILABLE|WEB_BUILD_UNAVAILABLE/.exec(bytes.toString());
      if (match) startCode = match[0];
    });
    const origin = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new DesktopError('DESKTOP_START_TIMEOUT')), 20_000);
      child!.once('error', () => { clearTimeout(timer); reject(new DesktopError('DESKTOP_START_FAILED')); });
      child!.once('exit', () => { clearTimeout(timer); reject(new DesktopError(startCode)); });
      child!.on('message', message => {
        if (message && typeof message === 'object' && 'type' in message && message.type === 'studio:ready'
          && 'origin' in message && typeof message.origin === 'string' && /^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(message.origin)) {
          clearTimeout(timer); resolve(message.origin);
        }
      });
    });
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
          if (Object.keys(request).sort().join() !== 'action,token' || !['status', 'stop'].includes(request.action!)
            || typeof request.token !== 'string' || !/^[a-f0-9]{64}$/.test(request.token)
            || !timingSafeEqual(Buffer.from(request.token), Buffer.from(token))) throw new Error();
          const response = JSON.stringify({ ok: true, origin, pid: state!.pid });
          if (request.action === 'status') socket.end(response);
          else {
            // Reply after the Authoring service releases its lease, before closing this control socket.
            const own = socket; sockets.delete(own);
            own.setTimeout(20_000, () => own.destroy());
            void stop(() => own.end(response)).catch(() => own.end(JSON.stringify({ ok: false })));
          }
        } catch { socket.end(JSON.stringify({ ok: false })); }
      });
    });
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(path.pipe, resolve); });
    writeFileSync(path.state, JSON.stringify(state), { flag: 'wx', mode: 0o600 });
    child.once('exit', () => { if (!stopping) void stop(); });
    return { origin, pid: state.pid, stop: () => stop() };
  } catch (error) {
    await stop();
    throw error instanceof DesktopError ? error : new DesktopError('DESKTOP_START_FAILED');
  }
}

async function existingStudio(): Promise<boolean> {
  try {
    const response = await fetch('http://127.0.0.1:4322/', { redirect: 'error', signal: AbortSignal.timeout(1000) });
    const text = await response.text();
    const match = /<script id="studio-session" type="application\/json">([^<]*)<\/script>/.exec(text);
    const value = JSON.parse(match?.[1] ?? 'null');
    return response.ok && value?.origin === 'http://127.0.0.1:4322' && /^[a-f0-9]{64}$/.test(value?.token);
  } catch { return false; }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const command = process.argv[2], root = resolve(defaultRoot), path = paths(root);
  try {
    if (process.platform !== 'win32') throw new DesktopError('WINDOWS_ONLY');
    if (process.argv.length !== 3 || !['open', 'stop', 'host'].includes(command!)) throw new DesktopError('INVALID_COMMAND');
    if (command === 'host') {
      await startDesktopHost();
    } else if (command === 'stop') {
      const result = await desktopControl(root, 'stop');
      if (!result && await existingStudio()) throw new DesktopError('USE_TERMINAL_CTRL_C');
      process.stdout.write('Studio stopped.\n');
    } else {
      if (await desktopControl(root, 'status') || await existingStudio()) process.stdout.write('Studio ready.\n');
      else {
        const started = Date.now();
        const child = spawn(process.execPath, ['--experimental-strip-types', fileURLToPath(import.meta.url), 'host'], { cwd: root, detached: true, windowsHide: true, stdio: 'ignore' });
        child.unref();
        let ready = false;
        for (let i = 0; i < 450; i++) {
          await delay(200);
          if (await desktopControl(root, 'status')) { ready = true; break; }
          if (existsSync(path.error)) {
            const error = JSON.parse(readFileSync(path.error, 'utf8'));
            if (error.date >= started) throw new DesktopError(error.code);
          }
        }
        if (!ready) throw new DesktopError('DESKTOP_START_TIMEOUT');
        process.stdout.write('Studio ready.\n');
      }
    }
  } catch (error) {
    const code = error instanceof DesktopError ? error.message : 'DESKTOP_FAILED';
    if (command === 'host') {
      mkdirSync(path.directory, { recursive: true });
      if (code !== 'DESKTOP_BUSY') writeFileSync(path.error, JSON.stringify({ date: Date.now(), code }));
    } else process.stderr.write(`Studio: ${code}\n`);
    process.exitCode = 1;
  }
}
