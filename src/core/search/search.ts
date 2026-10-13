import type { ModuleMetadata } from '../module/types.ts';
import type { SearchIndex, SearchResult } from './types.ts';

export function moduleShortcuts(modules: readonly ModuleMetadata[]): SearchResult[] {
  return modules.map((module) => ({ title: module.name, description: `Explore ${module.name}`, url: module.route, module: module.id }));
}

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function search(query: string, index: SearchIndex): SearchResult[] {
  const normalized = query.trim().toLowerCase();
  const shortcuts = moduleShortcuts(index.modules);
  if (!normalized) return shortcuts;
  const order = new Map(index.modules.map((module) => [module.id, module.order]));
  const rank = (result: SearchResult) => {
    const title = result.title.toLowerCase();
    if (title === normalized) return 0;
    if (title.startsWith(normalized)) return 1;
    if (title.includes(normalized)) return 2;
    return result.description.toLowerCase().includes(normalized) ? 3 : -1;
  };
  const ranked = [...shortcuts, ...index.results].map((result) => ({ result, rank: rank(result) }))
    .filter((item) => item.rank >= 0)
    .sort((a, b) => a.rank - b.rank || (order.get(a.result.module) ?? 0) - (order.get(b.result.module) ?? 0) || compare(a.result.title, b.result.title) || compare(a.result.url, b.result.url));
  const seen = new Set<string>();
  return ranked.flatMap(({ result }) => {
    if (seen.has(result.url)) return [];
    seen.add(result.url);
    return [result];
  });
}
