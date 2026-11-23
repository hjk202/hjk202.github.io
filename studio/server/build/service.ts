import fs from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';
import { publicProjects } from '../../../src/modules/build/projects.ts';
import type { Project, ProjectCollection, ProjectRecord, ProjectWrite } from '../../contracts/build.ts';
import type { EditorResult } from '../../contracts/result.ts';
import { SourceFiles, SourceFileError } from '../source-files.ts';
import { sourceExpression } from '../source-expression.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const slug = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new SourceFileError('INVALID_REQUEST');
  return value as Record<string, unknown>;
}
export function validateProjects(value: unknown): Project[] {
  if (!Array.isArray(value) || value.length > 2000) throw new SourceFileError('VALIDATION_FAILED');
  const invalid = () => { throw new SourceFileError('VALIDATION_FAILED'); };
  const text = (value: unknown) => typeof value === 'string';
  const strings = (value: unknown): boolean => Array.isArray(value) && Array.from(value).every(text);
  const records = (value: unknown, fields: string[], check: (item: Record<string, unknown>) => boolean) => {
    if (!Array.isArray(value) || value.length > 2000) return invalid();
    for (const item of value) if (!check(object(item, fields))) invalid();
  };
  for (const entry of value) {
    const item = object(entry, ['slug','title','summary','published','period','sections','keywords','links','status','milestones','updates','issues']);
    if (!slug(item.slug) || !text(item.title) || !text(item.summary) || item.published !== undefined && typeof item.published !== 'boolean'
      || item.period !== undefined && !text(item.period) || item.status !== undefined && !text(item.status) || item.keywords !== undefined && !strings(item.keywords)) invalid();
    records(item.sections, ['title','paragraphs','items','code'], section => (section.title === undefined || text(section.title)) && (section.code === undefined || text(section.code)) && (section.paragraphs === undefined || strings(section.paragraphs)) && (section.items === undefined || strings(section.items)));
    if (item.links !== undefined) records(item.links, ['label','url'], link => text(link.label) && text(link.url));
    if (item.milestones !== undefined) records(item.milestones, ['title','status','description'], stage => text(stage.title) && text(stage.status) && (stage.description === undefined || text(stage.description)));
    if (item.updates !== undefined) records(item.updates, ['date','title','accomplishments','challenges','nextSteps'], update => text(update.date) && text(update.title) && ['accomplishments','challenges','nextSteps'].every(key => update[key] === undefined || strings(update[key])));
    if (item.issues !== undefined) records(item.issues, ['title','description','status','resolution'], issue => text(issue.title) && text(issue.description) && text(issue.status) && (issue.resolution === undefined || text(issue.resolution)));
  }
  try { publicProjects((value as Project[]).map(item => ({ ...item, published: true }))); }
  catch { throw new SourceFileError('VALIDATION_FAILED'); }
  return structuredClone(value) as Project[];
}

