import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { join, relative, resolve } from 'node:path';
import { DesktopError } from './local.ts';
import { desktopDirectory, desktopPaths, desktopSnapshot, desktopJson, writeDesktopJson, removeDesktopSnapshot, recoverDesktop } from './desktop-state.ts';
import { ensureDesktopApp } from './app-build.ts';
import { ensureDesktopWeb } from './web-build.ts';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appBuildEnvironment } from './app-build.ts';
import type { StartupNote } from './startup.ts';

const sha = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');
const hex = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const MAX_FILE = 32 * 1024 * 1024, MAX_TOTAL = 128 * 1024 * 1024;
const models = ['think/metadata.ts','keep/bookmarks.ts','me/profile.ts','build/projects.ts',
  ...['think','keep','me','build'].map(name => name + '/vault.schema.ts')];
const dependencies = ['package.json','package-lock.json','node_modules/.package-lock.json'];
type Entry = { hash: string; size: number };
type Manifest = { version: 1; buildId: string; node: string; platform: string; arch: string; repository: string; source: string; dependencies: (string | null)[]; files: Record<string, Entry> };
export type PreparedStudio = { id: string; directory: string; executable: string; backend: string; host: string; web: string };
const identity = (root: string) => sha(fs.realpathSync.native(root));
function directory(path: string, create = false) {
  if (!fs.existsSync(path) && create) fs.mkdirSync(path);
  const stat = fs.lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || relative(path, fs.realpathSync.native(path)) !== '') throw new DesktopError('PREPARED_INVALID');
}
function base(root: string) { desktopDirectory(root); const dir = join(root,'.cache/studio/prepared'); directory(dir,true); return dir; }
function filename(root: string, name: string, create = false) {
  if (!/^[a-zA-Z0-9._/-]+$/.test(name) || name.split('/').some(part => !part || part === '.' || part === '..')) throw new DesktopError('PREPARED_INVALID');
  const parts = name.split('/'); let parent = root;
  for (const part of parts.slice(0,-1)) { parent = join(parent,part); directory(parent,create); }
  return join(root,...parts);
}
function bytes(path: string, limit = MAX_FILE) {
  const value = desktopSnapshot(path,limit); if (!value) throw new DesktopError('PREPARED_INVALID');
  return value.bytes;
}
function dependencyHashes(root: string) {
  return dependencies.map(name => {
    const parent = join(root,...name.split('/').slice(0,-1));
    if (fs.existsSync(parent) && relative(parent,fs.realpathSync.native(parent)) !== '') throw new DesktopError('PREPARED_INVALID');
    const value = desktopSnapshot(join(root,name),MAX_FILE); return value ? sha(value.bytes) : null;
  });
}
function tree(root: string, prefix: string, visit: (name: string, value: Buffer) => void) {
  const walk = (name: string) => {
    const path = join(root,name), stat = fs.lstatSync(path);
    if (stat.isSymbolicLink() || relative(path,fs.realpathSync.native(path)) !== '') throw new DesktopError('PREPARED_INVALID');
    if (stat.isDirectory()) for (const entry of fs.readdirSync(path).sort()) walk(name + '/' + entry);
    else visit(name,bytes(path));
  };
  walk(prefix);
}
function sourceHash(root: string) {
  const hash = createHash('sha256');
  const add = (name: string, value: Buffer) => hash.update(name).update('\0').update(value).update('\0');
  for (const prefix of ['studio','src/core/vault']) tree(root,prefix,add);
  for (const name of [...models.map(name => 'src/modules/' + name),
    ...['think','keep','me','build'].flatMap(name => [`src/modules/${name}/vault.client.ts`,`src/modules/${name}/vault.css`]),
    'src/modules/think/vault.markdown.ts','src/modules/think/markdown.mjs','src/shell/vault/dom.ts','src/core/module/urls.ts',...dependencies.slice(0,2)]) add(name,bytes(join(root,name)));
  return hash.digest('hex');
}
function inventory(root:string,prefix:string,found:Set<string>) {
  const path=join(root,prefix);directory(path);
  if(prefix==='native/profile')return; // WebView2 owns this volatile profile; never inspect its contents.
  for(const entry of fs.readdirSync(path,{withFileTypes:true})){
    if(entry.isSymbolicLink())throw new DesktopError('PREPARED_INVALID');
    const name=prefix+'/'+entry.name;
    if(entry.isDirectory())inventory(root,name,found);else found.add(name);
    if(found.size>512)throw new DesktopError('PREPARED_INVALID');
  }
}

