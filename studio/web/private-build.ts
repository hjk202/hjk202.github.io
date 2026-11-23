import type { PrivateProject,PrivateSupplement } from '../private/build.ts';
import { textField,selectField } from './form-fields.ts';
import { projectFields } from './project-fields.ts';
export function privateBuildFields(root:HTMLElement,entry:PrivateProject|PrivateSupplement,changed:()=>void) {
  const supplement='publicSlug' in entry;
  textField(root,supplement?'私人补充标题':'私人项目标题',entry.title,value=>{entry.title=value;changed();});
  if('publicSlug' in entry)textField(root,'公开项目 slug（已有）',entry.publicSlug,value=>{entry.publicSlug=value;changed();});
  else {
    textField(root,'私人项目摘要',entry.summary,value=>{entry.summary=value;changed();},true);
    textField(root,'私人项目周期（可选）',entry.period??'',value=>{if(value==='')delete entry.period;else entry.period=value;changed();});
    selectField(root,'私人项目状态',entry.status??'',[['','省略'],['in-progress','进行中'],['completed','完成'],['paused','暂停']],value=>{if(value==='')delete entry.status;else entry.status=value as 'in-progress'|'completed'|'paused';changed();});
  }
  for(const name of [...(supplement?[]:['keywords','links']),'sections','milestones','updates','issues']){const section=document.createElement('section'),heading=document.createElement('h3'),container=document.createElement('div');heading.textContent=({keywords:'关键词',links:'链接',sections:'内容章节',milestones:'阶段目标',updates:'进展记录',issues:'问题与复盘'} as Record<string,string>)[name]!;container.id='private-build-'+name;section.append(heading,container);root.append(section);}
  projectFields(root,entry,changed,'private-build');
}
