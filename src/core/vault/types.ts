import type { PublicModule, SearchResult } from '../search/types.ts';
export interface VaultContext {
  module: PublicModule;
  publicTargets: readonly string[];
  base: string;
  asset(id: string): string;
}
export interface VaultView {
  count(publicCount: number): number;
  search(): SearchResult[];
  hasTarget(id: string): boolean;
  mount(container: HTMLElement, id?: string): void;
  dispose(): void;
}
export type VaultFactory = (value: unknown, context: VaultContext) => VaultView;
