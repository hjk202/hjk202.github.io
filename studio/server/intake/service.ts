import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {dirname,isAbsolute,join,relative,resolve} from 'node:path';
import type {ThinkAuthoring} from '../think/service.ts';
import type {EditorResult,ThinkDocument} from '../../contracts/think.ts';
import type {Proposal,ProposalTarget,ProposalView,ThinkProposal,BuildProposal,PendingProposal,Evidence} from '../../contracts/proposal.ts';
import type {Project} from '../../contracts/build.ts';
import type {createBuildAuthoring} from '../build/service.ts';
import {ProposalStore,canonical,digest,hex,idValid,IntakeError,record} from './store.ts';
import {material,parseThinkMaterial,thinkCandidate} from './think.ts';
import {parseBuildMaterial,buildCandidate} from './build.ts';
import {localStorePathAsync} from '../../windows/local.ts';
import {keyOf} from '../think/files.ts';
import type {createThinkTextSuggestions} from '../ai/suggest.ts';
import {candidateLeaves} from '../ai/organize.ts';
import type {Organized} from '../ai/organize.ts';
import type {PublicationSelection} from '../../contracts/publish.ts';

export function proposalTarget(value:unknown):ProposalTarget{
  const t=record(value,['mode','key','expectedSourceRevision']);
  if(t.mode==='create'&&t.key===undefined&&(t.expectedSourceRevision===undefined||hex(t.expectedSourceRevision)))return{mode:'create',...(t.expectedSourceRevision?{expectedSourceRevision:t.expectedSourceRevision as string}:{})};
  if(t.mode==='update'&&typeof t.key==='string'&&t.key.length<=128&&hex(t.expectedSourceRevision)&&Object.keys(t).length===3)return{mode:'update',key:t.key,expectedSourceRevision:t.expectedSourceRevision};
  throw new IntakeError();
}
export const candidateHash=(p:PendingProposal)=>digest(canonical([p.module,p.materialHash,p.candidate,p.target,p.evidence,p.notes??[]]));
export function createIntake(options:{repositoryRoot:string;think:ThinkAuthoring;build?:ReturnType<typeof createBuildAuthoring>;ai?:ReturnType<typeof createThinkTextSuggestions>;directory?:string}){
  let store:Promise<ProposalStore>|undefined,closed=false;
  const build=()=>{if(!options.build)throw new IntakeError('INVALID_REQUEST');return options.build;};
  const storage=()=>store??=Promise.resolve().then(async()=>{
    const directory=options.directory??join(dirname(await localStorePathAsync()),'inbox',digest(fs.realpathSync.native(options.repositoryRoot)));
    if(!options.directory){const rel=relative(resolve(options.repositoryRoot),resolve(directory));if(rel===''||!rel.startsWith('..')&&!isAbsolute(rel))throw new IntakeError('PROTECTED_PATH');}
    return new ProposalStore(directory);
  });
  const result=async<T>(work:(s:ProposalStore)=>T):Promise<EditorResult<T>>=>{
    try{if(closed)throw new IntakeError('SERVICE_CLOSED');const s=await storage();if(closed)throw new IntakeError('SERVICE_CLOSED');return{ok:true,value:work(s)};}
    catch(e){return{ok:false,error:{code:e instanceof IntakeError?e.code:'FILE_OPERATION_FAILED',message:'公开提案操作未完成；材料与源文件请先核对，不自动重试应用。',issues:[]}};}
  };
  function checked(value:unknown):Proposal{
    const p=record(value,['version','id','module','state','material','materialHash','candidate','target','evidence','candidateHash','key','sourceRevision','intent','notes','writing']);
    if(p.version!==1||!idValid(p.id)||!['think','build'].includes(String(p.module)))throw new IntakeError('UNSUPPORTED_FORMAT');
    if(p.state==='applied'){if(Object.keys(p).sort().join()!=='candidateHash,id,key,module,sourceRevision,state,version'||!hex(p.candidateHash)||!hex(p.sourceRevision)||typeof p.key!=='string')throw new IntakeError('UNSUPPORTED_FORMAT');return p as Proposal;}
    if(p.writing!==undefined&&(p.module!=='think'||p.writing!==true))throw new IntakeError('UNSUPPORTED_FORMAT');
    const keys=(p.state==='applying'?['candidate','evidence','id','intent','material','materialHash','module','state','target','version']:['candidate','evidence','id','material','materialHash','module','state','target','version']).concat(p.notes===undefined?[]:['notes'],p.writing===true?['writing']:[]).sort().join();
    if(p.notes!==undefined&&(!Array.isArray(p.notes)||p.notes.length>36||p.notes.some(x=>typeof x!=='string'||Buffer.byteLength(x)>1024)))throw new IntakeError('UNSUPPORTED_FORMAT');
    if(!['pending','applying'].includes(String(p.state))||Object.keys(p).sort().join()!==keys||!hex(p.materialHash)||digest(material(p.material))!==p.materialHash||!Array.isArray(p.evidence)||p.evidence.length>512)throw new IntakeError('UNSUPPORTED_FORMAT');
    if(p.state==='applying'){const intent=record(p.intent,['candidateHash','documentHash','key']);if(!hex(intent.candidateHash)||!hex(intent.documentHash)||typeof intent.key!=='string'||(p.module==='think'?!hex(intent.key):!slug(intent.key)))throw new IntakeError('UNSUPPORTED_FORMAT');}
    if(p.module==='think')thinkCandidate(p.candidate);else buildCandidate(p.candidate);
    proposalTarget(p.target);
    for(const raw of p.evidence){const e=record(raw,['field','kind','quote']);if(typeof e.field!=='string'||e.field.length>256||!['material','author','source','unconfirmed'].includes(String(e.kind))||e.quote!==undefined&&(typeof e.quote!=='string'||!(p.material as string).includes(e.quote)))throw new IntakeError('UNSUPPORTED_FORMAT');}
    return p as PendingProposal;
  }
  function thinkSource(p:Pick<ThinkProposal,'target'>){
    if(p.target.mode==='create'){if(p.target.expectedSourceRevision!==undefined)throw new IntakeError();return{key:undefined,revision:null,published:false};}
    const read=options.think.readThink({key:p.target.key});if(!read.ok||!read.value.document||read.value.revision!==p.target.expectedSourceRevision||read.value.editable!==true)throw new IntakeError('REVISION_CONFLICT');
    return{key:p.target.key,revision:read.value.revision,published:read.value.document.metadata.published,document:read.value.document};
  }
  function buildSource(p:Pick<BuildProposal,'target'>){
    const current=build().listBuild();if(!current.ok)throw new IntakeError(current.error.code);
    if(current.value.revision!==p.target.expectedSourceRevision)throw new IntakeError('REVISION_CONFLICT');
    if(p.target.mode==='create')return{key:undefined,revision:current.value.revision,published:false};
    const key=p.target.key;if(!slug(key))throw new IntakeError();const project=current.value.entries.find(item=>item.slug===key);if(!project)throw new IntakeError('REVISION_CONFLICT');
    return{key:p.target.key,revision:current.value.revision,published:project.published,project};
  }
  function normalized(p:PendingProposal){
    if(p.module==='think'){const current=thinkSource(p),document=structuredClone(p.candidate) as ThinkDocument;document.metadata={...(p.target.mode==='create'&&!p.writing?{kind:'article' as const}:{}),...document.metadata};if(current.published===undefined)delete document.metadata.published;else document.metadata.published=current.published;return{module:'think' as const,document,current};}
    const current=buildSource(p),project=structuredClone(p.candidate) as Project;if(current.published===undefined)delete project.published;else project.published=current.published;return{module:'build' as const,project,current};
  }
  function validate(p:PendingProposal){
    const n=normalized(p);
    if(n.module==='think'){const r=options.think.validateThink({document:n.document,...(n.current.key?{key:n.current.key}:{})});if(!r.ok)throw new IntakeError(r.error.code);return{canApply:r.value.canSave,diagnostics:r.value.issues.map(i=>`${i.field} · ${i.code} · ${i.message}`)};}
    const r=build().validateBuild({project:n.project,...(n.current.key?{key:n.current.key}:{})});return{canApply:r.ok,diagnostics:r.ok?[]:['VALIDATION_FAILED：请补全项目标题、摘要、章节；核对嵌套记录、状态、日期及链接。']};
  }
  function view(p:Proposal,revision:string):ProposalView{
    if(p.state==='applied')return{...p,revision,diagnostics:[],canApply:false};
    const diagnostics:string[]=[];let canApply=false;
    try{const v=validate(p);canApply=v.canApply;diagnostics.push(...v.diagnostics);}catch(e){diagnostics.push(e instanceof IntakeError?e.code:'VALIDATION_FAILED');}
    if(p.state==='applying'){canApply=false;diagnostics.unshift('WRITE_RESULT_UNKNOWN：先核对真实内容源，禁止再次应用。');}
    diagnostics.push('必须人工核对事实；结构和来源标注不能证明个人贡献属实。新建保存为 draft，修订保留原公开状态。');
    diagnostics.push(...p.notes??[]);
    return{...p,revision,candidateHash:candidateHash(p),diagnostics,canApply};
  }
  const read=(s:ProposalStore,id:string)=>{
    const saved=s.read(id),p=checked(saved.value);if(p.id!==id)throw new IntakeError('UNSUPPORTED_FORMAT');
    if(p.state==='applying'&&p.intent){
      let observed:unknown,revision:string|undefined;
      if(p.module==='think'){const current=options.think.readThink({key:p.intent.key});if(current.ok){observed=current.value.document;revision=current.value.revision??undefined;}}
      else{const current=build().readBuild(p.intent.key);if(current.ok){observed=current.value.project;revision=current.value.revision;}}
      if(observed&&revision&&digest(canonical(observed))===p.intent.documentHash){const receipt:Proposal={version:1,id,module:p.module,state:'applied',candidateHash:p.intent.candidateHash,key:p.intent.key,sourceRevision:revision};return{p:receipt,revision:s.write(id,receipt,saved.revision)};}
    }
    return{p,revision:saved.revision};
  };
  const create=(input:unknown,module:'think'|'build'='think',generated?:Organized)=>result(s=>{
    const args=record(input,['material','format','target']),text=material(args.material);let target=proposalTarget(args.target??{mode:'create'}),p:PendingProposal;
    if(module==='think'){
      const parsed=generated?.module==='think'?generated:parseThinkMaterial(text,args.format);const item:ThinkProposal={version:1,id:randomUUID(),module,state:'pending',material:text,materialHash:digest(text),candidate:parsed.candidate,target,evidence:parsed.evidence,...(generated?{notes:generated.notes}:{})};const original=thinkSource(item);
      if('document'in original&&original.document)item.candidate={metadata:{...original.document.metadata,...item.candidate.metadata},body:item.candidate.body??original.document.body};
      if(original.published===undefined)delete item.candidate.metadata.published;else item.candidate.metadata.published=original.published;p=item;
    }else{
      if(target.mode==='create'&&target.expectedSourceRevision===undefined){const list=build().listBuild();if(!list.ok)throw new IntakeError(list.error.code);target={mode:'create',expectedSourceRevision:list.value.revision};}
      const parsed=generated?.module==='build'?generated:parseBuildMaterial(text,args.format),item:BuildProposal={version:1,id:randomUUID(),module,state:'pending',material:text,materialHash:digest(text),candidate:parsed.candidate,target,evidence:parsed.evidence,...(generated?{notes:generated.notes}:{})};const original=buildSource(item);
      if('project'in original&&original.project)item.candidate={...original.project,...item.candidate};
      if(original.published===undefined)delete item.candidate.published;else item.candidate.published=original.published;p=item;
    }
    const leaves=candidateLeaves(p.candidate);if(leaves.length>512)throw new IntakeError('UNSUPPORTED_FORMAT');
    p.evidence=leaves.map(field=>{const known=p.evidence.find(e=>e.field===field||field.startsWith(e.field+'.'));return known?{...known,field}:{field,kind:p.target.mode==='update'?'source':'unconfirmed'};});
    return view(p,s.write(p.id,p,null));
  });
  function forPublication(s:ProposalStore,id:string,revision:unknown,hash?:unknown):{p:PendingProposal;selection:PublicationSelection;revision:string}{
    const current=read(s,id),p=current.p;if(p.state!=='pending'||revision!==current.revision||hash!==undefined&&hash!==candidateHash(p))throw new IntakeError('REVISION_CONFLICT');
    const n=normalized(p),proposal={id,revision:current.revision,candidateHash:candidateHash(p)};
    if(n.module==='think'){
      n.document.metadata.published=true;const v=options.think.validateThink({document:n.document,...(n.current.key?{key:n.current.key}:{})});if(!v.ok||!v.value.publishReady)throw new IntakeError('VALIDATION_FAILED');
      return{p,revision:current.revision,selection:{module:'think',document:n.document,expectedSourceRevision:n.current.revision,...(n.current.key?{key:n.current.key}:{}),proposal}};
    }
    n.project.published=true;const v=build().validateBuild({project:n.project,...(n.current.key?{key:n.current.key}:{})});if(!v.ok)throw new IntakeError(v.error.code);
    return{p,revision:current.revision,selection:{module:'build',project:n.project,expectedSourceRevision:n.current.revision,...(n.current.key?{key:n.current.key}:{}),proposal}};
  }
  return{
    /** Trusted fixed publication coordinator; neither route is exposed to Agent/general HTTP. */
    publicationSnapshot:(id:string,revision:unknown)=>result(s=>forPublication(s,id,revision).selection),
    reservePublication:(id:string,revision:unknown,hash:unknown)=>result(s=>{
      const current=forPublication(s,id,revision,hash),n=current.selection,key=n.key??(n.module==='think'?keyOf(n.document.metadata.slug+'.md'):n.project.slug),object=n.module==='think'?n.document:n.project;
      const applying={...current.p,state:'applying',intent:{candidateHash:candidateHash(current.p),documentHash:digest(canonical(object)),key}};
      return{revision:s.write(id,applying,current.revision)};
    }),
    create:(input:unknown,module:'think'|'build'='think')=>create(input,module),
    listThinkWriting:()=>result(s=>s.list().flatMap(entry=>{
      const {p}=read(s,entry.id);
      if(p.module!=='think'||p.state==='applied')return[];
      const label=p.candidate.metadata.title||p.material.split(/\r?\n/).find(line=>line.trim()&&line.trim()!=='---')||'未命名原稿';
      return[{id:p.id,state:p.state,label:label.trim().replace(/^#{1,6}\s+/,'').slice(0,70)}];
    })),
    saveThinkWriting:(id:string|undefined,input:unknown)=>result(s=>{
      const args=record(input,['material','target','expectedProposalRevision','candidate']);
      const text=material(args.material),target=proposalTarget(args.target);
      if(target.mode==='create'?target.expectedSourceRevision!==undefined:!hex(target.key))throw new IntakeError();
      const current=id?read(s,id):undefined;
      if(current?(current.p.module!=='think'||current.p.state!=='pending'||current.revision!==args.expectedProposalRevision||canonical(current.p.target)!==canonical(target)):args.expectedProposalRevision!==undefined)throw new IntakeError('REVISION_CONFLICT');
      const candidate=args.candidate===undefined?{metadata:{}}:thinkCandidate(args.candidate);
      // Raw drafts can still be recovered after an external source change. Only stage a
      // candidate for applying/publishing when the original source version still matches.
      if(args.candidate!==undefined)thinkSource({target});
      const item:ThinkProposal={version:1,id:id??randomUUID(),module:'think',state:'pending',writing:true,material:text,materialHash:digest(text),target,candidate,evidence:candidateLeaves(candidate).map(field=>({field,kind:'author'}))};
      return view(item,s.write(item.id,item,current?.revision??null));
    }),
    async suggestThinkWriting(input:unknown,signal:AbortSignal):Promise<EditorResult<Organized>>{
      try{
        if(closed)throw new IntakeError('SERVICE_CLOSED');if(!options.ai)throw new IntakeError('AI_NOT_CONFIGURED');
        const args=record(input,['material','target']),text=material(args.material),target=proposalTarget(args.target);
        thinkSource({target});
        const suggestion=await options.ai.organizeMaterial('think',text,signal,true);
        if(closed||signal.aborted)throw new IntakeError('AI_CANCELLED');
        thinkSource({target});
        return suggestion;
      }catch(error){return{ok:false,error:{code:error instanceof IntakeError?error.code:'AI_FAILED',message:'AI 整理未完成，原稿保留。',issues:[]}};}
    },
    async organize(module:'think'|'build',input:unknown,signal:AbortSignal):Promise<EditorResult<ProposalView>>{
      try{
        if(closed)throw new IntakeError('SERVICE_CLOSED');if(!options.ai)throw new IntakeError('AI_NOT_CONFIGURED');
        const args=record(input,['material','target']),text=material(args.material);let target=proposalTarget(args.target??{mode:'create'});
        if(module==='build'&&target.mode==='create'&&target.expectedSourceRevision===undefined){const state=build().listBuild();if(!state.ok)throw new IntakeError(state.error.code);target={mode:'create',expectedSourceRevision:state.value.revision};}
        if(module==='think')thinkSource({target});else buildSource({target});
        const generated=await options.ai.organizeMaterial(module,text,signal);if(!generated.ok)return generated;
        if(closed||signal.aborted)throw new IntakeError('AI_CANCELLED');
        return create({material:text,format:'text',target},module,generated.value);
      }catch(error){return{ok:false,error:{code:error instanceof IntakeError?error.code:'AI_FAILED',message:'自动整理未完成，原材料保留，未写入源文件。',issues:[]}};}
    },
    list:()=>result(s=>s.list().map(entry=>{const{p,revision}=read(s,entry.id);return{id:p.id,module:p.module,state:p.state,revision};})),
    read:(id:string)=>result(s=>{const{p,revision}=read(s,id);return view(p,revision);}),
    update:(id:string,input:unknown)=>result(s=>{
      const args=record(input,['expectedProposalRevision','candidate','target']),current=read(s,id);if(current.revision!==args.expectedProposalRevision||current.p.state!=='pending')throw new IntakeError('REVISION_CONFLICT');
      const p=current.p,previous=structuredClone(p.candidate);p.target=proposalTarget(args.target);
      if(p.module==='think'){p.candidate=thinkCandidate(args.candidate);thinkSource(p);}
      else{p.candidate=buildCandidate(args.candidate);buildSource(p);}
      const at=(value:unknown,path:string):unknown=>path.split('.').reduce<unknown>((v,key)=>v&&typeof v==='object'?Object.getOwnPropertyDescriptor(v,key)?.value:undefined,value);
      const leaves=candidateLeaves(p.candidate);if(leaves.length>512)throw new IntakeError('UNSUPPORTED_FORMAT');
      p.evidence=leaves.map(field=>canonical(at(previous,field))===canonical(at(p.candidate,field))?(p.evidence.find(e=>e.field===field)??{field,kind:'unconfirmed'}):{field,kind:'author'} as Evidence);
      return view(p,s.write(id,p,current.revision));
    }),
    apply:(id:string,input:unknown)=>result(s=>{
      const a=record(input,['expectedProposalRevision','candidateHash','target','factsConfirmed']),current=read(s,id),p=current.p;
      if(p.state!=='pending'||a.expectedProposalRevision!==current.revision||a.candidateHash!==candidateHash(p)||canonical(proposalTarget(a.target))!==canonical(p.target)||a.factsConfirmed!==true)throw new IntakeError('REVISION_CONFLICT');
      if(!validate(p).canApply)throw new IntakeError('VALIDATION_FAILED');const n=normalized(p),object=n.module==='think'?n.document:n.project,key=n.current.key??(n.module==='think'?keyOf(n.document.metadata.slug+'.md'):n.project.slug);
      const applying={...p,state:'applying' as const,intent:{candidateHash:candidateHash(p),documentHash:digest(canonical(object)),key}} as PendingProposal,intent=s.write(id,applying,current.revision);
      let revision:string;
      if(n.module==='think'){const w=n.current.key?options.think.saveThink({key,expectedRevision:n.current.revision,document:n.document}):options.think.createThink({document:n.document});if(!w.ok){if(!['FILE_OPERATION_FAILED','REVISION_CONFLICT'].includes(w.error.code))s.write(id,p,intent);throw new IntakeError(w.error.code);}revision=w.value.revision;}
      else{const request={project:n.project,expectedRevision:n.current.revision,...(n.current.key?{key}:{})},w=n.current.key?build().saveBuild(request):build().createBuild(request);if(!w.ok){if(!['FILE_OPERATION_FAILED','REVISION_CONFLICT'].includes(w.error.code))s.write(id,p,intent);throw new IntakeError(w.error.code);}revision=w.value.revision;}
      const receipt:Proposal={version:1,id,module:p.module,state:'applied',candidateHash:candidateHash(p),key,sourceRevision:revision};return view(receipt,s.write(id,receipt,intent));
    }),
    remove:(id:string,input:unknown)=>result(s=>{const a=record(input,['expectedProposalRevision']),current=read(s,id);if(current.p.state==='applying')throw new IntakeError('REVISION_CONFLICT');if(a.expectedProposalRevision!==current.revision)throw new IntakeError('REVISION_CONFLICT');s.remove(id,current.revision);return{removed:true};}),
    close(){closed=true;},
  };
}
const slug=(value:string)=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
