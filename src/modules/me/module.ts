import type { Module } from '../../core/module/types.ts';
import { profile } from './data.ts';

export default {
  id: 'me', name: 'Me', route: '/me/', order: 2,
  compassStatistic: 'peer-average',
  icon: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
  count: async () => profile ? 1 : 0,
  search: async () => profile ? [{ title: profile.name, description: profile.description, url: '/me/', module: 'me' }] : [],
} satisfies Module;
