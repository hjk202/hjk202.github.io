import {parseDocument,isMap,isScalar} from 'yaml';
import type {ThinkCandidate,Evidence} from '../../contracts/proposal.ts';
import {INTAKE_MAX_MATERIAL} from '../../contracts/proposal.ts';
import {IntakeError,record} from './store.ts';
const fields=['slug','title','summary','date','published','kind','createdAt','updatedAt'];
export function material(value:unknown):string{
  if(typeof value!=='string'||!value.trim()||Buffer.byteLength(value)>INTAKE_MAX_MATERIAL||Buffer.from(value).toString('utf8')!==value||[...value].some(c=>{const n=c.charCodeAt(0);return(n<32&&![9,10,13].includes(n))||n===127;}))throw new IntakeError('UNSUPPORTED_FORMAT');return value;
}
export function thinkCandidate(value:unknown):ThinkCandidate{
  const c=record(value,['metadata','body']),m=record(c.metadata??{},fields);
  if(Object.entries(m).some(([k,v])=>typeof v!==(k==='published'?'boolean':'string')||typeof v==='string'&&Buffer.from(v).toString('utf8')!==v)||c.body!==undefined&&(typeof c.body!=='string'||Buffer.from(c.body).toString('utf8')!==c.body))throw new IntakeError();
  return structuredClone({...c,metadata:m}) as ThinkCandidate;
}
export function parseThinkMaterial(text:string,format:unknown):{candidate:ThinkCandidate;evidence:Evidence[]}{
  let candidate:ThinkCandidate;
  if(format==='report'){
    const raw=/^```personal-space\s*\r?\n([\s\S]*?)\r?\n```\s*$/.exec(text)?.[1]??text;
    let json:unknown;try{json=JSON.parse(raw);}catch{throw new IntakeError('UNSUPPORTED_FORMAT');}
    const report=record(json,['version','module','candidate']);if(report.version!==1||report.module!=='think')throw new IntakeError('UNSUPPORTED_FORMAT');candidate=thinkCandidate(report.candidate);
  }else if(format==='markdown'&&/^\uFEFF?---[ \t]*\r?\n/.test(text)){
    const match=/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)([\s\S]*)$/m.exec(text);if(!match)throw new IntakeError('UNSUPPORTED_FORMAT');
    const yaml=parseDocument(match[1],{version:'1.2',schema:'core',uniqueKeys:true,prettyErrors:false,logLevel:'silent'});if(yaml.errors.length||yaml.warnings.length||!isMap(yaml.contents))throw new IntakeError('UNSUPPORTED_FORMAT');
    const metadata:Record<string,unknown>={};for(const pair of yaml.contents.items){if(!isScalar(pair.key)||typeof pair.key.value!=='string'||pair.key.tag||pair.key.anchor||!isScalar(pair.value)||pair.value.tag||pair.value.anchor)throw new IntakeError('UNSUPPORTED_FORMAT');metadata[pair.key.value]=pair.value.value;}
    candidate=thinkCandidate({metadata,body:match[2]});
  }else if(format==='text'||format==='markdown')candidate={metadata:{},body:text};else throw new IntakeError();
  const evidence:Evidence[]=Object.keys(candidate.metadata).map(field=>({field:'metadata.'+field,kind:'material'}));if(candidate.body!==undefined)evidence.push({field:'body',kind:'material'});
  return{candidate,evidence};
}
