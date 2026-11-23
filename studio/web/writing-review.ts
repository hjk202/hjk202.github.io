import { presentableDiff } from '@codemirror/merge';
import type { Evidence, ThinkCandidate, ThinkSuggestedEdit } from '../contracts/proposal.ts';

type Field = 'slug' | 'title' | 'summary' | 'date' | 'kind';
type BodyEdit = { from: number; to: number; before: string; after: string };
export type ReviewChange = ({ field: Field; before?: string; after: string } | BodyEdit) & { unconfirmed?: boolean };
export type ReviewDraft = ThinkCandidate & { body: string };
export const fieldLabels: Record<Field, string> = { slug: 'slug', title: '标题', summary: '摘要', date: '日期', kind: '类型' };
const normalize = (text: string) => text.replace(/\r\n?/g, '\n');

/** Map normalized diff offsets to the unchanged original bytes. */
function lines(text: string) {
  const offsets = [0];
  let value = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '\r' && text[i + 1] === '\n') i++;
    value += char === '\r' ? '\n' : char;
    offsets.push(i + 1);
  }
  return { value, offsets };
}

export function writingReview(base: ReviewDraft, proposed: ThinkCandidate, evidence: Evidence[], explicit: ThinkSuggestedEdit[], defaultDate?: string, existing = false) {
  const changes: ReviewChange[] = [], notes: string[] = [];
  const { metadata, body } = base;
  for (const field of ['slug', 'title', 'summary', 'date', 'kind'] as const) {
    const value = proposed.metadata[field];
    if (!value?.trim() || value === metadata[field] || field === 'slug' && (existing || metadata.slug)) continue;
    const source = evidence.find(item => item.field === 'metadata.' + field);
    if (field === 'date' && (metadata.date || !source?.quote?.includes(value))) {
      if (!metadata.date) notes.push('建议日期没有可核对的原文依据，请手工填写。');
      continue;
    }
    const before = metadata[field];
    changes.push({ field, ...(before === undefined ? {} : { before }), after: value, unconfirmed: !source || source.kind === 'unconfirmed' });
  }
  if (defaultDate && !metadata.date && !changes.some(change => 'field' in change && change.field === 'date')) {
    changes.push({ field: 'date', after: defaultDate, unconfirmed: true });
  }

  const { value: original, offsets } = lines(body);
  const next = proposed.body === undefined ? undefined : normalize(proposed.body);
  const title = metadata.title?.trim();
  const withoutMarkup = (line: string) => line.trim().replace(/^#{1,6}[ \t]+/, '').replace(/^[*_]+|[*_]+$/g, '').trim();
  const scopes: { from: number; to: number; type: 'verbatim' | 'credit' }[] = [];
  const keep = (match: RegExpMatchArray, type: 'verbatim' | 'credit') => scopes.push({ from: match.index!, to: match.index! + match[0].length, type });
  for (const match of original.matchAll(/^[ \t]*(?:`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^[ \t]*(?:`{3,}|~{3,})[^\n]*|$(?![\s\S]))|^[ \t]*>[^\n]*|`[^\n`]+`|\$\$[\s\S]+?\$\$|\$[^\n$]+\$|!?\[[^\n\]]*\]\([^\n)]*\)|https?:\/\/[^\s)]+/gm)) keep(match, 'verbatim');
  const heading = /^[ \t]*#{1,6}[ \t]+/;
  let head = 0;
  for (const match of original.matchAll(/[^\n]+/g)) {
    const line = match[0], label = withoutMarkup(line);
    if (!label) continue;
    // Explicit credits anywhere, and short standalone headings/bylines near the start. A repeated title is handled separately.
    if (label !== title && (/^(?:作者|署名|原作|原文|译者|翻译|出处|来源|文|author|source|translator)[ \t]*[:：]|^[—–]{1,3}\s*\S|^(?:作|译|文)[ \t]*[／/]|^by\s+\S/iu.test(label)
      || head < 4 && (heading.test(line) || /^[\p{Script=Han}· ]{2,12}$/u.test(label)))) keep(match, 'credit');
    head++;
  }
  const verse = /诗作|诗歌|诗选/.test(metadata.summary ?? '') ||
    original.split(/\n[ \t]*\n/).some(block => {
      const rows = block.trim().split('\n');
      return rows.length >= 3 && rows.every(row => /[，。！？；、]$/.test(row.trim()) && row.trim().length <= 40);
    });
  const touches = (from: number, to: number, scope: typeof scopes[number]) => from === to
    ? from >= scope.from && from < scope.to : from < scope.to && to > scope.from;
  const edits: (BodyEdit & { start: number; end: number })[] = [];
  let refused = false;
  function add(start: number, end: number, after: string, exact: boolean) {
    const before = original.slice(start, end);
    if (before === after) return;
    const wholeTitle = !!title && (start === 0 || original[start - 1] === '\n') &&
      (original[end - 1] === '\n' || end === original.length || original[end] === '\n') &&
      withoutMarkup(before) === title && !before.trim().includes('\n') && !after.trim();
    const smallVerseCorrection = exact && !!after.trim() && before.length <= 32 && after.length <= 32 && !/[\n]/.test(before + after);
    if (scopes.some(scope => touches(start, end, scope)) ||
      (verse && !wholeTitle && !smallVerseCorrection) ||
      (!after.trim() && /^[\s#*_]*[\p{Script=Han}· ]{2,12}[\s#*_]*$/u.test(before) && !wholeTitle && !exact)) {
      refused = true; return;
    }
    if (edits.some(edit => start === edit.start || (start < edit.end && end > edit.start))) {
      if (exact) refused = true;
      return;
    }
    const from = offsets[start]!, to = offsets[end]!;
    const newline = /\r\n|\r|\n/.exec(body.slice(from, to))?.[0] ?? /\r\n|\r|\n/.exec(body)?.[0] ?? '\n';
    edits.push({ from, to, before: body.slice(from, to), after: after.replaceAll('\n', newline), start, end });
  }
  for (const edit of explicit) {
    const before = normalize(edit.before), start = original.indexOf(before);
    if (start < 0 || original.indexOf(before, start + 1) !== -1) { refused = true; continue; }
    add(start, start + before.length, normalize(edit.after), true);
  }
  // Older responses can still supply a whole candidate. Never add unlisted body changes to an explicit edit list.
  if (!explicit.length && next !== undefined && next !== original) {
    for (const part of presentableDiff(original, next, { scanLimit: 256 })) {
      add(part.fromA, part.toA, next.slice(part.fromB, part.toB), false);
    }
  }
  if (refused) notes.push('可能影响署名、诗句、引用、代码或无法定位的修改未列入可应用项，请对照原文。');
  for (const { from, to, before, after } of edits.sort((a, b) => a.from - b.from)) changes.push({ from, to, before, after });
  return { changes, notes };
}

export function applyReview(base: ReviewDraft, selected: ReviewChange[]): ReviewDraft {
  const metadata = { ...base.metadata };
  let body = '', end = 0;
  for (const edit of selected) {
    if ('field' in edit) {
      if (edit.field === 'kind') {
        if (edit.after === 'article' || edit.after === 'note') metadata.kind = edit.after;
      } else metadata[edit.field] = edit.after;
    } else {
      body += base.body.slice(end, edit.from) + edit.after;
      end = edit.to;
    }
  }
  return { metadata, body: body + base.body.slice(end) };
}
