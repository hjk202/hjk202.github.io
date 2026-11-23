import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { imageSize } from 'image-size';
import { fileBytes, safeDirectory } from '../publish/support.ts';
import type { EditorResult } from '../../contracts/result.ts';

const limit = 2 * 1024 * 1024;
export const IMAGE_REQUEST_LIMIT = Math.ceil(limit / 3) * 4 + 128;
const types:Record<string,string> = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'};

export function saveThinkImage(root:string, input:{mime?:unknown;data?:unknown}):EditorResult<{url:string}> {
  const fail = (code:'INVALID_REQUEST'|'FILE_OPERATION_FAILED'):EditorResult<never> => ({ok:false,error:{code,message:'无法保存这张图片。',issues:[]}});
  if(typeof input.mime!=='string'||!Object.hasOwn(types,input.mime)||typeof input.data!=='string'||input.data.length>IMAGE_REQUEST_LIMIT) return fail('INVALID_REQUEST');
  const bytes=Buffer.from(input.data,'base64');
  if(!bytes.length||bytes.length>limit||bytes.toString('base64')!==input.data)return fail('INVALID_REQUEST');
  const extension=types[input.mime]!;
  try {
    const info=imageSize(bytes);
    if(info.type!==extension || !info.width || !info.height || info.width>8192||info.height>8192||info.width*info.height>24_000_000) return fail('INVALID_REQUEST');
  } catch { return fail('INVALID_REQUEST'); }
  try {
    const content=join(resolve(root),'src/modules/think/content');
    safeDirectory(content);
    const directory=join(content,'assets');const original=safeDirectory(directory,true);
    const name=createHash('sha256').update(bytes).digest('hex')+'.'+extension, path=join(directory,name);
    if(fs.existsSync(path)){
      if(!fileBytes(path,limit).equals(bytes))return fail('FILE_OPERATION_FAILED');
    }else{
      const temporary=join(directory,randomUUID()+'.tmp');
      const descriptor=fs.openSync(temporary,'wx',0o600);
      try {
        try{fs.writeFileSync(descriptor,bytes);fs.fsyncSync(descriptor);}finally{fs.closeSync(descriptor);}
        const current=safeDirectory(directory);
        if(current.ino!==original.ino||current.dev!==original.dev)return fail('FILE_OPERATION_FAILED');
        try{fs.linkSync(temporary,path);}catch(error){
          if((error as NodeJS.ErrnoException).code!=='EEXIST'||!fileBytes(path,limit).equals(bytes))throw error;
        }
      }finally{
        const current=safeDirectory(directory);
        if(current.ino===original.ino&&current.dev===original.dev)fs.unlinkSync(temporary);
      }
    }
    return {ok:true,value:{url:'./assets/'+name}};
  }catch{return fail('FILE_OPERATION_FAILED');}
}