export function createBuildAuthoring(repositoryRoot = root) {
  let files: SourceFiles | undefined, closed = false;
  const store = () => { if (closed) throw new SourceFileError('SERVICE_CLOSED'); return files ??= new SourceFiles(repositoryRoot, 'build'); };
  function read() {
    const file = store().read('data.ts');
    const source = new TextDecoder('utf-8', { fatal: true }).decode(file.bytes);
    const expression = sourceExpression(source, 'projects', 'publicProjects', './projects.ts');
    return { file, expression, entries: validateProjects(expression.value) };
  }
  function result<T>(operation: () => T): EditorResult<T> {
    try { return { ok: true, value: operation() }; }
    catch (error) { return { ok: false, error: { code: error instanceof SourceFileError ? error.code : 'FILE_OPERATION_FAILED', message: 'Build 操作未完成；源文件与本地缓冲保留，请核对错误码。', issues: [], ...(error instanceof SourceFileError && error.cleanupPending ? { cleanupPending: true } : {}) } }; }
  }
  function candidate(input: unknown, mode: 'create' | 'save' | 'delete' | 'preview', precise=false) {
    const args = object(input, ['project', 'expectedRevision', 'key']);
    const state = read();
    if (mode !== 'preview' && (typeof args.expectedRevision !== 'string' || args.expectedRevision !== state.file.revision)) throw new SourceFileError('REVISION_CONFLICT');
    const key = args.key;
    if (key !== undefined && !slug(key)) throw new SourceFileError('INVALID_REQUEST');
    const index = key === undefined ? -1 : state.entries.findIndex(entry => entry.slug === key);
    if (key !== undefined && index < 0) throw new SourceFileError('NOT_FOUND');
    if ((mode === 'save' || mode === 'delete') && index < 0) throw new SourceFileError('INVALID_REQUEST');
    if (mode === 'delete') state.entries.splice(index, 1);
    else {
      const [entry] = validateProjects([args.project]);
      if (index >= 0 && entry!.slug !== key) throw new SourceFileError('INVALID_REQUEST');
      if (index < 0 && state.entries.some(existing => existing.slug === entry!.slug)) throw new SourceFileError('DUPLICATE_SLUG');
      if (index < 0) state.entries.push(entry!); else state.entries[index] = entry!;
    }
    validateProjects(state.entries);
    return { ...state, source: precise&&mode!=='delete'?state.expression.serializeEntry(index<0?state.entries.length-1:index,state.entries[index<0?state.entries.length-1:index]):state.expression.serialize(state.entries) };
  }
  function guardPrivateReferences(state: ReturnType<typeof candidate>, input: unknown, mode: 'create' | 'save' | 'delete') {
    if (mode === 'create') return;
    const args = input as { key?: string; project?: Project };
    const old = (state.expression.value as Project[]).find(project => project.slug === args.key);
    if (old?.published !== true || mode !== 'delete' && args.project?.published === true) return;
    for (const part of ['public', 'public/vault', 'public/vault/bundle.json']) {
      const path = join(repositoryRoot, part);
      let stat: fs.Stats;
      try { stat = fs.lstatSync(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
      if (stat.isSymbolicLink() || fs.realpathSync(path) !== resolve(path)) throw new SourceFileError('PROTECTED_PATH');
      if (part.endsWith('bundle.json')) throw new SourceFileError('PRIVATE_REFERENCES_UNKNOWN');
    }
  }
  function write(input: unknown, mode: 'create' | 'save' | 'delete', precise=false): EditorResult<ProjectWrite> {
    return result(() => {
      const state = candidate(input, mode,precise);
      guardPrivateReferences(state, input, mode);
      const cleanupPending = store().write('data.ts', state.source, state.file, () => {});
      return { revision: store().read('data.ts').revision, cleanupPending };
    });
  }
  return {
    /** Trusted publication coordinator only; not an additional ordinary HTTP/Agent operation. */
    preparePublication:(input:unknown)=>result(()=>{
      const args=object(input,['project','expectedRevision','key']);if(!args.project||typeof args.project!=='object'||(args.project as Project).published!==true)throw new SourceFileError('INVALID_REQUEST');
      const state=candidate(input,args.key===undefined?'create':'save',true);guardPrivateReferences(state,input,args.key===undefined?'create':'save');
      return{key:(args.project as Project).slug,fileName:'data.ts',expectedRevision:state.file.revision,before:state.file.bytes.toString('utf8'),after:state.source,project:args.project as Project};
    }),
    publishBuild:(input:unknown):EditorResult<ProjectWrite>=>{
      try{const args=object(input,['project','expectedRevision','key']);if(!args.project||typeof args.project!=='object'||(args.project as Project).published!==true)throw new SourceFileError('INVALID_REQUEST');return write(input,args.key===undefined?'create':'save',true);}catch(error){return result(()=>{throw error;});}
    },
    listBuild: (): EditorResult<ProjectCollection> => result(() => { const state = read(); return { entries: state.entries, revision: state.file.revision }; }),
    readBuild: (key: unknown): EditorResult<ProjectRecord> => result(() => {
      if (!slug(key)) throw new SourceFileError('INVALID_REQUEST');
      const state = read(), project = state.entries.find(entry => entry.slug === key);
      if (!project) throw new SourceFileError('NOT_FOUND');
      return { project, revision: state.file.revision };
    }),
    createBuild: (input: unknown) => write(input, 'create'),
    saveBuild: (input: unknown) => write(input, 'save'),
    deleteBuild: (input: unknown) => write(input, 'delete'),
    validateBuild: (input: unknown) => result(() => { const state = candidate(input, 'preview'); guardPrivateReferences(state, input, 'save'); return { canSave: true }; }),
    preparePreview: (input: unknown) => result(() => {
      const state = candidate(input, 'preview');
      const args = input as { project: Project };
      const entries = state.entries.map(entry => entry.slug === args.project.slug ? { ...entry, published: true } : entry);
      return { module: 'build' as const, slug: args.project.slug, source: state.expression.serialize(entries) };
    }),
    close() { closed = true; if (files) files.close(); },
  };
}
