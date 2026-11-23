import type { CipherRecord, CipherWrite, DeliveryCandidate, DeliveryResult } from '../contracts/private.ts';
import type { Envelope } from '../../src/core/vault/crypto.ts';
import type { PublicBuildSnapshot } from '../private/payload.ts';
import { ApiError } from './api.ts';

/** Ciphertext transport only. No path, password, payload or private document operation. */
export function privateApi(token: string) {
  async function request<T>(path: string, body?: unknown,method=body===undefined?'GET':'PUT'): Promise<T> {
    let response: Response;
    try { response = await fetch('/api/studio-private/' + path, { method, cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(25000), headers: { 'X-Studio-Token': token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
    catch { throw new ApiError('CONNECTION_LOST'); }
    const result = await response.json() as { ok: boolean; value: T; error: { code: string } };
    if (!result || typeof result.ok !== 'boolean') throw new ApiError('INVALID_RESPONSE');
    if (!result.ok) throw new ApiError(result.error.code);
    if (!response.ok) throw new ApiError('INVALID_RESPONSE');
    return result.value;
  }
  return {
    snapshot: () => request<PublicBuildSnapshot>('public-build'),
    read: (handle: string) => request<CipherRecord>('files/' + handle),
    save: (handle: string, expectedRevision: string | null, envelope: Envelope, publicRevision: string) => request<CipherWrite>('files/' + handle, { expectedRevision, envelope, publicRevision }),
    deliveryStatus:()=>request<{targetRevision:string|null}>('delivery/status'),
    exportCandidate:(handle:string,masterHandle:string,masterRevision:string,envelope:Envelope,publicRevision:string)=>request<DeliveryCandidate>('delivery/export',{handle,masterHandle,masterRevision,envelope,publicRevision},'POST'),
    replaceBundle:(candidateId:string,expectedTargetRevision:string|null)=>request<DeliveryResult>('delivery/replace',{candidateId,expectedTargetRevision},'POST'),
  };
}
