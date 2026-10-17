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
