import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { TextDecoder } from 'node:util';
import { BODY_TIMEOUT_MS, MAX_REQUEST_BYTES, THINK_API } from '../contracts/http.ts';
import type { HttpErrorCode, HttpResult } from '../contracts/http.ts';
import type { EditorErrorCode, EditorResult } from '../contracts/think.ts';
import { allowedPairing, allowedSource, authenticated, newSessionToken, singleHeader } from './security.ts';
import { openThinkAuthoring } from './think/service.ts';
import { loadStudioWeb } from './web.ts';
import type { StudioWeb } from './web.ts';
import { createThinkPreview } from './think/preview.ts';
import { PREVIEW_TIMEOUT_MS } from '../contracts/preview.ts';
import { AI_TIMEOUT_MS, AI_MAX_REQUEST_BYTES } from '../contracts/ai.ts';
import { createThinkTextSuggestions } from './ai/suggest.ts';
import type { ThinkAiOptions } from './ai/suggest.ts';

const errorStatuses: Record<EditorErrorCode, number> = {
  INVALID_REQUEST: 400, NOT_FOUND: 404, REVISION_CONFLICT: 409, DUPLICATE_SLUG: 409, FILE_EXISTS: 409,
  VALIDATION_FAILED: 422, UNSUPPORTED_FORMAT: 422, PROTECTED_PATH: 403, DIRECTORY_INVALID: 422,
  AUTHORING_BUSY: 503, SERVICE_CLOSED: 503, FILE_OPERATION_FAILED: 500,
  PREVIEW_NOT_READY: 422, PREVIEW_FAILED: 500, PREVIEW_TIMEOUT: 504, PREVIEW_CANCELLED: 409,
  PREVIEW_RESOURCE_BLOCKED: 422, PREVIEW_TOO_LARGE: 413,
  AI_NOT_CONFIGURED: 503, AI_CONFIG_INVALID: 503, AI_INPUT_TOO_LARGE: 413, AI_AUTH_FAILED: 502,
  AI_RATE_LIMITED: 429, AI_FAILED: 502, AI_TIMEOUT: 504, AI_CANCELLED: 409, AI_INVALID_RESPONSE: 502, AI_TOO_LARGE: 413,
};
class RequestError extends Error {
  readonly code: HttpErrorCode;
  readonly status: number;
  constructor(code: HttpErrorCode, status: number) { super(code); this.code = code; this.status = status; }
}
export class StudioStartError extends Error {
  readonly code: EditorErrorCode | 'PORT_UNAVAILABLE' | 'INVALID_PORT' | 'WEB_BUILD_UNAVAILABLE';
  constructor(code: StudioStartError['code']) { super(`Studio 启动失败：${code}`); this.code = code; }
}
export interface StudioHttpSession {
  origin: string;
  /** Trusted local launcher only. Never print, persist or place in a URL. */
  token: string;
  close(): Promise<EditorResult<{ closed: true }>>;
}

function headers(response: ServerResponse): void {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Content-Security-Policy', "default-src 'none'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
}
function send(response: ServerResponse, status: number, result: HttpResult<unknown>): void {
  if (response.destroyed || response.writableEnded) return;
  headers(response);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', Connection: 'close' });
  response.end(JSON.stringify(result));
}
function reject(response: ServerResponse, code: HttpErrorCode, status: number): void {
  send(response, status, { ok: false, error: { code, message: 'Studio HTTP 请求未完成，请检查错误码及请求。', issues: [] } });
}
function result(response: ServerResponse, value: EditorResult<unknown>, success = 200): void {
  const tooLarge = !value.ok && value.error.issues.some(issue => issue.code === 'SOURCE_TOO_LARGE');
  send(response, value.ok ? success : tooLarge ? 413 : errorStatuses[value.error.code], value);
}
function object(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !fields.includes(key))) throw new RequestError('INVALID_REQUEST', 400);
  return value as Record<string, unknown>;
}
function jsonBody(request: IncomingMessage, limit = MAX_REQUEST_BYTES): Promise<unknown> {
  const contentType = singleHeader(request, 'content-type');
  if (!contentType || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) throw new RequestError('UNSUPPORTED_MEDIA_TYPE', 415);
  if (request.headers['content-encoding'] !== undefined) throw new RequestError('UNSUPPORTED_MEDIA_TYPE', 415);
  const length = request.headers['content-length'];
  if (length !== undefined && Number(length) > limit) throw new RequestError('PAYLOAD_TOO_LARGE', 413);
  return new Promise((resolve, reject) => {
    let size = 0, finished = false;
    const chunks: Buffer[] = [];
    const finish = (error?: RequestError) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      request.off('data', data);
      request.off('end', end);
      request.off('aborted', aborted);
      // Retain an error listener through connection close; a disconnected request is never dispatched.
      if (error) { chunks.length = 0; request.pause(); reject(error); }
      else {
        try { resolve(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))); }
        catch { reject(new RequestError('INVALID_REQUEST', 400)); }
      }
    };
    const data = (chunk: Buffer) => { size += chunk.length; if (size > limit) finish(new RequestError('PAYLOAD_TOO_LARGE', 413)); else chunks.push(chunk); };
    const end = () => finish();
    const aborted = () => finish(new RequestError('INVALID_REQUEST', 400));
    const timer = setTimeout(() => finish(new RequestError('REQUEST_TIMEOUT', 408)), BODY_TIMEOUT_MS);
    request.on('data', data);
    request.once('end', end);
    request.once('aborted', aborted);
    request.on('error', aborted);
  });
}

