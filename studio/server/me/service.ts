import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';
import { publicProfile } from '../../../src/modules/me/profile.ts';
import type { Profile, ProfileRecord, ProfileWrite } from '../../contracts/me.ts';
import type { EditorResult } from '../../contracts/result.ts';
import { SourceFiles, SourceFileError } from '../source-files.ts';
import { sourceExpression } from '../source-expression.ts';

function request(value: unknown, fields: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) throw new SourceFileError('INVALID_REQUEST');
  return value as Record<string, unknown>;
}
export function validateProfile(value: unknown): Profile | null {
  if (value === null) return null;
  const profile = request(value, ['published', 'name', 'description', 'paragraphs', 'links']);
  if (typeof profile.name !== 'string' || typeof profile.description !== 'string' || !Array.isArray(profile.paragraphs)
    || profile.paragraphs.some(text => typeof text !== 'string') || profile.published !== undefined && typeof profile.published !== 'boolean'
    || profile.links !== undefined && (!Array.isArray(profile.links) || profile.links.some(link => {
      const data = request(link, ['label', 'url']); return typeof data.label !== 'string' || typeof data.url !== 'string';
    }))) throw new SourceFileError('VALIDATION_FAILED');
  try { publicProfile({ ...profile, published: true } as unknown as Profile); }
  catch { throw new SourceFileError('VALIDATION_FAILED'); }
  return structuredClone(value) as Profile;
}
export function createMeAuthoring(root = fileURLToPath(new URL('../../../', import.meta.url))) {
  let files: SourceFiles | undefined, closed = false;
  const store = () => { if (closed) throw new SourceFileError('SERVICE_CLOSED'); return files ??= new SourceFiles(root, 'me'); };
  function read() {
    const file = store().read('data.ts');
    const expression = sourceExpression(new TextDecoder('utf-8', { fatal: true }).decode(file.bytes), 'profile', 'publicProfile', './profile.ts');
    return { file, expression, profile: validateProfile(expression.value) };
  }
  function result<T>(operation: () => T): EditorResult<T> {
    try { return { ok: true, value: operation() }; }
    catch (error) { return { ok: false, error: { code: error instanceof SourceFileError ? error.code : 'FILE_OPERATION_FAILED', message: 'Me 操作未完成；原资料与缓冲保留，请核对错误码。', issues: [], ...(error instanceof SourceFileError && error.cleanupPending ? { cleanupPending: true } : {}) } }; }
  }
  function candidate(input: unknown) {
    const args = request(input, ['profile']);
    if (!Object.hasOwn(args, 'profile')) throw new SourceFileError('INVALID_REQUEST');
    return validateProfile(args.profile);
  }
  function write(input: unknown, clear: boolean): EditorResult<ProfileWrite> {
    return result(() => {
      const args = request(input, clear ? ['expectedRevision'] : ['profile', 'expectedRevision']);
      const state = read();
      if (typeof args.expectedRevision !== 'string' || args.expectedRevision !== state.file.revision) throw new SourceFileError('REVISION_CONFLICT');
      const profile = clear ? null : candidate({ profile: args.profile });
      if (!clear && profile === null) throw new SourceFileError('INVALID_REQUEST');
      const source = state.expression.serialize(profile);
      const cleanupPending = store().write('data.ts', source, state.file, () => {});
      return { revision: store().read('data.ts').revision, cleanupPending };
    });
  }
  return {
    readProfile: (): EditorResult<ProfileRecord> => result(() => { const state = read(); return { profile: state.profile, revision: state.file.revision }; }),
    saveProfile: (input: unknown) => write(input, false),
    clearProfile: (input: unknown) => write(input, true),
    validateProfile: (input: unknown) => result(() => { candidate(input); return { canSave: true }; }),
    preparePreview: (input: unknown) => result(() => {
      const profile = candidate(input), state = read();
      return { module: 'me' as const, slug: '', source: state.expression.serialize(profile === null ? null : { ...profile, published: true }) };
    }),
    close() { closed = true; files?.close(); },
  };
}
