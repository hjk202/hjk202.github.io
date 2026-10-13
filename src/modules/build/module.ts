import type { Module } from '../../core/module/types.ts';
import { projects } from './data.ts';

export default {
  id: 'build', name: 'Build', route: '/build/', order: 1,
  icon: 'm12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12 4 7.5M12 12v9',
  count: async () => projects.length,
  search: async () => projects.map((project) => ({ title: project.title, description: project.summary, url: `/build/${project.slug}/`, module: 'build' })),
} satisfies Module;
