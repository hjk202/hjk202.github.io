import type { PrivateProfile } from '../private/me.ts';
import { stringArray,linkArray } from './form-fields.ts';
export function privateMeFields(root:HTMLElement,profile:PrivateProfile,changed:()=>void) {
  const paragraphs=document.createElement('div'),links=document.createElement('div');root.append(paragraphs,links);
  stringArray(paragraphs,profile.paragraphs,'私人介绍段落',changed);
  const values=profile.links??[];linkArray(links,values,()=>{profile.links=values;changed();});
  const remove=document.createElement('button');remove.type='button';remove.textContent='省略私人介绍 links 字段';remove.addEventListener('click',()=>{delete profile.links;changed();root.replaceChildren();privateMeFields(root,profile,changed);});root.append(remove);
}
