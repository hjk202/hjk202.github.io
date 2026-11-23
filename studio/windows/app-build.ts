import type { StartupNote } from './startup.ts';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { join, relative } from 'node:path';
import { DesktopError } from './local.ts';
import { desktopDirectory, desktopSnapshot, desktopJson, writeDesktopJson } from './desktop-state.ts';

const digest = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
export function appBuildEnvironment(root: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, DOTNET_CLI_HOME: join(root, '.cache/studio/dotnet'), DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1' };
  delete env.DASHSCOPE_API_KEY; delete env.DASHSCOPE_BASE_URL; delete env.GEMINI_API_KEY; delete env.STUDIO_AI_PROVIDER;
  for(const name of ['GH_TOKEN','GITHUB_TOKEN','GH_ENTERPRISE_TOKEN','GITHUB_ENTERPRISE_TOKEN'])delete env[name];
  // Native privacy mode/profile must not be redirected by inherited WebView2 override switches.
  for (const name of Object.keys(env)) if (/^WEBVIEW2_/i.test(name)) delete env[name];
  return env;
}
function safeDirectory(path: string): void {
  if (!fs.existsSync(path)) fs.mkdirSync(path);
  if (!fs.lstatSync(path).isDirectory() || relative(path, fs.realpathSync.native(path)) !== '') throw new DesktopError('DESKTOP_STATE_INVALID');
}
function tree(path: string, base: string): Record<string, string> {
  if (relative(path, fs.realpathSync.native(path)) !== '') throw new DesktopError('DESKTOP_STATE_INVALID');
  const values: Record<string, string> = {};
  for (const entry of fs.readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) Object.assign(values, tree(file, base));
    else { const snapshot = desktopSnapshot(file, 32 * 1024 * 1024); if (!snapshot) throw new DesktopError('APP_BUILD_FAILED'); values[relative(base, file)] = digest(snapshot.bytes); }
  }
  return values;
}
function outputs(root: string): Record<string, string> | undefined {
  const path = join(root, '.cache/studio/desktop/app');
  if (!fs.existsSync(path)) return;
  const result: Record<string, string> = {};
  for (const name of ['PersonalSpaceStudio.exe', 'PersonalSpaceStudio.dll', 'PersonalSpaceStudio.deps.json', 'PersonalSpaceStudio.runtimeconfig.json', 'Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll']) {
    const file = desktopSnapshot(join(path, name), 32 * 1024 * 1024); if (!file) return; result[name] = digest(file.bytes);
  }
  const runtime = join(path, 'runtimes'); if (!fs.existsSync(runtime)) return;
  Object.assign(result, tree(runtime, path)); return result;
}
/** Fixed local project only; all generated files remain under the ignored Studio cache. */
export async function ensureDesktopApp(root: string, note?: StartupNote, buildRoot = root): Promise<string> {
  note?.('native-check');
  desktopDirectory(buildRoot);
  const directory = join(buildRoot, '.cache/studio/desktop'); safeDirectory(directory);
  for (const name of ['obj', 'app']) safeDirectory(join(directory, name));
  const source = join(root, 'studio/desktop'), env = appBuildEnvironment(root);
  const run = (args: string[]) => new Promise<string>((resolve, reject) => {
    execFile('dotnet.exe', args, { cwd: source, env, windowsHide: true, timeout: 120_000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (!error) return resolve(stdout.trim());
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return reject(new DesktopError('DOTNET_SDK_MISSING'));
      if (args[0] === 'restore' && /\bNU(?:1301|1900)\b/.test(stdout + stderr)) {
        return reject(new DesktopError('NUGET_SOURCE_UNAVAILABLE'));
      }
      reject(new DesktopError('APP_BUILD_FAILED'));
    });
  });
  const sdk = await run(['--version']);
  const input = digest(JSON.stringify([sdk, tree(source, source)])), path = join(directory, 'build.json');
  const stamp = desktopSnapshot(path), existing = outputs(buildRoot);
  if (stamp && existing) {
    let value: Record<string, unknown> | undefined;
    try { value = desktopJson(stamp); } catch { /* Rebuild a corrupt regular receipt. */ }
    if (value?.version === 1 && value.input === input && JSON.stringify(value.outputs) === JSON.stringify(existing)) { note?.('native-check','hit'); return join(directory, 'app/PersonalSpaceStudio.exe'); }
  }
  note?.('native-check',!stamp||!existing?'missing':(()=>{try{desktopJson(stamp);return 'changed';}catch{return 'invalid';}})());
  note?.('native-restore');
  const isolated = buildRoot === root ? [] : [`-p:BaseIntermediateOutputPath=${join(directory,'obj')}/`, `-p:MSBuildProjectExtensionsPath=${join(directory,'obj')}/`, `-p:OutputPath=${join(directory,'app')}/`];
  await run(['restore', 'PersonalSpaceStudio.csproj', '--locked-mode', '--source', 'https://api.nuget.org/v3/index.json', ...isolated]);
  note?.('native-build');
  await run(['build', 'PersonalSpaceStudio.csproj', '--no-restore', '--configuration', 'Release', ...isolated]);
  if (digest(JSON.stringify([sdk, tree(source, source)])) !== input) throw new DesktopError('APP_SOURCE_CHANGED');
  const fresh = outputs(buildRoot); if (!fresh) throw new DesktopError('APP_BUILD_FAILED');
  writeDesktopJson(path, { version: 1, input, outputs: fresh });
  return join(directory, 'app/PersonalSpaceStudio.exe');
}
