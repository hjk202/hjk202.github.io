import fs from 'node:fs';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { parse, ELEMENT_NODE, TEXT_NODE, DOCUMENT_NODE } from 'ultrahtml';
import type { Node, ElementNode } from 'ultrahtml';
import { decodeHTML } from 'entities';
import { MAX_PREVIEW_BYTES } from '../../contracts/preview.ts';
import { ThinkFileError } from './files.ts';

const escape = (text: string): string => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const htmlTags = new Set('article section div p span h1 h2 h3 h4 h5 h6 ul ol li blockquote pre code strong em b i del s sub sup small mark time br hr table thead tbody tfoot tr th td caption dl dt dd figure figcaption details summary a img'.split(' '));
const svgTags = new Set('svg g path rect circle ellipse line polyline polygon text tspan defs linearGradient radialGradient stop title desc'.toLowerCase().split(' '));
function descendants(node: Node): ElementNode[] {
  if (node.type !== ELEMENT_NODE && node.type !== DOCUMENT_NODE) return [];
  return [...(node.type === ELEMENT_NODE ? [node] : []), ...node.children.flatMap(descendants)];
}
function cleanSvg(source: string): string {
  function render(node: Node): string {
    if (node.type === TEXT_NODE) return escape(decodeHTML(node.value));
    if (node.type !== ELEMENT_NODE || !svgTags.has(node.name.toLowerCase())) return '';
    const attrs = Object.entries(node.attributes).filter(([name, value]) => {
      if (/^(fill|stroke|stop-color)$/i.test(name)) return /^(none|currentColor|#[a-f\d]{3,8}|[a-z]+|url\(#[\w-]+\))$/i.test(value);
      return /^(xmlns|viewBox|width|height|x|y|x1|x2|y1|y2|cx|cy|r|rx|ry|d|points|opacity|fill-opacity|stroke-width|transform|offset|id|gradientUnits|gradientTransform|text-anchor|font-size)$/i.test(name);
    }).map(([name, value]) => ` ${name}="${escape(decodeHTML(value))}"`).join('');
    return `<${node.name}${attrs}>${node.children.map(render).join('')}</${node.name}>`;
  }
  const tree = parse(source) as Node;
  const svg = descendants(tree).find(node => node.name.toLowerCase() === 'svg');
  if (!svg) throw new ThinkFileError('PREVIEW_RESOURCE_BLOCKED');
  return render(svg);
}

/** A conservative HTML projection, built from parsed nodes rather than returning raw build HTML. */
export function projectThinkPreview(directory: string, slug: string, base: string): { html: string; blockedResources: number } {
  const output = resolve(directory);
  let total = 0, blockedResources = 0;
  function read(file: string): Buffer {
    const path = resolve(output, file);
    const part = relative(output, path);
    if (!part || isAbsolute(part) || part.startsWith('..' + sep) || part === '..' || /[:\\]/.test(file) || [...file].some(char => char.charCodeAt(0) < 32)) throw new ThinkFileError('PREVIEW_RESOURCE_BLOCKED');
    const stat = fs.lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || fs.realpathSync(path) !== path) throw new ThinkFileError('PREVIEW_RESOURCE_BLOCKED');
    if (stat.size > MAX_PREVIEW_BYTES) throw new ThinkFileError('PREVIEW_TOO_LARGE');
    total += stat.size;
    if (total > MAX_PREVIEW_BYTES) throw new ThinkFileError('PREVIEW_TOO_LARGE');
    return fs.readFileSync(path);
  }
  const tree = parse(read(`think/${slug}/index.html`).toString('utf8')) as Node;
  const nodes = descendants(tree);
  const article = nodes.find(node => node.name === 'article' && decodeHTML(node.attributes.class ?? '').split(/\s+/).includes('think-article'));
  const head = nodes.find(node => node.name === 'head');
  if (!article || !head) throw new ThinkFileError('PREVIEW_FAILED');
  const styles = descendants(head).filter(node => node.name === 'style').map(node => node.children.map(child => child.type === TEXT_NODE ? child.value : '').join('')).join('\n');
  if (/@import|url\s*\(/i.test(styles)) throw new ThinkFileError('PREVIEW_RESOURCE_BLOCKED');
  function image(src: string): string | undefined {
    try {
      const url = new URL(decodeHTML(src), `http://preview.invalid${base}think/${slug}/`);
      if (url.origin !== 'http://preview.invalid' || url.search || url.hash || !url.pathname.startsWith(base)) return undefined;
      const file = decodeURIComponent(url.pathname.slice(base.length));
      const mime: Record<string, string> = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif' };
      const type = mime[extname(file).toLowerCase()];
      if (!type) return undefined;
      const bytes = read(file);
      return `data:${type};base64,${(type === 'image/svg+xml' ? Buffer.from(cleanSvg(bytes.toString('utf8'))) : bytes).toString('base64')}`;
    } catch (error) { if (error instanceof ThinkFileError && error.code === 'PREVIEW_TOO_LARGE') throw error; return undefined; }
  }
  function render(node: Node): string {
    if (node.type === TEXT_NODE) return escape(decodeHTML(node.value));
    if (node.type !== ELEMENT_NODE || !htmlTags.has(node.name.toLowerCase())) return '';
    const name = node.name.toLowerCase();
    const attrs: string[] = [];
    for (const [rawName, rawValue] of Object.entries(node.attributes)) {
      const key = rawName.toLowerCase(), value = decodeHTML(rawValue);
      if (/^(class|id|role|aria-label|datetime|colspan|rowspan|start|width|height|alt)$/.test(key) || /^data-astro-cid-[a-z\d]+$/.test(key)) attrs.push(`${key}="${escape(value)}"`);
      if (key === 'style' && !/url|expression|@|[\\<>]/i.test(value)) attrs.push(`style="${escape(value)}"`);
    }
    if (name === 'img') {
      const src = image(node.attributes.src ?? '');
      if (!src) { blockedResources++; return '<span>[图片资源已阻断或不可用]</span>'; }
      attrs.push(`src="${src}"`);
    }
    const opening = `<${name}${attrs.length ? ' ' + attrs.join(' ') : ''}>`;
    return ['img', 'br', 'hr'].includes(name) ? opening : opening + node.children.map(render).join('') + `</${name}>`;
  }
  const policy = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  const scope = (className: string) => {
    const element = nodes.find(node => (node.attributes.class ?? '').split(/\s+/).includes(className));
    return Object.keys(element?.attributes ?? {}).filter(key => /^data-astro-cid-[a-z\d]+$/.test(key)).map(key => ` ${key}=""`).join('');
  };
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${escape(policy)}"><meta name="referrer" content="no-referrer"><style>${styles.replace(/<\/style/gi, '\\3c /style')}\nbody{margin:0} .module-content{padding-top:24px}</style></head><body><div class="module-page" data-module="think"${scope('module-page')}><main class="module-content"${scope('module-content')}>${render(article)}</main></div></body></html>`;
  if (Buffer.byteLength(html) > MAX_PREVIEW_BYTES) throw new ThinkFileError('PREVIEW_TOO_LARGE');
  return { html, blockedResources };
}
