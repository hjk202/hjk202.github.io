import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { desktopDirectory, writeDesktopJson } from './desktop-state.ts';

export const STARTUP_PHASES = ['open-request','native-check','native-restore','native-build','web-check','web-build','credential-location','backend-start','credentials','ai-ready','api-ready','window-start','window-visible','webview-start','webview-ready','editor-ready','activated','failed'] as const;
export type StartupPhase = typeof STARTUP_PHASES[number];
export type CacheReason = 'hit' | 'missing' | 'changed' | 'invalid';
export type StartupNote = (phase: StartupPhase, cache?: CacheReason) => void;
/** Fixed metadata only. Diagnostics cannot introduce a startup failure or retain caller data. */
export class StartupTrace {
  #start = performance.now();
  #id = randomUUID();
  #root: string;
  #clock: 'host' | 'opener';
  #events: { phase: StartupPhase; atMs: number; cache?: CacheReason }[] = [];
  constructor(root: string, clock: 'host' | 'opener' = 'host') { this.#root = root; this.#clock=clock==='opener'?'opener':'host'; }
  mark: StartupNote = (phase, cache) => {
    if (!STARTUP_PHASES.includes(phase) || cache !== undefined && !['hit','missing','changed','invalid'].includes(cache)
      ) return;
    const existing=this.#events.find(event=>event.phase===phase);
    if(existing){if(!cache||existing.cache)return;existing.cache=cache;}
    else
    this.#events.push({ phase, atMs: Math.round(performance.now() - this.#start), ...(cache ? { cache } : {}) });
    try { desktopDirectory(this.#root); writeDesktopJson(join(this.#root,this.#clock==='opener'&&phase!=='activated'?'.cache/studio/startup-opener-latest.json':'.cache/studio/startup-latest.json'),this.snapshot()); }
    catch { process.stderr.write('Studio: STARTUP_DIAGNOSTICS_UNAVAILABLE\n'); }
  };
  snapshot() {
    const caches=this.#events.filter(event=>event.cache).map(event=>event.cache);
    const scenario=this.#events.some(event=>event.phase==='activated')?'activation'
      :caches.includes('missing')?'initial-preparation':caches.some(cache=>cache!=='hit')?'updated-or-recovery':caches.length===2?'cold':'unclassified';
    return { version:1, runId:this.#id, outcome:this.#events.some(event=>event.phase==='failed')?'failed':this.#events.some(event=>event.phase==='editor-ready'||event.phase==='activated')?'ready':'starting', clock:this.#clock+'-monotonic-ms', scenario, stages:this.#events.map(event=>({...event})) };
  }
}
