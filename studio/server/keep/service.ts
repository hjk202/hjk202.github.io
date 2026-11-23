import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';
import { publicBookmarks, bookmarkGroups } from '../../../src/modules/keep/bookmarks.ts';
import type { Bookmark, KeepCollection, KeepRecord, KeepWrite } from '../../contracts/keep.ts';
import type { EditorResult } from '../../contracts/result.ts';
import { SourceFiles, SourceFileError } from '../source-files.ts';
import { sourceExpression } from '../source-expression.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const slug = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new SourceFileError('INVALID_REQUEST');
  return value as Record<string, unknown>;
}
export function validateBookmarks(value: unknown): Bookmark[] {
  if (!Array.isArray(value) || value.length > 2000) throw new SourceFileError('VALIDATION_FAILED');
  for (const item of value) {
    const entry = object(item, ['slug', 'title', 'description', 'published', 'sourceUrl', 'note', 'category', 'kind']);
    if (!slug(entry.slug) || typeof entry.title !== 'string' || typeof entry.description !== 'string' || typeof entry.sourceUrl !== 'string'
      || !Array.isArray(entry.note) || entry.note.some(text => typeof text !== 'string') || entry.kind !== undefined && typeof entry.kind !== 'string'
      || entry.published !== undefined && typeof entry.published !== 'boolean') throw new SourceFileError('VALIDATION_FAILED');
    if (entry.category !== undefined) {
      const category = object(entry.category, ['id', 'label']);
      if (typeof category.id !== 'string' || typeof category.label !== 'string') throw new SourceFileError('VALIDATION_FAILED');
    }
  }
  try {
    // Validate every candidate, including drafts, without using the filtered return as the source.
    const complete = (value as Bookmark[]).map(item => ({ ...item, published: true }));
    publicBookmarks(complete); bookmarkGroups(complete);
  } catch { throw new SourceFileError('VALIDATION_FAILED'); }
  return structuredClone(value) as Bookmark[];
}

export function createKeepAuthoring(repositoryRoot = root) {
  let files: SourceFiles | undefined, closed = false;
  const store = () => { if (closed) throw new SourceFileError('SERVICE_CLOSED'); return files ??= new SourceFiles(repositoryRoot, 'keep'); };
  function read() {
    const file = store().read('data.ts');
    const source = new TextDecoder('utf-8', { fatal: true }).decode(file.bytes);
    const expression = sourceExpression(source, 'bookmarks', 'publicBookmarks', './bookmarks.ts');
    return { file, expression, entries: validateBookmarks(expression.value) };
  }
  function result<T>(operation: () => T): EditorResult<T> {
    try { return { ok: true, value: operation() }; }
    catch (error) { return { ok: false, error: { code: error instanceof SourceFileError ? error.code : 'FILE_OPERATION_FAILED', message: 'Keep 操作未完成；源文件与本地缓冲保留，请核对错误码。', issues: [], ...(error instanceof SourceFileError && error.cleanupPending ? { cleanupPending: true } : {}) } }; }
  }
  function candidate(input: unknown, mode: 'create' | 'save' | 'delete' | 'preview') {
    const args = object(input, ['bookmark', 'expectedRevision', 'key']);
    const state = read();
    if (mode !== 'preview' && (typeof args.expectedRevision !== 'string' || args.expectedRevision !== state.file.revision)) throw new SourceFileError('REVISION_CONFLICT');
    const key = args.key;
    if (key !== undefined && !slug(key)) throw new SourceFileError('INVALID_REQUEST');
    const index = key === undefined ? -1 : state.entries.findIndex(entry => entry.slug === key);
    if (key !== undefined && index < 0) throw new SourceFileError('NOT_FOUND');
    if ((mode === 'save' || mode === 'delete') && index < 0) throw new SourceFileError('INVALID_REQUEST');
    if (mode === 'delete') state.entries.splice(index, 1);
    else {
      const [entry] = validateBookmarks([args.bookmark]);
      if (index >= 0 && entry!.slug !== key) throw new SourceFileError('INVALID_REQUEST');
      if (index < 0 && state.entries.some(existing => existing.slug === entry!.slug)) throw new SourceFileError('DUPLICATE_SLUG');
      if (index < 0) state.entries.push(entry!); else state.entries[index] = entry!;
    }
    validateBookmarks(state.entries);
    return { ...state, source: state.expression.serialize(state.entries) };
  }
  function write(input: unknown, mode: 'create' | 'save' | 'delete'): EditorResult<KeepWrite> {
    return result(() => {
      const state = candidate(input, mode);
      const cleanupPending = store().write('data.ts', state.source, state.file, () => {});
      return { revision: store().read('data.ts').revision, cleanupPending };
    });
  }
  return {
    listKeep: (): EditorResult<KeepCollection> => result(() => { const state = read(); return { entries: state.entries, revision: state.file.revision }; }),
    readKeep: (key: unknown): EditorResult<KeepRecord> => result(() => {
      if (!slug(key)) throw new SourceFileError('INVALID_REQUEST');
      const state = read(), bookmark = state.entries.find(entry => entry.slug === key);
      if (!bookmark) throw new SourceFileError('NOT_FOUND');
      return { bookmark, revision: state.file.revision };
    }),
    createKeep: (input: unknown) => write(input, 'create'),
    saveKeep: (input: unknown) => write(input, 'save'),
    deleteKeep: (input: unknown) => write(input, 'delete'),
    validateKeep: (input: unknown) => result(() => { candidate(input, 'preview'); return { canSave: true }; }),
    preparePreview: (input: unknown) => result(() => {
      const state = candidate(input, 'preview');
      const args = input as { bookmark: Bookmark };
      const entries = state.entries.map(entry => entry.slug === args.bookmark.slug ? { ...entry, published: true } : entry);
      return { module: 'keep' as const, slug: args.bookmark.slug, source: state.expression.serialize(entries) };
    }),
    close() { closed = true; if (files) files.close(); },
  };
}
