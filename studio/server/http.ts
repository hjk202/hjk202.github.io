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
import { FAST_PREVIEW_MAX_BODY, PREVIEW_TIMEOUT_MS } from '../contracts/preview.ts';
import { createFastThinkPreview } from './think/fast-preview.ts';
import { createWritingTime } from './think/writing-time.ts';
import { IMAGE_REQUEST_LIMIT, saveThinkImage } from './think/image.ts';
import { AI_TIMEOUT_MS, AI_MAX_REQUEST_BYTES } from '../contracts/ai.ts';
import { createThinkTextSuggestions } from './ai/suggest.ts';
import type { ThinkAiOptions } from './ai/suggest.ts';
import { createKeepAuthoring } from './keep/service.ts';
import { createSourcePreview } from './source-preview.ts';
import { createMeAuthoring } from './me/service.ts';
import { createBuildAuthoring } from './build/service.ts';
import type { CipherFiles } from './private/files.ts';
import { MAX_ENVELOPE } from '../../src/core/vault/crypto.ts';
import { PrivateError } from '../private/error.ts';
import type { PrivateDelivery } from './private/delivery.ts';
import {createIntake} from './intake/service.ts';
import {PROPOSAL_MAX_RECORD} from '../contracts/proposal.ts';
import{createPublisher}from'./publish/service.ts';
import type{PublicationOptions}from'./publish/service.ts';