/** Only fixed prepared program assets are read on daily startup. No source scan or compiler. */
export function readPreparedStudio(root: string, requestedId?: string): PreparedStudio {
  root = resolve(root); const dir = base(root);
  let id = requestedId;
  if (!id) {
    const pointer = desktopSnapshot(join(dir,'current.json'));
    if (!pointer) throw new DesktopError('PREPARATION_REQUIRED');
    const value = desktopJson(pointer);
    if (Object.keys(value).sort().join() !== 'id,version' || value.version !== 1 || !hex(value.id)) throw new DesktopError('PREPARED_INVALID');
    id = value.id;
  }
  if (!hex(id)) throw new DesktopError('PREPARED_INVALID');
  const release = join(dir,id); if (!fs.existsSync(release)) throw new DesktopError('PREPARATION_REQUIRED'); directory(release);
  const raw = bytes(join(release,'manifest.json'),1024*1024); if (sha(raw) !== id) throw new DesktopError('PREPARED_INVALID');
  let value: Manifest;try{value=JSON.parse(raw.toString('utf8')) as Manifest;}catch{throw new DesktopError('PREPARED_INVALID');}
  if (!value || Object.keys(value).sort().join() !== 'arch,buildId,dependencies,files,node,platform,repository,source,version'
    || value.version !== 1 || value.node !== process.versions.node || value.platform !== process.platform || value.arch !== process.arch
    || typeof value.buildId !== 'string' || !/^[a-f0-9-]{36}$/.test(value.buildId) || value.repository !== identity(root) || !hex(value.source) || !Array.isArray(value.dependencies)
    || JSON.stringify(value.dependencies) !== JSON.stringify(dependencyHashes(root)) || !value.files || Array.isArray(value.files) || typeof value.files !== 'object') throw new DesktopError('PREPARED_INVALID');
  const entries = Object.entries(value.files); if (!entries.length || entries.length > 512) throw new DesktopError('PREPARED_INVALID');
  const found=new Set<string>();for(const prefix of ['native','runtime','web'])inventory(release,prefix,found);
  if(JSON.stringify([...found].sort())!==JSON.stringify(Object.keys(value.files).sort()))throw new DesktopError('PREPARED_INVALID');
  let total = 0;
  for (const [name, entry] of entries) {
    if (!entry || Object.keys(entry).sort().join() !== 'hash,size' || !hex(entry.hash) || !Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > MAX_FILE) throw new DesktopError('PREPARED_INVALID');
    total += entry.size; if (total > MAX_TOTAL) throw new DesktopError('PREPARED_INVALID');
    const data = bytes(filename(release,name)); if (data.length !== entry.size || sha(data) !== entry.hash) throw new DesktopError('PREPARED_INVALID');
  }
  for (const name of ['runtime/app.mjs','runtime/backend.mjs','runtime/Read-Credentials.ps1','runtime/Credentials.ps1','runtime/preview-build.mjs','runtime/think/preview-build.mjs',
    'native/PersonalSpaceStudio.exe','native/PersonalSpaceStudio.dll','native/PersonalSpaceStudio.deps.json','native/PersonalSpaceStudio.runtimeconfig.json',
    'native/Microsoft.Web.WebView2.Core.dll','native/Microsoft.Web.WebView2.WinForms.dll','native/runtimes/win-x64/native/WebView2Loader.dll',
    'web/index.html','web/main.js','web/style.css']) if (!value.files[name]) throw new DesktopError('PREPARED_INVALID');
  return { id, directory: release, executable: join(release,'native/PersonalSpaceStudio.exe'),
    backend: join(release,'runtime/backend.mjs'), host: join(release,'runtime/app.mjs'), web: join(release,'web') };
}

