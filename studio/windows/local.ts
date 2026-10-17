import { execFile } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { lstatSync, realpathSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readBailianConfig } from '../server/ai/config.ts';

export class DesktopError extends Error {
  constructor(code: string) { super(code); }
}
export function localStorePath(): string {
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) throw new DesktopError('WINDOWS_ONLY');
  return join(process.env.LOCALAPPDATA, 'PersonalSpaceStudio', 'bailian.json');
}
/** Called by the trusted desktop host only. stdout is a private pipe, never forwarded or logged. */
export async function readLocalCredential(path = localStorePath()): Promise<{ baseUrl: string; apiKey: string } | undefined> {
  if (process.platform !== 'win32') throw new DesktopError('WINDOWS_ONLY');
  path = resolve(path);
  if (!existsSync(path)) return undefined;
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 65536 || realpathSync(dirname(path)) !== dirname(path)) throw new DesktopError('LOCAL_CONFIG_UNSAFE');
  const script = fileURLToPath(new URL('./Read-Credentials.ps1', import.meta.url));
  const raw = await new Promise<string>((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', script, '-StorePath', path], { windowsHide: true, timeout: 10_000, maxBuffer: 65536, encoding: 'utf8' }, (error, stdout) => {
      if (error) reject(new DesktopError('LOCAL_CONFIG_INVALID')); else resolve(stdout);
    });
  });
  try {
    const value = JSON.parse(raw) as { baseUrl?: unknown; apiKey?: unknown } | null;
    if (!value || typeof value.baseUrl !== 'string' || typeof value.apiKey !== 'string'
      || Object.keys(value).sort().join() !== 'apiKey,baseUrl'
      || readBailianConfig({ DASHSCOPE_BASE_URL: value.baseUrl, DASHSCOPE_API_KEY: value.apiKey }).state !== 'ready') throw new Error();
    return { baseUrl: value.baseUrl, apiKey: value.apiKey };
  } catch { throw new DesktopError('LOCAL_CONFIG_INVALID'); }
}
