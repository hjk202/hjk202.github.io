import { validatePayload } from '../../src/core/vault/crypto.ts';
import type { VaultPayload } from '../../src/core/vault/crypto.ts';
import { validateThink } from '../../src/modules/think/vault.schema.ts';
import { validateKeep } from '../../src/modules/keep/vault.schema.ts';
import { validateMe } from '../../src/modules/me/vault.schema.ts';
import { validateBuild } from '../../src/modules/build/vault.schema.ts';
import { PrivateError } from './error.ts';
export { PrivateError } from './error.ts';

export interface PublicBuildSnapshot { revision: string; slugs: string[] }
/** Verify the entire package. Never replace untouched data with schemas' normalized output. */
export function validatePrivatePayload(value: unknown, snapshot: PublicBuildSnapshot): VaultPayload {
  try {
    if (!snapshot || !/^[a-f0-9]{64}$/.test(snapshot.revision) || !Array.isArray(snapshot.slugs)
      || snapshot.slugs.some(slug => typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) throw new Error();
    const payload = validatePayload(value);
    for (const [module, data] of Object.entries(payload.modules)) {
      if (module === 'think') validateThink(data);
      else if (module === 'keep') validateKeep(data);
      else if (module === 'me') validateMe(data);
      else if (module === 'build') {
        const build = validateBuild(data);
        if (build.supplements.some(entry => !snapshot.slugs.includes(entry.publicSlug))) throw new PrivateError('PRIVATE_PUBLIC_REFERENCE');
      } else throw new PrivateError('PRIVATE_UNSUPPORTED_MODULE');
    }
    for (const [, id] of JSON.stringify(payload.modules).matchAll(/asset:([a-f0-9]{32})/g)) if (!Object.hasOwn(payload.assets, id)) throw new PrivateError('PRIVATE_ASSET_MISSING');
    return structuredClone(payload);
  } catch (error) { throw error instanceof PrivateError ? error : new PrivateError('PRIVATE_VALIDATION_FAILED'); }
}
