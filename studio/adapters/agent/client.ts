import { MAX_REQUEST_BYTES, STUDIO_TOKEN_HEADER, THINK_API } from '../../contracts/http.ts';
import type { HttpResult } from '../../contracts/http.ts';
import type { ThinkDocument, ThinkReadResult } from '../../contracts/think.ts';

export type AgentErrorCode = 'INVALID_REQUEST' | 'AGENT_CONFIG_INVALID' | 'AGENT_CONNECTION_FAILED'
  | 'AGENT_INVALID_RESPONSE' | 'AGENT_TIMEOUT' | 'AGENT_WRITE_OUTCOME_UNKNOWN'
  | 'AGENT_WRITE_FORBIDDEN' | 'AGENT_PUBLICATION_FORBIDDEN' | 'AGENT_BUSY' | 'AGENT_CLOSED'
  | 'DUPLICATE_REQUEST' | 'SESSION_LIMIT' | 'PAYLOAD_TOO_LARGE';
export type AgentResult<T> = HttpResult<T> | {
  ok: false; error: { code: AgentErrorCode; message: string; issues: [] };
};
export type AgentReply = { id: string | null } & AgentResult<unknown>;
export interface ThinkAgent {
  execute(input: unknown): Promise<AgentReply>;
  close(): void;
}

export const MAX_AGENT_REQUESTS = 128;
export const agentFailure = (code: AgentErrorCode): AgentResult<never> => ({
  ok: false, error: { code, message: code === 'AGENT_WRITE_OUTCOME_UNKNOWN'
    ? '写入结果未知；先 list/read 核对源文件，不要自动重试。'
    : 'Agent 操作未完成；请根据错误码核对请求、权限或本机服务。', issues: [] },
});
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
  && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const fields = (value: unknown, allowed: string[]): value is Record<string, unknown> => object(value)
  && Reflect.ownKeys(value).every(key => typeof key === 'string' && allowed.includes(key));
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const document = (value: unknown): value is ThinkDocument => object(value) && object(value.metadata);

class TransportError extends Error {
  code: AgentErrorCode;
  constructor(code: AgentErrorCode) { super(code); this.code = code; }
}
function json(text: string): unknown {
  try { return JSON.parse(text); }
  catch { throw new TransportError('AGENT_INVALID_RESPONSE'); }
}
async function responseText(response: Response, limit: number): Promise<string> {
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  if (!response.body) throw new TransportError('AGENT_INVALID_RESPONSE');
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > limit) throw new TransportError('AGENT_INVALID_RESPONSE');
    chunks.push(chunk);
  }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); }
  catch { throw new TransportError('AGENT_INVALID_RESPONSE'); }
}

