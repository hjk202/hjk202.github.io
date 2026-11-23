import type { Profile } from '../../src/modules/me/profile.ts';
export type { Profile } from '../../src/modules/me/profile.ts';
export interface ProfileRecord { profile: Profile | null; revision: string }
export interface ProfileWrite { revision: string; cleanupPending: boolean }
