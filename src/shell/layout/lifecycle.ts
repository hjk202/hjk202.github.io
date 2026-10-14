import { navigate } from 'astro:transitions/client';
// Astro uses native snapshots even with fallback="swap". Skip before capture,
// keeping its normal navigation lifecycle without snapshotting private content.
const nativeStart = document.startViewTransition;
if (nativeStart) document.startViewTransition = function (...args: Parameters<typeof nativeStart>) {
  const transition = nativeStart.apply(this,args);
  if (document.documentElement.hasAttribute('data-vault-unlocked')) transition.skipTransition();
  return transition;
};
export function onPage(initialize:()=>void|(()=>void)) {
  let cleanup: void|(()=>void);
  let initialized=false;
  const mount=()=>{if(initialized)return;initialized=true;cleanup=initialize();};
  document.addEventListener('astro:before-swap',()=>{cleanup?.();cleanup=undefined;initialized=false;});
  document.addEventListener('astro:after-swap',mount);
  document.addEventListener('astro:page-load',mount);
  mount();
}
export async function goTo(href: string) {
  if(document.documentElement.hasAttribute('data-vault-unlocked')) {
    // Retire modal compositing layers before replacing their document, including in WebKit.
    for(const dialog of document.querySelectorAll<HTMLDialogElement>('dialog[open]')) {
      dialog.style.animation='none';dialog.getAnimations({subtree:true}).forEach(animation=>animation.cancel());dialog.close();
    }
    document.documentElement.classList.remove('search-open','vault-open');
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    if(document.documentElement.hasAttribute('data-vault-unlocked')) {
      const target=new URL(href,location.href),oldURL=location.href;
      if(target.pathname===location.pathname&&target.search===location.search&&(target.hash.startsWith('#vault=')||location.hash.startsWith('#vault='))) {
        history.pushState(null,'',target.href);window.dispatchEvent(new HashChangeEvent('hashchange',{oldURL,newURL:target.href}));window.scrollTo(0,0);
      } else await navigate(href);
    }
    // Locking while modal retirement is pending cancels the old selected target.
  } else window.location.assign(href);
}
