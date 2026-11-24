import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sha } from '../../studio/server/publish/support.ts';
import { githubGateway, runTitle } from '../../studio/server/publish/github.ts';
import type { GitHubTestTransport, UploadCommit, PublicationRun } from '../../studio/server/publish/github.ts';

const sha1=(c:string)=>c.repeat(40),id='12345678-1234-1234-1234-123456789abc';
const packet:UploadCommit={id,sha:sha1('1'),tree:sha1('2'),baseTree:sha1('3'),baseSha:sha1('4'),blobSha:sha1('5'),path:'src/modules/think/content/entry.md',bytes:Buffer.from('NON_SENSITIVE_CONTENT'),author:{name:'Fixture',email:'fixture@example.invalid',date:'2026-10-31T00:00:00Z'},message:'Publish think: entry\n'};
test('M23 GitHub upload proves every object and uses exact beforeOid / afterOid / force:false CAS',async()=>{
  const calls:{path:string;body:unknown}[]=[];let mismatch='';const transport:GitHubTestTransport={api:async(path,_method,body)=>{calls.push({path,body});if(path==='graphql')return mismatch==='race'?{errors:[{message:'stale'}]}:{data:{updateRefs:{clientMutationId:id}}};if(path.endsWith('/git/blobs'))return{sha:mismatch==='blob'?sha1('f'):packet.blobSha};if(path.endsWith('/git/trees'))return{sha:mismatch==='tree'?sha1('f'):packet.tree};if(path.endsWith('/git/commits'))return{sha:mismatch==='commit'?sha1('f'):packet.sha};return{node_id:'FIXTURE_REPO',permissions:{push:true}};},publicFile:async()=>{throw Error('Unexpected online');}};
  const gateway=githubGateway('.',transport);await gateway.push(packet);const mutation=calls.at(-1)!.body as{variables:{input:{refUpdates:unknown[]}}};assert.deepEqual(mutation.variables.input.refUpdates,[{name:'refs/heads/main',beforeOid:packet.baseSha,afterOid:packet.sha,force:false}]);
  for(const mode of['blob','tree','commit']){mismatch=mode;calls.length=0;await assert.rejects(gateway.push(packet));assert.equal(calls.some(c=>c.path==='graphql'),false);}mismatch='race';await assert.rejects(gateway.push(packet));
  calls.length=0;await assert.rejects(gateway.push({...packet,path:'src/modules/think/content/../../bad.md'}));assert.equal(calls.length,0);
});
test('M23 distinguishes GitHub checks, Pages deployment, failure and successful deployment', async () => {
  const run:PublicationRun={id:7,head_sha:sha1('1'),head_branch:'main',event:'workflow_dispatch',
    display_title:runTitle(id,sha1('1')),status:'in_progress',conclusion:null,run_attempt:2};
  let jobs:Record<string,string>[]=[];
  const gateway=githubGateway('.',{
    api:async path=>{assert.match(path,/runs\/7\/attempts\/2\/jobs$/);return {jobs};},
    publicFile:async()=>{throw Error('Unexpected public fetch');},
  });
  assert.equal(await gateway.deployment(run),'waiting');
  jobs=[{name:'Publish checked Pages artifact',status:'in_progress'}];
  assert.equal(await gateway.deployment(run),'deploying');
  run.status='completed';run.conclusion='failure';
  assert.equal(await gateway.deployment(run),'failed');
  run.conclusion='success';jobs[0].conclusion='skipped';
  assert.equal(await gateway.deployment(run),'failed');
  jobs[0].conclusion='success';
  assert.equal(await gateway.deployment(run),'success');
});

test('M23 verifies the deployed SHA and the one approved page without an archive or browser', async () => {
  const source=sha1('1'),html=Buffer.from('NON_SENSITIVE_ARTICLE');
  const run:PublicationRun={id:7,head_sha:source,head_branch:'main',event:'workflow_dispatch',
    display_title:runTitle(id,source),status:'completed',conclusion:'success'};
  const requested:string[]=[];let mode='';
  const gateway=githubGateway('.',{
    api:async()=>{throw Error('Unexpected API call');},
    publicFile:async url=>{
      const file=new URL(url).pathname;requested.push(file);
      if(file==='/release-manifest.json')return Buffer.from(JSON.stringify({version:1,
        source:mode==='sha'?sha1('f'):source,files:mode==='missing'?{}:{'think/entry/index.html':sha(html)}}));
      return mode==='online'?Buffer.from('STALE'):html;
    },
  });
  const target={module:'think',slug:'entry'} as const;
  await gateway.verify(run,target);
  assert.deepEqual(requested,['/release-manifest.json','/think/entry/']);
  for(const [failure,code] of [['sha','ONLINE_SOURCE_MISMATCH'],['missing','ONLINE_PAGE_NOT_RECORDED'],['online','ONLINE_FILE_MISMATCH']]){
    mode=failure;await assert.rejects(gateway.verify(run,target),{message:code});
  }
  await assert.rejects(gateway.verify(run,{...target,slug:'../../other'}),{message:'PUBLICATION_SCOPE_INVALID'});
});
