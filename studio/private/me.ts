import type { VaultPayload } from '../../src/core/vault/crypto.ts';
export interface PrivateProfile { paragraphs:string[]; links?:{label:string;url:string}[] }
export function privateProfile(payload:VaultPayload):PrivateProfile|undefined { return payload.modules.me as PrivateProfile|undefined; }
