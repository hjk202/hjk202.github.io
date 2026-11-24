import{command,git,gitSha,sha,PublishError}from'./support.ts';
import{allowedThinkFileName}from'../think/files.ts';
import type{PublicationStatus}from'../../contracts/publish.ts';
export const PUBLISH_REPOSITORY='hjk202/hjk202.github.io',PUBLISH_SITE='https://hjk202.github.io/',PUBLISH_GIT='https://github.com/hjk202/hjk202.github.io.git';
export type UploadCommit={id:string;sha:string;tree:string;baseTree:string;baseSha:string;blobSha:string;path:string;bytes:Buffer;author:{name:string;email:string;date:string};message:string};
export type PublicationRun={id:number;head_sha:string;head_branch:string;event:string;display_title:string;status:string;conclusion:string|null;run_attempt?:number};
export interface PublicationGateway{
  repository:string;site:string;gitUrl:string;
  head():Promise<string>;fetch(candidate:string,sha:string):Promise<void>;writeAvailable():Promise<boolean>;
  readinessIssue?():Promise<string | undefined>;
  push(packet:UploadCommit):Promise<void>;dispatch(id:string,sha:string):Promise<void>;findRun(id:string,sha:string):Promise<PublicationRun|undefined>;inspectRun(runId:number):Promise<PublicationRun>;
  deployment(run:PublicationRun):Promise<'waiting'|'deploying'|'success'|'failed'>;
  verify(run:PublicationRun,target:Pick<PublicationStatus,'module'|'slug'>):Promise<void>;
}
export const runTitle=(id:string,sha:string)=>`Studio ${id} ${sha}`;
type Json=Record<string,unknown>;
/** Transport hooks are deterministic tests only; production has one fixed GitHub implementation. */
export type GitHubTestTransport={api(path:string,method:string,body?:unknown):Promise<Json>;publicFile(url:string,max:number):Promise<Buffer>};
export function githubGateway(root:string,testing?:GitHubTestTransport):PublicationGateway{
  const endpoint='repos/'+PUBLISH_REPOSITORY;
  const api=async(path:string,method='GET',body?:unknown):Promise<Json>=>{
    if(testing)return testing.api(path,method,body);
    const data=await command('gh',['api','--hostname','github.com',path,'--method',method,'-H','X-GitHub-Api-Version: 2026-03-10',...(body===undefined?[]:['--input','-'])],root,{...(body===undefined?{timeout:15000}:{input:JSON.stringify(body)})});
    if(!data.length)return{};try{const json:unknown=JSON.parse(data.toString('utf8'));if(!json||typeof json!=='object'||Array.isArray(json))throw new Error();return json as Json;}catch{throw new PublishError('GITHUB_RESPONSE_INVALID');}
  };
  const run=(value:unknown):PublicationRun=>{if(!value||typeof value!=='object')throw new PublishError('RUN_INVALID');const r=value as PublicationRun;if(!Number.isSafeInteger(r.id)||r.id<1||!gitSha(r.head_sha)||typeof r.head_branch!=='string'||typeof r.event!=='string'||typeof r.display_title!=='string'||typeof r.status!=='string'||r.conclusion!==null&&typeof r.conclusion!=='string'||r.run_attempt!==undefined&&(!Number.isSafeInteger(r.run_attempt)||r.run_attempt<1))throw new PublishError('RUN_INVALID');return r;};
  const inspectRun=async(id:number)=>{if(!Number.isSafeInteger(id)||id<1)throw new PublishError('RUN_INVALID');const r=run(await api(`${endpoint}/actions/runs/${id}`));if(r.id!==id)throw new PublishError('RUN_INVALID');return r;};
  async function bounded(url:string,max=32*1024*1024):Promise<Buffer>{
    if(testing)return testing.publicFile(url,max);
    const response=await fetch(url,{redirect:'error',cache:'no-store',credentials:'omit',headers:{'Cache-Control':'no-cache','Accept-Encoding':'identity'},signal:AbortSignal.timeout(30000)});
    if(!response.ok||!response.body){await response.body?.cancel();throw new PublishError('ONLINE_NOT_READY');}
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>max){await reader.cancel();throw new PublishError('ONLINE_RESOURCE_LIMIT');}chunks.push(next.value);}}finally{reader.releaseLock();}return Buffer.concat(chunks);
  }
  return{
    repository:PUBLISH_REPOSITORY,site:PUBLISH_SITE,gitUrl:PUBLISH_GIT,
    head:async()=>{const text=await git(root,['ls-remote','--refs',PUBLISH_GIT,'refs/heads/main']);const match=/^([a-f0-9]{40})\s+refs\/heads\/main$/.exec(text);if(!match)throw new PublishError('REMOTE_MAIN_INVALID');return match[1]!;},
    fetch:async(candidate,sha)=>{if(!gitSha(sha))throw new PublishError('REMOTE_MAIN_INVALID');await git(candidate,['fetch','--depth=1','--no-tags',PUBLISH_GIT,sha]);},
    writeAvailable:async()=>{try{const r=await api(endpoint);return!!(r.permissions&&typeof r.permissions==='object'&&(r.permissions as Json).push===true&&typeof r.node_id==='string');}catch{return false;}},
    ...(!testing ? { readinessIssue:async()=>{
      try { await command('gh',['--version'],root,{timeout:5000}); }
      catch { return 'GITHUB_CLI_UNAVAILABLE：Studio 找不到 GitHub CLI。请安装 gh，确认桌面进程可从 PATH 找到它，再重开 Studio。'; }
      try { await command('gh',['auth','status','--hostname','github.com'],root,{timeout:15000}); }
      catch { return 'GITHUB_AUTH_UNAVAILABLE：请在本机登录 GitHub CLI，再重新准备发布。'; }
      try {
        const result=await api(endpoint);
        if((result.permissions as Json|undefined)?.push===true && typeof result.node_id==='string')return undefined;
        return 'GITHUB_WRITE_UNAVAILABLE：当前 GitHub 身份没有仓库写入权限。';
      } catch { return 'GITHUB_ACCESS_UNAVAILABLE：无法核对仓库权限，请检查网络或凭据授权。'; }
    } } : {}),
    push:async packet=>{
      // Upload exactly the checked objects; atomic beforeOid + force:false rejects races and non-FF.
      if(![packet.sha,packet.tree,packet.baseTree,packet.baseSha,packet.blobSha].every(gitSha)||packet.path!=='src/modules/build/data.ts'&&(!packet.path.startsWith('src/modules/think/content/')||!allowedThinkFileName(packet.path.slice('src/modules/think/content/'.length))))throw new PublishError('PUBLICATION_SCOPE_INVALID');
      const repo=await api(endpoint);if(typeof repo.node_id!=='string')throw new PublishError('GITHUB_WRITE_UNAVAILABLE');
      const blob=await api(endpoint+'/git/blobs','POST',{content:packet.bytes.toString('base64'),encoding:'base64'});if(blob.sha!==packet.blobSha)throw new PublishError('GITHUB_BLOB_MISMATCH');
      const tree=await api(endpoint+'/git/trees','POST',{base_tree:packet.baseTree,tree:[{path:packet.path,mode:'100644',type:'blob',sha:packet.blobSha}]});if(tree.sha!==packet.tree)throw new PublishError('GITHUB_TREE_MISMATCH');
      const commit=await api(endpoint+'/git/commits','POST',{message:packet.message,tree:packet.tree,parents:[packet.baseSha],author:packet.author,committer:packet.author});if(commit.sha!==packet.sha)throw new PublishError('GITHUB_COMMIT_MISMATCH');
      const r=await api('graphql','POST',{query:'mutation($input:UpdateRefsInput!){updateRefs(input:$input){clientMutationId}}',variables:{input:{repositoryId:repo.node_id,clientMutationId:packet.id,refUpdates:[{name:'refs/heads/main',beforeOid:packet.baseSha,afterOid:packet.sha,force:false}]}}});
      if(r.errors)throw new PublishError('REMOTE_HEAD_CHANGED','PUBLISH_STALE');
      if(((r.data as Json|undefined)?.updateRefs as Json|undefined)?.clientMutationId!==packet.id)throw new PublishError('REMOTE_UPDATE_UNCONFIRMED','PUBLISH_UNKNOWN');
    },
    dispatch:async(id,sha)=>{await api(endpoint+'/actions/workflows/deploy.yml/dispatches','POST',{ref:'main',inputs:{expected_sha:sha,studio_request:id}});},
    findRun:async(id,sha)=>{const rows=await api(endpoint+'/actions/workflows/deploy.yml/runs?event=workflow_dispatch&branch=main&per_page=100');if(!Array.isArray(rows.workflow_runs))throw new PublishError('RUN_INVALID');const matches=rows.workflow_runs.map(run).filter(r=>r.display_title===runTitle(id,sha));if(matches.length>1)throw new PublishError('RUN_AMBIGUOUS');return matches[0];},
    inspectRun,
    deployment:async r=>{
      if(r.status==='queued'||r.status==='requested'||r.status==='pending'||r.status==='waiting')return 'waiting';
      if(r.status==='completed'&&r.conclusion!=='success')return 'failed';
      const list=await api(`${endpoint}/actions/runs/${r.id}/attempts/${r.run_attempt??1}/jobs`);
      if(!Array.isArray(list.jobs))throw new PublishError('GITHUB_RESPONSE_INVALID');
      const deploy=list.jobs.find(job=>job.name==='Publish checked Pages artifact');
      if(r.status==='completed')return deploy?.conclusion==='success'?'success':'failed';
      return deploy?.status==='in_progress'?'deploying':'waiting';
    },
    verify:async(r,{module,slug})=>{
      if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!['think','build'].includes(module))throw new PublishError('PUBLICATION_SCOPE_INVALID');
      const suffix='?studio='+r.id;
      const bytes=await bounded(PUBLISH_SITE+'release-manifest.json'+suffix,1024*1024);
      let manifest:Json;try{manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
      catch{throw new PublishError('ONLINE_MANIFEST_INVALID');}
      if(!manifest||manifest.version!==1||manifest.source!==r.head_sha)throw new PublishError('ONLINE_SOURCE_MISMATCH');
      const route=`${module}/${slug}/`;
      const expected=(manifest.files as Json|undefined)?.[route+'index.html'];
      if(typeof expected!=='string'||!/^[a-f0-9]{64}$/.test(expected))throw new PublishError('ONLINE_PAGE_NOT_RECORDED');
      if(sha(await bounded(PUBLISH_SITE+route+suffix,4*1024*1024))!==expected)throw new PublishError('ONLINE_FILE_MISMATCH');
    },
  };
}
