import type { RegisteredModule } from '../module/types.ts';
import { publicMetadata } from '../module/registry.ts';
import type { SearchIndex, SearchResult } from './types.ts';

export async function buildPublicData(modules: readonly RegisteredModule[], pageUrls: ReadonlySet<string>): Promise<SearchIndex> {
  const results: SearchResult[] = [];
  const metadata = publicMetadata(modules);
  const summaries = await Promise.all(modules.map(async (module, index) => {
    try {
      const count = await module.count();
      if (!Number.isSafeInteger(count) || count < 0) throw new Error('count must be a non-negative integer');
      const entries = await module.search();
      if (!Array.isArray(entries)) throw new Error('search must return an array');
      const projected = entries.map((entry) => {
        if (!entry || typeof entry.title !== 'string' || !entry.title.trim() || typeof entry.description !== 'string' || entry.module !== module.id || typeof entry.url !== 'string' || !entry.url.startsWith(module.route) || !pageUrls.has(entry.url)) {
          throw new Error('search result must describe a generated page in its module');
        }
        const { title, description, url } = entry;
        return { title, description, url, module: module.id };
      });
      return { module: { ...metadata[index], count }, results: projected };
    } catch (error) {
      throw new Error(`Module ${module.id} public data: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }));
  for (const summary of summaries) results.push(...summary.results);
  return { modules: summaries.map((summary) => summary.module), results };
}
