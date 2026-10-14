import type { PublicModule } from '../../core/search/types';
import { compassGeometry, compassStatistics, polygonPoints } from './geometry';
export function refreshCompass(compass: HTMLElement, modules: readonly PublicModule[]): void {
  const nodes = compassGeometry(compassStatistics(modules));
  const format = new Intl.NumberFormat('en',{maximumFractionDigits:2,useGrouping:false});
  modules.forEach((module,index) => {
    const node=nodes[index], link=compass.querySelector<SVGAElement>(`[data-module="${module.id}"]`), dot=compass.querySelector(`[data-radar="${module.id}"]`);
    const average=module.compassStatistic==='peer-average', value=format.format(node.count);
    const readout=average?`Avg · ${value}`:`${module.count} ${module.count===1?'entry':'entries'}`;
    if(link){link.dataset.count=String(node.count);link.dataset.readout=readout;link.setAttribute('aria-label',average?`${module.name}, average count ${value} across other modules`:`${module.name}, ${readout}`);}
    dot?.setAttribute('cx',String(node.radar.x));dot?.setAttribute('cy',String(node.radar.y));
  });
  const svg=compass.querySelector('svg')!;
  for(const className of ['radar-depth','compass-radar']) {
    let polygon=svg.querySelector(`.${className}`);
    if(nodes.length<3||!nodes.some(node=>node.count>0)){polygon?.remove();continue;}
    if(!polygon){polygon=document.createElementNS('http://www.w3.org/2000/svg','polygon');polygon.setAttribute('class',className);if(className==='radar-depth')polygon.setAttribute('aria-hidden','true');svg.insertBefore(polygon,svg.querySelector('[data-radar]'));}
    polygon.setAttribute('points',polygonPoints(nodes.map(node=>node.radar)));
  }
}
