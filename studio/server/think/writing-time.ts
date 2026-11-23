import fs from 'node:fs';
import { dirname, join } from 'node:path';
import type { EditorResult } from '../../contracts/result.ts';
import { localStorePathAsync } from '../../windows/local.ts';
import { digest, hex, idValid, IntakeError, ProposalStore, record } from '../intake/store.ts';
import type { ThinkAuthoring } from './service.ts';

type Entry = { ids: string[]; ms: number };
type Ledger = { version: 1; entries: Entry[]; batches: string[] };
const ledgerId = '00000000-0000-0000-0000-000000000001';
const maxEntries = 1_000;
const maxDuration = Number.MAX_SAFE_INTEGER;
const idPattern = /^(?:draft:[a-f0-9-]{36}|key:[a-f0-9]{64}|slug:[a-z0-9]+(?:-[a-z0-9]+)*)$/;

function decode(value: unknown): Ledger {
  const {version, entries, batches} = record(value, ['version','entries','batches']);
  if (version !== 1 || !Array.isArray(entries) || entries.length > maxEntries || !Array.isArray(batches) || batches.length > 256 || !batches.every(idValid)) throw new IntakeError('UNSUPPORTED_FORMAT');
  const seen = new Set<string>();
  for (const entry of entries) {
    const {ids,ms} = record(entry,['ids','ms']);
    if (!Array.isArray(ids) || !ids.length || ids.length > 64 || typeof ms !== 'number' || !Number.isSafeInteger(ms) || ms < 0) throw new IntakeError('UNSUPPORTED_FORMAT');
    for (const id of ids) {
      if (typeof id !== 'string' || id.length > 270 || !idPattern.test(id) || seen.has(id)) throw new IntakeError('UNSUPPORTED_FORMAT');
      seen.add(id);
    }
  }
  return {version, entries: entries as Entry[], batches};
}

export function createWritingTime(root: string, think: ThinkAuthoring, directory?: string) {
  let storage: Promise<ProposalStore> | undefined;
  return async (input: unknown): Promise<EditorResult<{ms:number}>> => {
    try {
      const {sourceKey,draftId,elapsedMs,batch} = record(input,['sourceKey','draftId','elapsedMs','batch']);
      if (sourceKey === undefined && draftId === undefined || sourceKey !== undefined && !hex(sourceKey) || draftId !== undefined && !idValid(draftId)
        || typeof elapsedMs !== 'number' || !Number.isInteger(elapsedMs) || elapsedMs < 0 || elapsedMs > 120_000
        || (elapsedMs === 0 ? batch !== undefined : !idValid(batch))) throw new IntakeError('INVALID_REQUEST');
      const ids: string[] = [];
      if (typeof sourceKey === 'string') {
        const source = think.readThink({key:sourceKey});
        if (!source.ok || !source.value.document?.metadata.slug) throw new IntakeError('NOT_FOUND');
        ids.push('key:' + sourceKey, 'slug:' + source.value.document.metadata.slug);
      }
      if (typeof draftId === 'string') ids.push('draft:' + draftId);
      storage ??= (async () => new ProposalStore(directory ?? join(dirname(await localStorePathAsync()), 'writing-time', digest(fs.realpathSync.native(root)))))().catch(error => { storage = undefined; throw error; });
      const store = await storage;
      let revision: string | null = null;
      let state: Ledger = {version:1,entries:[],batches:[]};
      try { const saved = store.read(ledgerId); revision = saved.revision; state = decode(saved.value); }
      catch (error) { if (!(error instanceof IntakeError && error.code === 'NOT_FOUND')) throw error; }
      const related = state.entries.filter(entry => entry.ids.some(id => ids.includes(id)));
      const aliases = [...new Set([...related.flatMap(entry => entry.ids), ...ids])];
      const increment = typeof batch === 'string' && !state.batches.includes(batch) ? elapsedMs : 0;
      const ms = Math.min(maxDuration, related.reduce((sum, entry) => sum + entry.ms, 0) + increment);
      if (increment || related.length && (related.length > 1 || aliases.length !== related[0]!.ids.length)) {
        const entries = state.entries.filter(entry => !related.includes(entry));
        if (entries.length >= maxEntries || aliases.length > 64) throw new IntakeError('AUTHORING_BUSY');
        entries.push({ids:aliases,ms});
        const batches = increment ? [...state.batches.slice(-255),batch as string] : state.batches;
        store.write(ledgerId,{version:1,entries,batches},revision);
      }
      return {ok:true,value:{ms}};
    } catch (error) {
      return {ok:false,error:{code:error instanceof IntakeError?error.code:'FILE_OPERATION_FAILED',message:'写作时长暂未保存，文章不受影响。',issues:[]}};
    }
  };
}
