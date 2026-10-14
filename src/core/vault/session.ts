import { decryptVault, type VaultPayload } from './crypto.ts';
type State='locked'|'unlocking'|'unlocked';
export class VaultSession {
  state: State='locked';
  private value: VaultPayload | null=null;
  private generation=0;
  private listeners=new Set<()=>void>();
  private validate: (payload: VaultPayload)=>void;
  constructor(validate: (payload: VaultPayload)=>void = ()=>{}) { this.validate=validate; }
  get isUnlocked() { return this.state==='unlocked'; }
  get payload() { return this.isUnlocked?this.value:null; }
  subscribe(listener:()=>void) { this.listeners.add(listener);return ()=>this.listeners.delete(listener); }
  private emit() { for(const listener of this.listeners) listener(); }
  lock() { this.generation++;this.state='locked';this.value=null;this.emit(); }
  async unlock(envelope: unknown,password: string) {
    this.lock(); const generation=this.generation;
    this.state='unlocking';this.emit();
    try {
      const value=await decryptVault(envelope,password);
      if(generation!==this.generation)return false;
      this.validate(value);
      if(generation!==this.generation)return false;
      this.value=value;this.state='unlocked';this.emit();return true;
    } catch(error) { if(generation===this.generation)this.lock();throw error; }
  }
}
export function protectSession(session: VaultSession) {
  const abort=new AbortController(),options={signal:abort.signal};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const activity=()=>{clearTimeout(timer);if(session.isUnlocked)timer=setTimeout(()=>session.lock(),10*60*1000);};
  const unsubscribe=session.subscribe(activity);
  for(const event of ['pointerdown','keydown','wheel']) document.addEventListener(event,activity,{...options,passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)session.lock();},options);
  window.addEventListener('pagehide',()=>session.lock(),options);
  window.addEventListener('pageshow',event=>{if(event.persisted)session.lock();},options);
  return ()=>{abort.abort();unsubscribe();clearTimeout(timer);};
}
