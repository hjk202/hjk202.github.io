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

function readSource(source: unknown) {
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
  const validation = validateThinkDocument(document);
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

function sameMetadata(a: ThinkDocument['metadata'], b: ThinkDocument['metadata']): boolean {
  return thinkMetadataFields.every(field => Object.hasOwn(a, field) === Object.hasOwn(b, field) && a[field] === b[field]);
}

/** Serialize in memory. Supply the original source to preserve its formatting and comments. */
export function serializeThinkDocument(value: unknown, originalSource?: string): EditorResult<string> {
  const report = validateThinkDocument(value);
  if (!report.canSave) return failure('VALIDATION_FAILED', report.issues);
  const document = value as ThinkDocument;
  const original = originalSource === undefined ? undefined : readSource(originalSource);
  if (original && !original.ok) return original;
  const previous = original?.value;
  if (previous && sameMetadata(document.metadata, previous.document.metadata)) {
    const separator = !previous.parts.closing.endsWith('\n') && document.body ? previous.parts.newline : '';
    return { ok: true, value: document.body === previous.document.body ? originalSource! : previous.parts.opening + previous.parts.yaml + previous.parts.closing + separator + document.body };
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
  const check = readSource(source);
  if (!check.ok) return check;
  if (!sameMetadata(document.metadata, check.value.document.metadata) || document.body !== check.value.document.body) return sourceIssue('UNSUPPORTED_YAML', '序列化结果无法保持原文语义。');
  return { ok: true, value: source };
}
