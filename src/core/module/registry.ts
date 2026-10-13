import type { ModuleMetadata, RegisteredModule } from './types.ts';

export function createRegistry(exports: Record<string, unknown>): RegisteredModule[] {
  const ids = new Set<string>();
  const routes = new Set<string>();
  const orders = new Set<number>();

  const modules = Object.entries(exports).map(([file, value]) => {
    const fail = (reason: string): never => { throw new Error(`Module ${file}: ${reason}`); };
    if (!value || typeof value !== 'object') return fail('expected a default module export');
    const module = value as Record<string, unknown>;
    const directory = file.replaceAll('\\', '/').split('/').at(-2);
    for (const field of ['id', 'name', 'route', 'icon']) {
      if (typeof module[field] !== 'string' || !(module[field] as string).trim()) {
        fail(`${field} must be a non-empty string`);
      }
    }
    const { id, name, route, icon } = module as Record<string, string>;
    if (!/^[a-z][a-z0-9-]*$/.test(id) || id !== directory) fail('id must match its directory');
    if (!/^\/[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*\/?$/.test(route)) {
      fail('route must be a local logical path');
    }
    const normalizedRoute = `${route.replace(/\/$/, '')}/`;
    if (typeof module.order !== 'number' || !Number.isSafeInteger(module.order)) fail('order must be an integer');
    if (module.enabled !== undefined && typeof module.enabled !== 'boolean') fail('enabled must be boolean');
    if (module.compassStatistic !== undefined && module.compassStatistic !== 'peer-average') fail('compassStatistic must be peer-average');
    if (typeof module.count !== 'function' || typeof module.search !== 'function') fail('count and search must be functions');
    if (ids.has(id)) fail(`duplicate id: ${id}`);
    if (routes.has(normalizedRoute)) fail(`duplicate route: ${normalizedRoute}`);
    if (orders.has(module.order as number)) fail(`ambiguous order: ${module.order}`);
    ids.add(id);
    routes.add(normalizedRoute);
    orders.add(module.order as number);
    return { ...module, id, name, icon, route: normalizedRoute, enabled: module.enabled ?? true } as RegisteredModule;
  });
  return modules.filter((module) => module.enabled).sort((a, b) => a.order - b.order);
}

export function publicMetadata(modules: readonly RegisteredModule[]): ModuleMetadata[] {
  return modules.map(({ id, name, route, icon, order, enabled, compassStatistic }) => ({ id, name, route, icon, order, enabled, ...(compassStatistic ? { compassStatistic } : {}) }));
}
