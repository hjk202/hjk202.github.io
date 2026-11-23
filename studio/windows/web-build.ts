import type { StartupNote } from './startup.ts';
import fs from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { join, relative } from 'node:path';
import { DesktopError } from './local.ts';
import { desktopDirectory, desktopJson, desktopSnapshot } from './desktop-state.ts';

const digest = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const assets = ['index.html', 'main.js', 'style.css'];
function inputHash(root: string): string {
  const hash = createHash('sha256').update(process.versions.node);
  const add = (path: string) => {
    const stat = fs.lstatSync(path);
    if (stat.isSymbolicLink() || relative(path, fs.realpathSync.native(path)) !== '') throw new DesktopError('DESKTOP_STATE_INVALID');
    if (stat.isDirectory()) for (const name of fs.readdirSync(path).sort()) add(join(path, name));
    else {
      const source = desktopSnapshot(path, 16 * 1024 * 1024); if (!source) throw new DesktopError('DEPENDENCIES_MISSING');
      hash.update(relative(root, path)).update('\0').update(source.bytes).update('\0');
    }
  };
  try { for (const name of ['studio/web', 'studio/contracts', 'studio/private', 'studio/vite.config.ts', 'package.json', 'package-lock.json',
    'src/core/vault', 'src/core/module/urls.ts', 'src/shell/vault/dom.ts',
    'src/modules/think/vault.client.ts', 'src/modules/think/vault.markdown.ts', 'src/modules/think/vault.css',
    'src/modules/keep/vault.client.ts', 'src/modules/keep/vault.css',
    'src/modules/me/vault.client.ts', 'src/modules/me/vault.css',
    'src/modules/build/vault.client.ts', 'src/modules/build/vault.css', 'src/modules/build/projects.ts',
    ...['think','keep','me','build'].map(module => `src/modules/${module}/vault.schema.ts`)]) add(join(root, name)); }
  catch (error) { if (error instanceof DesktopError) throw error; throw new DesktopError('DEPENDENCIES_MISSING'); }
  return hash.digest('hex');
}
function outputHashes(root: string): Record<string, string> | undefined {
  const directory = join(root, '.cache/studio/web');
  if (!fs.existsSync(directory)) return;
  if (!fs.lstatSync(directory).isDirectory() || relative(directory, fs.realpathSync.native(directory)) !== '') throw new DesktopError('DESKTOP_STATE_INVALID');
  const result: Record<string, string> = {};
  for (const name of assets) { const file = desktopSnapshot(join(directory, name), 4 * 1024 * 1024); if (!file) return; result[name] = digest(file.bytes); }
  return result;
}
/** Host holds the startup lock. Build before loading any credential, with a minimal key-free environment. */
export async function ensureDesktopWeb(root: string, note?: StartupNote, buildRoot = root): Promise<{ rebuilt: boolean }> {
  note?.('web-check');
  desktopDirectory(buildRoot);
  const cli = join(root, 'node_modules/vite/bin/vite.js');
  if (!fs.existsSync(cli)) throw new DesktopError('DEPENDENCIES_MISSING');
  const fingerprint = inputHash(root), path = join(buildRoot, '.cache/studio/web-build.json');
  const stamp = desktopSnapshot(path);
  const outputs = outputHashes(buildRoot);
  if (stamp && outputs) {
    let value: Record<string, unknown> | undefined;
    try { value = desktopJson(stamp); } catch { /* A regular corrupt build receipt is rebuilt, never trusted. */ }
    if (value?.version === 1 && value.input === fingerprint && JSON.stringify(value.outputs) === JSON.stringify(outputs)) { note?.('web-check','hit'); return { rebuilt: false }; }
  }
  note?.('web-check',!stamp||!outputs?'missing':(()=>{try{desktopJson(stamp);return 'changed';}catch{return 'invalid';}})());
  note?.('web-build');
  const env = { ...process.env }; delete env.DASHSCOPE_API_KEY; delete env.DASHSCOPE_BASE_URL; delete env.GEMINI_API_KEY; delete env.STUDIO_AI_PROVIDER;
  await new Promise<void>((resolve, reject) => {
    execFile(process.execPath, [cli, 'build', '--config', join(root, 'studio/vite.config.ts'), ...(buildRoot === root ? [] : ['--outDir', join(buildRoot,'.cache/studio/web')])], { cwd: root, env, windowsHide: true, timeout: 60_000, maxBuffer: 2 * 1024 * 1024 }, error => error ? reject(new DesktopError('WEB_BUILD_FAILED')) : resolve());
  });
  if (inputHash(root) !== fingerprint) throw new DesktopError('WEB_SOURCE_CHANGED');
  const fresh = outputHashes(buildRoot); if (!fresh) throw new DesktopError('WEB_BUILD_FAILED');
  const current = desktopSnapshot(path);
  if ((stamp && (!current || !current.bytes.equals(stamp.bytes) || current.stat.ino !== stamp.stat.ino)) || (!stamp && current)) throw new DesktopError('DESKTOP_STATE_CHANGED');
  const temporary = path + '.' + randomBytes(8).toString('hex') + '.tmp';
  try { fs.writeFileSync(temporary, JSON.stringify({ version: 1, input: fingerprint, outputs: fresh }), { flag: 'wx', mode: 0o600 }); fs.renameSync(temporary, path); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  return { rebuilt: true };
}
