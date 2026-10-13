import type { Module } from '../../core/module/types.ts';
import { posts } from './content.server.ts';

export default {
  id: 'think', name: 'Think', route: '/think/', order: 0,
  icon: 'M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z',
  count: async () => posts.length,
  search: async () => posts.map(({ metadata: post }) => ({ title: post.title, description: post.summary, url: `/think/${post.slug}/`, module: 'think' })),
} satisfies Module;
