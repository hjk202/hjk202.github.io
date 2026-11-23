import { Document, isMap, isScalar, parseDocument, Scalar } from 'yaml';
import type { EditorResult, ParsedThinkSource, ThinkDocument, ValidationIssue } from '../../contracts/think.ts';
import { thinkMetadataFields, validateThinkDocument } from './validation.ts';

function failure(code: 'VALIDATION_FAILED' | 'UNSUPPORTED_FORMAT', issues: ValidationIssue[]): EditorResult<never> {
  return { ok: false, error: { code, message: 'Think 文档未通过校验，原始文本未被修改。', issues } };
}

function sourceIssue(code: 'INVALID_FRONTMATTER' | 'UNSUPPORTED_YAML', message: string): EditorResult<never> {
  return failure('UNSUPPORTED_FORMAT', [{ field: 'metadata', code, message, severity: 'error' }]);
}

function decode(source: string) {
  const opening = /^(\uFEFF?---[ \t]*)(\r?\n)/.exec(source);
  if (!opening) return null;
  const closingPattern = /^---[ \t]*(?:\r?\n|$)/gm;
  closingPattern.lastIndex = opening[0].length;
  const closing = closingPattern.exec(source);
  if (!closing) return null;
  return {
    opening: opening[0],
    yaml: source.slice(opening[0].length, closing.index),
    closing: closing[0],
    body: source.slice(closing.index + closing[0].length),
    newline: opening[2],
  };
}

/** Writing preview can render an incomplete draft without validating public metadata. */
export function thinkPreviewBody(source: string): string {
  const parts = decode(source);
  if (!parts || !/^(?:slug|title|summary|date|kind|published|createdAt|updatedAt)\s*:/m.test(parts.yaml)) return source;
  return parts.body;
}

function missingDraftSlug(metadata: Record<string, unknown>) {
  return metadata.slug === undefined || metadata.slug === '';
}

function bufferReport(value: unknown, draft: boolean) {
  const report = validateThinkDocument(value);
  if (!draft || !value || typeof value !== 'object' || !('metadata' in value) || !value.metadata
    || typeof value.metadata !== 'object' || !missingDraftSlug(value.metadata as Record<string, unknown>)) return report;
  const issues = report.issues.filter(issue => issue.field !== 'metadata.slug' || issue.code !== 'INVALID_SLUG');
  return { ...report, issues, canSave: !issues.some(issue => issue.severity === 'error'), publishReady: false };
}

function readSource(source: unknown, draft = false) {
  if (typeof source !== 'string') return failure('VALIDATION_FAILED', [{ field: 'source', code: 'INVALID_TYPE', message: '源文本必须是字符串。', severity: 'error' }]);
  const parts = decode(source);
  if (!parts) return sourceIssue('INVALID_FRONTMATTER', '需要位于文件开头、闭合的 YAML frontmatter（---）。');
  const yaml = parseDocument(parts.yaml, { schema: 'core', customTags: ['timestamp'], version: '1.2', uniqueKeys: true, prettyErrors: false, logLevel: 'silent' });
  if (yaml.errors.length) return sourceIssue('INVALID_FRONTMATTER', 'YAML 语法错误或键重复。');
  if (yaml.warnings.length || yaml.directives?.yaml.version !== '1.2' || yaml.directives.docEnd || !isMap(yaml.contents)) return sourceIssue('UNSUPPORTED_YAML', '仅支持 YAML 1.2 的字段映射，不接受额外文档标记。');
  const metadata: Record<string, unknown> = Object.create(null);
  for (const pair of yaml.contents.items) {
    if (!isScalar(pair.key) || typeof pair.key.value !== 'string' || pair.key.tag || pair.key.anchor
      || !isScalar(pair.value) || pair.value.tag || pair.value.anchor) return sourceIssue('UNSUPPORTED_YAML', '字段必须是普通标量，不支持标签、锚点、别名或嵌套结构。');
    metadata[pair.key.value] = pair.value.value;
  }
  const document = { metadata, body: parts.body };
  const validation = bufferReport(document, draft);
  if (!validation.canSave) return failure('VALIDATION_FAILED', validation.issues);
  return { ok: true as const, value: { parts, yaml, document: document as unknown as ThinkDocument, validation } };
}

/** Parse an editable source; unsupported/invalid sources return diagnostics, never an empty replacement. */
export function parseThinkSource(source: unknown): EditorResult<ParsedThinkSource> {
  const result = readSource(source);
  if (!result.ok) return result;
  const { document, validation } = result.value;
  return { ok: true, value: { document, validation } };
}

