import fs from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {join,relative,resolve} from 'node:path';
import {PROPOSAL_MAX_COUNT,PROPOSAL_MAX_RECORD,PROPOSAL_MAX_TOTAL} from '../../contracts/proposal.ts';
import type {EditorErrorCode} from '../../contracts/result.ts';

export class IntakeError extends Error {readonly code:EditorErrorCode;constructor(code:EditorErrorCode='INVALID_REQUEST'){super(code);this.code=code;}}
export const digest=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
export const canonical=(value:unknown):string=>JSON.stringify(value,(_key,item:unknown)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
export const hex=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export const idValid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
export function record(value:unknown,keys:string[]):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Object.keys(value).some(k=>!keys.includes(k)))throw new IntakeError();
  return value as Record<string,unknown>;
}
const same=(a:fs.BigIntStats,b:fs.BigIntStats)=>a.dev===b.dev&&a.ino===b.ino;
/** Fixed repository-specific public inbox. Never a browser-selected path or source mirror. */
export class ProposalStore {
  private anchors:{path:string;stat:fs.BigIntStats}[]=[];
  private directory:string;
  constructor(directory:string){
    directory=resolve(directory);this.directory=directory;
    const missing:string[]=[];let parent=directory;
    while(!fs.existsSync(parent)){missing.unshift(parent);const next=resolve(parent,'..');if(next===parent)throw new IntakeError('PROTECTED_PATH');parent=next;}
    const existing:string[]=[];while(true){existing.unshift(parent);const next=resolve(parent,'..');if(next===parent)break;parent=next;}
    for(const path of existing)this.anchor(path);
    for(const path of missing){this.check();fs.mkdirSync(path,{mode:0o700});this.anchor(path);}
  }
  private anchor(path:string){const stat=fs.lstatSync(path,{bigint:true});if(!stat.isDirectory()||stat.isSymbolicLink()||relative(path,fs.realpathSync.native(path))!=='')throw new IntakeError('PROTECTED_PATH');this.anchors.push({path,stat});}
  private check(){for(const a of this.anchors){const s=fs.lstatSync(a.path,{bigint:true});if(!s.isDirectory()||s.isSymbolicLink()||!same(a.stat,s)||relative(a.path,fs.realpathSync.native(a.path))!=='')throw new IntakeError('PROTECTED_PATH');}}
  private path(id:string){if(!idValid(id))throw new IntakeError();this.check();return join(this.directory,id+'.json');}
  private bytes(path:string){
    let before:fs.BigIntStats;try{before=fs.lstatSync(path,{bigint:true});}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return;throw e;}
    if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1n||before.size>BigInt(PROPOSAL_MAX_RECORD)||relative(path,fs.realpathSync.native(path))!=='')throw new IntakeError('PROTECTED_PATH');
    const fd=fs.openSync(path,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));
    try{const opened=fs.fstatSync(fd,{bigint:true});if(!same(before,opened)||opened.nlink!==1n)throw new IntakeError('REVISION_CONFLICT');const data=Buffer.alloc(Number(before.size)+1);let n=0;while(n<data.length){const next=fs.readSync(fd,data,n,data.length-n,null);if(!next)break;n+=next;}const after=fs.fstatSync(fd,{bigint:true}),named=fs.lstatSync(path,{bigint:true});if(!same(before,named)||!same(before,after)||named.isSymbolicLink()||after.nlink!==1n||before.mtimeNs!==after.mtimeNs||before.ctimeNs!==after.ctimeNs||BigInt(n)!==after.size)throw new IntakeError('REVISION_CONFLICT');return{bytes:data.subarray(0,n),stat:after};}finally{fs.closeSync(fd);}
  }
  read(id:string){const data=this.bytes(this.path(id));if(!data)throw new IntakeError('NOT_FOUND');let value:unknown;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data.bytes));}catch{throw new IntakeError('UNSUPPORTED_FORMAT');}return{value,revision:digest(data.bytes)};}
  list(){this.check();const files=fs.readdirSync(this.directory).sort();if(files.length>PROPOSAL_MAX_COUNT*2+1)throw new IntakeError('AUTHORING_BUSY');let total=0;const values=[];for(const name of files){if(!name.endsWith('.json')||!idValid(name.slice(0,-5)))throw new IntakeError('UNSUPPORTED_FORMAT');const path=this.path(name.slice(0,-5)),data=this.bytes(path)!;total+=data.bytes.length;if(total>PROPOSAL_MAX_TOTAL)throw new IntakeError('AUTHORING_BUSY');values.push({id:name.slice(0,-5),size:data.bytes.length});}if(values.length>PROPOSAL_MAX_COUNT)throw new IntakeError('AUTHORING_BUSY');return values;}
  write(id:string,value:unknown,expected:string|null){
    const path=this.path(id),before=this.bytes(path);if((before?digest(before.bytes):null)!==expected)throw new IntakeError('REVISION_CONFLICT');
    const content=Buffer.from(JSON.stringify(value));if(content.length>PROPOSAL_MAX_RECORD)throw new IntakeError('UNSUPPORTED_FORMAT');const entries=this.list();if((!before&&entries.length>=PROPOSAL_MAX_COUNT)||entries.reduce((n,e)=>n+e.size,0)-(before?.bytes.length??0)+content.length>PROPOSAL_MAX_TOTAL)throw new IntakeError('AUTHORING_BUSY');
    const temp=join(this.directory,randomUUID()+'.tmp');let own:fs.BigIntStats|undefined;
    try{const fd=fs.openSync(temp,'wx',0o600);try{own=fs.fstatSync(fd,{bigint:true});let n=0;while(n<content.length)n+=fs.writeSync(fd,content,n,content.length-n);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}this.check();const now=this.bytes(path);if((now?digest(now.bytes):null)!==expected||before&&(!now||!same(before.stat,now.stat)))throw new IntakeError('REVISION_CONFLICT');if(before)fs.renameSync(temp,path);else{fs.linkSync(temp,path);fs.unlinkSync(temp);}own=undefined;return digest(content);}finally{if(own){const stat=fs.lstatSync(temp,{bigint:true});if(same(own,stat)&&stat.nlink===1n)fs.unlinkSync(temp);}}
  }
  remove(id:string,expected:string){const path=this.path(id),current=this.bytes(path);if(!current||digest(current.bytes)!==expected)throw new IntakeError('REVISION_CONFLICT');this.check();fs.unlinkSync(path);}
}
