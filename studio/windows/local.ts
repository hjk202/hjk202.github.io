import { execFile, execFileSync } from 'node:child_process';
import { isAbsolute, resolve, dirname, join } from 'node:path';
import { lstatSync, realpathSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readAiConfig, readBailianConfig } from '../server/ai/config.ts';
import { GEMINI_BASE } from '../contracts/ai.ts';

export class DesktopError extends Error {
  constructor(code: string) { super(code); }
}
export function localStorePath(): string {
  if (process.platform !== 'win32') throw new DesktopError('WINDOWS_ONLY');
  try {
    const script = fileURLToPath(new URL(/* @vite-ignore */ './Read-Credentials.ps1', import.meta.url));
    const value: unknown = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', script, '-ResolveStorePath'], { windowsHide: true, timeout: 10_000, maxBuffer: 65536, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    if (typeof value !== 'string' || !isAbsolute(value) || value.length > 32768 || value.includes('\0')) throw new Error();
    return value;
  } catch { throw new DesktopError('LOCAL_CONFIG_INVALID'); }
}
/** Same Known Folder resolver, without blocking API/window startup on a PowerShell process. */
export async function localStorePathAsync(signal?: AbortSignal): Promise<string> {
  if(process.platform!=='win32')throw new DesktopError('WINDOWS_ONLY');
  const script=fileURLToPath(new URL(/* @vite-ignore */ './Read-Credentials.ps1',import.meta.url));
  return new Promise((resolvePath,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',script,'-ResolveStorePath'],
    {windowsHide:true,timeout:10000,maxBuffer:65536,encoding:'utf8',...(signal?{signal}:{})},(error,stdout)=>{
      try{if(error)throw error;const value:unknown=JSON.parse(stdout);if(typeof value!=='string'||!isAbsolute(value)||value.length>32768||value.includes('\0'))throw new Error();resolvePath(value);}
      catch{reject(new DesktopError('LOCAL_CONFIG_INVALID'));}
    }));
}
/** Called by the trusted desktop host only. stdout is a private pipe, never forwarded or logged. */
export async function readLocalCredential(path = localStorePath(), signal?: AbortSignal): Promise<{ baseUrl: string; apiKey: string } | undefined> {
  if (process.platform !== 'win32') throw new DesktopError('WINDOWS_ONLY');
  path = resolve(path);
  if (!existsSync(path)) return undefined;
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 65536 || realpathSync(dirname(path)) !== dirname(path)) throw new DesktopError('LOCAL_CONFIG_UNSAFE');
  const script = fileURLToPath(new URL(/* @vite-ignore */ './Read-Credentials.ps1', import.meta.url));
  const raw = await new Promise<string>((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', script, '-StorePath', path], { windowsHide: true, timeout: 10_000, maxBuffer: 65536, encoding: 'utf8', ...(signal?{signal}:{}) }, (error, stdout) => {
      if (error) reject(new DesktopError('LOCAL_CONFIG_INVALID')); else resolve(stdout);
    });
  });
  try {
    const value = JSON.parse(raw) as { baseUrl?: unknown; apiKey?: unknown } | null;
    if (!value || typeof value.baseUrl !== 'string' || typeof value.apiKey !== 'string'
      || Object.keys(value).sort().join() !== 'apiKey,baseUrl'
      || (value.baseUrl===GEMINI_BASE?readAiConfig({STUDIO_AI_PROVIDER:'gemini',GEMINI_API_KEY:value.apiKey}):readBailianConfig({ DASHSCOPE_BASE_URL: value.baseUrl, DASHSCOPE_API_KEY: value.apiKey })).state !== 'ready') throw new Error();
    return { baseUrl: value.baseUrl, apiKey: value.apiKey };
  } catch { throw new DesktopError('LOCAL_CONFIG_INVALID'); }
}
export async function localAuthoringEnvironmentAsync(store: string | undefined, signal: AbortSignal): Promise<NodeJS.ProcessEnv> {
  return localAuthoringEnvironment(store??await localStorePathAsync(signal),signal);
}

/** Shared by trusted desktop and standalone Windows startup, never called from HTTP. */
export async function localAuthoringEnvironment(store = localStorePath(), signal?: AbortSignal): Promise<NodeJS.ProcessEnv> {
  const environment = { ...process.env };
  delete environment.DASHSCOPE_API_KEY; delete environment.DASHSCOPE_BASE_URL;
  delete environment.GEMINI_API_KEY; delete environment.STUDIO_AI_PROVIDER;
  const marker = join(dirname(store),'gemini-selected');
  if (existsSync(marker)) {
    const info=lstatSync(marker);
    if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size!==0||realpathSync(marker)!==marker)throw new DesktopError('LOCAL_CONFIG_UNSAFE');
    const gemini=await readLocalCredential(join(dirname(store),'gemini.json'),signal);
    if(gemini && gemini.baseUrl!==GEMINI_BASE)throw new DesktopError('LOCAL_CONFIG_INVALID');
    environment.STUDIO_AI_PROVIDER='gemini';
    if(gemini)environment.GEMINI_API_KEY=gemini.apiKey;
  }
  const credential = await readLocalCredential(store,signal).catch(error=>{if(environment.STUDIO_AI_PROVIDER!=='gemini')throw error;return undefined;});
  if (credential?.baseUrl!==GEMINI_BASE && credential) { environment.DASHSCOPE_API_KEY = credential.apiKey; environment.DASHSCOPE_BASE_URL = credential.baseUrl; }
  return environment;
}
