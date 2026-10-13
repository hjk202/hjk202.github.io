import { modules } from './registry.server.ts';
import { collectPages } from './pages.ts';

const adapters = import.meta.glob('../../modules/*/pages.ts', { eager: true, import: 'default' });
export const pages = collectPages(modules, adapters);
