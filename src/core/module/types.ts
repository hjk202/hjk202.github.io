import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
import type { SearchResult } from '../search/types.ts';

export interface ModuleMetadata {
  id: string;
  name: string;
  route: string;
  /** SVG path data, drawn in a 24 × 24 viewBox. */
  icon: string;
  order: number;
  enabled?: boolean;
  /** Compass display only; content count remains the actual public population. */
  compassStatistic?: 'peer-average';
}

export interface Module extends ModuleMetadata {
  count(): Promise<number>;
  search(): Promise<SearchResult[]>;
}

/** Build-time routing only; props belong to each module. */
export interface ModulePage {
  path: string;
  component: AstroComponentFactory;
  props: Record<string, unknown>;
}

export type RegisteredModule = Module & { enabled: boolean };