const errorStatuses: Record<EditorErrorCode, number> = {
  INVALID_REQUEST: 400, NOT_FOUND: 404, REVISION_CONFLICT: 409, DUPLICATE_SLUG: 409, FILE_EXISTS: 409,
  VALIDATION_FAILED: 422, UNSUPPORTED_FORMAT: 422, PROTECTED_PATH: 403, DIRECTORY_INVALID: 422,
  AUTHORING_BUSY: 503, SERVICE_CLOSED: 503, FILE_OPERATION_FAILED: 500, PRIVATE_REFERENCES_UNKNOWN: 409,
  PRIVATE_UNAVAILABLE: 503, PRIVATE_HANDLE_INVALID: 403, PRIVATE_CONFLICT: 409, PRIVATE_ENVELOPE_INVALID: 422,
  PRIVATE_FILE_UNSAFE: 403, PRIVATE_BACKUP_INVALID: 409, PRIVATE_WRITE_FAILED: 500, PRIVATE_PUBLIC_CHANGED: 409, PRIVATE_FAILED: 500,
  DELIVERY_NOT_READY:409, DELIVERY_STALE:409, DELIVERY_FAILED:500,
  PUBLISH_NOT_READY:503,PUBLISH_STALE:409,PUBLISH_FAILED:500,PUBLISH_UNKNOWN:409,PUBLISH_BUSY:409,PUBLISH_TOO_LARGE:413,
  PREVIEW_NOT_READY: 422, PREVIEW_FAILED: 500, PREVIEW_TIMEOUT: 504, PREVIEW_CANCELLED: 409,
  PREVIEW_RESOURCE_BLOCKED: 422, PREVIEW_TOO_LARGE: 413,
  AI_INITIALIZING:503,AI_CONFIG_UNAVAILABLE:503,AI_NOT_CONFIGURED: 503, AI_CONFIG_INVALID: 503, AI_INPUT_TOO_LARGE: 413, AI_AUTH_FAILED: 502,
  AI_RATE_LIMITED: 429, AI_MODEL_UNAVAILABLE: 502, AI_UPSTREAM_UNAVAILABLE: 503, AI_FAILED: 502, AI_TIMEOUT: 504, AI_CANCELLED: 409, AI_INVALID_RESPONSE: 502, AI_TOO_LARGE: 413,
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
  /** Trusted process-owner loss only. No HTTP endpoint; waits the current bounded operation. */
  abandon():Promise<EditorResult<{closed:true}>>;
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
export async function startStudioHttp(options: { repositoryRoot?: string; port?: number; webDirectory?: string; previewBase?: string; previewTimeoutMs?: number; ai?: ThinkAiOptions; privateFiles?: CipherFiles; createPrivateDelivery?:(publicRevision:()=>string)=>PrivateDelivery; intakeDirectory?:string; publication?:PublicationOptions } = {}): Promise<StudioHttpSession> {
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
  const fastPreview = createFastThinkPreview(options.repositoryRoot, options.previewBase);
  const writingTime = createWritingTime(options.repositoryRoot ?? process.cwd(), service, options.intakeDirectory && options.intakeDirectory + '-writing-time');
  try { preview = createThinkPreview(service, { ...(options.repositoryRoot ? { repositoryRoot: options.repositoryRoot } : {}), ...(options.previewBase ? { base: options.previewBase } : {}), ...(options.previewTimeoutMs ? { timeoutMs: options.previewTimeoutMs } : {}) }); }
  catch { service.close(); throw new StudioStartError('INVALID_REQUEST'); }
  const token = newSessionToken();
  const keep = createKeepAuthoring(options.repositoryRoot);
  const keepPreview = createSourcePreview(keep.preparePreview, { ...(options.repositoryRoot ? { repositoryRoot: options.repositoryRoot } : {}), ...(options.previewBase ? { base: options.previewBase } : {}), ...(options.previewTimeoutMs ? { timeoutMs: options.previewTimeoutMs } : {}) });
  const me = createMeAuthoring(options.repositoryRoot);
  const mePreview = createSourcePreview(me.preparePreview, { ...(options.repositoryRoot ? { repositoryRoot: options.repositoryRoot } : {}), ...(options.previewBase ? { base: options.previewBase } : {}), ...(options.previewTimeoutMs ? { timeoutMs: options.previewTimeoutMs } : {}) });
  const build = createBuildAuthoring(options.repositoryRoot);
  const intake=createIntake({repositoryRoot:options.repositoryRoot??process.cwd(),think:service,build,ai,...(options.intakeDirectory?{directory:options.intakeDirectory}:{})});
  const publication=createPublisher({repositoryRoot:options.repositoryRoot??process.cwd(),think:service,build,intake,...options.publication});
  const publicSnapshot = () => {
    const current=build.listBuild();if(!current.ok)throw new PrivateError('PRIVATE_PUBLIC_CHANGED');
    return {revision:current.value.revision,slugs:current.value.entries.filter(entry=>entry.published===true).map(entry=>entry.slug)};
  };
  let delivery:PrivateDelivery|undefined;
  try{delivery=options.createPrivateDelivery?.(()=>publicSnapshot().revision);}
  catch{await Promise.all([preview.close(),keepPreview.close(),mePreview.close(),ai.close()]);keep.close();me.close();build.close();service.close();throw new StudioStartError('INVALID_REQUEST');}
  const buildPreview = createSourcePreview(build.preparePreview, { ...(options.repositoryRoot ? { repositoryRoot: options.repositoryRoot } : {}), ...(options.previewBase ? { base: options.previewBase } : {}), ...(options.previewTimeoutMs ? { timeoutMs: options.previewTimeoutMs } : {}) });
  let origin = '', active = 0, closing = false, previewWarmScheduled = false;
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
    const match = /^(\/api\/authoring\/v1\/think\/(?:documents(?:\/[^/?]+)?|validate|preview(?:-fast)?|suggest|writing-time))(?:\?(.*))?$/.exec(target);
    if (target === '/' && request.method === 'GET') {
      if (!allowedPairing(request)) return reject(response, 'FORBIDDEN', 403);
      headers(response);
      if (web) response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src data: blob:; frame-src 'self' about:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' });
      const pairing = `<script id="studio-session" type="application/json">${JSON.stringify({ origin, token })}</script>`;
      response.end(web ? web.template.replace('<!--studio-session-->', pairing) : '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Personal Space Studio API</title>'
        + '<h1>Personal Space Studio API</h1><p>本机 API 配对入口。完整编辑器请用 npm run studio 启动。</p>'
        + pairing + '</html>');
      if (web && !previewWarmScheduled) {
        previewWarmScheduled = true;
        // Initialize the shared Markdown processor while the paired editor is loading; do not render author text.
        setImmediate(() => { if (!closing) fastPreview.warm(); }).unref();
      }
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
    if(target===THINK_API+'/images'){
      if(request.method!=='POST')return reject(response,'METHOD_NOT_ALLOWED',405);
      if(active>=2)return reject(response,'AUTHORING_BUSY',503);
      active++;
      try {
        const image=object(await jsonBody(request,IMAGE_REQUEST_LIMIT),['mime','data']);
        if(closing||!request.complete||response.destroyed)return;
        result(response,saveThinkImage(options.repositoryRoot??process.cwd(),image),201);
      }catch(error){if(error instanceof RequestError)reject(response,error.code,error.status);else reject(response,'INTERNAL_ERROR',500);}
      finally{active--;}
      return;
    }
    const publicationRoute=/^\/api\/authoring\/v1\/publish(?:\/(prepare|[a-f0-9-]{36})(?:\/(execute|reconcile|verify|close))?)?$/.exec(target);
    if(publicationRoute){
      const key=publicationRoute[1],action=publicationRoute[2],method=request.method;
      if(key==='prepare'&&action||action&&method!=='POST'||key==='prepare'&&method!=='POST'||!key&&method!=='GET'||key&&key!=='prepare'&&!action&&!['GET','DELETE'].includes(method??''))return reject(response,'METHOD_NOT_ALLOWED',405);
      if(active>=2)return reject(response,'AUTHORING_BUSY',503);active++;
      try{
        const body=method==='GET'?undefined:await jsonBody(request,16384);if(method==='GET'&&(request.headers['transfer-encoding']!==undefined||request.headers['content-length']&&request.headers['content-length']!=='0'))throw new RequestError('INVALID_REQUEST',400);if(closing||method!=='GET'&&!request.complete||response.destroyed)return;request.socket.setTimeout(5*60*1000);
        if((action==='reconcile'||action==='verify')&&(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length))throw new RequestError('INVALID_REQUEST',400);
        const value=!key?await publication.list():key==='prepare'?await publication.prepare(body):method==='GET'?await publication.status(key):method==='DELETE'?await publication.remove(key,body):action==='execute'?await publication.execute(key,body):action==='reconcile'?await publication.reconcile(key):action==='verify'?await publication.verifyAgain(key):await publication.closeRecord(key,body);
        result(response,value,action==='execute'&&value.ok?202:200);
      }catch(error){if(error instanceof RequestError)reject(response,error.code,error.status);else reject(response,'INTERNAL_ERROR',500);}finally{active--;}return;
    }
    const organizeRoute=/^\/api\/authoring\/v1\/intake\/(think|build)\/(organize|suggest)$/.exec(target);
    if(organizeRoute){
      if(organizeRoute[2]==='suggest'&&organizeRoute[1]!=='think')return reject(response,'NOT_FOUND',404);
      if(request.method!=='POST')return reject(response,'METHOD_NOT_ALLOWED',405);if(active>=2)return reject(response,'AUTHORING_BUSY',503);active++;
      const controller=new AbortController(),cancel=()=>{if(!response.writableEnded)controller.abort();};response.once('close',cancel);
      try{const body=await jsonBody(request,AI_MAX_REQUEST_BYTES);if(closing||!request.complete||response.destroyed)return;request.socket.setTimeout(AI_TIMEOUT_MS+10000);result(response,organizeRoute[2]==='suggest'?await intake.suggestThinkWriting(body,controller.signal):await intake.organize(organizeRoute[1] as 'think'|'build',body,controller.signal));}
      catch(error){if(error instanceof RequestError)reject(response,error.code,error.status);else reject(response,'INTERNAL_ERROR',500);}finally{response.off('close',cancel);active--;}return;
    }
    const writingDraft=/^\/api\/authoring\/v1\/intake\/think\/draft(?:\/([a-f0-9-]{36}))?$/.exec(target);
    if(writingDraft){
      const listing=!writingDraft[1]&&request.method==='GET';
      if(!listing&&request.method!==(writingDraft[1]?'PUT':'POST'))return reject(response,'METHOD_NOT_ALLOWED',405);
      if(active>=2)return reject(response,'AUTHORING_BUSY',503);active++;
      try{
        if(listing){if(request.headers['transfer-encoding']!==undefined||request.headers['content-length']&&request.headers['content-length']!=='0')throw new RequestError('INVALID_REQUEST',400);result(response,await intake.listThinkWriting());}
        else{const body=await jsonBody(request,PROPOSAL_MAX_RECORD);if(closing||!request.complete||response.destroyed)return;result(response,await intake.saveThinkWriting(writingDraft[1],body));}
      }
      catch(error){if(error instanceof RequestError)reject(response,error.code,error.status);else reject(response,'INTERNAL_ERROR',500);}finally{active--;}return;
    }
    const intakeRoute=/^\/api\/authoring\/v1\/(intake\/(think|build)|proposals(?:\/([a-f0-9-]{36})(?:\/(apply))?)?)$/.exec(target);
    if(intakeRoute){
      const creating=!!intakeRoute[2],id=intakeRoute[3],applying=!!intakeRoute[4],method=request.method;
      const methods=creating||applying?['POST']:id?['GET','PUT','DELETE']:['GET'];if(!methods.includes(method??''))return reject(response,'METHOD_NOT_ALLOWED',405);
      if(active>=2)return reject(response,'AUTHORING_BUSY',503);active++;
      try{
        const body=method==='GET'?undefined:await jsonBody(request,PROPOSAL_MAX_RECORD);
        if(method==='GET'&&(request.headers['transfer-encoding']!==undefined||request.headers['content-length']&&request.headers['content-length']!=='0'))throw new RequestError('INVALID_REQUEST',400);
        if(closing||method!=='GET'&&!request.complete||response.destroyed)return;
        const responseValue=creating?await intake.create(body,intakeRoute[2] as 'think'|'build'):!id?await intake.list():method==='GET'?await intake.read(id):applying?await intake.apply(id,body):method==='PUT'?await intake.update(id,body):await intake.remove(id,body);
        result(response,responseValue);
      }catch(error){if(error instanceof RequestError)reject(response,error.code,error.status);else reject(response,'INTERNAL_ERROR',500);}finally{active--;}return;
    }
    const deliveryRoute=/^\/api\/studio-private\/delivery\/(status|export|replace)$/.exec(target);
    if(deliveryRoute){
      if(!delivery)return result(response,{ok:false,error:{code:'PRIVATE_UNAVAILABLE',message:'密文交付只在正式 App 中提供。',issues:[]}});
      const action=deliveryRoute[1]!,method=action==='status'?'GET':'POST';if(request.method!==method)return reject(response,'METHOD_NOT_ALLOWED',405);
      if(active>=2)return reject(response,'AUTHORING_BUSY',503);active++;
      try{
        if(action==='status'){
          if(request.headers['transfer-encoding']!==undefined||request.headers['content-length']&&request.headers['content-length']!=='0')throw new RequestError('INVALID_REQUEST',400);
          send(response,200,{ok:true,value:delivery.status()});
        }else{
          const body=object(await jsonBody(request,MAX_ENVELOPE+2048),action==='export'?['handle','masterHandle','masterRevision','publicRevision','envelope']:['candidateId','expectedTargetRevision']);
          if(closing||!request.complete||response.destroyed)return;
          send(response,200,{ok:true,value:action==='export'?delivery.export({handle:body.handle,masterHandle:body.masterHandle,masterRevision:body.masterRevision,publicRevision:body.publicRevision,envelope:body.envelope}):delivery.replace(body.candidateId,body.expectedTargetRevision)});
        }
      }catch(error){
        if(error instanceof RequestError)reject(response,error.code,error.status);
        else{const known=['DELIVERY_NOT_READY','DELIVERY_STALE','DELIVERY_FAILED','PRIVATE_HANDLE_INVALID','PRIVATE_CONFLICT','PRIVATE_ENVELOPE_INVALID','PRIVATE_FILE_UNSAFE','PRIVATE_BACKUP_INVALID','PRIVATE_WRITE_FAILED','PRIVATE_PUBLIC_CHANGED'] as const;const code=error instanceof PrivateError?known.find(code=>code===error.message)??'PRIVATE_FAILED':'PRIVATE_FAILED';send(response,errorStatuses[code],{ok:false,error:{code,message:'密文交付未完成；请核对版本和错误码，不自动重试。',issues:[],...(error instanceof PrivateError&&error.cleanupPending?{cleanupPending:true}:{})}});}
      }finally{active--;}return;
    }
    const privateRoute = /^\/api\/studio-private\/(public-build|files\/([a-f0-9-]{36}))$/.exec(target);
    if (privateRoute) {
      if (!options.privateFiles) return result(response, { ok: false, error: { code:'PRIVATE_UNAVAILABLE',message:'私人文件只由正式 App 的可信选择器授权。',issues:[] } });
      const handle = privateRoute[2], methods = handle ? ['GET', 'PUT'] : ['GET'];
      if (!methods.includes(request.method ?? '')) return reject(response, 'METHOD_NOT_ALLOWED', 405);
      if (active >= 2) return reject(response, 'AUTHORING_BUSY', 503);
      active++;
      try {
        if (request.method === 'GET') {
          if (request.headers['transfer-encoding'] !== undefined || request.headers['content-length'] && request.headers['content-length'] !== '0') throw new RequestError('INVALID_REQUEST', 400);
          send(response, 200, { ok: true, value: handle ? options.privateFiles.read(handle) : publicSnapshot() });
        } else {
          const input = object(await jsonBody(request, MAX_ENVELOPE + 1024), ['envelope', 'expectedRevision', 'publicRevision']);
          if (closing || !request.complete || response.destroyed) return;
          const guard = () => { if (typeof input.publicRevision !== 'string' || input.publicRevision !== publicSnapshot().revision) throw new PrivateError('PRIVATE_PUBLIC_CHANGED'); };
          send(response, 200, { ok: true, value: options.privateFiles.save(handle, input.expectedRevision, input.envelope, guard) });
        }
      } catch (error) {
        if (error instanceof RequestError) reject(response, error.code, error.status);
        else {
          const permitted = ['PRIVATE_HANDLE_INVALID','PRIVATE_CONFLICT','PRIVATE_ENVELOPE_INVALID','PRIVATE_FILE_UNSAFE','PRIVATE_BACKUP_INVALID','PRIVATE_WRITE_FAILED','PRIVATE_PUBLIC_CHANGED'] as const;
          const code = error instanceof PrivateError ? permitted.find(code => code === error.message) ?? 'PRIVATE_FAILED' : 'PRIVATE_FAILED';
          send(response, errorStatuses[code], { ok: false, error: { code, message: '私人密文操作未完成，请核对错误码；不自动重试。', issues: [], ...(error instanceof PrivateError && error.cleanupPending ? { cleanupPending: true } : {}) } });
        }
      } finally { active--; }
      return;
    }
    const meRoute = /^\/api\/authoring\/v1\/me\/(profile|clear|validate|preview)$/.exec(target);
    if (meRoute) {
      const action = meRoute[1]!, methods = action === 'profile' ? ['GET', 'PUT'] : ['POST'];
      if (!methods.includes(request.method ?? '')) { response.setHeader('Allow', methods.join(', ')); return reject(response, 'METHOD_NOT_ALLOWED', 405); }
      if (active >= 2) return reject(response, 'AUTHORING_BUSY', 503);
      active++;
      try {
        if (request.method === 'GET') {
          if (request.headers['transfer-encoding'] !== undefined || request.headers['content-length'] && request.headers['content-length'] !== '0') throw new RequestError('INVALID_REQUEST', 400);
          result(response, me.readProfile());
        } else {
          const input = object(await jsonBody(request), action === 'clear' ? ['expectedRevision'] : action === 'profile' ? ['profile', 'expectedRevision'] : ['profile']);
          if (closing || !request.complete || response.destroyed) return;
          if (action === 'preview') {
            request.socket.setTimeout(PREVIEW_TIMEOUT_MS + 10_000);
            const controller = new AbortController(), cancel = () => { if (!response.writableEnded) controller.abort(); };
            response.once('close', cancel);
            try { result(response, await mePreview.preview(input, controller.signal)); }
            finally { response.off('close', cancel); }
          } else result(response, action === 'clear' ? me.clearProfile(input) : action === 'validate' ? me.validateProfile(input) : me.saveProfile(input));
        }
      } catch (error) {
        if (error instanceof RequestError) reject(response, error.code, error.status); else reject(response, 'INTERNAL_ERROR', 500);
      } finally { active--; }
      return;
    }
    const buildRoute = /^\/api\/authoring\/v1\/build\/(documents(?:\/([a-z0-9]+(?:-[a-z0-9]+)*))?|validate|preview)$/.exec(target);
    if (buildRoute) {
      const action = buildRoute[1]!, key = buildRoute[2];
      const methods = action === 'documents' ? ['GET', 'POST'] : key ? ['GET', 'PUT', 'DELETE'] : ['POST'];
      if (!methods.includes(request.method ?? '')) { response.setHeader('Allow', methods.join(', ')); return reject(response, 'METHOD_NOT_ALLOWED', 405); }
      if (active >= 2) return reject(response, 'AUTHORING_BUSY', 503);
      active++;
      try {
        if (request.method === 'GET') {
          if (request.headers['transfer-encoding'] !== undefined || request.headers['content-length'] && request.headers['content-length'] !== '0') throw new RequestError('INVALID_REQUEST', 400);
          result(response, key ? build.readBuild(key) : build.listBuild());
        } else {
          const body = object(await jsonBody(request), action === 'preview' || action === 'validate' ? ['project', 'key'] : ['project', 'expectedRevision']);
          if (closing || !request.complete || response.destroyed) return;
          const input = { ...body, ...(key ? { key } : {}) };
          if (action === 'preview') {
            request.socket.setTimeout(PREVIEW_TIMEOUT_MS + 10_000);
            const controller = new AbortController();
            const cancel = () => { if (!response.writableEnded) controller.abort(); };
            response.once('close', cancel);
            try { result(response, await buildPreview.preview(input, controller.signal)); }
            finally { response.off('close', cancel); }
          } else if (action === 'validate') result(response, build.validateBuild(input));
          else if (request.method === 'POST') result(response, build.createBuild(input), 201);
          else if (request.method === 'PUT') result(response, build.saveBuild(input));
          else result(response, build.deleteBuild(input));
        }
      } catch (error) {
        if (error instanceof RequestError) reject(response, error.code, error.status);
        else reject(response, 'INTERNAL_ERROR', 500);
      } finally { active--; }
      return;
    }
    const keepRoute = /^\/api\/authoring\/v1\/keep\/(documents(?:\/([a-z0-9]+(?:-[a-z0-9]+)*))?|validate|preview)$/.exec(target);
    if (keepRoute) {
      const action = keepRoute[1]!, key = keepRoute[2];
      const methods = action === 'documents' ? ['GET', 'POST'] : key ? ['GET', 'PUT', 'DELETE'] : ['POST'];
      if (!methods.includes(request.method ?? '')) { response.setHeader('Allow', methods.join(', ')); return reject(response, 'METHOD_NOT_ALLOWED', 405); }
      if (active >= 2) return reject(response, 'AUTHORING_BUSY', 503);
      active++;
      try {
        if (request.method === 'GET') {
          if (request.headers['transfer-encoding'] !== undefined || request.headers['content-length'] && request.headers['content-length'] !== '0') throw new RequestError('INVALID_REQUEST', 400);
          result(response, key ? keep.readKeep(key) : keep.listKeep());
        } else {
          const body = object(await jsonBody(request), action === 'preview' || action === 'validate' ? ['bookmark', 'key'] : ['bookmark', 'expectedRevision']);
          if (closing || !request.complete || response.destroyed) return;
          const input = { ...body, ...(key ? { key } : {}) };
          if (action === 'preview') {
            request.socket.setTimeout(PREVIEW_TIMEOUT_MS + 10_000);
            const controller = new AbortController();
            const cancel = () => { if (!response.writableEnded) controller.abort(); };
            response.once('close', cancel);
            try { result(response, await keepPreview.preview(input, controller.signal)); }
            finally { response.off('close', cancel); }
          } else if (action === 'validate') result(response, keep.validateKeep(input));
          else if (request.method === 'POST') result(response, keep.createKeep(input), 201);
          else if (request.method === 'PUT') result(response, keep.saveKeep(input));
          else result(response, keep.deleteKeep(input));
        }
      } catch (error) {
        if (error instanceof RequestError) reject(response, error.code, error.status);
        else reject(response, 'INTERNAL_ERROR', 500);
      } finally { active--; }
      return;
    }
    if (!match) return reject(response, 'NOT_FOUND', 404);
    const path = match[1]!;
    const query = match[2];
    if (query !== undefined && !/^status=(all|draft|published)$/.test(query)) return reject(response, 'INVALID_REQUEST', 400);
    const status = query?.slice('status='.length);
    const collection = path === THINK_API + '/documents';
    const validate = path === THINK_API + '/validate';
    const isPreview = path === THINK_API + '/preview';
    const isFastPreview = path === THINK_API + '/preview-fast';
    const isWritingTime = path === THINK_API + '/writing-time';
    const isSuggest = path === THINK_API + '/suggest';
    const key = collection || validate || isPreview || isFastPreview || isSuggest || isWritingTime ? undefined : path.slice((THINK_API + '/documents/').length);
    const allowed = validate || isPreview || isFastPreview || isWritingTime ? ['POST'] : collection || isSuggest ? ['GET', 'POST'] : ['GET', 'PUT', 'DELETE'];
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
      const body = await jsonBody(request, isSuggest ? AI_MAX_REQUEST_BYTES : isFastPreview ? FAST_PREVIEW_MAX_BODY * 6 + 32 : isWritingTime ? 1024 : MAX_REQUEST_BYTES);
      if (closing || !request.complete || response.destroyed) return;
      if (isSuggest) {
        request.socket.setTimeout(AI_TIMEOUT_MS + 10_000);
        const controller = new AbortController();
        const cancel = () => { if (!response.writableEnded) controller.abort(); };
        response.once('close', cancel);
        try { result(response, await ai.suggestThinkText(object(body, ['operation', 'input']), controller.signal)); }
        finally { response.off('close', cancel); }
      }
      else if (isPreview || isFastPreview) {
        request.socket.setTimeout(isFastPreview ? 15_000 : PREVIEW_TIMEOUT_MS + 10_000);
        const controller = new AbortController();
        const cancel = () => { if (!response.writableEnded) controller.abort(); };
        response.once('close', cancel);
        try {
          if (isFastPreview) {
            const start = performance.now();
            const rendered = await fastPreview(object(body, ['body']), controller.signal);
            response.setHeader('Server-Timing', `markdown;dur=${(performance.now() - start).toFixed(1)}`);
            result(response, rendered);
          } else result(response, await preview.previewThink(object(body, ['document', 'key']), controller.signal));
        }
        finally { response.off('close', cancel); }
      }
      else if (isWritingTime) result(response, await writingTime(body));
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
    intake.close();delivery?.close();options.privateFiles?.close();
    await Promise.all([preview.close(),keepPreview.close(),mePreview.close(),buildPreview.close(),ai.close()]);
    keep.close();me.close();build.close();
    service.close();
    throw error;
  }
  let shutdown: Promise<EditorResult<{ closed: true }>> | undefined;
  return {
    origin, token,
    abandon:async()=>{closing=true;options.privateFiles?.close();await publication.abandon();return sessionClose();},
    close:sessionClose,
  };
  function sessionClose():Promise<EditorResult<{closed:true}>> {
      if(publication.busy())return Promise.resolve({ok:false as const,error:{code:'AUTHORING_BUSY' as const,message:'发布边界尚未结束，窗口和缓冲保留，请等待或核对状态。',issues:[]}});
      return shutdown ??= new Promise(resolve => {
      closing = true;
      intake.close();options.privateFiles?.close();
      delivery?.close();
      server.close(() => { void Promise.all([publication.close(),preview.close(), keepPreview.close(), mePreview.close(), buildPreview.close(), ai.close()]).then(() => {
        let keepFailed = false;
        try { keep.close(); } catch { keepFailed = true; }
        try { me.close(); } catch { keepFailed = true; }
        try { build.close(); } catch { keepFailed = true; }
        const stopped = service.close();
        resolve(keepFailed ? { ok: false, error: { code: 'FILE_OPERATION_FAILED', message: '模块作者锁未能安全释放。', issues: [] } } : stopped);
      }); });
      server.closeAllConnections();
    });
  }
}
