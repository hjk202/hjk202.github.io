import { vault } from './runtime';
import { onPage } from '../layout/lifecycle';
import { MAX_ENVELOPE, readEnvelope, type Envelope } from '../../core/vault/crypto';
import { passphraseIssue } from '../../core/vault/passphrase';
import { withBase } from '../../core/module/urls';
async function boundedText(response: Response) {
  if(Number(response.headers.get('content-length'))>MAX_ENVELOPE||!response.body)throw new Error('Invalid response');
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;
  try { while(true) {const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_ENVELOPE)throw new Error('Too large');chunks.push(value);} }
  catch(error){await reader.cancel();throw error;}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
onPage(()=>{
  const dialog=document.querySelector<HTMLDialogElement>('[data-vault-dialog]')!;
  const input=dialog.querySelector<HTMLInputElement>('#vault-passphrase')!,submit=dialog.querySelector<HTMLButtonElement>('[data-vault-submit]')!,closeButton=dialog.querySelector<HTMLButtonElement>('[data-vault-close]')!,form=dialog.querySelector<HTMLElement>('[data-vault-form]')!,status=dialog.querySelector<HTMLElement>('#vault-status')!,retry=dialog.querySelector<HTMLButtonElement>('[data-vault-retry]')!;
  const abort=new AbortController(),options={signal:abort.signal};
  let request:AbortController|undefined,envelope:Envelope|undefined,generation=0,trigger:Element|null=null,restored=true,outsideStarted=false,holdTimer:number|undefined;
  const update=()=>{for(const button of document.querySelectorAll<HTMLButtonElement>('[data-vault-lock]'))button.hidden=!vault.isUnlocked;};
  const unsubscribe=vault.subscribe(update);update();
  const cancelHold=()=>{clearTimeout(holdTimer);holdTimer=undefined;};
  function restoreFocus() { if(dialog.open||restored)return;restored=true;document.documentElement.classList.remove('vault-open');if(trigger instanceof HTMLElement||trigger instanceof SVGElement)trigger.focus({preventScroll:true}); }
  function close() {
    generation++;request?.abort();input.value='';input.removeAttribute('aria-invalid');cancelHold();if(vault.state==='unlocking')vault.lock();
    if(!dialog.open)return;
    dialog.close();restoreFocus();
  }
  async function load() {
    const token=++generation;request?.abort();request=new AbortController();form.hidden=true;retry.hidden=true;status.textContent='正在准备私人空间…';
    if(!window.isSecureContext||!globalThis.crypto?.subtle){status.textContent='当前浏览器无法打开私人空间。请使用支持安全连接的浏览器。';return;}
    try {
      const response=await fetch(withBase('/vault/bundle.json',document.documentElement.dataset.base),{signal:request.signal,credentials:'same-origin'});
      if(token!==generation||!dialog.open)return;
      if(response.status===404){status.textContent='尚未配置私人内容。';return;}
      if(!response.ok)throw new Error('Request failed');
      const source=await boundedText(response);if(token!==generation||!dialog.open)return;
      envelope=readEnvelope(source);form.hidden=false;submit.disabled=false;input.disabled=false;input.removeAttribute('aria-invalid');status.textContent='输入口令，进入私人空间。';input.focus({preventScroll:true});
    }catch{if(token===generation&&dialog.open){status.textContent='暂时无法打开私人空间，请重试。';retry.hidden=false;}}
  }
  function open(source:Element|null) {
    if(vault.isUnlocked)return;
    const spotlight=document.querySelector<HTMLDialogElement>('[data-spotlight]');
    if(spotlight?.open){spotlight.addEventListener('close',()=>open(source),{once:true,signal:abort.signal});document.dispatchEvent(new CustomEvent('vault:request-open'));return;}
    trigger=source;restored=false;input.value='';envelope=undefined;dialog.showModal();document.documentElement.classList.add('vault-open');closeButton.focus({preventScroll:true});void load();
  }
  async function unlock() {
    if(!envelope||submit.disabled||!input.value)return;
    if (showInputIssue()) return;
    const token=++generation,password=input.value;input.value='';submit.disabled=true;input.disabled=true;status.textContent='正在解锁…';
    try {const success=await vault.unlock(envelope,password);if(token!==generation||!dialog.open)return;if(success){close();document.dispatchEvent(new CustomEvent('vault:ready'));}}
    catch{if(token===generation&&dialog.open){status.textContent='口令或内容校验失败。';input.disabled=false;submit.disabled=false;input.focus();}}
  }
  function showInputIssue(value=input.value) {
    const issue=passphraseIssue(value);
    if (!issue || issue==='empty') { input.removeAttribute('aria-invalid'); return false; }
    input.setAttribute('aria-invalid','true');
    status.textContent=issue==='too-long'?'口令过长，请检查粘贴内容。':'口令含有控制字符或不可见字符，请检查粘贴内容。';
    return true;
  }
  document.querySelectorAll<HTMLButtonElement>('[data-vault-entrance]').forEach(button=>{
    let start:{x:number;y:number}|undefined;
    button.addEventListener('pointerdown',event=>{if(event.button!==0)return;cancelHold();if(event.isTrusted)button.setPointerCapture(event.pointerId);start={x:event.clientX,y:event.clientY};holdTimer=window.setTimeout(()=>{cancelHold();open(button);},1500);},options);
    button.addEventListener('pointermove',event=>{if(start&&Math.hypot(event.clientX-start.x,event.clientY-start.y)>10)cancelHold();},options);
    for(const event of ['pointerup','pointercancel','pointerleave','lostpointercapture'])button.addEventListener(event,cancelHold,options);
    button.addEventListener('click',event=>event.preventDefault(),options);
    button.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open(button);}},options);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-vault-lock]').forEach(button=>button.addEventListener('click',()=>{vault.lock();close();const focus=document.querySelector<HTMLElement>('[data-vault-entrance], a[aria-label="Home"], [data-search-trigger]');focus?.focus({preventScroll:true});},options));
  submit.addEventListener('click',()=>void unlock(),options);
  input.addEventListener('input',()=>{if(!showInputIssue())status.textContent='输入口令，进入私人空间。';},options);
  // Password inputs can strip pasted newlines before `input`; inspect the original paste first.
  input.addEventListener('paste',event=>{
    if(!event.clipboardData)return;
    const start=input.selectionStart??input.value.length,end=input.selectionEnd??start;
    if(showInputIssue(input.value.slice(0,start)+event.clipboardData.getData('text/plain')+input.value.slice(end)))event.preventDefault();
  },options);
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();void unlock();}},options);
  retry.addEventListener('click',()=>void load(),options);closeButton.addEventListener('click',()=>close(),options);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();},options);dialog.addEventListener('close',restoreFocus,options);
  dialog.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const nodes=[closeButton,...(!form.hidden&&!input.disabled?[input,submit]:[]),...(!retry.hidden?[retry]:[])];const position=nodes.indexOf(document.activeElement as HTMLButtonElement);if(event.shiftKey&&position<=0){event.preventDefault();nodes.at(-1)!.focus();}if(!event.shiftKey&&position===nodes.length-1){event.preventDefault();closeButton.focus();}},options);
  const outside=(event:MouseEvent)=>{const bounds=dialog.getBoundingClientRect();return event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom;};
  dialog.addEventListener('pointerdown',event=>{outsideStarted=outside(event);},options);dialog.addEventListener('click',event=>{if(outsideStarted&&outside(event))close();},options);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)close();},options);
  document.addEventListener('vault:open',event=>open((event as CustomEvent<{source:Element}>).detail.source),options);
  return()=>{generation++;request?.abort();if(vault.state==='unlocking')vault.lock();abort.abort();unsubscribe();cancelHold();input.value='';dialog.close();document.documentElement.classList.remove('vault-open');};
});
