import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { isAbsolute } from 'node:path';
import { startStudioHttp, StudioStartError } from './http.ts';
import { DesktopError, localAuthoringEnvironment, localAuthoringEnvironmentAsync } from '../windows/local.ts';
import { CipherFiles } from './private/files.ts';
import { PrivateDelivery } from './private/delivery.ts';

const args = process.argv.slice(2);
const valid = args.length === 0 || (args.length === 2 && args[0] === '--port' && /^[1-9][0-9]{0,4}$/.test(args[1]!));
/** Private Node launcher channel only. Missing store is explicit; never fall back from an unconfigured fixture. */
type Startup = { localCredentialStore?:string; repositoryRoot?:string; webDirectory?:string; deferCredentials?:true; localCredentials?:true };
async function startupStore(): Promise<Startup> {
  if (!process.send) return {};
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); process.off('message', receive); process.off('disconnect', disconnected); };
    const disconnected = () => { cleanup(); reject(new DesktopError('DESKTOP_UNAVAILABLE')); };
    const receive = (value: unknown) => {
      cleanup();
      if (!value || typeof value !== 'object' || Array.isArray(value)) { reject(new DesktopError('INVALID_COMMAND')); return; }
      const input = value as Record<string, unknown>;
      if (input.type !== 'studio:start' || Object.keys(input).some(key => !['type','localCredentialStore','repositoryRoot','webDirectory','deferCredentials','localCredentials'].includes(key))
        || ['localCredentialStore','repositoryRoot','webDirectory'].some(key=>key in input&&(typeof input[key]!=='string'||(input[key] as string).length>32768||(input[key] as string).includes('\0')||!isAbsolute(input[key] as string)))
        || ['deferCredentials','localCredentials'].some(key=>key in input&&input[key]!==true)) { reject(new DesktopError('INVALID_COMMAND')); return; }
      resolve(input as Startup);
    };
    const timer = setTimeout(() => { cleanup(); reject(new DesktopError('DESKTOP_START_TIMEOUT')); }, 10_000);
    process.once('message', receive);
    process.once('disconnect', disconnected);
    if (!process.connected) disconnected();
  });
}
if (!valid) {
  process.stderr.write('用法：npm.cmd run studio -- [--port 4322]\n');
  process.exitCode = 1;
} else {
  try {
    // Desktop startup names its store through private IPC; decryption happens in the backend, not the native window.
    const startup = await startupStore(),store=startup.localCredentialStore;
    const root=startup.repositoryRoot??fileURLToPath(new URL('../../',import.meta.url));
    // Optional observation must not throw EPIPE when the trusted launcher disconnects.
    if(process.send&&process.connected)process.send({type:'studio:startup-phase',phase:'credentials'},()=>{});
    const environment = startup.deferCredentials?{}:store !== undefined ? await localAuthoringEnvironment(store)
      : process.platform === 'win32' && !process.send && !process.env.DASHSCOPE_API_KEY && !process.env.DASHSCOPE_BASE_URL && !process.env.STUDIO_AI_PROVIDER
        ? await localAuthoringEnvironment() : process.env;
    if (process.send && !process.connected) throw new DesktopError('DESKTOP_UNAVAILABLE');
    const privateFiles = process.send ? new CipherFiles(root) : undefined;
    let delivery:PrivateDelivery|undefined;
    const session = await startStudioHttp({repositoryRoot:root, ...(args.length ? { port: Number(args[1]) } : {}), webDirectory: startup.webDirectory??fileURLToPath(new URL('../../.cache/studio/web/', import.meta.url)), ai: startup.deferCredentials?{loadEnvironment:async signal=>{
      const value=store!==undefined||startup.localCredentials?await localAuthoringEnvironmentAsync(store,signal):{};
      if(process.connected)process.send?.({type:'studio:startup-phase',phase:'ai-ready'},()=>{});return value;
    }}:{ environment }, ...(privateFiles ? { privateFiles,createPrivateDelivery:(publicRevision:()=>string)=>delivery=new PrivateDelivery(root,privateFiles,publicRevision) } : {}) });
    if (process.send && !process.connected) { await session.close(); throw new DesktopError('DESKTOP_UNAVAILABLE'); }
    process.stdout.write(`Studio API: ${session.origin}/\n本机浏览器打开 Think 编辑器与隔离预览。Ctrl+C 停止。\n`);
    process.send?.({ type: 'studio:ready', origin: session.origin });
    const stop = async (ownerLost=false) => {
      privateFiles?.close();
      const result = await(ownerLost?session.abandon():session.close());
      if (!result.ok) { process.stderr.write(`Studio 停止未完成：${result.error.code}\n`);if(result.error.code==='AUTHORING_BUSY'&&process.connected)process.send?.({type:'studio:stop-refused',code:'AUTHORING_BUSY'},()=>{});else process.exitCode=1; }
      return result.ok;
    };
    process.once('SIGINT', () => { void stop(true); });
    process.once('SIGTERM', () => { void stop(true); });
    // A trusted parent may request clean shutdown, including Windows where SIGTERM is forceful.
    if (process.send) {
      process.on('message', message => {
        if (message === 'studio:stop') { void stop().then(ok => { if (ok&&process.connected) process.disconnect(); }); return; }
        if (!message || typeof message !== 'object' || Array.isArray(message)) return;
        const value = message as Record<string, unknown>;
        if (value.type !== 'studio:private-bind' || typeof value.requestId !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value.requestId)) return;
        try {
          if (Object.keys(value).sort().join() !== 'mode,path,requestId,type' || typeof value.path !== 'string' || (value.mode !== 'open' && value.mode !== 'create' && value.mode !== 'export') || !privateFiles) throw new Error();
          const selected = value.mode==='export'?delivery?.bindCandidate(value.path):privateFiles.bind(value.path,value.mode);if(!selected)throw new Error();
          if (process.connected) process.send?.({ type: 'studio:private-bound', requestId: value.requestId, handle: selected.handle });
        } catch { if (process.connected) process.send?.({ type: 'studio:private-error', requestId: value.requestId, code: 'PRIVATE_FILE_SELECTION_INVALID' }); }
      });
      process.once('disconnect', () => { void stop(true); });
    }
  } catch (error) {
    process.stderr.write(`${error instanceof StudioStartError ? error.message : error instanceof DesktopError ? `Studio 启动失败：${error.message}` : 'Studio 启动失败：INTERNAL_ERROR'}\n`);
    process.exitCode = 1;
  }
}
