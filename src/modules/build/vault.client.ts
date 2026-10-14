import { validateBuild,buildVaultCount } from './vault.schema';
import { projectStatusLabels,milestoneStatusLabels } from './projects';
import type { VaultFactory } from '../../core/vault/types';
import { vaultTarget,targetHref } from '../../core/vault/targets';
import { withBase } from '../../core/module/urls';
import { element,externalLink,privateLabel } from '../../shell/vault/dom';
import './vault.css';
type Archive=ReturnType<typeof validateBuild>['projects'][number]|ReturnType<typeof validateBuild>['supplements'][number];
function content(parent:HTMLElement,entry:Archive) {
  for(const section of entry.sections){const node=element('section');if(section.title)node.append(element('h2',section.title));for(const text of section.paragraphs??[])node.append(element('p',text));if(section.items?.length){const list=element('ul');for(const item of section.items)list.append(element('li',item));node.append(list);}if(section.code){const pre=element('pre');pre.append(element('code',section.code));node.append(pre);}parent.append(node);}
  if(entry.milestones.length){const section=element('section','','project-record-section');section.append(element('h2','阶段目标'));const stages=element('ol','','project-stages');for(const [index,stage]of entry.milestones.entries()){const item=element('li');item.append(element('span',String(index+1).padStart(2,'0'),'stage-number'));const title=element('div');title.append(element('h3',stage.title));if(stage.description)title.append(element('p',stage.description));item.append(title,element('span',milestoneStatusLabels[stage.status],'stage-status'));stages.append(item);}section.append(stages);parent.append(section);}
  if(entry.updates.length){const section=element('section','','project-record-section');section.append(element('h2','进展记录'));for(const update of [...entry.updates].sort((a,b)=>b.date.localeCompare(a.date))){const details=element('details','','project-update');const summary=element('summary');summary.append(element('time',update.date),element('span',update.title));details.append(summary);for(const [heading,items]of [['完成了什么',update.accomplishments],['遇到的问题',update.challenges],['下一步',update.nextSteps]] as const)if(items.length){details.append(element('h3',heading));const list=element('ul');for(const item of items)list.append(element('li',item));details.append(list);}section.append(details);}parent.append(section);}
  if(entry.issues.length){const section=element('section','','project-record-section');section.append(element('h2','问题与复盘'));for(const issue of entry.issues){const item=element('article','','project-issue');item.append(element('h3',issue.title),element('p',issue.description),element('p',issue.status==='resolved'?'已解决':'待解决'));if(issue.resolution)item.append(element('p',`解决方式：${issue.resolution}`));section.append(item);}parent.append(section);}
}
const create:VaultFactory=(value,context)=>{
  let data=validateBuild(value);
  if(data.supplements.some(entry=>!context.publicTargets.includes(`${context.module.route}${entry.publicSlug}/`)))throw new Error('Missing public project');
  const target=(id:string)=>targetHref(vaultTarget(context.module.route,id),context.base);
  return {
    count:count=>buildVaultCount(count,data),
    search:()=>Array.from([...data.projects,...data.supplements],entry=>({title:entry.title,description:'summary'in entry?entry.summary:'项目的私人阶段、进展与复盘。',url:vaultTarget(context.module.route,entry.id),module:context.module.id})),
    hasTarget:id=>[...data.projects,...data.supplements].some(entry=>entry.id===id),
    mount(container,id) {
      if(id){const entry=[...data.projects,...data.supplements].find(entry=>entry.id===id)!;const article=element('article','','private-project');const back=element('a','← 返回项目','text-link');back.href=withBase(context.module.route,context.base);article.append(back,privateLabel(),element('h1',entry.title));
        if('summary'in entry){article.append(element('p',entry.summary,'summary'));if(entry.status)article.append(element('p',projectStatusLabels[entry.status]));if(entry.period)article.append(element('p',entry.period));if(entry.keywords.length)article.append(element('p',entry.keywords.join(' · ')));for(const link of entry.links)article.append(externalLink(link.label,link.url));}
        else{const link=element('a','查看公开项目档案 →','text-link');link.href=withBase(`${context.module.route}${entry.publicSlug}/`,context.base);article.append(link);}content(article,entry);container.append(article);return;}
      if(location.pathname===withBase(context.module.route,context.base)&&data.projects.length){const section=element('section','','private-projects');section.append(privateLabel(),element('h2','私人项目档案'));const list=element('div','','project-entries');for(const [index,project]of data.projects.entries()){const card=element('article','','project-entry');card.append(element('div',String(index+1).padStart(2,'0'),'project-number'));const body=element('div','','project-entry-main');const heading=element('h3'),link=element('a',project.title);link.href=target(project.id);heading.append(link);body.append(heading,element('p',project.summary));if(project.status)body.append(element('p',projectStatusLabels[project.status]));card.append(body);list.append(card);}section.append(list);container.append(section);}
      for(const entry of data.supplements){const parent=`${context.module.route}${entry.publicSlug}/`;if(location.pathname!==withBase(context.module.route,context.base)&&location.pathname!==withBase(parent,context.base))continue;const section=element('section','','private-project-supplement');section.append(privateLabel());const title=element('h2'),link=element('a',entry.title);link.href=target(entry.id);title.append(link);section.append(title);if(location.pathname===withBase(parent,context.base))content(section,entry);else section.append(element('p','这份私人记录属于已存在的公开项目，不另计为项目。'));container.append(section);}
    },
    dispose(){data={projects:[],supplements:[]};},
  };
};
export default create;
