import { decryptVault, encryptVault, validatePayload, MAX_PLAIN } from '../../src/core/vault/crypto.ts';
import type { Envelope, VaultPayload } from '../../src/core/vault/crypto.ts';
import { PrivateError, validatePrivatePayload } from './payload.ts';
import type { PublicBuildSnapshot } from './payload.ts';

/** Browser-only, volatile package state. No network, filesystem, logging or password storage. */
export class PrivateSession {
  #payload: VaultPayload | undefined;
  #baseline = '';
  #epoch = 0;
  #version = 0;
  get unlocked() { return this.#payload !== undefined; }
  get version() { return this.#version; }
  get dirty() { return !!this.#payload && JSON.stringify(this.#payload) !== this.#baseline; }
  snapshot(): VaultPayload {
    if (!this.#payload) throw new PrivateError('PRIVATE_LOCKED');
    return structuredClone(this.#payload);
  }
  create(snapshot: PublicBuildSnapshot) {
    this.lock(); this.#payload = validatePrivatePayload({ version: 1, modules: {}, assets: {} }, snapshot);
    this.#baseline = ''; this.#version++;
  }
  async unlock(envelope: unknown, password: string, snapshot: PublicBuildSnapshot) {
    this.lock(); const epoch = this.#epoch;
    let payload: VaultPayload;
    try { payload = validatePrivatePayload(await decryptVault(envelope, password), snapshot); }
    catch (error) { throw error instanceof PrivateError ? error : new PrivateError('PRIVATE_UNLOCK_FAILED'); }
    if (epoch !== this.#epoch) throw new PrivateError('PRIVATE_STALE');
    this.#payload = payload; this.#baseline = JSON.stringify(payload); this.#version++;
  }
  /** Partial form candidates remain volatile; full business validation precedes preview/encryption. */
  replaceCandidate(value: unknown) {
    if (!this.#payload) throw new PrivateError('PRIVATE_LOCKED');
    try {
      const candidate = validatePayload(value);
      if (Object.keys(candidate.modules).some(module => !['think', 'keep', 'me', 'build'].includes(module))) throw new Error();
      if (new TextEncoder().encode(JSON.stringify(candidate)).length > MAX_PLAIN) throw new Error();
      this.#payload = structuredClone(candidate); this.#version++;
    } catch { throw new PrivateError('PRIVATE_VALIDATION_FAILED'); }
  }
  validate(snapshot: PublicBuildSnapshot) { return validatePrivatePayload(this.snapshot(), snapshot); }
  async seal(password: string, snapshot: PublicBuildSnapshot): Promise<{ envelope: Envelope; version: number; publicRevision: string }> {
    const payload = this.validate(snapshot), epoch = this.#epoch, version = this.#version;
    let envelope: Envelope;
    try { envelope = await encryptVault(payload, password); }
    catch { throw new PrivateError('PRIVATE_ENCRYPT_FAILED'); }
    if (epoch !== this.#epoch || version !== this.#version) throw new PrivateError('PRIVATE_STALE');
    return { envelope, version, publicRevision: snapshot.revision };
  }
  markSaved(version: number) {
    if (!this.#payload || version !== this.#version) throw new PrivateError('PRIVATE_STALE');
    this.#baseline = JSON.stringify(this.#payload);
  }
  lock() { this.#epoch++; this.#version++; this.#payload = undefined; this.#baseline = ''; }
}
