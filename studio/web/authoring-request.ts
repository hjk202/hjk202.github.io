import type { EditorResult } from '../contracts/result.ts';
import { ApiError } from './api.ts';

/** Shared same-origin transport only. Module contracts and state stay in their own editors. */
export function authoringRequest(token: string, module: 'keep' | 'me' | 'build') {
  return async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    let response: Response;
    try { response = await fetch(`/api/authoring/v1/${module}/${path}`, { method, headers: { 'X-Studio-Token': token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(path === 'preview' ? 150000 : 25000), ...(signal ? [signal] : [])]) }); }
    catch { throw new ApiError('CONNECTION_LOST'); }
    let result: EditorResult<T>;
    try { result = await response.json() as EditorResult<T>; } catch { throw new ApiError('INVALID_RESPONSE'); }
    if (!result || typeof result.ok !== 'boolean') throw new ApiError('INVALID_RESPONSE');
    if (!result.ok) throw new ApiError(result.error.code, result.error.issues);
    if (!response.ok) throw new ApiError('INVALID_RESPONSE');
    return result.value;
  };
}
