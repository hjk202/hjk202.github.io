import type { Module } from '../../core/module/types.ts';
import { bookmarks } from './data.ts';

export default {
  id: 'keep', name: 'Keep', route: '/keep/', order: 3,
  icon: 'M6 3h12v18l-6-4-6 4V3Z',
  count: async () => bookmarks.length,
  search: async () => bookmarks.map((bookmark) => ({ title: bookmark.title, description: bookmark.description, url: `/keep/${bookmark.slug}/`, module: 'keep' })),
} satisfies Module;
