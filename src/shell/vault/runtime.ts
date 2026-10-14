import { VaultSession, protectSession } from '../../core/vault/session.ts';
import { decodeBase64, type VaultPayload } from '../../core/vault/crypto.ts';
import type { SearchIndex } from '../../core/search/types.ts';
import type { VaultView } from '../../core/vault/types.ts';
import { vaultFactories } from '../../core/module/vault-registry.client.ts';
import { combineVaultProjection, validateVaultProjection } from '../../core/search/vault-projection.ts';
import { targetId } from '../../core/vault/targets.ts';
import { onPage, goTo } from '../layout/lifecycle.ts';

function publicIndex(): SearchIndex { return JSON.parse(document.querySelector('[data-vault-public]')!.textContent!); }
const views=new Map<string,VaultView>();
const blobs=new Map<string,string>();
let unmount:(()=>void)|undefined;
function cleanupViews() {
  unmount?.();unmount=undefined;
  for(const view of views.values())view.dispose();views.clear();
  for(const url of blobs.values())URL.revokeObjectURL(url);blobs.clear();
}
function buildViews(payload: VaultPayload) {
  cleanupViews();
  const index=publicIndex(),factories=vaultFactories(index.modules);
  try {
    for(const [id,value] of Object.entries(payload.modules)) {
      const module=index.modules.find(module=>module.id===id),factory=factories.get(id);
      if(!module||!factory)throw new Error('Unsupported Vault module');
      const view=factory(value,{module,base:document.documentElement.dataset.base??'/',publicTargets:index.results.filter(result=>result.module===id).map(result=>result.url),asset(assetId){
        if(!blobs.has(assetId)) {
          const asset=payload.assets[assetId];if(!asset)throw new Error('Missing Vault asset');
          blobs.set(assetId,URL.createObjectURL(new Blob([decodeBase64(asset.data,512*1024)],{type:asset.type})));
        }
        return blobs.get(assetId)!;
      }});
      views.set(id,view);
      validateVaultProjection(module,view);
    }
  } catch(error) {cleanupViews();throw error;}
}
export const vault=new VaultSession(buildViews);
protectSession(vault);
function navigationState() {
  document.documentElement.toggleAttribute('data-vault-unlocked',vault.isUnlocked);
  for(const link of document.querySelectorAll('a[href]')) {
    if(!vault.isUnlocked&&!link.hasAttribute('data-astro-reload')) {link.setAttribute('data-astro-reload','');link.setAttribute('data-vault-native','');}
    if(vault.isUnlocked&&link.hasAttribute('data-vault-native')) {link.removeAttribute('data-astro-reload');link.removeAttribute('data-vault-native');}
  }
}
document.addEventListener('click',event=>{
  const link=event.target instanceof Element?event.target.closest('a[href]'):null;
  if(link&&!vault.isUnlocked&&!link.hasAttribute('data-astro-reload')) {link.setAttribute('data-astro-reload','');link.setAttribute('data-vault-native','');}
}, {capture:true});
document.addEventListener('astro:after-swap',navigationState);
function mount() {
  unmount?.();unmount=undefined;
  const shell=document.querySelector<HTMLElement>('.module-page'),main=shell?.querySelector<HTMLElement>('.module-content');
  if(!shell||!main)return;
  const moduleId=shell.dataset.module!,view=views.get(moduleId);
  let id:string|undefined;
  try{id=targetId(location.hash);}catch{id='invalid';}
  const root=document.createElement('section');root.className='vault-view';root.dataset.vaultView='';
  const originals=[...main.children] as HTMLElement[];
  if(id)originals.forEach(element=>{element.hidden=true;element.setAttribute('data-vault-hidden','');});
  if(id&&!vault.isUnlocked){
    const message=document.createElement('p');message.textContent='这条内容需要解锁私人空间。';
    const button=document.createElement('button');button.type='button';button.className='glass-control';button.textContent='解锁私人空间';
    button.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('vault:open',{detail:{source:button}})));root.append(message,button);
  }
  else if(id&&(!view||!view.hasTarget(id))){root.textContent='这条私人内容不存在或已移除。';}
  else if(vault.isUnlocked&&view){try{view.mount(root,id);}catch{vault.lock();return;}}
  if(root.childNodes.length)main.append(root);
  unmount=()=>{root.replaceChildren();root.remove();originals.forEach(element=>{element.hidden=false;element.removeAttribute('data-vault-hidden');});};
}
let previouslyUnlocked=false;
vault.subscribe(()=>{
  if(previouslyUnlocked&&!vault.isUnlocked&&location.hash.startsWith('#vault=')) history.replaceState(null,'',location.pathname+location.search);
  previouslyUnlocked=vault.isUnlocked;
  if(!vault.isUnlocked)cleanupViews();
  navigationState();
  mount();document.dispatchEvent(new CustomEvent('vault:change'));
});
onPage(()=>{
  navigationState();mount();const abort=new AbortController();
  window.addEventListener('hashchange',mount,{signal:abort.signal});
  document.body.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    const link=event.target instanceof Element?event.target.closest('a[href]'):null;
    if(!link||link.hasAttribute('download')||(link.hasAttribute('data-astro-reload')&&!link.hasAttribute('data-vault-native'))||!['','_self'].includes(link.getAttribute('target')??''))return;
    const target=new URL(link.getAttribute('href')!,location.href);
    if(target.origin!==location.origin||!['http:','https:'].includes(target.protocol))return;
    if(target.pathname===location.pathname&&target.search===location.search&&target.hash&&!target.hash.startsWith('#vault='))return;
    event.preventDefault();void goTo(target.pathname+target.search+target.hash);
  },{signal:abort.signal});
  return()=>{abort.abort();unmount?.();unmount=undefined;};
});
// Only module-owned projections are exposed; raw content and keys have no global debug handle.
export function vaultProjection(index: SearchIndex = publicIndex()): SearchIndex {
  return vault.isUnlocked ? combineVaultProjection(index,views) : index;
}