/** Only a missing version triggers preparation. Invalid files still require explicit repair. */
export async function readOrPrepareStudio(root: string, prepare = prepareStudio): Promise<PreparedStudio> {
  try { return readPreparedStudio(root); }
  catch (error) {
    if (!(error instanceof DesktopError) || error.message !== 'PREPARATION_REQUIRED') throw error;
    return prepare(root);
  }
}

/** Fixed local preparation. Hooks are trusted test builders, never client inputs. */
export async function prepareStudio(root: string, builders = { native: ensureDesktopApp, web: ensureDesktopWeb }, note?: StartupNote): Promise<PreparedStudio> {
  root = resolve(root); await recoverDesktop(root); const dir = base(root), lockPath = desktopPaths(root).lock;
  try{fs.writeFileSync(lockPath,JSON.stringify({pid:process.pid,token:sha(randomUUID())}),{flag:'wx',mode:0o600});}catch{throw new DesktopError('DESKTOP_BUSY');}
  const lock = desktopSnapshot(lockPath)!;
  try {
    const initial = sourceHash(root), deps = dependencyHashes(root), stage = join(dir,'stage-' + randomUUID()); directory(stage,true);
    const build = join(stage,'build'); directory(build,true);
    const executable = await builders.native(root,note,build); await builders.web(root,note,build);
    const output = join(stage,'release'); directory(output,true); const files: Record<string, Entry> = {}; let total = 0;
    const copy = (name: string, value: Buffer) => {
      total += value.length;
      if (total > MAX_TOTAL || Object.keys(files).length >= 512) throw new DesktopError('PREPARED_INVALID');
      fs.writeFileSync(filename(output,name,true),value,{flag:'wx',mode:0o600}); files[name] = {hash:sha(value),size:value.length};
    };
    tree(resolve(executable,'..'),'./', (name,value) => copy('native/' + name.slice(3),value));
    for (const name of ['index.html','main.js','style.css']) copy('web/' + name,bytes(join(build,'.cache/studio/web',name)));
    const runtime=join(stage,'runtime');
    await new Promise<void>((resolveBuild,reject)=>execFile(process.execPath,['--experimental-strip-types',fileURLToPath(new URL('./runtime-build.ts',import.meta.url)),root,runtime],
      {cwd:root,env:appBuildEnvironment(root),windowsHide:true,timeout:60000,maxBuffer:2*1024*1024},error=>error?reject(new DesktopError('PREPARATION_FAILED')):resolveBuild()));
    tree(runtime,'./',(name,value)=>copy('runtime/'+name.slice(3),value));
    if (sourceHash(root) !== initial || JSON.stringify(deps) !== JSON.stringify(dependencyHashes(root))) throw new DesktopError('APP_SOURCE_CHANGED');
    const manifest: Manifest = {version:1,buildId:randomUUID(),node:process.versions.node,platform:process.platform,arch:process.arch,repository:identity(root),source:initial,dependencies:deps,files};
    const raw = Buffer.from(JSON.stringify(manifest)), id = sha(raw), target = join(dir,id);
    fs.writeFileSync(join(output,'manifest.json'),raw,{flag:'wx',mode:0o600});
    if (!fs.existsSync(target)) fs.renameSync(output,target);
    const result = readPreparedStudio(root,id);
    writeDesktopJson(join(dir,'current.json'),{version:1,id});
    return result;
  } catch (error) { throw error instanceof DesktopError ? error : new DesktopError('PREPARATION_FAILED'); }
  finally { removeDesktopSnapshot(lock); }
}