/** Trusted startup options only. Neither repositoryRoot nor port is accepted from HTTP clients. */
export async function startStudioHttp(options: { repositoryRoot?: string; port?: number; webDirectory?: string; previewBase?: string; previewTimeoutMs?: number; ai?: ThinkAiOptions } = {}): Promise<StudioHttpSession> {
  const port = options.port ?? 4322;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new StudioStartError('INVALID_PORT');
  let web: StudioWeb | undefined;
  try { web = options.webDirectory === undefined ? undefined : loadStudioWeb(options.webDirectory); }
  catch { throw new StudioStartError('WEB_BUILD_UNAVAILABLE'); }
  const opened = openThinkAuthoring(options.repositoryRoot);
  if (!opened.ok) throw new StudioStartError(opened.error.code);
  const service = opened.value;
  let ai: ReturnType<typeof createThinkTextSuggestions>;
  try { ai = createThinkTextSuggestions(options.ai); }
  catch { service.close(); throw new StudioStartError('INVALID_REQUEST'); }
  let preview: ReturnType<typeof createThinkPreview>;
  try { preview = createThinkPreview(service, { ...(options.repositoryRoot ? { repositoryRoot: options.repositoryRoot } : {}), ...(options.previewBase ? { base: options.previewBase } : {}), ...(options.previewTimeoutMs ? { timeoutMs: options.previewTimeoutMs } : {}) }); }
  catch { service.close(); throw new StudioStartError('INVALID_REQUEST'); }
  const token = newSessionToken();
  let origin = '', active = 0, closing = false;
  const handledSockets = new WeakSet();
  const server = createServer({ maxHeaderSize: 8 * 1024, headersTimeout: 5_000, requestTimeout: 20_000, connectionsCheckingInterval: 1_000, keepAliveTimeout: 2_000 }, (request, response) => {
    handledSockets.add(request.socket);
    void route(request, response).catch(() => reject(response, 'INTERNAL_ERROR', 500));
  });
  server.maxConnections = 16;
  server.maxRequestsPerSocket = 32;
  server.setTimeout(20_000, socket => socket.destroy());
  server.on('clientError', (_error, socket) => {
    // Never reflect parser exceptions: they can include raw request/token bytes.
    if (handledSockets.has(socket) || socket.destroyed || socket.writableEnded) { socket.destroy(); return; }
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n', () => socket.destroy());
  });
  server.on('checkContinue', (_request, response) => reject(response, 'INVALID_REQUEST', 400));
  server.on('checkExpectation', (_request, response) => reject(response, 'INVALID_REQUEST', 400));
  server.on('upgrade', (_request, socket) => socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n', () => socket.destroy()));

  async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (closing) return reject(response, 'AUTHORING_BUSY', 503);
    if (!allowedSource(request, origin)) return reject(response, 'FORBIDDEN', 403);
    const target = request.url ?? '';
    // Never normalize dot segments, decode path separators or accept absolute-form/proxy URLs.
    const match = /^(\/api\/authoring\/v1\/think\/(?:documents(?:\/[^/?]+)?|validate|preview|suggest))(?:\?(.*))?$/.exec(target);
    if (target === '/' && request.method === 'GET') {
      if (!allowedPairing(request)) return reject(response, 'FORBIDDEN', 403);
      headers(response);
      if (web) response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src data:; frame-src 'self' about:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' });
      const pairing = `<script id="studio-session" type="application/json">${JSON.stringify({ origin, token })}</script>`;
      response.end(web ? web.template.replace('<!--studio-session-->', pairing) : '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Personal Space Studio API</title>'
        + '<h1>Personal Space Studio API</h1><p>本机 API 配对入口。完整编辑器请用 npm run studio 启动。</p>'
        + pairing + '</html>');
      return;
    }
    const asset = web?.assets.get(target);
    if (asset && request.method === 'GET') {
      headers(response);
      response.writeHead(200, { 'Content-Type': asset.contentType, Connection: 'close' });
      response.end(asset.bytes);
      return;
    }
    if (!authenticated(request, token)) return reject(response, 'UNAUTHORIZED', 401);
    if (!match) return reject(response, 'NOT_FOUND', 404);
    const path = match[1]!;
    const query = match[2];
    if (query !== undefined && !/^status=(all|draft|published)$/.test(query)) return reject(response, 'INVALID_REQUEST', 400);
    const status = query?.slice('status='.length);
    const collection = path === THINK_API + '/documents';
    const validate = path === THINK_API + '/validate';
    const isPreview = path === THINK_API + '/preview';
    const isSuggest = path === THINK_API + '/suggest';
    const key = collection || validate || isPreview || isSuggest ? undefined : path.slice((THINK_API + '/documents/').length);
    const allowed = validate || isPreview ? ['POST'] : collection || isSuggest ? ['GET', 'POST'] : ['GET', 'PUT', 'DELETE'];
    if (status !== undefined && (!collection || request.method !== 'GET')) return reject(response, 'INVALID_REQUEST', 400);
    if (!allowed.includes(request.method ?? '')) { response.setHeader('Allow', allowed.join(', ')); return reject(response, 'METHOD_NOT_ALLOWED', 405); }
    if (active >= 2) return reject(response, 'AUTHORING_BUSY', 503);
    active++;
    try {
      if (request.method === 'GET') {
        if (request.headers['transfer-encoding'] !== undefined || (request.headers['content-length'] !== undefined && request.headers['content-length'] !== '0')) throw new RequestError('INVALID_REQUEST', 400);
        result(response, isSuggest ? { ok: true, value: ai.status() } : collection ? service.listThink(status ? { status } : {}) : service.readThink({ key }));
        return;
      }
      const body = await jsonBody(request, isSuggest ? AI_MAX_REQUEST_BYTES : MAX_REQUEST_BYTES);
      if (closing || !request.complete || response.destroyed) return;
      if (isSuggest) {
        request.socket.setTimeout(AI_TIMEOUT_MS + 10_000);
        const controller = new AbortController();
        const cancel = () => { if (!response.writableEnded) controller.abort(); };
        response.once('close', cancel);
        try { result(response, await ai.suggestThinkText(object(body, ['operation', 'input']), controller.signal)); }
        finally { response.off('close', cancel); }
      }
      else if (isPreview) {
        request.socket.setTimeout(PREVIEW_TIMEOUT_MS + 10_000);
        const controller = new AbortController();
        const cancel = () => { if (!response.writableEnded) controller.abort(); };
        response.once('close', cancel);
        try { result(response, await preview.previewThink(object(body, ['document', 'key']), controller.signal)); }
        finally { response.off('close', cancel); }
      }
      else if (validate) result(response, service.validateThink(object(body, ['document', 'key'])));
      else if (collection) result(response, service.createThink(object(body, ['document'])), 201);
      else if (request.method === 'PUT') result(response, service.saveThink({ ...object(body, ['document', 'expectedRevision']), key }));
      else result(response, service.deleteThink({ ...object(body, ['expectedRevision']), key }));
    } catch (error) {
      if (error instanceof RequestError) reject(response, error.code, error.status);
      else reject(response, 'INTERNAL_ERROR', 500);
    } finally { active--; }
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const error = () => reject(new StudioStartError('PORT_UNAVAILABLE'));
      server.once('error', error);
      server.listen(port, '127.0.0.1', () => { server.off('error', error); resolve(); });
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new StudioStartError('PORT_UNAVAILABLE');
    origin = new URL(`http://127.0.0.1:${address.port}`).origin;
  } catch (error) {
    server.close();
    service.close();
    throw error;
  }
  let shutdown: Promise<EditorResult<{ closed: true }>> | undefined;
  return {
    origin, token,
    close: () => shutdown ??= new Promise(resolve => {
      closing = true;
      server.close(() => { void Promise.all([preview.close(), ai.close()]).then(() => resolve(service.close())); });
      server.closeAllConnections();
    }),
  };
}
