import{command,git,gitSha,sha,PublishError,publicPath}from'./support.ts';import{pagesFiles,sameCatalog,releaseIdentity}from'./artifact.ts';
import{allowedThinkFileName}from'../think/files.ts';
export const PUBLISH_REPOSITORY='hjk202/hjk202.github.io',PUBLISH_SITE='https://hjk202.github.io/',PUBLISH_GIT='https://github.com/hjk202/hjk202.github.io.git';
export type UploadCommit={id:string;sha:string;tree:string;baseTree:string;baseSha:string;blobSha:string;path:string;bytes:Buffer;author:{name:string;email:string;date:string};message:string};
export type PublicationRun={id:number;head_sha:string;head_branch:string;event:string;display_title:string;status:string;conclusion:string|null};
export interface PublicationGateway{
  repository:string;site:string;gitUrl:string;
  head():Promise<string>;fetch(candidate:string,sha:string):Promise<void>;writeAvailable():Promise<boolean>;
  readinessIssue?():Promise<string | undefined>;
  push(packet:UploadCommit):Promise<void>;dispatch(id:string,sha:string):Promise<void>;findRun(id:string,sha:string):Promise<PublicationRun|undefined>;inspectRun(runId:number):Promise<PublicationRun>;
  verify(run:PublicationRun,expected:Record<string,string>,candidate:string):Promise<{artifactId:number;artifactDigest:string}>;
}
export const runTitle=(id:string,sha:string)=>`Studio ${id} ${sha}`;
type Json=Record<string,unknown>;
/** Transport hooks are deterministic tests only; production has one fixed GitHub implementation. */
export type GitHubTestTransport={api(path:string,method:string,body?:unknown):Promise<Json>;archive(id:number):Promise<Buffer>;publicFile(url:string,max:number):Promise<Buffer>};
export function githubGateway(root:string,onlineSmoke:(candidate:string)=>Promise<void>,testing?:GitHubTestTransport):PublicationGateway{
  const endpoint='repos/'+PUBLISH_REPOSITORY;
  const api=async(path:string,method='GET',body?:unknown):Promise<Json>=>{
    if(testing)return testing.api(path,method,body);
    const data=await command('gh',['api','--hostname','github.com',path,'--method',method,'-H','X-GitHub-Api-Version: 2026-03-10',...(body===undefined?[]:['--input','-'])],root,{...(body===undefined?{}:{input:JSON.stringify(body)})});
    if(!data.length)return{};try{const json:unknown=JSON.parse(data.toString('utf8'));if(!json||typeof json!=='object'||Array.isArray(json))throw new Error();return json as Json;}catch{throw new PublishError('GITHUB_RESPONSE_INVALID');}
  };
  const run=(value:unknown):PublicationRun=>{if(!value||typeof value!=='object')throw new PublishError('RUN_INVALID');const r=value as PublicationRun;if(!Number.isSafeInteger(r.id)||r.id<1||!gitSha(r.head_sha)||typeof r.head_branch!=='string'||typeof r.event!=='string'||typeof r.display_title!=='string'||typeof r.status!=='string'||r.conclusion!==null&&typeof r.conclusion!=='string')throw new PublishError('RUN_INVALID');return r;};
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
    verify:async(r,expected,candidate)=>{
      const current=await inspectRun(r.id);if(current.head_sha!==r.head_sha||current.display_title!==r.display_title||current.head_branch!=='main'||current.event!=='workflow_dispatch'||current.status!=='completed'||current.conclusion!=='success')throw new PublishError('DEPLOYMENT_NOT_SUCCESSFUL');
      const list=await api(`${endpoint}/actions/runs/${r.id}/artifacts`);if(!Array.isArray(list.artifacts))throw new PublishError('ARTIFACT_MISSING');const artifacts=list.artifacts.filter((a:Json)=>a.name==='github-pages'&&a.expired===false);if(artifacts.length!==1)throw new PublishError('ARTIFACT_AMBIGUOUS');const a=artifacts[0] as Json,id=a.id,digest=a.digest;
      if(!Number.isSafeInteger(id)||Number(id)<1||typeof digest!=='string'||!/^sha256:[a-f0-9]{64}$/.test(digest)||(a.workflow_run as Json|undefined)?.head_sha!==r.head_sha)throw new PublishError('ARTIFACT_IDENTITY_INVALID');
      const zip=testing?await testing.archive(Number(id)):await command('gh',['api','--hostname','github.com',`${endpoint}/actions/artifacts/${id}/zip`],root,{maxOutputBytes:128*1024*1024});if('sha256:'+sha(zip)!==digest)throw new PublishError('ARTIFACT_DIGEST_MISMATCH');sameCatalog(pagesFiles(zip),expected);
      const manifest=await bounded(PUBLISH_SITE+'release-manifest.json?studio='+encodeURIComponent(String(r.id)),1024*1024);if(sha(manifest)!==expected['release-manifest.json'])throw new PublishError('ONLINE_SOURCE_MISMATCH');releaseIdentity(manifest,r.head_sha,expected);
      // Independent hashes of every served file, then actual browser behavior. No redirects or credentials.
      const queue=Object.keys(expected);await Promise.all(Array.from({length:4},async()=>{while(queue.length){const path=queue.shift()!;publicPath(path);const data=await bounded(PUBLISH_SITE+path.split('/').map(encodeURIComponent).join('/')+'?studio='+r.id);if(sha(data)!==expected[path])throw new PublishError('ONLINE_FILE_MISMATCH');}}));
      await onlineSmoke(candidate);return{artifactId:Number(id),artifactDigest:digest};
    },
  };
}
