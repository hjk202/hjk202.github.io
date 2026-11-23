import type { EditorResult } from '../contracts/result.ts';
import { ApiError } from './api.ts';

export function writingRequest(token: string) {
  return async function request<T>(method: string, route: string, body?: unknown, signal?: AbortSignal, timeout = 25_000, keepalive = false): Promise<T> {
    let response: Response;
    try {
      response = await fetch('/api/authoring/v1/' + route, {
        method, cache: 'no-store', credentials: 'omit', redirect: 'error', keepalive,
        headers: { 'X-Studio-Token': token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.any([AbortSignal.timeout(timeout), ...(signal ? [signal] : [])]),
      });
    } catch { throw new ApiError('CONNECTION_LOST'); }
    const result = await response.json().catch(() => undefined) as EditorResult<T> | undefined;
    if (!result || typeof result.ok !== 'boolean') throw new ApiError('INVALID_RESPONSE');
    if (!result.ok) throw new ApiError(result.error.code, result.error.issues);
    if (!response.ok) throw new ApiError('INVALID_RESPONSE');
    return result.value;
  };
}
