import { articleIdentityIssues, publishedArticleIssues } from '../../../src/modules/think/metadata.ts';
import type { ValidationCode, ValidationIssue, ValidationReport } from '../../contracts/think.ts';

export const thinkMetadataFields = ['slug', 'title', 'summary', 'date', 'published', 'kind'] as const;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

/** Pure author-input validation. Directory uniqueness and revisions belong to M1. */
export function validateThinkDocument(value: unknown): ValidationReport {
  const issues: ValidationIssue[] = [];
  const add = (field: string, code: ValidationCode, message: string, severity: 'error' | 'warning' = 'error') => {
    if (!issues.some(issue => issue.field === field && issue.severity === 'error')) issues.push({ field, code, message, severity });
  };
  const finish = (): ValidationReport => ({
    canSave: !issues.some(issue => issue.severity === 'error'),
    publishReady: issues.length === 0,
    issues,
  });
  if (!record(value)) {
    add('document', 'INVALID_TYPE', '文章必须是普通对象。');
    return finish();
  }
  for (const key of Reflect.ownKeys(value)) {
    if (key !== 'metadata' && key !== 'body') add('document', 'UNKNOWN_FIELD', '文章含不支持的字段。');
  }
  if (typeof value.body !== 'string') add('body', 'INVALID_TYPE', '正文必须是字符串。');
  if (!record(value.metadata)) {
    add('metadata', 'INVALID_TYPE', 'metadata 必须是普通对象。');
    return finish();
  }
  const data = value.metadata;
  for (const key of Reflect.ownKeys(data)) {
    if (typeof key !== 'string' || !thinkMetadataFields.some(field => field === key)) add('metadata', 'UNKNOWN_FIELD', 'metadata 含不支持的字段。');
  }
  for (const field of thinkMetadataFields) {
    if (!Object.hasOwn(data, field)) continue;
    if (typeof data[field] !== (field === 'published' ? 'boolean' : 'string')) add(`metadata.${field}`, 'INVALID_TYPE', `${field} 类型错误。`);
  }
  for (const issue of articleIdentityIssues(data)) add(`metadata.${issue.field}`, issue.code, issue.message);
  const published = data.published === true;
  for (const issue of publishedArticleIssues(data, typeof value.body === 'string' ? value.body : '')) {
    const field = issue.field === 'body' ? 'body' : `metadata.${issue.field}`;
    // Empty draft fields are incomplete, but supplied invalid dates/kinds remain errors.
    const incomplete = issue.code === 'REQUIRED_FIELD'
      || (issue.field === 'date' && (data.date === undefined || (typeof data.date === 'string' && !data.date.trim())));
    add(field, incomplete ? 'REQUIRED_FIELD' : issue.code, issue.message, !published && incomplete ? 'warning' : 'error');
  }
  return finish();
}
