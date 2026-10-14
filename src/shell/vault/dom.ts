import { httpUrl } from '../../core/vault/validation.ts';
export function element<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className=''):HTMLElementTagNameMap[K] {
  const node=document.createElement(tag);node.textContent=text;node.className=className;return node;
}
export function externalLink(label:string,url:string,className='text-link') {
  const link=element('a',label,className);link.href=httpUrl(url);link.target='_blank';link.rel='noopener noreferrer';return link;
}
export function privateLabel() { return element('p','PRIVATE / 私人记录','eyebrow private-label'); }
