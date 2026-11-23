import assert from 'node:assert/strict';
import test from 'node:test';
import { createThinkTextSuggestions } from '../../studio/server/ai/suggest.ts';
import { GEMINI_MODEL } from '../../studio/contracts/ai.ts';

const environment={STUDIO_AI_PROVIDER:'gemini',GEMINI_API_KEY:'UNIT_TEST_KEY_ONLY'};
const raw='这波真绷不住了，API 有有问题。\n\n```js\nconst x = 1;\n```\n\n$E=mc^2$，文件 `api.ts`。';
const body=raw.replace('有有','有');
const json=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});

test('Gemini uses fixed credentials header and schema; review keeps slang, formula, filename and code',async()=>{
  let emitted=body;
  let evidenceField='body';
  const ai=createThinkTextSuggestions({environment,fetch:async(url,init)=>{
    assert.match(String(url),new RegExp('^https://generativelanguage.googleapis.com/v1beta/models/'+GEMINI_MODEL+':generateContent$'));
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'),environment.GEMINI_API_KEY);
    const request=JSON.parse(String(init?.body));
    assert.equal(request.contents[0].parts[0].text,raw);
    assert.match(request.systemInstruction.parts[0].text,/网络梗/);
    assert.match(request.systemInstruction.parts[0].text,/不确定是否为错误/);
    assert.match(request.systemInstruction.parts[0].text,/不加 candidate 前缀/);
    assert.equal(request.generationConfig.responseMimeType,'application/json');
    assert.deepEqual(request.generationConfig.responseJsonSchema.properties.evidence.items.properties.field.enum,
      ['metadata.slug','metadata.title','metadata.summary','metadata.date','metadata.kind','body']);
    return json(200,{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({
      candidate:{metadata:{title:'一次API故障'},body:emitted},evidence:[{field:evidenceField,quote:'API 有有问题'}],unknowns:[],
    })}]}}]});
  }});
  try{
    const result=await ai.organizeMaterial('think',raw);
    assert.ok(result.ok && result.value.module==='think');
    assert.equal(result.value.candidate.body,body);
    emitted=body.replace('const x = 1','const x = 2');
    const changed=await ai.organizeMaterial('think',raw);
    assert.ok(changed.ok && changed.value.module==='think');assert.equal(changed.value.candidate.body,undefined);
    assert.ok(changed.value.notes.some(note=>note.includes('保留原正文')));
    evidenceField='candidate.body';
    const invalid=await ai.organizeMaterial('think',raw);
    assert.ok(!invalid.ok);assert.equal(invalid.error.code,'AI_INVALID_RESPONSE');
  }finally{await ai.close();}
});

test('Gemini errors distinguish quota, key rejection, timeout and invalid structured output',async()=>{
  const cases:[[number,unknown],string][]=[
    [[429,{error:{status:'RESOURCE_EXHAUSTED'}}],'AI_RATE_LIMITED'],
    [[400,{error:{details:[{reason:'API_KEY_INVALID'}]}}],'AI_AUTH_FAILED'],
    [[404,{error:{status:'NOT_FOUND'}}],'AI_MODEL_UNAVAILABLE'],
    [[503,{error:{status:'UNAVAILABLE'}}],'AI_UPSTREAM_UNAVAILABLE'],
    [[504,{}],'AI_TIMEOUT'],
    [[200,{candidates:[{finishReason:'MAX_TOKENS'}]}],'AI_INVALID_RESPONSE'],
  ];
  for(const [[status,data],expected] of cases){
    const ai=createThinkTextSuggestions({environment,fetch:async()=>json(status,data)});
    try{const result=await ai.organizeMaterial('think',raw);assert.ok(!result.ok);assert.equal(result.error.code,expected);}
    finally{await ai.close();}
  }
});

test('transport connection timeouts surface as AI_TIMEOUT before an HTTP response',async()=>{
  const ai=createThinkTextSuggestions({environment,fetch:async()=>{
    throw new TypeError('fetch failed',{cause:{code:'UND_ERR_CONNECT_TIMEOUT'}});
  }});
  try {
    const result=await ai.organizeMaterial('think',raw);
    assert.ok(!result.ok);
    assert.equal(result.error.code,'AI_TIMEOUT');
  } finally { await ai.close(); }
});
