import type { ModuleMetadata } from '../module/types.ts';

export interface SearchResult {
  title: string;
  description: string;
  url: string;
  module: string;
}

export interface PublicModule extends ModuleMetadata { count: number }
export interface SearchIndex {
  modules: PublicModule[];
  results: SearchResult[];
}
