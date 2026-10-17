import { fileURLToPath } from 'node:url';
import type { EditorErrorCode, EditorResult, ThinkDocument, ThinkReadResult, ThinkSummary, ThinkWriteResult, ValidationIssue, ValidationReport } from '../../contracts/think.ts';
import { parseThinkSource, serializeThinkDocument } from './document.ts';
import { allowedThinkFileName, keyOf, MAX_THINK_SOURCE_BYTES, revisionOf, ThinkFileError, ThinkFiles } from './files.ts';
import type { ThinkSourceFile } from './files.ts';
import { validateThinkDocument } from './validation.ts';

interface Entry { summary: ThinkSummary; source?: ThinkSourceFile; document?: ThinkDocument }
interface Snapshot { entries: Entry[]; names: string[] }
export interface ThinkAuthoring {
  listThink(input?: unknown): EditorResult<ThinkSummary[]>;
  readThink(input: unknown): EditorResult<ThinkReadResult>;
  createThink(input: unknown): EditorResult<ThinkWriteResult>;
  saveThink(input: unknown): EditorResult<ThinkWriteResult>;
  deleteThink(input: unknown): EditorResult<{ deleted: true }>;
  validateThink(input: unknown): EditorResult<ValidationReport>;
  close(): EditorResult<{ closed: true }>;
}

const issue = (field: string, code: ValidationIssue['code'], message: string): ValidationIssue => ({ field, code, message, severity: 'error' });
const invalidDirectory = (): ValidationIssue => issue('directory', 'DIRECTORY_INVALID', '存在不可可靠校验的源文件，请先处理目录诊断。');
function errorResult(error: unknown): EditorResult<never> {
  const code: EditorErrorCode = error instanceof ThinkFileError ? error.code : 'FILE_OPERATION_FAILED';
  return { ok: false, error: { code, message: 'Think 作者操作未完成，请根据错误码重新读取或检查本地源。', issues: [], ...(error instanceof ThinkFileError && error.cleanupPending ? { cleanupPending: true } : {}) } };
}
function request(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).some(key => typeof key !== 'string' || !fields.includes(key))) throw new ThinkFileError('INVALID_REQUEST');
  return value as Record<string, unknown>;
}
function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new ThinkFileError('INVALID_REQUEST');
  return value;
}
function requireValid(report: ValidationReport): void {
  if (!report.canSave) throw Object.assign(new ThinkFileError(report.issues.some(i => i.code === 'DUPLICATE_SLUG') ? 'DUPLICATE_SLUG'
    : report.issues.some(i => i.code === 'FILE_EXISTS') ? 'FILE_EXISTS'
    : report.issues.some(i => i.code === 'DIRECTORY_INVALID') ? 'DIRECTORY_INVALID' : 'VALIDATION_FAILED'), { issues: report.issues });
}

