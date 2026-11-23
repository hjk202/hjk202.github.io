import type { ThinkDocument } from './think.ts';

export interface ThinkPreviewInput { document: ThinkDocument; key?: string }
export interface ThinkPreviewResult {
  fingerprint: string;
  /** Self-contained, restricted Astro projection. Never insert into the editor DOM. */
  html: string;
  blockedResources: number;
  cleanupPending: boolean;
}
export const PREVIEW_TIMEOUT_MS = 90_000;
export const MAX_PREVIEW_BYTES = 8 * 1024 * 1024;
export const FAST_PREVIEW_MAX_BODY = 512 * 1024;
export interface FastThinkPreviewResult {
  html: string;
  blockedResources: number;
  restrictedHtml: boolean;
  literalMath: boolean;
}
