import type {BuildCandidate,Evidence} from '../../contracts/proposal.ts';
import {IntakeError,record} from './store.ts';
const strings=(v:unknown)=>Array.isArray(v)&&v.length<=2000&&v.every(x=>typeof x==='string'&&Buffer.from(x).toString('utf8')===x);
export function buildCandidate(value:unknown):BuildCandidate{
  const c=record(value,['slug','title','summary','published','period','sections','keywords','links','status','milestones','updates','issues']);
  const text=(value:unknown)=>typeof value==='string'&&Buffer.from(value).toString('utf8')===value;
  for(const key of ['slug','title','summary','period','status'])if(key in c&&!text(c[key]))throw new IntakeError();
  if(c.published!==undefined&&typeof c.published!=='boolean'||c.keywords!==undefined&&!strings(c.keywords))throw new IntakeError();
  const nested=(key:string,fields:string[],arrayFields:string[]=[])=>{if(c[key]===undefined)return;if(!Array.isArray(c[key])||c[key].length>2000)throw new IntakeError();for(const row of c[key])for(const[name,v]of Object.entries(record(row,fields)))if(arrayFields.includes(name)?!strings(v):!text(v))throw new IntakeError();};
  nested('sections',['title','paragraphs','items','code'],['paragraphs','items']);nested('links',['label','url']);nested('milestones',['title','status','description']);nested('updates',['date','title','accomplishments','challenges','nextSteps'],['accomplishments','challenges','nextSteps']);nested('issues',['title','description','status','resolution']);
  return structuredClone(c) as BuildCandidate;
}
export function parseBuildMaterial(text:string,format:unknown):{candidate:BuildCandidate;evidence:Evidence[]}{
  let candidate:BuildCandidate;
  if(format==='report'){
    let parsed:unknown;try{parsed=JSON.parse(/^```personal-space\s*\r?\n([\s\S]*?)\r?\n```\s*$/.exec(text)?.[1]??text);}catch{throw new IntakeError('UNSUPPORTED_FORMAT');}
    const report=record(parsed,['version','module','candidate']);if(report.version!==1||report.module!=='build')throw new IntakeError('UNSUPPORTED_FORMAT');candidate=buildCandidate(report.candidate);
  }else if(format==='text'||format==='markdown')candidate={sections:[{paragraphs:[text]}]};else throw new IntakeError();
  return{candidate,evidence:Object.keys(candidate).map(field=>({field,kind:'material'}))};
}
