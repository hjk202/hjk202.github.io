import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import type { EditorResult, ThinkDocument } from '../../contracts/think.ts';
import type { ThinkPreviewResult } from '../../contracts/preview.ts';
import { PREVIEW_TIMEOUT_MS } from '../../contracts/preview.ts';
import { serializeThinkDocument, parseThinkSource } from './document.ts';
import type { ThinkAuthoring } from './service.ts';
import { ThinkFileError } from './files.ts';
import { projectThinkPreview } from './preview-html.ts';

const defaultRoot = fileURLToPath(new URL('../../../', import.meta.url));
const within = (root: string, path: string) => { const part = relative(root, path); return !isAbsolute(part) && part !== '..' && !part.startsWith('..' + sep) && !resolve(path).startsWith('\\\\'); };
function safeDirectory(path: string): void {
  const stat = fs.lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(path) !== resolve(path)) throw new ThinkFileError('PROTECTED_PATH');
}

/** One bounded build, no queue, retained content store, resource server or client-provided paths. */
export function createThinkPreview(service: ThinkAuthoring, options: { repositoryRoot?: string; base?: string; timeoutMs?: number } = {}) {
  const root = resolve(options.repositoryRoot ?? defaultRoot);
  const base = options.base ?? '/';
  if (!/^\/(?:[a-z0-9-]+\/)*$/.test(base)) throw new ThinkFileError('INVALID_REQUEST');
  const timeout = options.timeoutMs ?? PREVIEW_TIMEOUT_MS;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > PREVIEW_TIMEOUT_MS) throw new ThinkFileError('INVALID_REQUEST');
  let closed = false;
  let pending: Promise<EditorResult<ThinkPreviewResult>> | undefined;
  let abort: AbortController | undefined;

  async function run(input: unknown, signal?: AbortSignal): Promise<EditorResult<ThinkPreviewResult>> {
    let job: string | undefined, identity: fs.Stats | undefined, cleanupPending = false;
    let result: EditorResult<ThinkPreviewResult>;
    try {
      const validation = service.validateThink(input);
      if (!validation.ok) return validation;
      if (!validation.value.canSave || !validation.value.publishReady) return { ok: false, error: { code: 'PREVIEW_NOT_READY', message: '预览需要完整且合法的公开候选；不会保存或改变源状态。', issues: validation.value.issues } };
      const args = input as { document: ThinkDocument; key?: string };
      const snapshot = structuredClone(args.document);
      let fileName = snapshot.metadata.slug + '.md';
      if (args.key) { const read = service.readThink({ key: args.key }); if (!read.ok) return read; fileName = read.value.fileName; }
      abort = new AbortController();
      const cancel = () => abort?.abort();
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        if (signal?.aborted || closed) throw new ThinkFileError('PREVIEW_CANCELLED');
        safeDirectory(root);
        let cache = root;
        for (const part of ['.cache', 'studio', 'preview']) { cache = join(cache, part); if (!fs.existsSync(cache)) fs.mkdirSync(cache); safeDirectory(cache); }
        job = fs.mkdtempSync(join(cache, 'job-')); identity = fs.lstatSync(job);
        const project = join(job, 'project'); fs.mkdirSync(project);
        let bytes = 0, count = 0;
        const markdown: string[] = [];
        function copy(from: string, to: string) {
          if (from.startsWith(join(root, 'public') + sep) && !fs.lstatSync(from).isDirectory() && !/\.(svg|png|jpe?g|webp|gif|avif|ico)$/i.test(from)) return;
          const stat = fs.lstatSync(from);
          if (stat.isSymbolicLink() || fs.realpathSync(from) !== resolve(from)) throw new ThinkFileError('PROTECTED_PATH');
          if (stat.isDirectory()) { fs.mkdirSync(to); for (const name of fs.readdirSync(from)) copy(join(from, name), join(to, name)); }
          else {
            if (!stat.isFile() || stat.nlink !== 1 || stat.size > 16 * 1024 * 1024) throw new ThinkFileError('PROTECTED_PATH');
            bytes += stat.size;
            if (++count > 4000 || bytes > 128 * 1024 * 1024) throw new ThinkFileError('PREVIEW_TOO_LARGE');
            const content = fs.readFileSync(from);
            const after = fs.lstatSync(from);
            if (stat.ino !== after.ino || stat.dev !== after.dev || content.length !== stat.size || stat.mtimeMs !== after.mtimeMs) throw new ThinkFileError('PREVIEW_FAILED');
            fs.writeFileSync(to, content, { flag: 'wx' });
            if (extname(to) === '.md') markdown.push(to);
          }
        }
        for (const directory of ['src', 'public']) if (fs.existsSync(join(root, directory))) copy(join(root, directory), join(project, directory));
        for (const file of ['package.json', 'astro.config.mjs', 'tsconfig.json']) copy(join(root, file), join(project, file));
        // Preview does not distribute Vault packages or source maps from public/.
        const publicRoot = join(project, 'public');
        if (fs.existsSync(publicRoot)) for (const file of fs.readdirSync(publicRoot, { recursive: true })) {
          const path = join(publicRoot, String(file));
          if (fs.statSync(path).isFile() && !['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.ico'].includes(extname(path).toLowerCase())) fs.unlinkSync(path);
        }
        const serialized = serializeThinkDocument({ ...snapshot, metadata: { ...snapshot.metadata, published: true } });
        if (!serialized.ok) throw new ThinkFileError(serialized.error.code);
        const target = join(project, 'src/modules/think/content', fileName);
        fs.writeFileSync(target, serialized.value);
        if (!markdown.includes(target)) markdown.push(target);
        // Use the same Markdown processor's image collection before native bundler imports.
        // Node permissions alone do not constrain reads performed inside trusted native addons.
        const processor = await createSatteriMarkdownProcessor({ syntaxHighlight: false });
        for (const file of markdown) {
          const source = parseThinkSource(fs.readFileSync(file, 'utf8'));
          const body = source.ok ? source.value.document.body : fs.readFileSync(file, 'utf8');
          const rendered = await processor.render(body);
          for (const image of rendered.metadata.localImagePaths) {
            const path = resolve(dirname(file), image);
            if (!(within(join(project, 'src'), path) || within(publicRoot, path)) || !/\.(svg|png|jpe?g|webp|gif|avif)$/i.test(path) || !fs.existsSync(path)) throw new ThinkFileError('PREVIEW_RESOURCE_BLOCKED');
          }
        }
        fs.writeFileSync(join(project, 'pnpm-workspace.yaml'), 'packages: []\n'); // Stop Vite's upward workspace probing.
        fs.copyFileSync(new URL('./preview-build.mjs', import.meta.url), join(job, 'build.mjs'));
        fs.writeFileSync(join(job, 'options.json'), JSON.stringify({ base }));
        const moduleRoot = dirname(dirname(createRequire(import.meta.url).resolve('astro/package.json')));
        const packageFile = join(dirname(moduleRoot), 'package.json');
        const childEnv: NodeJS.ProcessEnv = { ASTRO_TELEMETRY_DISABLED: '1', NODE_ENV: 'production', APPDATA: join(job, 'appdata'), LOCALAPPDATA: join(job, 'localappdata'), XDG_CONFIG_HOME: join(job, 'config'), TEMP: job, TMP: job };
        for (const field of ['SystemRoot', 'WINDIR', 'PATH']) if (process.env[field]) childEnv[field] = process.env[field];
        await new Promise<void>((resolveBuild, rejectBuild) => {
          const child = spawn(process.execPath, ['--permission', `--allow-fs-read=${moduleRoot}`, `--allow-fs-read=${packageFile}`, `--allow-fs-read=${job!}`, `--allow-fs-write=${job!}`, '--allow-addons', '--allow-worker', join(job!, 'build.mjs')], { cwd: job, env: childEnv, stdio: 'ignore', windowsHide: true });
          let reason: 'PREVIEW_TIMEOUT' | 'PREVIEW_CANCELLED' | undefined;
          const stop = () => { reason ??= 'PREVIEW_CANCELLED'; child.kill(); };
          const timer = setTimeout(() => { reason = 'PREVIEW_TIMEOUT'; child.kill(); }, timeout);
          abort!.signal.addEventListener('abort', stop, { once: true });
          if (abort!.signal.aborted) stop();
          child.once('error', () => { clearTimeout(timer); abort!.signal.removeEventListener('abort', stop); rejectBuild(new ThinkFileError('PREVIEW_FAILED')); });
          child.once('close', code => {
            clearTimeout(timer); abort!.signal.removeEventListener('abort', stop);
            if (reason) rejectBuild(new ThinkFileError(reason));
            else if (fs.existsSync(join(job!, 'network-blocked'))) rejectBuild(new ThinkFileError('PREVIEW_RESOURCE_BLOCKED'));
            else if (code !== 0) rejectBuild(new ThinkFileError('PREVIEW_FAILED'));
            else resolveBuild();
          });
        });
        if (abort.signal.aborted) throw new ThinkFileError('PREVIEW_CANCELLED');
        const projection = projectThinkPreview(join(project, 'out'), snapshot.metadata.slug, base);
        result = { ok: true, value: { ...projection, fingerprint: createHash('sha256').update(JSON.stringify({ document: snapshot, key: args.key, base })).digest('hex'), cleanupPending: false } };
      } finally { signal?.removeEventListener('abort', cancel); }
    } catch (error) {
      result = { ok: false, error: { code: error instanceof ThinkFileError ? error.code : 'PREVIEW_FAILED', message: '隔离预览未完成；源文件与缓冲未保存，请检查候选或本地项目后重试。', issues: [] } };
    } finally {
      if (job && identity) {
        try {
          const cache = join(root, '.cache/studio/preview'); safeDirectory(cache); safeDirectory(job);
          const stat = fs.lstatSync(job);
          if (!within(cache, job) || stat.ino !== identity.ino || stat.dev !== identity.dev || !relative(cache, job).startsWith('job-')) cleanupPending = true;
          else fs.rmSync(job, { recursive: true });
        } catch { cleanupPending = true; }
      }
    }
    if (result.ok) result.value.cleanupPending = cleanupPending;
    else if (cleanupPending) result.error.cleanupPending = true;
    return result;
  }
  return {
    previewThink(input: unknown, signal?: AbortSignal): Promise<EditorResult<ThinkPreviewResult>> {
      if (closed || pending) return Promise.resolve({ ok: false, error: { code: closed ? 'SERVICE_CLOSED' : 'AUTHORING_BUSY', message: '预览服务已关闭或正在构建，请稍后重试。', issues: [] } });
      pending = run(input, signal).finally(() => { pending = undefined; abort = undefined; });
      return pending;
    },
    async close() { closed = true; abort?.abort(); await pending; },
  };
}
