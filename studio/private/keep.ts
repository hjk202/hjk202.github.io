import type { VaultPayload } from '../../src/core/vault/crypto.ts';
import type { validateKeep } from '../../src/modules/keep/vault.schema.ts';
export type PrivateBookmark = ReturnType<typeof validateKeep>['bookmarks'][number];
export function privateBookmarks(payload: VaultPayload): PrivateBookmark[] { return (payload.modules.keep as { bookmarks:PrivateBookmark[] } | undefined)?.bookmarks ?? []; }
export function newPrivateBookmark(): PrivateBookmark { return {id:crypto.randomUUID().replaceAll('-',''),title:'',description:'',sourceUrl:'',note:['']}; }
