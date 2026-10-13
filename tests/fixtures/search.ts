import type { Module } from '../../src/core/module/types.ts';

export const definitions: Module[] = ['think', 'build', 'me', 'keep'].map((id, order) => ({
  id, name: id[0].toUpperCase() + id.slice(1), route: `/${id}/`, order, icon: 'M0 0',
  count: async () => id === 'think' || id === 'keep' ? 2 : 1,
  search: async () => id === 'think' ? [
    { title: 'A space', description: 'Ideas', url: '/think/space/', module: id },
    { title: '微小的观察', description: 'Observations', url: '/think/observations/', module: id },
  ] : id === 'keep' ? [
    { title: 'Reading', description: 'The web', url: '/keep/reading/', module: id },
    { title: 'Whitespace', description: '留白', url: '/keep/space/', module: id },
  ] : [{ title: id, description: 'Example', url: `/${id}/`, module: id }],
}));