/** Opens a single-repository lease. root is trusted bootstrap/test configuration, never a client argument. */
export function openThinkAuthoring(repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))): EditorResult<ThinkAuthoring> {
  let files: ThinkFiles;
  try { files = new ThinkFiles(repositoryRoot); } catch (error) { return errorResult(error); }
  let active = false;
  const run = <T>(action: () => T): EditorResult<T> => {
    if (active) return errorResult(new ThinkFileError('AUTHORING_BUSY'));
    active = true;
    try { files.assertLease(); return { ok: true, value: action() }; }
    catch (error) {
      const result = errorResult(error);
      if (!result.ok && error instanceof ThinkFileError && 'issues' in error) result.error.issues = (error as ThinkFileError & { issues: ValidationIssue[] }).issues;
      return result;
    } finally { active = false; }
  };
  const scan = (): Snapshot => {
    const names = files.names();
    const entries: Entry[] = names.filter(name => name.toLowerCase().endsWith('.md')).map(fileName => {
      const entry: Entry = { summary: { key: keyOf(fileName), fileName, revision: null, editable: false, deletable: false, issues: [] } };
      if (!allowedThinkFileName(fileName)) {
        entry.summary.issues.push(issue('fileName', 'INVALID_FILENAME', '文件名不在受支持的本层 .md 范围内。'));
        return entry;
      }
      try {
        const source = files.read(fileName);
        entry.source = source;
        entry.summary.revision = source.revision;
        entry.summary.deletable = true;
        const text = source.bytes.toString('utf8');
        if (!Buffer.from(text).equals(source.bytes)) {
          entry.summary.issues.push(issue('source', 'SOURCE_UNAVAILABLE', '源文件不是有效 UTF-8。'));
          return entry;
        }
        const parsed = parseThinkSource(text);
        if (!parsed.ok) { entry.summary.issues = parsed.error.issues; return entry; }
        entry.document = parsed.value.document;
        const { slug, title, date, published, kind } = entry.document.metadata;
        Object.assign(entry.summary, { slug, ...(title !== undefined ? { title } : {}), ...(date !== undefined ? { date } : {}), ...(published !== undefined ? { published } : {}), ...(kind !== undefined ? { kind } : {}), editable: true, issues: parsed.value.validation.issues });
      } catch {
        entry.summary.issues.push(issue('source', 'SOURCE_UNAVAILABLE', '源文件不安全、不可读、过大或在读取时变化。'));
      }
      return entry;
    });
    for (const entry of entries) {
      if (entries.some(other => other !== entry && other.summary.fileName.toLowerCase() === entry.summary.fileName.toLowerCase())) {
        entry.summary.editable = false;
        entry.summary.issues.push(issue('fileName', 'INVALID_FILENAME', '文件名存在大小写冲突。'));
      }
      if (entry.document && entries.some(other => other !== entry && other.document?.metadata.slug === entry.document?.metadata.slug)) {
        entry.summary.editable = false;
        entry.summary.issues.push(issue('metadata.slug', 'DUPLICATE_SLUG', '目录内 slug 重复（包括草稿）。'));
      }
    }
    return { entries, names };
  };
  const find = (snapshot: Snapshot, key: string): Entry => {
    const entry = snapshot.entries.find(entry => entry.summary.key === key);
    if (!entry) throw new ThinkFileError('NOT_FOUND');
    return entry;
  };
  const expected = (snapshot: Snapshot, key: string, revision: string): Entry & { source: ThinkSourceFile } => {
    const entry = find(snapshot, key);
    if (entry.summary.revision !== revision) throw new ThinkFileError('REVISION_CONFLICT');
    if (!entry.source || !entry.summary.deletable) throw new ThinkFileError('PROTECTED_PATH');
    return entry as Entry & { source: ThinkSourceFile };
  };
  const validate = (snapshot: Snapshot, document: unknown, key?: string): ValidationReport => {
    const report = validateThinkDocument(document);
    if (!report.canSave) return report;
    const candidate = document as ThinkDocument;
    const target = key === undefined ? undefined : find(snapshot, key);
    if (snapshot.entries.some(entry => !entry.summary.editable)) report.issues.push(invalidDirectory());
    if (target?.document && target.document.metadata.slug !== candidate.metadata.slug) report.issues.push(issue('metadata.slug', 'SLUG_IMMUTABLE', '首版不修改已有文章 slug 或文件名。'));
    if (snapshot.entries.some(entry => entry.summary.key !== key && entry.document?.metadata.slug === candidate.metadata.slug)) report.issues.push(issue('metadata.slug', 'DUPLICATE_SLUG', '目录内 slug 重复（包括草稿）。'));
    if (key === undefined) {
      const name = candidate.metadata.slug + '.md';
      if (!allowedThinkFileName(name)) report.issues.push(issue('fileName', 'INVALID_FILENAME', 'slug 不能用作安全的 Windows .md 文件名。'));
      if (snapshot.names.some(other => other.toLowerCase() === name.toLowerCase())) report.issues.push(issue('fileName', 'FILE_EXISTS', '目标文件名已存在。'));
    }
    report.canSave = !report.issues.some(i => i.severity === 'error');
    if (report.canSave) {
      const serialized = serializeThinkDocument(candidate, target?.source?.bytes.toString('utf8'));
      if (!serialized.ok) report.issues.push(...serialized.error.issues);
      else if (Buffer.byteLength(serialized.value, 'utf8') > MAX_THINK_SOURCE_BYTES) report.issues.push(issue('document', 'SOURCE_TOO_LARGE', '作者工具的单篇源文件上限为 16 MiB。'));
      report.canSave = !report.issues.some(i => i.severity === 'error');
    }
    report.publishReady = report.issues.length === 0;
    return report;
  };
  const recheck = (key: string, revision: string): Snapshot => {
    const snapshot = scan();
    try { expected(snapshot, key, revision); }
    catch (error) { if (error instanceof ThinkFileError && error.code === 'NOT_FOUND') throw new ThinkFileError('REVISION_CONFLICT'); throw error; }
    return snapshot;
  };
  const service: ThinkAuthoring = {
    listThink: (input = {}) => run(() => {
      const args = request(input, ['status']);
      if (args.status !== undefined && (typeof args.status !== 'string' || !['all', 'draft', 'published'].includes(args.status))) throw new ThinkFileError('INVALID_REQUEST');
      return scan().entries.map(entry => entry.summary)
        .filter(entry => !entry.editable || args.status === undefined || args.status === 'all' || (args.status === 'published' ? entry.published === true : entry.published !== true))
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.fileName.localeCompare(b.fileName));
    }),
    readThink: input => run(() => {
      const args = request(input, ['key']);
      const entry = find(scan(), identifier(args.key));
      return { ...entry.summary, ...(entry.document ? { document: entry.document } : {}) };
    }),
    validateThink: input => run(() => {
      const args = request(input, ['key', 'document']);
      return validate(scan(), args.document, args.key === undefined ? undefined : identifier(args.key));
    }),
    createThink: input => run(() => {
      const args = request(input, ['document']);
      requireValid(validateThinkDocument(args.document));
      const supplied = args.document as ThinkDocument;
      const document: ThinkDocument = { ...supplied, metadata: { published: false, kind: 'article', ...supplied.metadata } };
      requireValid(validate(scan(), document));
      const serialized = serializeThinkDocument(document);
      if (!serialized.ok) throw Object.assign(new ThinkFileError(serialized.error.code), { issues: serialized.error.issues });
      const fileName = document.metadata.slug + '.md';
      const cleanupPending = files.write(fileName, serialized.value, null, () => requireValid(validate(scan(), document)));
      return { key: keyOf(fileName), revision: revisionOf(Buffer.from(serialized.value)), cleanupPending };
    }),
    saveThink: input => run(() => {
      const args = request(input, ['key', 'expectedRevision', 'document']);
      const key = identifier(args.key), revision = identifier(args.expectedRevision);
      const snapshot = scan(), entry = expected(snapshot, key, revision);
      requireValid(validate(snapshot, args.document, key));
      const serialized = serializeThinkDocument(args.document, entry.source.bytes.toString('utf8'));
      if (!serialized.ok) throw Object.assign(new ThinkFileError(serialized.error.code), { issues: serialized.error.issues });
      const cleanupPending = files.write(entry.source.fileName, serialized.value, entry.source, () => requireValid(validate(recheck(key, revision), args.document, key)));
      return { key, revision: revisionOf(Buffer.from(serialized.value)), cleanupPending };
    }),
    deleteThink: input => run(() => {
      const args = request(input, ['key', 'expectedRevision']);
      const key = identifier(args.key), revision = identifier(args.expectedRevision);
      const entry = expected(scan(), key, revision);
      files.remove(entry.source, () => { recheck(key, revision); });
      return { deleted: true as const };
    }),
    close: () => {
      if (active) return errorResult(new ThinkFileError('AUTHORING_BUSY'));
      try { files.close(); return { ok: true, value: { closed: true } }; }
      catch (error) { return errorResult(error); }
    },
  };
  return { ok: true, value: service };
}
