import { StartupTrace } from './startup.ts';
import { fork, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { StringDecoder } from 'node:string_decoder';
import { existsSync } from 'node:fs';
import { resolve,isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { desktopControl, startDesktopHost, existingStudio } from './desktop.ts';
import { DesktopError } from './local.ts';
import { appBuildEnvironment } from './app-build.ts';
import { readPreparedStudio } from './prepared.ts';
import { recoverDesktop, startupOwner, processGone, desktopPaths, desktopDirectory, writeDesktopJson, assertPortFree } from './desktop-state.ts';

const defaultRoot = fileURLToPath(new URL('../../', import.meta.url));
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
/** root/store/port are trusted fixture inputs, never UI or HTTP settings. */
type AppOptions = { root?: string; store?: string; port?: number; preparedId?: string };
export async function startAppHost(options: AppOptions & { build?: false; executable?: string; windowProcess?:(executable:string,environment:NodeJS.ProcessEnv)=>ReturnType<typeof spawn> } = {}) {
  const root = resolve(options.root ?? defaultRoot);
  let executable = '';
  let window: ReturnType<typeof spawn> | undefined = undefined;
  let approved = false, lost = false, windowExited = false, windowReady = false, windowConnected=false,preparedId: string | undefined;
  let pending: { id: string; resolve(value: boolean): void } | undefined;
  let readyResolve!: () => void, readyReject!: (error: DesktopError) => void;
  const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const send = (value: object) => { if (window?.stdin?.writable) window.stdin.write(JSON.stringify(value) + '\n'); };
  const prepare = () => {
    if (approved) return Promise.resolve(true);
    if (pending) return new Promise<boolean>(resolve => { const previous = pending!.resolve; pending!.resolve = value => { previous(value); resolve(value); }; });
    return new Promise<boolean>(resolve => { pending = { id: randomUUID(), resolve }; send({ type: 'studio:prepare-close', requestId: pending.id }); });
  };
  const trace=new StartupTrace(root);
  trace.mark('native-check');
  const prepared=options.build===false?undefined:readPreparedStudio(root,options.preparedId);
  if(prepared){trace.mark('native-check','hit');trace.mark('web-check','hit');}
  executable=options.executable??prepared?.executable??'';
  if(!executable)throw new DesktopError('PREPARATION_REQUIRED');
  let session!: Awaited<ReturnType<typeof startDesktopHost>>;
  const requestClose = async () => {
    try{await starting;}catch{send({type:'studio:close-complete'});return;}
    if (!await prepare()) return;
    try { await session.stop(); }
    catch {
      if (!lost && !processGone(session.pid)) { approved = false; send({ type: 'studio:close-failed', requestId: preparedId }); return; }
      process.stderr.write('Studio: DESKTOP_RECOVERY_REQUIRED\n');
    }
    send({ type: 'studio:close-complete' });
  };

  let timeout: ReturnType<typeof setTimeout>|undefined;
  const startWindow=()=>{
  // Separate the native window from Node's Windows job so a lost supervisor cannot kill its buffer.
  trace.mark('window-start');
  window = options.windowProcess?.(executable,appBuildEnvironment(root))??spawn(executable, [], { cwd: root, env: appBuildEnvironment(root), detached: true, windowsHide: false, stdio: ['pipe', 'pipe', 'pipe'] });
  window.stdin!.on('error', () => { /* A lost window is handled by its exit event, never retried. */ });
  window.stderr!.resume();
  let input = '';
  const decoder = new StringDecoder('utf8');
  timeout = setTimeout(() => readyReject(new DesktopError('APP_START_TIMEOUT')), 30_000);
  window.once('error', () => readyReject(new DesktopError('APP_START_FAILED')));
  window.once('exit', () => {
    windowExited = true; pending?.resolve(false); pending = undefined;
    readyReject(new DesktopError('APP_EXITED'));
    void starting.then(value=>value.stop()).catch(() => process.stderr.write('Studio: DESKTOP_RECOVERY_REQUIRED\n'));
  });
  window.stdout!.on('data', bytes => {
    input += decoder.write(bytes);
    if (Buffer.byteLength(input) > 65536) { readyReject(new DesktopError('APP_PROTOCOL_INVALID')); return; }
    let end: number;
    while ((end = input.indexOf('\n')) >= 0) {
      const line = input.slice(0, end).trim(); input = input.slice(end + 1);
      try {
        const value = JSON.parse(line) as Record<string, unknown>;
        if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
        const fields = Object.keys(value).sort().join();
        if (fields==='type'&&['studio:window-visible','studio:webview-start','studio:webview-ready'].includes(String(value.type))){trace.mark(value.type==='studio:window-visible'?'window-visible':value.type==='studio:webview-start'?'webview-start':'webview-ready');}
        else if(value.type==='studio:editor-connected'&&fields==='type'){windowConnected=true;}
        else if (value.type === 'studio:window-ready' && fields === 'type') { trace.mark('editor-ready'); windowReady = windowConnected = true; clearTimeout(timeout); readyResolve(); }
        else if (value.type === 'studio:private-selected-file' && fields === 'mode,path,requestId,type'
          && (windowConnected||windowReady) && !approved && !lost && !windowExited && !pending
          && typeof value.requestId === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value.requestId)
          && typeof value.path === 'string' && value.path.length <= 32768 && (value.mode === 'open' || value.mode === 'create' || value.mode === 'export')) {
          const id = value.requestId;
          void session.bindPrivateFile(value.path, value.mode, id).then(handle => send({ type: 'studio:private-bound', requestId: id, handle }))
            .catch(() => send({ type: 'studio:private-error', requestId: id, code: 'PRIVATE_FILE_SELECTION_INVALID' }));
        }
        else if (value.type === 'studio:request-close' && fields === 'type') void requestClose();
        else if (value.type === 'studio:editor-failed' && fields === 'type') { /* Native host requires explicit confirmation before closing a failed renderer. */ }
        else if (value.type === 'studio:close-result' && fields === 'requestId,status,type' && pending?.id === value.requestId && ['ready', 'cancel'].includes(String(value.status))) {
          const current = pending!; pending = undefined; approved = value.status === 'ready'; preparedId = approved ? current.id : undefined; current.resolve(approved);
        }
        else if (value.type === 'studio:app-error' && fields === 'code,type' && ['APP_START_FAILED', 'WEBVIEW2_RUNTIME_MISSING'].includes(String(value.code))) readyReject(new DesktopError(String(value.code)));
      } catch { readyReject(new DesktopError('APP_PROTOCOL_INVALID')); }
    }
  });

    send({type:'studio:boot',version:prepared?.id??'0'.repeat(64)});
  };
  const starting=startDesktopHost({ ...options,root,build:false,startup:trace.mark,...(prepared?{prepared}:{}),
    beforeStart:async()=>{startWindow();},
    app:{prepareClose:prepare,activate:async()=>{await ready;send({type:'studio:activate'});},
      stopped:()=>{if(approved||windowExited)send({type:'studio:close-complete'});else{lost=true;send({type:'studio:service-lost'});}},
      failed:()=>{lost=true;send({type:'studio:service-lost'});},
      closeFailed:()=>{approved=false;send({type:'studio:close-failed',requestId:preparedId});},
    },
  });
  // A native initialization rejection must be observed even if API startup has not completed.
  void ready.catch(()=>{});
  try {
    session=await starting;send({type:'studio:init',origin:session.origin});
    await ready;return {...session,windowPid:window!.pid!,requestClose};
  }catch(error){trace.mark('failed');(window as ReturnType<typeof spawn>|undefined)?.stdin?.end();if(session)await session.stop();throw error;}
  finally{clearTimeout(timeout);}
}

async function launch(root: string, options: AppOptions): Promise<void> {
  const prepared=readPreparedStudio(root,options.preparedId);
  const child = fork(prepared.host, ['host'], { cwd: root, env: appBuildEnvironment(root), detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true, execArgv: [] });
  child.unref();
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: DesktopError) => { clearTimeout(timer); child.removeAllListeners('message'); if (child.connected) child.disconnect(); if (error) reject(error); else resolve(); };
    const timer = setTimeout(() => finish(new DesktopError('APP_START_TIMEOUT')), 180_000);
    child.once('error', () => finish(new DesktopError('APP_START_FAILED')));
    child.once('exit', () => finish(new DesktopError('APP_START_FAILED')));
    child.on('message', value => {
      if (!value || typeof value !== 'object' || !('type' in value)) return;
      if (value.type === 'studio:app-ready') finish();
      else if (value.type === 'studio:app-error' && 'code' in value && typeof value.code === 'string' && /^[A-Z_]+$/.test(value.code)) finish(new DesktopError(value.code));
    });
    child.send({ type: 'studio:app-start', root,preparedId:prepared.id,...(options.port ? { port: options.port } : {}), ...(options.store ? { store: options.store } : {}) });
  });
}
export async function openApp(options: AppOptions = {}): Promise<void> {
  const root = resolve(options.root ?? defaultRoot), port = options.port ?? 4322, until = Date.now() + 180_000;
  desktopDirectory(root);
  const trace=new StartupTrace(root,'opener');trace.mark('open-request');
  let portBusySince: number | undefined;
  while (Date.now() < until) {
    try {
      const current = await desktopControl(root, 'status');
      if (current) { if (!current.app) throw new DesktopError('APP_MODE_CONFLICT'); await desktopControl(root, 'activate'); trace.mark('activated'); return; }
    } catch (error) { if (!(error instanceof DesktopError) || error.message !== 'DESKTOP_UNAVAILABLE') throw error; }
    const owner = startupOwner(root);
    try { await recoverDesktop(root, port); }
    catch (error) {
      if (error instanceof DesktopError && error.message === 'DESKTOP_BUSY') { await delay(200); continue; }
      if (error instanceof DesktopError && error.message === 'PORT_UNAVAILABLE' && owner && processGone(owner.pid)) {
        portBusySince ??= Date.now(); if (Date.now() - portBusySince < 3000) { await delay(100); continue; }
      }
      if (!owner && await existingStudio(port)) throw new DesktopError('USE_TERMINAL_CTRL_C');
      throw error;
    }
    portBusySince = undefined;
    if (await existingStudio(port)) throw new DesktopError('USE_TERMINAL_CTRL_C');
    await assertPortFree(port);
    try { await launch(root, options);trace.mark('editor-ready');return; }
    catch (error) { if (!(error instanceof DesktopError) || error.message !== 'DESKTOP_BUSY') throw error; await delay(200); }
  }
  throw new DesktopError('APP_START_TIMEOUT');
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  let root = resolve(defaultRoot);
  try {
    if (process.platform !== 'win32' || process.argv.length !== 3 || !['open', 'host'].includes(process.argv[2]!)) throw new DesktopError('INVALID_COMMAND');
    if (process.argv[2] === 'open') await openApp();
    else {
      if (!process.send) throw new DesktopError('INVALID_COMMAND');
      const options = await new Promise<AppOptions>((resolve, reject) => {
        const timer = setTimeout(() => reject(new DesktopError('APP_START_TIMEOUT')), 10_000);
        process.once('message', value => {
          clearTimeout(timer);
          if (!value || typeof value !== 'object' || !('type' in value) || value.type !== 'studio:app-start' || Object.keys(value).some(key => !['type','port','store','root','preparedId'].includes(key))
            || ('port' in value && (!Number.isSafeInteger(value.port) || Number(value.port) < 1 || Number(value.port) > 65535)) || ('store' in value && typeof value.store !== 'string')||!('root'in value)||typeof value.root!=='string'||!('preparedId'in value)||typeof value.preparedId!=='string'||!isAbsolute(value.root)||value.root.includes('\0')||value.root.length>32768||! /^[a-f0-9]{64}$/.test(value.preparedId)) reject(new DesktopError('INVALID_COMMAND'));
          else resolve(value as AppOptions);
        });
      });
      root=resolve(options.root!);await startAppHost(options); if (process.connected) process.send?.({ type: 'studio:app-ready' }, () => {});
    }
  } catch (error) {
    const code = error instanceof DesktopError ? error.message : 'APP_START_FAILED';
    if (process.argv[2] === 'host') {
      if (code !== 'DESKTOP_BUSY') try { if (existsSync(root)) writeDesktopJson(desktopPaths(root).error, { date: Date.now(), pid: process.pid, code }); } catch { /* Preserve unsafe state instead of overwriting it to log a failure. */ }
      if (process.connected) process.send?.({ type: 'studio:app-error', code }, () => {});
    } else process.stderr.write(`Studio: ${code}\n`);
    process.exitCode = 1;
  }
}
