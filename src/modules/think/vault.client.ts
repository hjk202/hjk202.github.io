import { validateThink } from './vault.schema';
import { markdownBlocks } from './vault.markdown';
import type { VaultFactory } from '../../core/vault/types';
import { vaultTarget,targetHref } from '../../core/vault/targets';
import { withBase } from '../../core/module/urls';
import { httpUrl } from '../../core/vault/validation';
import { element,privateLabel } from '../../shell/vault/dom';
import './vault.css';
const create:VaultFactory=(value,context)=>{
  let posts=validateThink(value).posts;
  for(const post of posts) for(const block of markdownBlocks(post.body)) if(block.type!=='code')for(const [,id] of block.text.matchAll(/!\[[^\]\n]*\]\(asset:([a-f0-9]{32})\)/g))context.asset(id);
  const target=(id:string)=>targetHref(vaultTarget(context.module.route,id),context.base);
  function inline(parent:HTMLElement,source:string) {
    const pattern=/(!?\[([^\]\n]+)\]\(([^)\s]+)\)|`([^`\n]+)`|\*\*([^*\n]+)\*\*)/g;let position=0;
    for(const match of source.matchAll(pattern)) {
      parent.append(document.createTextNode(source.slice(position,match.index)));
      if(match[4])parent.append(element('code',match[4]));
      else if(match[5])parent.append(element('strong',match[5]));
      else if(match[1].startsWith('!')) {
        const id=/^asset:([a-f0-9]{32})$/.exec(match[3]);
        if(id){const image=element('img');image.src=context.asset(id[1]);image.alt=match[2];image.loading='lazy';parent.append(image);}
        else parent.append(document.createTextNode(match[0]));
      } else {
        try {const link=element('a',match[2]);link.href=match[3].startsWith('/')?withBase(match[3],context.base):httpUrl(match[3]);if(!match[3].startsWith('/')){link.target='_blank';link.rel='noopener noreferrer';}parent.append(link);}
        catch {parent.append(document.createTextNode(match[0]));}
      }
      position=match.index+match[0].length;
    }
    parent.append(document.createTextNode(source.slice(position)));
  }
  return {
    count:count=>count+posts.length,
    search:()=>Array.from(posts,post=>({title:post.title,description:post.summary,url:vaultTarget(context.module.route,post.id),module:context.module.id})),
    hasTarget:id=>posts.some(post=>post.id===id),
    mount(container,id) {
      if(!id&&location.pathname!==withBase(context.module.route,context.base))return;
      if(id) {
        const post=posts.find(post=>post.id===id)!;
        const article=element('article','','think-private-article');const back=element('a','← 返回 Think','text-link');back.href=withBase(context.module.route,context.base);
        const time=element('time',post.date);time.dateTime=post.date;
        article.append(back,privateLabel(),time,element('h1',post.title),element('p',post.summary,'summary'));
        const prose=element('div','','prose');let list:HTMLUListElement|HTMLOListElement|undefined;
        for(const block of markdownBlocks(post.body)) {
          if(block.type==='list') {
            const tag=block.ordered?'OL':'UL';if(!list||list.tagName!==tag){list=element(block.ordered?'ol':'ul');prose.append(list);}const item=element('li');inline(item,block.text);list.append(item);continue;
          }
          list=undefined;
          if(block.type==='code'){const pre=element('pre');pre.append(element('code',block.text));prose.append(pre);}
          else {const node=block.type==='heading'?element(block.level===1?'h2':block.level===2?'h3':'h4'):element(block.type==='quote'?'blockquote':'p');inline(node,block.text);prose.append(node);}
        }
        article.append(prose);container.append(article);
      }else if(posts.length){const section=element('section','','thought-essays private-thoughts');section.append(privateLabel(),element('h2','留给自己的想法。'));
        for(const post of posts){const article=element('article','','thought-essay');article.dataset.kind=post.kind;article.append(element('time',`${post.date} / ${post.kind==='note'?'随记':'文章'}`));const heading=element('h3'),link=element('a',post.title);link.href=target(post.id);heading.append(link);article.append(heading,element('p',post.summary));section.append(article);}container.append(section);}
    },
    dispose(){posts=[];},
  };
};
export default create;
