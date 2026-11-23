import type { VaultPayload } from '../../src/core/vault/crypto.ts';
import type { validateThink } from '../../src/modules/think/vault.schema.ts';
export type PrivateThinkPost = ReturnType<typeof validateThink>['posts'][number];
export function thinkPosts(payload: VaultPayload): PrivateThinkPost[] {
  return (payload.modules.think as { posts: PrivateThinkPost[] } | undefined)?.posts ?? [];
}
export function newPrivateThink(date: string): PrivateThinkPost {
  return { id: crypto.randomUUID().replaceAll('-', ''), title: '', summary: '', date, kind: 'article', body: '' };
}
