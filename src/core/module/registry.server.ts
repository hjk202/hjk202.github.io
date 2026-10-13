import { createRegistry, publicMetadata } from './registry.ts';

const definitions = import.meta.glob('../../modules/*/module.ts', { eager: true, import: 'default' });
export const modules = createRegistry(definitions);
export const moduleMetadata = publicMetadata(modules);
