import type { writingRequest } from './writing-request.ts';

type Identity = { sourceKey: string; draftId?: string } | { draftId: string };
type Bucket = { identity?: Identity; total: number; pending: number; outstanding: number };
type Batch = { bucket: Bucket; body: Identity & {elapsedMs:number; batch?:string} };
const idleMs = 30_000;
const saveMs = 10_000;

/** Counts elapsed time from real edits, never from opening or reading an article. */
export function writingClock(output: HTMLOutputElement, request: ReturnType<typeof writingRequest>) {
  let item: Bucket = {total:0,pending:0,outstanding:0};
  let since: number | undefined, lastEdit = 0, lastSave = performance.now(), worker: Promise<void> | undefined;
  const jobs: Batch[] = [];
  let failed = false;
  function draw() {
    const seconds = Math.floor((item.total + item.pending + item.outstanding) / 1000);
    const minutes = Math.floor(seconds / 60), hours = Math.floor(minutes / 60);
    output.textContent = hours ? `写作 ${hours}:${String(minutes % 60).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`
      : `写作 ${minutes}:${String(seconds % 60).padStart(2,'0')}`;
    output.title = failed ? '写作时长暂未同步，文章保存不受影响。' : since === undefined ? '累计写作时长 · 已暂停' : '累计写作时长 · 正在记录';
  }
  function advance(now: number) {
    if (since === undefined) return;
    const end = Math.min(now, lastEdit + idleMs);
    item.pending += Math.max(0,end - since);
    since = now >= lastEdit + idleMs ? undefined : end;
  }
  function flush() {
    if (worker) return worker;
    worker = (async () => {
      while (jobs.length) {
        const job = jobs[0]!;
        try {
          const result = await request<{ms:number}>('POST','think/writing-time',job.body,undefined,1_500,true);
          jobs.shift();
          job.bucket.total = result.ms;
          job.bucket.outstanding -= job.body.elapsedMs;
          if (job.bucket === item) { failed = false; draw(); }
        } catch {
          // Retain the original batch ID. A lost reply may follow a committed write.
          if (job.bucket === item) { failed = true; draw(); }
          break;
        }
      }
    })().finally(() => { worker = undefined; });
    return worker;
  }
  function send(bucket: Bucket, read = false) {
    const identity = bucket.identity;
    if (!identity || !read && bucket.pending < 1 || jobs.length >= 64) { if(jobs.length)void flush(); return; }
    const elapsedMs = Math.min(120_000, Math.floor(bucket.pending));
    const body = {...identity,elapsedMs,...(elapsedMs ? {batch:crypto.randomUUID()} : {})};
    bucket.pending -= elapsedMs; bucket.outstanding += elapsedMs;
    jobs.push({bucket,body});
    void flush();
  }
  function pause() { advance(performance.now()); since = undefined; send(item); draw(); }
  const ticker = window.setInterval(() => {
    const now = performance.now(), wasActive = since !== undefined;
    advance(now);
    if (wasActive && since === undefined || now-lastSave >= saveMs) { lastSave=now; send(item); }
    draw();
  }, 1_000);
  window.addEventListener('blur',pause);
  document.addEventListener('visibilitychange',() => { if(document.hidden) pause(); });
  window.addEventListener('pagehide',() => { clearInterval(ticker); pause(); },{once:true});
  draw();
  return {
    edit() {
      if(document.hidden || !document.hasFocus()) return;
      const now = performance.now(); advance(now); lastEdit = now; since ??= now; draw();
    },
    pause,
    select(identity?: Identity) { pause(); item = { ...(identity?{identity}:{}),total:0,pending:0,outstanding:0 }; failed=false; send(item,true); draw(); },
    bind(identity: Identity) { advance(performance.now()); since=undefined; item.identity=identity; send(item,true); draw(); },
    async finish() { pause(); await Promise.race([flush(),new Promise<void>(done => setTimeout(done,1800))]); },
  };
}