/** Trusted bootstrap options only. The Agent request can never supply an origin or capability. */
export async function connectThinkAgent(options: { origin: string; allowWrite?: boolean; timeoutMs?: number }): Promise<AgentResult<ThinkAgent>> {
  const port = /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})$/.exec(options.origin)?.[1];
  const timeoutMs = options.timeoutMs ?? 20_000;
  if (!port || Number(port) > 65535 || typeof options.allowWrite !== 'undefined' && typeof options.allowWrite !== 'boolean'
    || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20_000) return agentFailure('AGENT_CONFIG_INVALID');
  let token = '';
  let controller: AbortController | undefined;
  let closed = false;
  let busy = false;
  const seen = new Set<string>();
  const transport = async (path: string, method: string, body?: unknown, writing = false): Promise<unknown> => {
    const serialized = body === undefined ? undefined : JSON.stringify(body);
    if (serialized !== undefined && Buffer.byteLength(serialized) > MAX_REQUEST_BYTES) throw new TransportError('PAYLOAD_TOO_LARGE');
    controller = new AbortController();
    const active = controller;
    const timer = setTimeout(() => active.abort(), timeoutMs);
    try {
      const response = await fetch(options.origin + path, {
        method, redirect: 'error', credentials: 'omit', cache: 'no-store', signal: active.signal,
        headers: { ...(token ? { [STUDIO_TOKEN_HEADER]: token } : {}), ...(serialized === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(serialized === undefined ? {} : { body: serialized }),
      });
      const text = await responseText(response, path === '/' ? 64 * 1024 : MAX_REQUEST_BYTES);
      if (path === '/') {
        if (response.status !== 200 || !response.headers.get('content-type')?.startsWith('text/html')) throw new TransportError('AGENT_INVALID_RESPONSE');
        const matches = [...text.matchAll(/<script id="studio-session" type="application\/json">([^<]*)<\/script>/g)];
        if (matches.length !== 1) throw new TransportError('AGENT_INVALID_RESPONSE');
        return json(matches[0]![1]!);
      }
      if (!response.headers.get('content-type')?.startsWith('application/json')) throw new TransportError('AGENT_INVALID_RESPONSE');
      const result = json(text);
      if (!object(result) || typeof result.ok !== 'boolean'
        || (result.ok ? response.status < 200 || response.status >= 300 || !Object.hasOwn(result, 'value')
          : !object(result.error) || typeof result.error.code !== 'string' || typeof result.error.message !== 'string' || !Array.isArray(result.error.issues))) {
        throw new TransportError('AGENT_INVALID_RESPONSE');
      }
      return result;
    } catch (error) {
      // Once a mutation was dispatched, even a lost/invalid response may follow a committed write.
      if (writing) throw new TransportError('AGENT_WRITE_OUTCOME_UNKNOWN');
      if (error instanceof TransportError) throw error;
      throw new TransportError(active.signal.aborted ? 'AGENT_TIMEOUT' : 'AGENT_CONNECTION_FAILED');
    } finally { clearTimeout(timer); if (controller === active) controller = undefined; }
  };
  const call = async <T>(path: string, method: string, body?: unknown, writing = false): Promise<AgentResult<T>> =>
    await transport(THINK_API + path, method, body, writing) as AgentResult<T>;
  try {
    const session = await transport('/', 'GET');
    if (!fields(session, ['origin', 'token']) || session.origin !== options.origin || !identifier(session.token)) return agentFailure('AGENT_INVALID_RESPONSE');
    token = session.token;
  } catch (error) { return agentFailure(error instanceof TransportError ? error.code : 'AGENT_CONNECTION_FAILED'); }

  return { ok: true, value: {
    close() { closed = true; token = ''; controller?.abort(); },
    async execute(input) {
      const id = object(input) && typeof input.id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(input.id) ? input.id : null;
      const reply = (result: AgentResult<unknown>): AgentReply => ({ id, ...result });
      if (closed) return reply(agentFailure('AGENT_CLOSED'));
      if (busy) return reply(agentFailure('AGENT_BUSY'));
      if (!id || !fields(input, ['id', 'operation', 'params']) || typeof input.operation !== 'string' || !object(input.params)) return reply(agentFailure('INVALID_REQUEST'));
      if (seen.has(id)) return reply(agentFailure('DUPLICATE_REQUEST'));
      if (seen.size >= MAX_AGENT_REQUESTS) return reply(agentFailure('SESSION_LIMIT'));
      seen.add(id);
      const { operation, params } = input;
      busy = true;
      try {
        if (operation === 'listThink' && fields(params, ['status'])
          && (params.status === undefined || ['all', 'draft', 'published'].includes(params.status as string))) {
          return reply(await call('/documents' + (params.status === undefined ? '' : '?status=' + params.status), 'GET'));
        }
        if (operation === 'readThink' && fields(params, ['key']) && identifier(params.key)) return reply(await call('/documents/' + params.key, 'GET'));
        if (operation === 'validateThink' && fields(params, ['document', 'key']) && Object.hasOwn(params, 'document')
          && (params.key === undefined || identifier(params.key))) return reply(await call('/validate', 'POST', params));
        if (operation === 'createDraft' && fields(params, ['document']) && document(params.document)) {
          if (!options.allowWrite) return reply(agentFailure('AGENT_WRITE_FORBIDDEN'));
          if (params.document.metadata.published === true) return reply(agentFailure('AGENT_PUBLICATION_FORBIDDEN'));
          return reply(await call('/documents', 'POST', params, true));
        }
        if (operation === 'saveThink' && fields(params, ['key', 'expectedRevision', 'document'])
          && identifier(params.key) && identifier(params.expectedRevision) && document(params.document)) {
          if (!options.allowWrite) return reply(agentFailure('AGENT_WRITE_FORBIDDEN'));
          const source = await call<ThinkReadResult>('/documents/' + params.key, 'GET');
          if (!source.ok) return reply(source);
          if (!object(source.value) || !identifier(source.value.revision) || !document(source.value.document)) return reply(agentFailure('AGENT_INVALID_RESPONSE'));
          if (source.value.revision !== params.expectedRevision) return reply({ ok: false, error: { code: 'REVISION_CONFLICT', message: '源已变化；重新读取并核对，不能自动覆盖。', issues: [] } });
          const original = source.value.document.metadata;
          const candidate = params.document.metadata;
          if (Object.hasOwn(original, 'published') !== Object.hasOwn(candidate, 'published') || original.published !== candidate.published) return reply(agentFailure('AGENT_PUBLICATION_FORBIDDEN'));
          // The backend rechecks expectedRevision and every content rule at the actual commit boundary.
          return reply(await call('/documents/' + params.key, 'PUT', { expectedRevision: params.expectedRevision, document: params.document }, true));
        }
        return reply(agentFailure('INVALID_REQUEST'));
      } catch (error) { return reply(agentFailure(error instanceof TransportError ? error.code : 'INVALID_REQUEST')); }
      finally { busy = false; }
    },
  } };
}
