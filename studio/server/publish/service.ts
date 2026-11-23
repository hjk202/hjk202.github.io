import fs from'node:fs';import{join,resolve,dirname,relative}from'node:path';import{randomUUID}from'node:crypto';
import type{EditorResult}from'../../contracts/result.ts';import type{ThinkAuthoring}from'../think/service.ts';import{openThinkAuthoring}from'../think/service.ts';import{createBuildAuthoring}from'../build/service.ts';import type{createIntake}from'../intake/service.ts';
import type{PublicationPlan,PublicationSelection,PublicationStatus}from'../../contracts/publish.ts';import{canonical,ProposalStore,record,hex,idValid}from'../intake/store.ts';import{localStorePathAsync}from'../../windows/local.ts';
import{command,git,gitSha,sha,fileBytes,safeDirectory,PublishError,catalog}from'./support.ts';import{githubGateway,PUBLISH_GIT,PUBLISH_REPOSITORY,runTitle}from'./github.ts';import type{PublicationGateway,UploadCommit,PublicationRun}from'./github.ts';import{publicationCheckers,guardPublicationAssets}from'./checks.ts';import{guardedWorkflow}from'./workflow.ts';
import{releaseIdentity}from'./artifact.ts';

type Options={repositoryRoot:string;think:ThinkAuthoring;build:ReturnType<typeof createBuildAuthoring>;intake:ReturnType<typeof createIntake>;receiptDirectory?:string;gateway?:PublicationGateway;verifyCandidate?:(candidate:string)=>Promise<void>;guardAssets?:(candidate:string,selection:PublicationSelection)=>Promise<void>;timeoutMs?:number};
/** Trusted test/startup hooks, never parsed from an HTTP request. */
export type PublicationOptions=Pick<Options,'receiptDirectory'|'gateway'|'verifyCandidate'|'guardAssets'|'timeoutMs'>;
type Memory={plan:PublicationPlan;selection:PublicationSelection;input:unknown;candidate:string;identity:fs.Stats;local:Projection;remote:Projection;path:string;tree:string;baseTree:string;blobSha:string;indexPath:string;indexHash:string;fileHashes?:Record<string,string>};
type Projection={key:string;fileName:string;expectedRevision:string|null;before:string|null;after:string};
const complete=new Set(['complete','failed','closed']);
const unwrap=<T>(r:EditorResult<T>):T=>{if(!r.ok)throw new PublishError('SOURCE_'+r.error.code,r.error.code);return r.value;};
function localDiff(before:string|null,after:string,path:string){
  if(before===after)return'';const a=(before??'').split('\n'),b=after.split('\n');let first=0;while(first<Math.min(a.length,b.length)&&a[first]===b[first])first++;let endA=a.length,endB=b.length;while(endA>first&&endB>first&&a[endA-1]===b[endB-1]){endA--;endB--;}
  const start=Math.max(0,first-3),tail=Math.min(3,a.length-endA,b.length-endB);return`--- local/${path}\n+++ approved/${path}\n@@ -${start+1},${endA-start+tail} +${start+1},${endB-start+tail} @@\n`+a.slice(start,first).map(s=>' '+s).concat(a.slice(first,endA).map(s=>'-'+s),b.slice(first,endB).map(s=>'+'+s),a.slice(endA,endA+tail).map(s=>' '+s)).join('\n');
}
/** One fixed public Think/Build publication. All paths/commands/target/auth stay in the backend. */
export function createPublisher(options:Options){
  const root=resolve(options.repositoryRoot),checks=publicationCheckers(root),gateway=options.gateway??githubGateway(root,checks.smoke),verify=options.verifyCandidate??checks.verify,assetGuard=options.guardAssets??guardPublicationAssets;
  const timeout=options.timeoutMs??30*60*1000;if(timeout<1||timeout>30*60*1000)throw new PublishError('INVALID_TIMEOUT');
  const plans=new Map<string,Memory>(),faults=new Map<string,PublicationStatus>();let preparing=false,active:Promise<void>|undefined,closed=false,interrupted=false,store:Promise<ProposalStore>|undefined;
  const continuing=()=>{if(interrupted)throw new PublishError('OWNER_LOST_AT_SAFE_BOUNDARY','PUBLISH_UNKNOWN');};
  const storage=()=>store??=Promise.resolve().then(async()=>new ProposalStore(options.receiptDirectory??join(dirname(await localStorePathAsync()),'publications',sha(fs.realpathSync.native(root)))));
  const result=async<T>(work:()=>Promise<T>):Promise<EditorResult<T>>=>{try{if(closed)throw new PublishError('SERVICE_CLOSED','SERVICE_CLOSED');return{ok:true,value:await work()};}catch(e){return{ok:false,error:{code:e instanceof PublishError?e.code:'PUBLISH_FAILED',message:e instanceof PublishError?e.message:'PUBLICATION_FAILED',issues:[]}};}};
  function statusValue(raw:unknown):PublicationStatus{
    const s=record(raw,['version','id','bindingHash','module','slug','repository','branch','phase','message','sourceState','commitState','pushState','dispatchState','sourceKey','sourceAfterRevision','remoteBaseSha','localHeadSha','commitSha','runId','artifactId','artifactDigest','live','fileHashes','observations','cleanupPending']);
    if(s.version!==1||!idValid(s.id)||!hex(s.bindingHash)||!['think','build'].includes(String(s.module))||typeof s.slug!=='string'||s.repository!==gateway.repository||s.branch!=='main'||!['prepared','committing','checking','saving','pushing','dispatching','deploying','verifying','complete','failed','unknown','closed'].includes(String(s.phase))||typeof s.message!=='string'||!hex(s.sourceAfterRevision)||!gitSha(s.remoteBaseSha)||!gitSha(s.localHeadSha)||typeof s.sourceKey!=='string'||typeof s.live!=='boolean'||['sourceState','commitState','pushState','dispatchState'].some(k=>!['not-started','in-flight','confirmed','unknown'].includes(String(s[k]))))throw new PublishError('PUBLICATION_RECEIPT_INVALID');
    if(s.commitSha!==undefined&&!gitSha(s.commitSha)||s.runId!==undefined&&(!Number.isSafeInteger(s.runId)||Number(s.runId)<1)||s.artifactId!==undefined&&(!Number.isSafeInteger(s.artifactId)||Number(s.artifactId)<1)||s.artifactDigest!==undefined&&(typeof s.artifactDigest!=='string'||!/^sha256:[a-f0-9]{64}$/.test(s.artifactDigest)))throw new PublishError('PUBLICATION_RECEIPT_INVALID');
    if(s.fileHashes!==undefined&&(!s.fileHashes||typeof s.fileHashes!=='object'||Array.isArray(s.fileHashes)||Object.keys(s.fileHashes).length>512||Object.values(s.fileHashes).some(v=>!hex(v))))throw new PublishError('PUBLICATION_RECEIPT_INVALID');
    if(s.cleanupPending!==undefined&&typeof s.cleanupPending!=='boolean'||s.live&&(s.phase!=='complete'||!s.commitSha||!s.runId||!s.artifactId||!s.artifactDigest||!s.fileHashes||['sourceState','commitState','pushState','dispatchState'].some(k=>s[k]!=='confirmed')))throw new PublishError('PUBLICATION_RECEIPT_INVALID');
    if(s.observations!==undefined&&(!Array.isArray(s.observations)||s.observations.length>8||s.observations.some(x=>typeof x!=='string'||x.length>256)))throw new PublishError('PUBLICATION_RECEIPT_INVALID');return s as unknown as PublicationStatus;
  }
  const read=async(id:string):Promise<PublicationStatus>=>{const fault=faults.get(id);if(fault)return fault;const s=await storage(),raw=s.read(id),value=statusValue(raw.value);if(value.id!==id)throw new PublishError('PUBLICATION_RECEIPT_INVALID');return{...value,revision:raw.revision,...(!active&&!preparing&&!complete.has(value.phase)&&value.phase!=='prepared'&&value.phase!=='unknown'?{phase:'unknown' as const,message:'没有正在执行的任务；这里只是最后确认边界，必须核对外部状态，不会自动恢复或重试。'}:{})};};
  const change=async(id:string,patch:Partial<PublicationStatus>)=>{const s=await storage(),current=await read(id),value:PublicationStatus={...current,...patch};delete value.revision;try{const revision=s.write(id,value,current.revision!);faults.delete(id);return{...value,revision};}catch{faults.set(id,{...current,phase:'unknown',live:false,message:'RECEIPT_WRITE_FAILED：无法记录最后边界，禁止盲重试，请先核对源和远端。'});throw new PublishError('RECEIPT_WRITE_FAILED','PUBLISH_UNKNOWN');}};
  function assertCandidate(m:Pick<Memory,'candidate'|'identity'>){const stat=safeDirectory(m.candidate);if(stat.dev!==m.identity.dev||stat.ino!==m.identity.ino)throw new PublishError('CANDIDATE_CHANGED','PUBLISH_STALE');}
  function cleanup(id:string,m:Pick<Memory,'candidate'|'identity'>){
    try{const parent=join(root,'.cache/studio/publication-work');safeDirectory(parent);assertCandidate(m);if(!idValid(id)||resolve(m.candidate)!==join(parent,id)||relative(fs.realpathSync.native(parent),fs.realpathSync.native(m.candidate))!==id)throw new PublishError('CANDIDATE_CHANGED');fs.rmSync(m.candidate,{recursive:true});return false;}catch{return true;}
  }
  async function selection(input:unknown):Promise<PublicationSelection>{
    const args=record(input,['proposalId','expectedProposalRevision','module','key','expectedSourceRevision']);
    if(args.proposalId!==undefined){if(!idValid(args.proposalId)||!hex(args.expectedProposalRevision)||Object.keys(args).length!==2)throw new PublishError('INVALID_PROPOSAL_REFERENCE','INVALID_REQUEST');return unwrap(await options.intake.publicationSnapshot(args.proposalId,args.expectedProposalRevision));}
    if(!hex(args.expectedSourceRevision)||typeof args.key!=='string'||Object.keys(args).length!==3)throw new PublishError('INVALID_SOURCE_REFERENCE','INVALID_REQUEST');
    if(args.module==='think'){const r=unwrap(options.think.readThink({key:args.key}));if(!r.document||!r.editable||r.revision!==args.expectedSourceRevision)throw new PublishError('SOURCE_CHANGED','PUBLISH_STALE');return{module:'think',key:args.key,document:{...r.document,metadata:{...r.document.metadata,published:true}},expectedSourceRevision:r.revision};}
    if(args.module==='build'){const r=unwrap(options.build.readBuild(args.key));if(r.revision!==args.expectedSourceRevision)throw new PublishError('SOURCE_CHANGED','PUBLISH_STALE');return{module:'build',key:args.key,project:{...r.project,published:true},expectedSourceRevision:r.revision};}
    throw new PublishError('INVALID_MODULE','INVALID_REQUEST');
  }
  function projection(s:PublicationSelection,think:ThinkAuthoring,build:ReturnType<typeof createBuildAuthoring>):Projection{
    if(s.module==='think'){if(!think.preparePublication)throw new PublishError('SOURCE_ADAPTER_NOT_READY');return unwrap(think.preparePublication({document:s.document,...(s.key?{key:s.key,expectedRevision:s.expectedSourceRevision}:{})}));}
    return unwrap(build.preparePublication({project:s.project,expectedRevision:s.expectedSourceRevision,...(s.key?{key:s.key}:{})}));
  }
  async function unchanged(m:Memory,remote=false){
    continuing();
    assertCandidate(m);if(await git(root,['rev-parse','HEAD'])!==m.plan.localHeadSha||sha(fileBytes(m.indexPath))!==m.indexHash)throw new PublishError('LOCAL_GIT_CHANGED','PUBLISH_STALE');
    const current=await selection(m.input);if(canonical(current)!==canonical(m.selection))throw new PublishError('APPROVAL_SOURCE_CHANGED','PUBLISH_STALE');
    const p=projection(current,options.think,options.build);if(sha(p.after)!==sha(m.local.after)||p.expectedRevision!==m.local.expectedRevision)throw new PublishError('SOURCE_CHANGED','PUBLISH_STALE');
    if(remote&&await gateway.head()!==m.plan.remoteBaseSha)throw new PublishError('REMOTE_HEAD_CHANGED','PUBLISH_STALE');
  }
  async function landed(m:Memory){
    continuing();
    if(await git(root,['rev-parse','HEAD'])!==m.plan.localHeadSha||sha(fileBytes(m.indexPath))!==m.indexHash)throw new PublishError('LOCAL_GIT_CHANGED','PUBLISH_STALE');
    const observed=m.selection.module==='think'?unwrap(options.think.readThink({key:m.local.key})).revision:unwrap(options.build.listBuild()).revision;if(observed!==sha(m.local.after))throw new PublishError('SOURCE_CHANGED_AFTER_SAVE','PUBLISH_STALE');
  }
  async function run(id:string,m:Memory){
    try{
      await unchanged(m,true);const identityName=await git(root,['config','user.name']),email=await git(root,['config','user.email']);
      if(!identityName||identityName.length>256||/[<>\r\n]/.test(identityName)||!email||email.length>256||!/^\S+@\S+$/.test(email)||/[<>\r\n]/.test(email))throw new PublishError('GIT_AUTHOR_NOT_CONFIGURED','PUBLISH_NOT_READY');
      const epoch=Math.floor(Date.now()/1000),author={name:identityName,email,date:new Date(epoch*1000).toISOString().replace('.000Z','Z')},message=`Publish ${m.selection.module}: ${m.plan.slug}\n`;
      let commit=m.plan.remoteBaseSha;
      await change(id,{phase:'committing',message:'正在为精确内容创建隔离提交；开发分支和暂存区保持。',commitState:'in-flight'});
      if(m.plan.remoteDiff){const raw=`tree ${m.tree}\nparent ${m.plan.remoteBaseSha}\nauthor ${identityName} <${email}> ${epoch} +0000\ncommitter ${identityName} <${email}> ${epoch} +0000\n\n${message}`;commit=await git(m.candidate,['hash-object','-t','commit','-w','--stdin'],{input:raw});if(!gitSha(commit))throw new PublishError('COMMIT_INVALID');await git(m.candidate,['update-ref','HEAD',commit,m.plan.remoteBaseSha]);}
      await change(id,{commitSha:commit,commitState:'confirmed',phase:'checking',message:'正在检查同一冻结提交（依赖、浏览器、lint/types/test/build、完整网站与边界），可能需要数分钟。'});
      await assetGuard(m.candidate,m.selection);continuing();await verify(m.candidate);continuing();
      assertCandidate(m);if(await git(m.candidate,['rev-parse','HEAD'])!==commit||await git(m.candidate,['diff','--name-only','HEAD'])||await git(m.candidate,['diff','--cached','--name-only']))throw new PublishError('CHECKED_SOURCE_CHANGED','PUBLISH_STALE');
      m.fileHashes=catalog(join(m.candidate,'dist'));releaseIdentity(fileBytes(join(m.candidate,'dist/release-manifest.json'),1024*1024),commit,m.fileHashes);
      await unchanged(m,true);
      await change(id,{phase:'saving',message:'检查通过，正在保存最终批准的本机源码；其他改动保留。',sourceState:'in-flight',fileHashes:m.fileHashes});
      if(m.selection.proposal)unwrap(await options.intake.reservePublication(m.selection.proposal.id,m.selection.proposal.revision,m.selection.proposal.candidateHash));
      let sourceRevision:string;
      if(m.selection.module==='think'){const s=m.selection,w=s.key?options.think.saveThink({key:s.key,expectedRevision:s.expectedSourceRevision,document:s.document}):options.think.createThink({document:s.document});sourceRevision=unwrap(w).revision;}
      else{const s=m.selection;sourceRevision=unwrap(options.build.publishBuild({project:s.project,expectedRevision:s.expectedSourceRevision,...(s.key?{key:s.key}:{})})).revision;}
      if(sourceRevision!==sha(m.local.after))throw new PublishError('SOURCE_RESULT_UNCONFIRMED','PUBLISH_UNKNOWN');
      await change(id,{sourceState:'confirmed',phase:'pushing',message:'本机源码已保存；正在核对上传边界。'});
      if(m.selection.proposal)unwrap(await options.intake.read(m.selection.proposal.id));
      await landed(m);if(await gateway.head()!==m.plan.remoteBaseSha)throw new PublishError('GIT_TARGET_CHANGED','PUBLISH_STALE');
      await change(id,{pushState:'in-flight',message:'正在上传获批对象并原子前移远端 main。'});
      if(m.plan.remoteDiff){const packet:UploadCommit={id,sha:commit,tree:m.tree,baseTree:m.baseTree,baseSha:m.plan.remoteBaseSha,blobSha:m.blobSha,path:m.path,bytes:fileBytes(join(m.candidate,m.path)),author,message};await gateway.push(packet);}
      if(await gateway.head()!==commit)throw new PublishError('PUSH_RESULT_UNCONFIRMED','PUBLISH_UNKNOWN');
      await change(id,{pushState:'confirmed',phase:'dispatching',message:'远端 main 已确认；正在核对部署边界。'});await landed(m);
      await change(id,{dispatchState:'in-flight',message:'正在触发带精确 SHA 守卫的 Pages 流程。'});
      continuing();await gateway.dispatch(id,commit);await change(id,{dispatchState:'confirmed',phase:'deploying',message:'已请求部署，正在核对唯一请求对应的 run 与受检产物。'});continuing();
      const deadline=Date.now()+timeout;let r:PublicationRun|undefined;
      while(Date.now()<deadline){continuing();r=r?await gateway.inspectRun(r.id):await gateway.findRun(id,commit);if(r){if(r.head_sha!==commit||r.head_branch!=='main'||r.event!=='workflow_dispatch'||r.display_title!==runTitle(id,commit))throw new PublishError('RUN_SOURCE_MISMATCH','PUBLISH_STALE');await change(id,{runId:r.id});if(r.status==='completed')break;}await new Promise(resolve=>setTimeout(resolve,2000));}
      if(!r||r.status!=='completed')throw new PublishError('DEPLOYMENT_RESULT_UNCONFIRMED','PUBLISH_UNKNOWN');if(r.conclusion!=='success')throw new PublishError('DEPLOYMENT_FAILED');
      await change(id,{phase:'verifying',message:'部署 run 成功；正在核对本机/下载产物/线上文件与两引擎页面。'});
      continuing();const proof=await gateway.verify(r,m.fileHashes,m.candidate),cleanupPending=cleanup(id,m);await change(id,{phase:'complete',message:'已核验上线：获批 SHA、同一受检产物、线上文件和浏览器均匹配。'+(cleanupPending?' 自有派生检查目录未能清理，请按回执 id 核对。':''),live:true,cleanupPending,...proof});
    }catch(error){
      const current=await read(id),patch:Partial<PublicationStatus>={phase:error instanceof PublishError&&error.code==='PUBLISH_STALE'?'failed':current.sourceState==='in-flight'||current.pushState==='in-flight'||current.dispatchState==='in-flight'||error instanceof PublishError&&error.code==='PUBLISH_UNKNOWN'?'unknown':'failed',message:error instanceof PublishError?error.message:'PUBLICATION_FAILED',live:false};
      for(const key of ['sourceState','commitState','pushState','dispatchState'] as const)if(current[key]==='in-flight')patch[key]='unknown';await change(id,patch);
    }
  }
  return{
    busy:()=>preparing||!!active,
    prepare:(input:unknown)=>result(async()=>{
      if(preparing||active||plans.size>=4)throw new PublishError('PUBLICATION_BUSY','PUBLISH_BUSY');preparing=true;let disposable:({id:string}&Pick<Memory,'candidate'|'identity'>)|undefined;
      try{
        safeDirectory(root);if(!options.gateway){const origin=await git(root,['remote','get-url','origin']);if(![PUBLISH_GIT,PUBLISH_GIT.replace('.git',''),'git@github.com:'+PUBLISH_REPOSITORY+'.git'].includes(origin))throw new PublishError('PUBLICATION_TARGET_INVALID','PUBLISH_NOT_READY');}
        const s=await selection(input),local=projection(s,options.think,options.build),localHeadSha=await git(root,['rev-parse','HEAD']);if(!gitSha(localHeadSha))throw new PublishError('LOCAL_HEAD_INVALID');
        const indexPath=resolve(root,await git(root,['rev-parse','--git-path','index'])),indexHash=sha(fileBytes(indexPath));
        const id=randomUUID(),remoteBaseSha=await gateway.head(),work=join(root,'.cache/studio/publication-work');for(const path of [join(root,'.cache'),join(root,'.cache/studio'),work])safeDirectory(path,true);
        // The published parent comes from main, so there is no need to copy the author's local Git history.
        const candidate=join(work,id);fs.mkdirSync(candidate);const identity=safeDirectory(candidate);disposable={id,candidate,identity};
        await git(candidate,['init','--quiet','--template=']);await git(candidate,['config','core.hooksPath',join(candidate,'.cache/no-hooks')]);
        await git(candidate,['config','core.autocrlf','false']); // Use committed bytes regardless of Windows global Git settings.
        await gateway.fetch(candidate,remoteBaseSha);await git(candidate,['checkout','--detach',remoteBaseSha]);
        const opened=openThinkAuthoring(candidate);if(!opened.ok)throw new PublishError('CANDIDATE_SOURCE_UNAVAILABLE');const remoteThink=opened.value,remoteBuild=createBuildAuthoring(candidate);let remote:Projection;
        try{
          if(s.module==='think'){const entries=unwrap(remoteThink.listThink()),entry=entries.find(e=>e.slug===s.document.metadata.slug);if(s.proposal&&!s.key&&entry)throw new PublishError('REMOTE_DUPLICATE_SLUG','DUPLICATE_SLUG');remote=unwrap(remoteThink.preparePublication!({document:s.document,...(entry?{key:entry.key,expectedRevision:entry.revision}:{})}));}
          else{const list=unwrap(remoteBuild.listBuild()),entry=list.entries.find(e=>e.slug===s.project.slug);if(s.proposal&&!s.key&&entry)throw new PublishError('REMOTE_DUPLICATE_SLUG','DUPLICATE_SLUG');remote=unwrap(remoteBuild.preparePublication({project:s.project,expectedRevision:list.revision,...(entry?{key:entry.slug}:{})}));}
        }finally{remoteThink.close();remoteBuild.close();}
        const path=s.module==='think'?'src/modules/think/content/'+remote.fileName:'src/modules/build/data.ts',target=join(candidate,path);if(remote.before!==null&&fileBytes(target).toString('utf8')!==remote.before||remote.before===null&&fs.existsSync(target))throw new PublishError('CANDIDATE_CHANGED','PUBLISH_STALE');
        fs.writeFileSync(target,remote.after,{flag:remote.before===null?'wx':'w'});await git(candidate,['add','--',path]);
        const names=(await git(candidate,['diff','--cached','--name-only','-z'])).split('\0').filter(Boolean);if(names.some(name=>name!==path))throw new PublishError('UNAPPROVED_CANDIDATE_FILES');
        const staged=await command('git',['show',':'+path],candidate,{maxOutputBytes:16*1024*1024});fs.writeFileSync(target,staged);const mode=(await git(candidate,['ls-files','--stage','--',path])).split(' ')[0];if(mode!=='100644')throw new PublishError('UNSUPPORTED_CONTENT_MODE');
        const tree=await git(candidate,['write-tree']),baseTree=await git(candidate,['rev-parse',remoteBaseSha+'^{tree}']),blobSha=await git(candidate,['rev-parse',':'+path]);
        const remoteDiff=await git(candidate,['diff','--cached','--no-ext-diff','--no-color','--',path]),landingPath=s.module==='think'?'src/modules/think/content/'+local.fileName:'src/modules/build/data.ts',diff=localDiff(local.before,local.after,landingPath);if(Buffer.byteLength(remoteDiff)+Buffer.byteLength(diff)>1024*1024)throw new PublishError('DIFF_LIMIT','PUBLISH_TOO_LARGE');
        const issues:string[]=[];try{if(!guardedWorkflow(fileBytes(join(candidate,'.github/workflows/deploy.yml'),1024*1024).toString('utf8'))||!fs.existsSync(join(candidate,'scripts/release/record.mjs')))issues.push('REMOTE_WORKFLOW_NOT_READY：需先另获许可发布本版 SHA 守卫和产物记录脚本；当前只能审核差异。');}catch{issues.push('REMOTE_WORKFLOW_NOT_READY');}
        const githubIssue=gateway.readinessIssue?await gateway.readinessIssue():!await gateway.writeAvailable()?'GITHUB_WRITE_UNAVAILABLE：本机 gh 需要现有仓库写入和 Actions 权限。':undefined;
        if(githubIssue)issues.push(githubIssue);
        if(s.module==='think' && s.document.body.includes('./assets/')){
          const {createSatteriMarkdownProcessor}=await import('@astrojs/markdown-satteri');
          const {metadata}=await (await createSatteriMarkdownProcessor({syntaxHighlight:false})).render(s.document.body);
          const assets=metadata.localImagePaths.filter(path=>/^\.\/assets\/[a-f0-9]{64}\.(?:png|jpg|gif|webp)$/.test(path));
          for(const link of assets){
            try {
              const path='src/modules/think/content/'+link.slice(2);
              if(sha(fileBytes(join(candidate,path),2*1024*1024))===link.slice(9,73))continue;
            }catch{ /* The approved article commit cannot include unreviewed assets. */ }
            issues.push('PUBLICATION_IMAGE_NOT_ON_MAIN：文章引用的本机图片尚未进入远端 main。请先单独审核并同步该图片。');
            break;
          }
        }
        const store=await storage();for(const entry of store.list()){const status=await read(entry.id);if(!complete.has(status.phase)&&status.phase!=='prepared')issues.push('PREVIOUS_PUBLICATION_UNCONFIRMED：先核对旧发布记录，禁止盲重试。');}
        const slug=s.module==='think'?s.document.metadata.slug:s.project.slug,bindingHash=sha(canonical([s,local.expectedRevision,sha(local.after),remoteBaseSha,tree,localHeadSha,indexHash,gateway.repository,'main']));
        const plan:PublicationPlan={id,bindingHash,module:s.module,slug,repository:gateway.repository,branch:'main',site:gateway.site,remoteBaseSha,localHeadSha,remoteDiff,localDiff:diff,canExecute:issues.length===0,issues};
        const memory:Memory={plan,selection:s,input:structuredClone(input),candidate,identity,local,remote,path,tree,baseTree,blobSha,indexPath,indexHash};await unchanged(memory,true);
        const status:PublicationStatus={version:1,id,bindingHash,module:s.module,slug,repository:gateway.repository,branch:'main',phase:'prepared',message:plan.canExecute?'等待本人批准精确差异。':'尚不满足执行条件；没有提交或部署。',sourceState:'not-started',commitState:'not-started',pushState:'not-started',dispatchState:'not-started',sourceKey:local.key,sourceAfterRevision:sha(local.after),remoteBaseSha,localHeadSha,live:false};store.write(id,status,null);plans.set(id,memory);return plan;
      }finally{if(disposable&&!plans.has(disposable.id))cleanup(disposable.id,disposable);preparing=false;}
    }),
    execute:(id:string,input:unknown)=>result(async()=>{
      const args=record(input,['bindingHash','approvePublication']),m=plans.get(id);if(!m||!m.plan.canExecute||args.bindingHash!==m.plan.bindingHash||args.approvePublication!==true)throw new PublishError('APPROVAL_INVALID','PUBLISH_STALE');
      if(preparing||active)throw new PublishError('PUBLICATION_BUSY','PUBLISH_BUSY');preparing=true;try{const current=await read(id);if(current.phase!=='prepared')throw new PublishError('PUBLICATION_ALREADY_STARTED','PUBLISH_STALE');await unchanged(m,true);
      await change(id,{phase:'committing',message:'最终批准已接收，执行固定发布步骤。'});active=run(id,m).catch(()=>{if(!faults.has(id))faults.set(id,{...current,phase:'unknown',live:false,message:'PUBLICATION_BOUNDARY_UNCONFIRMED：请先核对，禁止重试。'});}).finally(()=>{active=undefined;plans.delete(id);});return read(id);}finally{preparing=false;}
    }),
    status:(id:string)=>result(()=>read(id)),
    list:()=>result(async()=>{const s=await storage();return Promise.all(s.list().map(e=>read(e.id)));}),
    reconcile:(id:string)=>result(async()=>{const s=await read(id);if(active||preparing)throw new PublishError('PUBLICATION_BUSY','PUBLISH_BUSY');const observations=['REMOTE_HEAD '+await gateway.head()];if(s.commitSha){const r=s.runId?await gateway.inspectRun(s.runId):await gateway.findRun(id,s.commitSha);if(r){if(r.head_sha!==s.commitSha||r.display_title!==runTitle(id,s.commitSha)||r.head_branch!=='main'||r.event!=='workflow_dispatch')throw new PublishError('RUN_SOURCE_MISMATCH','PUBLISH_STALE');observations.push(`RUN ${r.id} ${r.status} ${r.conclusion??'pending'}`);await change(id,{runId:r.id});}}return change(id,{observations});}),
    verifyAgain:(id:string)=>result(async()=>{
      if(active||preparing)throw new PublishError('PUBLICATION_BUSY','PUBLISH_BUSY');const s=await read(id);if(!s.runId||!s.commitSha||!s.fileHashes||s.sourceState!=='confirmed'||s.commitState!=='confirmed')throw new PublishError('NO_CHECKED_RUN','PUBLISH_NOT_READY');preparing=true;
      try{const run=await gateway.inspectRun(s.runId);if(run.head_sha!==s.commitSha||run.display_title!==runTitle(id,s.commitSha)||run.head_branch!=='main'||run.event!=='workflow_dispatch')throw new PublishError('RUN_SOURCE_MISMATCH','PUBLISH_STALE');const proof=await gateway.verify(run,s.fileHashes,root);return change(id,{...proof,pushState:'confirmed',dispatchState:'confirmed',phase:'complete',live:true,message:'只重跑安全核对，未重复提交/上传/触发部署；获批产物与当前线上核验匹配。'});}finally{preparing=false;}
    }),
    closeRecord:(id:string,input:unknown)=>result(async()=>{if(active||preparing)throw new PublishError('PUBLICATION_BUSY','PUBLISH_BUSY');const a=record(input,['expectedStatusRevision','acknowledgeUnverified']),s=await read(id);if(a.expectedStatusRevision!==s.revision||a.acknowledgeUnverified!==true||s.phase==='complete')throw new PublishError('RECEIPT_CHANGED','PUBLISH_STALE');const m=plans.get(id),cleanupPending=m?cleanup(id,m):s.cleanupPending;plans.delete(id);return change(id,{phase:'closed',message:'本人已核对并结束此记录，未认证为已上线；不重试任何 Git 或部署副作用。',live:false,...(cleanupPending===undefined?{}:{cleanupPending})});}),
    remove:(id:string,input:unknown)=>result(async()=>{if(active||preparing)throw new PublishError('PUBLICATION_BUSY','PUBLISH_BUSY');const a=record(input,['expectedStatusRevision']),s=await read(id);if(a.expectedStatusRevision!==s.revision||!complete.has(s.phase))throw new PublishError('RECEIPT_NOT_SETTLED','PUBLISH_STALE');(await storage()).remove(id,s.revision!);plans.delete(id);return{removed:true};}),
    async close(){if(preparing||active)throw new PublishError('PUBLICATION_BUSY','PUBLISH_BUSY');for(const[id,m]of plans)cleanup(id,m);closed=true;plans.clear();},
    async abandon(){interrupted=true;closed=true;while(preparing)await new Promise(resolve=>setTimeout(resolve,20));await active;plans.clear();},
  };
}
