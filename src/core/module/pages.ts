import type { ModulePage, RegisteredModule } from './types.ts';

export interface RoutedPage extends ModulePage {
  url: string;
  module: RegisteredModule;
}

export function collectPages(modules: readonly RegisteredModule[], adapters: Record<string, unknown>): RoutedPage[] {
  const used = new Set<string>(['/', '/search-index.json']);
  return modules.flatMap((module) => {
    const entry = Object.entries(adapters).find(([file]) => file.replaceAll('\\', '/').split('/').at(-2) === module.id);
    if (!entry || !Array.isArray(entry[1])) throw new Error(`Module ${module.id}: missing or invalid pages adapter`);
    const pages = entry[1] as ModulePage[];
    if (!pages.some((page) => page?.path === '')) throw new Error(`Module ${module.id}: missing module home page`);
    return pages.map((page) => {
      if (!page || typeof page.path !== 'string' || !/^(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/.test(page.path)) {
        throw new Error(`Module ${module.id}: page path must stay inside the module`);
      }
      if (typeof page.component !== 'function' || !page.props || typeof page.props !== 'object') {
        throw new Error(`Module ${module.id}: invalid page component or props`);
      }
      const url = `${module.route}${page.path ? `${page.path}/` : ''}`;
      if (used.has(url)) throw new Error(`Duplicate page URL: ${url}`);
      used.add(url);
      return { ...page, url, module };
    });
  });
}
