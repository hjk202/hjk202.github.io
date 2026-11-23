const string = {type:'string'};
const candidate = {
  type:'object', additionalProperties:false, properties:{
    metadata:{type:'object',additionalProperties:false,properties:{slug:string,title:string,summary:string,date:string,kind:{type:'string',enum:['article','note']}}},
    body:string,
  },
};
const evidencePaths=['metadata.slug','metadata.title','metadata.summary','metadata.date','metadata.kind','body'];
const schema = {type:'object',additionalProperties:false,required:['candidate','evidence','unknowns'],properties:{
  candidate, evidence:{type:'array',items:{type:'object',additionalProperties:false,required:['field','quote'],properties:{field:{type:'string',enum:evidencePaths},quote:string}}},
  unknowns:{type:'array',items:string},
}};
const writingSchema={...schema,properties:{...schema.properties,
  edits:{type:'array',maxItems:32,items:{type:'object',additionalProperties:false,required:['before','after'],properties:{before:string,after:string}}},
}};

export function geminiBody(system: string, material: string, structured: boolean, writing=false) {
  return { systemInstruction:{parts:[{text:system}]}, contents:[{role:'user',parts:[{text:material}]}],
    generationConfig:{maxOutputTokens:4096, ...(structured?{responseMimeType:'application/json',responseJsonSchema:writing?writingSchema:schema}:{})} };
}

export function geminiText(value: unknown) {
  const reply = value as {candidates?: {finishReason?:string;content?:{parts?:{text?:unknown;thought?:boolean;functionCall?:unknown}[]}}[]};
  const result = reply?.candidates?.length === 1 ? reply.candidates[0] : undefined;
  if (result?.finishReason !== 'STOP' || !Array.isArray(result.content?.parts) || result.content.parts.some(part=>!part || part.functionCall)) return;
  return result.content.parts.filter(part=>!part.thought).map(part=>typeof part.text==='string'?part.text:'').join('');
}

export async function geminiKeyError(response:Response) {
  if(response.status!==400||!response.body)return false;
  const reader=response.body.getReader();
  try{
    let size=0;
    const parts:Uint8Array[]=[];
    for(;;){
      const chunk=await reader.read();
      if(chunk.done)break;
      size+=chunk.value.length;
      if(size>16384){await reader.cancel();return false;}
      parts.push(chunk.value);
    }
    return /API_KEY_(?:INVALID|EXPIRED|SERVICE_BLOCKED|HTTP_REFERRER_BLOCKED)/.test(Buffer.concat(parts).toString('utf8'));
  }finally{reader.releaseLock();}
}
