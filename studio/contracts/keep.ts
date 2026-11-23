import type { Bookmark } from '../../src/modules/keep/bookmarks.ts';
export type { Bookmark } from '../../src/modules/keep/bookmarks.ts';
export interface KeepCollection { entries: Bookmark[]; revision: string }
export interface KeepRecord { bookmark: Bookmark; revision: string }
export interface KeepWrite { revision: string; cleanupPending: boolean }
