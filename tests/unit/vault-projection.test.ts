import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateVaultProjection, combineVaultProjection } from '../../src/core/search/vault-projection.ts';
import { search } from '../../src/core/search/search.ts';
import { compassStatistics } from '../../src/shell/home/geometry.ts';
import type { SearchIndex } from '../../src/core/search/types.ts';
import type { VaultView } from '../../src/core/vault/types.ts';
const module={id:'observatory',name:'Observatory',route:'/observatory/',order:50,icon:'M0 0',count:0};
const id='c'.repeat(32);
const result={module:module.id,title:'私人数学',description:'non-sensitive',url:`/observatory/#vault=${id}`};
const view:VaultView={count:n=>n+2,search:()=>[result],hasTarget:target=>target===id,mount(){},dispose(){}};
test('private projection checks owned targets and rejects bad adapters without weakening public paths',()=>{
  validateVaultProjection(module,view);
  for(const url of ['/think/#vault='+id,'https://example.com','/observatory/unknown/','/observatory/#vault='+'d'.repeat(32),'/observatory/#bad','/observatory/../me/']) assert.throws(()=>validateVaultProjection(module,{...view,search:()=>[{...result,url}]}));
  for(const count of [-1,0.1,NaN,Infinity])assert.throws(()=>validateVaultProjection(module,{...view,count:()=>count}));
  assert.throws(()=>validateVaultProjection(module,{...view,search:()=>[{...result,module:'disabled'}]}));
  assert.throws(()=>validateVaultProjection(module,{...view,search:()=>[{...result,body:'unexpected'}]}));
});
test('combined counts include zero peers and private description sharing a public target stays searchable',()=>{
  const index:SearchIndex={modules:[module,{...module,id:'me',route:'/me/',count:1,compassStatistic:'peer-average'}],results:[{module:'me',title:'Me',description:'public',url:'/me/'}]};
  const before=JSON.stringify(index),views=new Map([['observatory',view],['me',{...view,count:(n:number)=>n,search:()=>[{module:'me',title:'Me',description:'私人资料',url:'/me/'}]}]]);
  const projection=combineVaultProjection(index,views);
  assert.deepEqual(projection.modules.map(m=>m.count),[2,1]);assert.deepEqual(compassStatistics(projection.modules),[2,2]);
  assert.deepEqual(search('私人资料',projection).map(r=>r.url),['/me/']);assert.deepEqual(search('私人数学',projection).map(r=>r.url),[`/observatory/#vault=${id}`]);
  assert.equal(search('Me',projection).filter(r=>r.url==='/me/').length,1);assert.equal(JSON.stringify(index),before);
  assert.deepEqual(compassStatistics([{count:3},{count:2},{count:1,compassStatistic:'peer-average'},{count:0}]),[3,2,5/3,0]);
});
