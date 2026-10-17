import { parse, DOCUMENT_NODE, ELEMENT_NODE, TEXT_NODE } from 'ultrahtml';
import type { Node } from 'ultrahtml';
import { decodeHTML } from 'entities';

/** Plain text only: list previews never contain hidden links, media or headings. */
export function notePreview(html: string): string {
  function text(node: Node): string {
    if (node.type === TEXT_NODE) return node.value;
    if (node.type !== DOCUMENT_NODE && node.type !== ELEMENT_NODE) return '';
    if (node.type === ELEMENT_NODE && ['script', 'style', 'template', 'svg', 'math'].includes(node.name)) return '';
    const content = node.children.map(text).join('');
    return node.type === ELEMENT_NODE && /^(?:p|h[1-6]|li|blockquote|pre|div|br)$/.test(node.name) ? `${content} ` : content;
  }
  const content = decodeHTML(text(parse(html))).replace(/\s+/gu, ' ').trim();
  const characters = Array.from(content);
  return characters.length > 400 ? `${characters.slice(0, 400).join('')}…` : content;
}
