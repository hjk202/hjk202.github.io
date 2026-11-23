import fs from 'node:fs';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EditorResult } from '../../contracts/result.ts';
import { FAST_PREVIEW_MAX_BODY } from '../../contracts/preview.ts';
import type { FastThinkPreviewResult } from '../../contracts/preview.ts';
import { cleanSvg, projectFastMarkdown } from './preview-html.ts';
import { ThinkFileError } from './files.ts';

const mime: Record<string, string> = { '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.avif':'image/avif' };
const defaultRoot = fileURLToPath(new URL('../../../', import.meta.url));
const inside = (root: string, path: string) => {
  const part = relative(root, path);
  return !!part && !isAbsolute(part) && part !== '..' && !part.startsWith('..' + sep);
};
const unsafeImagePath = (path: string) => /[\\:?#]/.test(path) || path.startsWith('//') || [...path].some(char => char.charCodeAt(0) < 32);

function safeBytes(path: string, limit: number) {
  if (fs.realpathSync.native(path) !== path) return;
  const before = fs.lstatSync(path);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > limit) return;
  const fd = fs.openSync(path, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fs.fstatSync(fd);
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.nlink !== 1 || opened.size !== before.size) return;
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (!count) return;
      offset += count;
    }
    const after = fs.fstatSync(fd), named = fs.lstatSync(path);
    if (named.isSymbolicLink() || named.ino !== opened.ino || named.dev !== opened.dev || named.nlink !== 1 || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs || fs.realpathSync.native(path) !== path) return;
    return bytes;
  } finally { fs.closeSync(fd); }
}

export function createFastThinkPreview(repositoryRoot = defaultRoot, base = '/') {
  const root = resolve(repositoryRoot), content = join(root, 'src/modules/think/content'), publicRoot = join(root, 'public');
  let processor: Promise<Awaited<ReturnType<typeof import('@astrojs/markdown-satteri')['createSatteriMarkdownProcessor']>>> | undefined;
  let styles: string | undefined;
  function loadProcessor() {
    return processor ??= Promise.all([import('@astrojs/markdown-satteri'), import('../../../src/modules/think/markdown.mjs')])
      .then(([{createSatteriMarkdownProcessor},{writingMarkdown}]) => createSatteriMarkdownProcessor({
        ...writingMarkdown, hastPlugins:[...writingMarkdown.hastPlugins, {
          name:'preview-source-lines', options:{position:true},
          element:{filter:['p','li','h1','h2','h3','h4','h5','h6','blockquote','table','tr','pre','hr'],visit(node,ctx){
            if(node.position?.start.line)ctx.setProperty(node,'data-source-line',node.position.start.line);
          }},
        }],
      }))
      .catch(error => { processor = undefined; throw error; });
  }
  async function render(input: { body?: unknown }, signal: AbortSignal): Promise<EditorResult<FastThinkPreviewResult>> {
    const fail = (code: 'INVALID_REQUEST'|'PREVIEW_CANCELLED'|'PREVIEW_FAILED'|'PREVIEW_TOO_LARGE'): EditorResult<never> => ({ ok: false, error: { code, message: '快速预览未完成，正文保留。', issues: [] } });
    if (typeof input.body !== 'string') return fail('INVALID_REQUEST');
    if (Buffer.byteLength(input.body) > FAST_PREVIEW_MAX_BODY) return fail('PREVIEW_TOO_LARGE');
    if (signal.aborted) return fail('PREVIEW_CANCELLED');
    try {
      const rendered = await (await loadProcessor()).render(input.body);
      if (signal.aborted) return fail('PREVIEW_CANCELLED');
      styles ??= [join(root,'src/shell/theme/theme.css'), join(root,'src/modules/think/prose.css')].map(path => {
        try { return safeBytes(path, 64*1024)?.toString('utf8') ?? ''; }
        catch { return ''; }
      }).join('\n') +
        '\nbody{margin:0;padding:24px;font:16px/1.65 system-ui,sans-serif;color:var(--ink,#293237);background:var(--background,#f2f3f1)}.think-article{max-width:720px;margin:auto}.prose{line-height:1.95}';
      let remaining = 4 * 1024 * 1024, count = 0;
      const preview = projectFastMarkdown(rendered.code, styles, raw => {
        if (!raw || ++count > 48 || unsafeImagePath(raw)) return;
        try {
          const path = decodeURIComponent(raw);
          if (unsafeImagePath(path)) return;
          const parent = path.startsWith('/') ? publicRoot : content;
          const name = path.startsWith('/') ? path.slice(base !== '/' && path.startsWith(base) ? base.length : 1) : path;
          const target = resolve(parent, name);
          if (!inside(parent, target)) return;
          const type = mime[extname(target).toLowerCase()];
          if (!type) return;
          const bytes = safeBytes(target, Math.min(remaining, 2 * 1024 * 1024));
          if (!bytes) return;
          remaining -= bytes.length;
          const safe = type === 'image/svg+xml' ? Buffer.from(cleanSvg(bytes.toString('utf8'))) : bytes;
          return `data:${type};base64,${safe.toString('base64')}`;
        } catch { /* Unavailable or unsafe resources are inert placeholders. */ }
      });
      return { ok: true, value: { ...preview, literalMath: false } };
    } catch (error) { return fail(error instanceof ThinkFileError && error.code === 'PREVIEW_TOO_LARGE' ? 'PREVIEW_TOO_LARGE' : 'PREVIEW_FAILED'); }
  }
  return Object.assign(render, {
    warm() { void loadProcessor().catch(() => { /* Retry on the first explicit request. */ }); },
  });
}
