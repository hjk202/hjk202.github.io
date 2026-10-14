import { validateMe,meVaultCount } from './vault.schema';
import type { VaultFactory } from '../../core/vault/types';
import { withBase } from '../../core/module/urls';
import { element,externalLink,privateLabel } from '../../shell/vault/dom';
import './vault.css';
const create:VaultFactory=(value,context)=>{
  let profile=validateMe(value);
  return {
    count:meVaultCount,
    search:()=>profile.paragraphs.length?[{title:`${context.module.name} · 私人补充`,description:profile.paragraphs.join(' ').slice(0,300),url:context.module.route,module:context.module.id}]:[],
    hasTarget:()=>false,
    mount(container) {
      if(location.pathname!==withBase(context.module.route,context.base)||(!profile.paragraphs.length&&!profile.links.length))return;
      const section=element('section','','private-profile');section.append(privateLabel(),element('h2','更内在的一面。'));for(const paragraph of profile.paragraphs)section.append(element('p',paragraph));
      const links=element('div','','private-profile-links');for(const link of profile.links)links.append(externalLink(link.label,link.url));section.append(links);container.append(section);
    },
    dispose(){profile={paragraphs:[],links:[]};},
  };
};
export default create;
