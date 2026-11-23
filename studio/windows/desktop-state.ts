import fs from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { createConnection, createServer } from 'node:net';
import { join, relative, resolve } from 'node:path';
import { DesktopError } from './local.ts';

export type DesktopState = { version: 1; origin: string; token: string; pipe: string; pid: number };
export type DesktopSnapshot = { path: string; bytes: Buffer; stat: fs.BigIntStats };
export const desktopPaths = (root: string) => {
  const directory = join(resolve(root), '.cache/studio');
  return { directory, state: join(directory, 'desktop-session.json'), lock: join(directory, 'desktop-start.lock'), error: join(directory, 'desktop-error.json'), lease: join(directory, 'think-authoring.lock'),
    pipe: '\\\\.\\pipe\\personal-space-studio-' + createHash('sha256').update(fs.realpathSync(root)).digest('hex').slice(0, 24) };
};
export function desktopDirectory(root: string): void {
  for (const path of [resolve(root), join(root, '.cache'), join(root, '.cache/studio')]) {
    if (!fs.existsSync(path) && path !== resolve(root)) fs.mkdirSync(path);
    const stat = fs.lstatSync(path);
    if (!stat.isDirectory() || stat.isSymbolicLink() || relative(path, fs.realpathSync.native(path)) !== '') throw new DesktopError('DESKTOP_STATE_INVALID');
  }
}
export function desktopSnapshot(path: string, limit = 2048): DesktopSnapshot | undefined {
  let before: fs.BigIntStats;
  try { before = fs.lstatSync(path, { bigint: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw new DesktopError('DESKTOP_STATE_INVALID'); }
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.size > BigInt(limit)
    || relative(path, fs.realpathSync.native(path)) !== '') throw new DesktopError('DESKTOP_STATE_INVALID');
  const fd = fs.openSync(path, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fs.fstatSync(fd, { bigint: true });
    if (opened.dev !== before.dev || opened.ino !== before.ino || !opened.isFile() || opened.nlink !== 1n) throw new DesktopError('DESKTOP_STATE_CHANGED');
    const buffer = Buffer.alloc(Number(before.size) + 1); let length = 0;
    while (length < buffer.length) { const size = fs.readSync(fd, buffer, length, buffer.length - length, null); if (!size) break; length += size; }
    if (length !== Number(before.size) || length > limit) throw new DesktopError('DESKTOP_STATE_CHANGED');
    return { path, bytes: buffer.subarray(0, length), stat: before };
  } finally { fs.closeSync(fd); }
}
export function removeDesktopSnapshot(snapshot: DesktopSnapshot): void {
  const now = desktopSnapshot(snapshot.path, Math.max(2048, snapshot.bytes.length));
  if (!now || now.stat.dev !== snapshot.stat.dev || now.stat.ino !== snapshot.stat.ino || !now.bytes.equals(snapshot.bytes)) throw new DesktopError('DESKTOP_STATE_CHANGED');
  fs.unlinkSync(snapshot.path);
}
export function desktopJson(snapshot: DesktopSnapshot): Record<string, unknown> {
  try {
    const value = JSON.parse(snapshot.bytes.toString('utf8')) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new DesktopError('DESKTOP_STATE_INVALID'); }
}
export function writeDesktopJson(path: string, value: unknown): void {
  const before = desktopSnapshot(path), temporary = path + '.' + randomBytes(8).toString('hex') + '.tmp';
  let own: DesktopSnapshot | undefined;
  try {
    fs.writeFileSync(temporary, JSON.stringify(value), { flag: 'wx', mode: 0o600 }); own = desktopSnapshot(temporary);
    const now = desktopSnapshot(path);
    if ((before && (!now || !before.bytes.equals(now.bytes) || before.stat.dev !== now.stat.dev || before.stat.ino !== now.stat.ino)) || (!before && now)) throw new DesktopError('DESKTOP_STATE_CHANGED');
    fs.renameSync(temporary, path); own = undefined;
  } finally { if (own) removeDesktopSnapshot(own); }
}
const pid = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const token = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function stateAt(root: string): DesktopState | undefined {
  const paths = desktopPaths(root), snapshot = desktopSnapshot(paths.state); if (!snapshot) return;
  const state = desktopJson(snapshot);
  if (Object.keys(state).sort().join() !== 'origin,pid,pipe,token,version' || state.version !== 1 || state.pipe !== paths.pipe
    || typeof state.origin !== 'string' || !/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(state.origin)
    || Number(new URL(state.origin).port) > 65535 || !token(state.token) || !pid(state.pid)) throw new DesktopError('DESKTOP_STATE_INVALID');
  return state as DesktopState;
}
export function processGone(value: number): boolean {
  try { process.kill(value, 0); return false; }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'ESRCH'; }
}
export function startupOwner(root: string): { pid: number; token: string } | undefined {
  const snapshot = desktopSnapshot(desktopPaths(root).lock); if (!snapshot) return;
  const value = desktopJson(snapshot);
  if (Object.keys(value).sort().join() !== 'pid,token' || !pid(value.pid) || !token(value.token)) throw new DesktopError('DESKTOP_STATE_INVALID');
  return value as { pid: number; token: string };
}
async function pipeAbsent(pipe: string): Promise<boolean> {
  return new Promise(resolve => {
    const socket = createConnection(pipe);
    socket.once('connect', () => { socket.destroy(); resolve(false); });
    socket.setTimeout(1000, () => { socket.destroy(); resolve(false); });
    socket.once('error', error => resolve(['ENOENT', 'ECONNREFUSED'].includes((error as NodeJS.ErrnoException).code ?? '')));
  });
}
export async function assertPortFree(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = createServer();
    server.once('error', () => reject(new DesktopError('PORT_UNAVAILABLE')));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve()));
  });
}
/** Fixed files only. Refuse ambiguous, live, linked or changed state; never kill a PID. */
export async function recoverDesktop(root: string, port = 4322): Promise<boolean> {
  desktopDirectory(root);
  const paths = desktopPaths(root), lock = desktopSnapshot(paths.lock), session = desktopSnapshot(paths.state), lease = desktopSnapshot(paths.lease);
  const moduleLeases = ['keep', 'me', 'build'].map(module => desktopSnapshot(join(paths.directory, `${module}-authoring.lock`))).filter((value): value is DesktopSnapshot => value !== undefined);
  if (!lock && !session && !lease && !moduleLeases.length) return false;
  const owner = startupOwner(root);
  if (!owner || !lock) throw new DesktopError('DESKTOP_RECOVERY_REQUIRED');
  // A live host may already own an authoring lease before it publishes its ready state.
  if (!processGone(owner.pid)) throw new DesktopError('DESKTOP_BUSY');
  const state = stateAt(root);
  if (state && (state.token !== owner.token || Number(new URL(state.origin).port) !== port)) throw new DesktopError('DESKTOP_STATE_INVALID');
  for (const snapshot of [lease, ...moduleLeases]) if (snapshot) {
    const value = desktopJson(snapshot);
    if (!state || value.version !== 1 || value.pid !== state.pid || typeof value.token !== 'string'
      || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value.token)
      || Object.keys(value).sort().join() !== 'pid,token,version') throw new DesktopError('DESKTOP_RECOVERY_REQUIRED');
  }
  if (!processGone(owner.pid) || (state && !processGone(state.pid)) || !await pipeAbsent(paths.pipe)) throw new DesktopError('DESKTOP_BUSY');
  await assertPortFree(port);
  // Recheck every recorded process and identity after the asynchronous probes.
  if (!processGone(owner.pid) || (state && !processGone(state.pid))) throw new DesktopError('DESKTOP_BUSY');
  for (const snapshot of [...moduleLeases, session, lease, lock]) if (snapshot) removeDesktopSnapshot(snapshot);
  return true;
}
