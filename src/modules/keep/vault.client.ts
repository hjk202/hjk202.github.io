import { validateKeep,keepVaultCount } from './vault.schema';
import type { VaultFactory } from '../../core/vault/types';
import { vaultTarget,targetHref } from '../../core/vault/targets';
import { withBase } from '../../core/module/urls';
import { element,externalLink,privateLabel } from '../../shell/vault/dom';
import './vault.css';
const create:VaultFactory=(value,context)=>{
  let bookmarks=validateKeep(value).bookmarks;
  const target=(id:string)=>targetHref(vaultTarget(context.module.route,id),context.base);
  return {
    count:count=>keepVaultCount(count,{bookmarks}),
    search:()=>Array.from(bookmarks,entry=>({title:entry.title,description:entry.description,url:vaultTarget(context.module.route,entry.id),module:context.module.id})),
    hasTarget:id=>bookmarks.some(entry=>entry.id===id),
    mount(container,id) {
      if(id){const entry=bookmarks.find(entry=>entry.id===id)!;const article=element('article','','private-bookmark');const back=element('a','← 返回收藏夹','text-link');back.href=withBase(context.module.route,context.base);article.append(back,privateLabel(),element('p',entry.category?.label??'未分类','eyebrow'),element('p',new URL(entry.sourceUrl).hostname,'source'),element('h1',entry.title),element('p',entry.description,'description'));for(const text of entry.note)article.append(element('p',text));article.append(externalLink('打开来源 ↗',entry.sourceUrl,'glass-control text-link'));container.append(article);return;}
      if(location.pathname!==withBase(context.module.route,context.base)||!bookmarks.length)return;
      const section=element('section','','private-bookmarks');section.append(privateLabel(),element('h2','私人收藏夹'));
      const groups=new Map<string,{label:string;entries:typeof bookmarks}>();
      for(const entry of bookmarks){const key=entry.category?.id??'uncategorized';if(!groups.has(key))groups.set(key,{label:entry.category?.label??'未分类',entries:[]});groups.get(key)!.entries.push(entry);}
      const filters=element('div','','private-category-filter');filters.setAttribute('role','group');filters.setAttribute('aria-label','私人收藏分类');
      const panels=new Map<string,HTMLElement>(),buttons=new Map<string,HTMLButtonElement>();
      const choose=(key:string)=>{for(const [id,panel]of panels)panel.hidden=key!=='all'&&id!==key;for(const [id,button]of buttons)button.setAttribute('aria-pressed',String(id===key));};
      for(const [key,label]of [['all','全部'],...Array.from(groups,([key,group])=>[key,group.label])]){const button=element('button',label);button.type='button';button.addEventListener('click',()=>choose(key));filters.append(button);buttons.set(key,button);}
      section.append(filters);
      for(const [key,group]of groups){const panel=element('section','','bookmark-group');panel.append(element('h3',group.label));const grid=element('div','','bookmark-grid');
        for(const entry of group.entries){const card=element('article','','bookmark-card');card.append(element('p',new URL(entry.sourceUrl).hostname,'bookmark-source'));const heading=element('h4'),link=element('a',entry.title);link.href=target(entry.id);heading.append(link);card.append(heading,element('p',entry.description));const footer=element('footer'),detail=element('a','查看收藏说明 →','text-link');detail.href=target(entry.id);footer.append(detail,externalLink('打开网站 ↗',entry.sourceUrl));card.append(footer);grid.append(card);}panel.append(grid);panels.set(key,panel);section.append(panel);}
      choose('all');container.append(section);
    },
    dispose(){bookmarks=[];},
  };
};
export default create;