/** Review can read an incomplete local buffer, without relaxing source validation. */
export function parseThinkDraftBuffer(source: string): EditorResult<{ metadata: Partial<ThinkDocument['metadata']>; body: string }> {
  const result = readSource(source, true);
  return result.ok ? { ok: true, value: result.value.document } : result;
}

function sameMetadata(a: ThinkDocument['metadata'], b: ThinkDocument['metadata']): boolean {
  return thinkMetadataFields.every(field => Object.hasOwn(a, field) === Object.hasOwn(b, field) && a[field] === b[field]);
}

/** Serialize in memory. Supply the original source to preserve its formatting and comments. */
export function serializeThinkDocument(value: unknown, originalSource?: string): EditorResult<string> {
  return serialize(value, originalSource, false);
}

/** In-memory review only. Save/preview/publish source endpoints still use the strict codec. */
export function serializeThinkDraftBuffer(value: { metadata: Partial<ThinkDocument['metadata']>; body: string }, originalSource?: string): EditorResult<string> {
  return serialize(value, originalSource, true);
}

function serialize(value: unknown, originalSource: string | undefined, draft: boolean): EditorResult<string> {
  const report = bufferReport(value, draft);
  if (!report.canSave) return failure('VALIDATION_FAILED', report.issues);
  const document = value as ThinkDocument;
  const original = originalSource === undefined ? undefined : readSource(originalSource, draft);
  if (original && !original.ok) return original;
  const previous = original?.value;
  if (previous && sameMetadata(document.metadata, previous.document.metadata)) {
    const separator = !previous.parts.closing.endsWith('\n') && document.body ? previous.parts.newline : '';
    return { ok: true, value: document.body === previous.document.body ? originalSource! : previous.parts.opening + previous.parts.yaml + previous.parts.closing + separator + document.body };
  }
  if (previous) {
    const changes = thinkMetadataFields.filter(field => document.metadata[field] !== previous.document.metadata[field]);
    if (changes.length && changes.every(field => (field === 'createdAt' || field === 'updatedAt') && document.metadata[field] !== undefined)) {
      let header = previous.parts.yaml;
      const edits = changes.map(field => {
        const node = previous.yaml.get(field, true);
        return { field, range: isScalar(node) ? node.range : undefined };
      }).sort((a,b) => (b.range?.[0] ?? -1) - (a.range?.[0] ?? -1));
      for (const {field,range} of edits) {
        const value = JSON.stringify(document.metadata[field]);
        header = range ? header.slice(0, range[0]) + value + header.slice(range[1]) : header + field + ': ' + value + previous.parts.newline;
      }
      const separator = !previous.parts.closing.endsWith('\n') && document.body ? previous.parts.newline : '';
      const patched = previous.parts.opening + header + previous.parts.closing + separator + document.body;
      const check = readSource(patched, draft);
      if (check.ok && sameMetadata(document.metadata, check.value.document.metadata) && check.value.document.body === document.body) return {ok:true,value:patched};
    }
  }
  const yaml = previous ? previous.yaml.clone() : new Document({});
  for (const field of thinkMetadataFields) {
    if (!Object.hasOwn(document.metadata, field)) {
      yaml.delete(field);
      continue;
    }
    const scalar = yaml.get(field, true);
    if (isScalar(scalar)) scalar.value = document.metadata[field];
    else yaml.set(field, yaml.createNode(document.metadata[field]));
    const current = yaml.get(field, true);
    if (isScalar(current) && typeof document.metadata[field] === 'string'
      && (!previous || previous.document.metadata[field] !== document.metadata[field])) current.type = Scalar.QUOTE_DOUBLE;
  }
  const newline = previous?.parts.newline ?? '\n';
  const text = yaml.toString({ lineWidth: 0 }).replace(/\n/g, newline);
  const opening = previous?.parts.opening ?? `---${newline}`;
  // A previous EOF delimiter needs a newline when a body is added.
  const closing = previous?.parts.closing || `---${newline}`;
  const source = opening + text + closing + (!closing.endsWith('\n') && document.body ? newline : '') + document.body;
  const check = readSource(source, draft);
  if (!check.ok) return check;
  if (!sameMetadata(document.metadata, check.value.document.metadata) || document.body !== check.value.document.body) return sourceIssue('UNSUPPORTED_YAML', '序列化结果无法保持原文语义。');
  return { ok: true, value: source };
}
