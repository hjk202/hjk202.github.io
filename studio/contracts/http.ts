import type { EditorResult } from './think.ts';

export type HttpErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_REQUEST' | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED' | 'PAYLOAD_TOO_LARGE' | 'REQUEST_TIMEOUT' | 'UNSUPPORTED_MEDIA_TYPE'
  | 'AUTHORING_BUSY' | 'INTERNAL_ERROR';
export type HttpResult<T> = EditorResult<T> | {
  ok: false;
  error: { code: HttpErrorCode; message: string; issues: [] };
};

export const THINK_API = '/api/authoring/v1/think';
export const STUDIO_TOKEN_HEADER = 'X-Studio-Token';
/** Transport limit, including JSON escaping; independent of the 16 MiB source limit. */
export const MAX_REQUEST_BYTES = 24 * 1024 * 1024;
export const BODY_TIMEOUT_MS = 15_000;
