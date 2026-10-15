import type { SearchIndex, PublicModule, SearchResult } from './types.ts';
import type { VaultView } from '../vault/types.ts';
import { targetId, targetHref } from '../vault/targets.ts';

/** Browser-only source identity; never added to the four-field public results. */
export interface VaultSearchIndex extends SearchIndex {
  privateResults?: ReadonlySet<SearchResult>;
}

export function searchVisibility(query: string, result: SearchResult, index: VaultSearchIndex): 'public' | 'private' | 'mixed' | 'module' {
  // A generated module shortcut still opens the whole module, even if content also matches.
  if (!index.results.includes(result)) return 'module';
  const normalized = query.trim().toLowerCase();
  let publicMatch = false, privateMatch = false;
  for (const candidate of index.results) {
    if (candidate.url !== result.url || !normalized || !(candidate.title.toLowerCase().includes(normalized) || candidate.description.toLowerCase().includes(normalized))) continue;
    if (index.privateResults?.has(candidate)) privateMatch = true;
    else publicMatch = true;
  }
  return privateMatch ? (publicMatch ? 'mixed' : 'private') : publicMatch ? 'public' : 'module';
}

/** Validate module-owned runtime projections without relaxing static page validation. */
export function validateVaultProjection(module: PublicModule, view: VaultView): void {
  if (!view || ['count','search','hasTarget','mount','dispose'].some(key => typeof view[key as keyof VaultView] !== 'function')) throw new Error('Invalid Vault adapter');
  const count = view.count(module.count);
  if (!Number.isSafeInteger(count) || count < module.count) throw new Error('Invalid Vault count');
  const results = view.search();
  if (!Array.isArray(results) || results.length > 400) throw new Error('Invalid Vault search');
  for (const result of results) {
    if (!result || Object.keys(result).sort().join(',') !== 'description,module,title,url' || result.module !== module.id || typeof result.title !== 'string' || !result.title.trim() || result.title.length > 300 || typeof result.description !== 'string' || result.description.length > 2000 || typeof result.url !== 'string') throw new Error('Invalid Vault search result');
    targetHref(result.url);
    const split = result.url.indexOf('#');
    if (result.url === module.route) continue;
    if (split < 0 || result.url.slice(0,split) !== module.route) throw new Error('Invalid Vault module target');
    const id = targetId(result.url.slice(split));
    if (!id || !view.hasTarget(id)) throw new Error('Unknown Vault target');
  }
}

export function combineVaultProjection(index: SearchIndex, views: ReadonlyMap<string,VaultView>): VaultSearchIndex {
  const results: SearchResult[] = [...index.results];
  const privateResults = new Set<SearchResult>();
  const modules = index.modules.map(module => {
    const view = views.get(module.id);
    if (!view) return module;
    const entries = view.search();
    results.push(...entries);
    entries.forEach(entry => privateResults.add(entry));
    return {...module,count:view.count(module.count)};
  });
  // Search deduplicates after matching: a private description sharing a public URL stays searchable.
  return {modules,results,privateResults};
}
