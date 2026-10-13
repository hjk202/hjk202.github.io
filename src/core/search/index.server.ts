import { modules } from '../module/registry.server.ts';
import { pages } from '../module/pages.server.ts';
import { buildPublicData } from './build.ts';

export const searchIndex = await buildPublicData(modules, new Set(pages.map((page) => page.url)));
