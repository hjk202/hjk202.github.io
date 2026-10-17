import { STUDIO_TOKEN_HEADER, THINK_API } from '../contracts/http.ts';
import type { HttpResult } from '../contracts/http.ts';
import type { ThinkDocument, ThinkReadResult, ThinkSummary, ThinkWriteResult, ValidationIssue, ValidationReport } from '../contracts/think.ts';
import type { ThinkPreviewResult } from '../contracts/preview.ts';
import { PREVIEW_TIMEOUT_MS } from '../contracts/preview.ts';
import type { ThinkAiStatus, ThinkTextInput, ThinkTextSuggestion } from '../contracts/ai.ts';
import { AI_TIMEOUT_MS } from '../contracts/ai.ts';

export class ApiError extends Error {
  readonly code: string;
  readonly issues: ValidationIssue[];
  constructor(code: string, issues: ValidationIssue[] = []) { super(code); this.code = code; this.issues = issues; }
}

/** Same-origin transport only. Credentials remain in this closure, never in URLs or storage. */
export function createThinkApi(token: string) {
  async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal, timeout = 25_000): Promise<T> {
    let response: Response;
    try {
      response = await fetch(THINK_API + path, {
        method, cache: 'no-store', credentials: 'omit', redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout),
        headers: { [STUDIO_TOKEN_HEADER]: token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch { throw new ApiError('CONNECTION_LOST'); }
    let result: HttpResult<T>;
    try { result = await response.json() as HttpResult<T>; } catch { throw new ApiError('INVALID_RESPONSE'); }
    if (!result || typeof result.ok !== 'boolean') throw new ApiError('INVALID_RESPONSE');
    if (!result.ok) throw new ApiError(result.error.code, result.error.issues);
    if (!response.ok) throw new ApiError('INVALID_RESPONSE');
    return result.value;
  }
  return {
    list: (status: string) => request<ThinkSummary[]>('GET', '/documents?status=' + encodeURIComponent(status)),
    read: (key: string) => request<ThinkReadResult>('GET', '/documents/' + encodeURIComponent(key)),
    create: (document: ThinkDocument) => request<ThinkWriteResult>('POST', '/documents', { document }),
    save: (key: string, expectedRevision: string, document: ThinkDocument) => request<ThinkWriteResult>('PUT', '/documents/' + encodeURIComponent(key), { expectedRevision, document }),
    remove: (key: string, expectedRevision: string) => request<{ deleted: true }>('DELETE', '/documents/' + encodeURIComponent(key), { expectedRevision }),
    validate: (document: ThinkDocument, key?: string) => request<ValidationReport>('POST', '/validate', { document, ...(key ? { key } : {}) }),
    preview: (document: ThinkDocument, key: string | undefined, signal: AbortSignal) => request<ThinkPreviewResult>('POST', '/preview', { document, ...(key ? { key } : {}) }, signal, PREVIEW_TIMEOUT_MS + 15_000),
    aiStatus: () => request<ThinkAiStatus>('GET', '/suggest'),
    suggest: (input: ThinkTextInput, signal: AbortSignal) => request<ThinkTextSuggestion>('POST', '/suggest', input, signal, AI_TIMEOUT_MS + 10_000),
  };
}
