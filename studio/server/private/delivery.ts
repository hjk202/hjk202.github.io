import fs from 'node:fs';
import { join,relative,resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DeliveryCandidate,DeliveryResult } from '../../contracts/private.ts';
import { CipherFiles } from './files.ts';
import { PrivateError } from '../../private/error.ts';

const same=(a:fs.BigIntStats,b:fs.BigIntStats)=>a.dev===b.dev&&a.ino===b.ino;
type Candidate=DeliveryCandidate&{masterHandle:string;exportHandle:string};
/** Ciphertext only. Fixed bundle, external native-selected candidate, external verified old-bundle backup. */
export class PrivateDelivery {
  #root:string;#rootStat:fs.BigIntStats;#masters:CipherFiles;#exports:CipherFiles;#bundle:CipherFiles;#targetHandle:string|undefined;#candidate:Candidate|undefined;#publicRevision:()=>string;#closed=false;
  constructor(root:string,masters:CipherFiles,publicRevision:()=>string) {
    this.#root=fs.realpathSync(resolve(root));this.#rootStat=fs.lstatSync(this.#root,{bigint:true});this.#masters=masters;this.#exports=new CipherFiles(root);this.#bundle=CipherFiles.forBundle(root);this.#publicRevision=publicRevision;
  }
  #parents(create=false) {
    if(this.#closed)throw new PrivateError('DELIVERY_NOT_READY');
    const anchors=[{path:this.#root,stat:this.#rootStat}];
    const check=()=>{for(const anchor of anchors){const stat=fs.lstatSync(anchor.path,{bigint:true});if(!stat.isDirectory()||stat.isSymbolicLink()||!same(stat,anchor.stat)||relative(anchor.path,fs.realpathSync.native(anchor.path))!=='')throw new PrivateError('PRIVATE_FILE_UNSAFE');}};
    check();let parent=this.#root;
    for(const name of ['public','vault']) {
      const path=join(parent,name);let stat:fs.BigIntStats;
      try{stat=fs.lstatSync(path,{bigint:true});}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;check();if(!create)return false;fs.mkdirSync(path);stat=fs.lstatSync(path,{bigint:true});}
      anchors.push({path,stat});check();parent=path;
    }return true;
  }
  #target(create=false) {
    if(!this.#parents(create)){if(this.#targetHandle)throw new PrivateError('DELIVERY_STALE');return undefined;}
    if(!this.#targetHandle){const path=join(this.#root,'public/vault/bundle.json');let exists=false;try{fs.lstatSync(path);exists=true;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}this.#targetHandle=this.#bundle.bind(path,exists?'open':'create').handle;}
    return this.#bundle.read(this.#targetHandle);
  }
  status(){return {targetRevision:this.#target()?.revision??null};}
  bindCandidate(path:string){if(this.#closed)throw new PrivateError('DELIVERY_NOT_READY');this.#candidate=undefined;return this.#exports.bind(path,'create');}
  export(input:{handle:unknown;masterHandle:unknown;masterRevision:unknown;publicRevision:unknown;envelope:unknown}):DeliveryCandidate {
    if(this.#closed)throw new PrivateError('DELIVERY_NOT_READY');
    const guard=()=>{if(typeof input.masterHandle!=='string'||typeof input.masterRevision!=='string'||this.#masters.read(input.masterHandle).revision!==input.masterRevision)throw new PrivateError('DELIVERY_STALE');if(typeof input.publicRevision!=='string'||this.#publicRevision()!==input.publicRevision)throw new PrivateError('PRIVATE_PUBLIC_CHANGED');};
    guard();const targetRevision=this.status().targetRevision;
    const written=this.#exports.save(input.handle,null,input.envelope,guard);if(written.cleanupPending)throw Object.assign(new PrivateError('DELIVERY_FAILED'),{cleanupPending:true});
    const candidate:Candidate={id:randomUUID(),revision:written.revision,masterRevision:input.masterRevision as string,publicRevision:input.publicRevision as string,targetRevision,masterHandle:input.masterHandle as string,exportHandle:input.handle as string};this.#candidate=candidate;
    const {id,revision,masterRevision,publicRevision}=candidate;return {id,revision,masterRevision,publicRevision,targetRevision};
  }
  replace(id:unknown,expectedTargetRevision:unknown):DeliveryResult {
    const candidate=this.#candidate;if(this.#closed||!candidate||id!==candidate.id)throw new PrivateError('DELIVERY_NOT_READY');
    const guard=()=>{
      if(this.#masters.read(candidate.masterHandle).revision!==candidate.masterRevision||this.#exports.read(candidate.exportHandle).revision!==candidate.revision)throw new PrivateError('DELIVERY_STALE');
      if(this.#publicRevision()!==candidate.publicRevision)throw new PrivateError('PRIVATE_PUBLIC_CHANGED');
      if(expectedTargetRevision!==candidate.targetRevision||this.status().targetRevision!==candidate.targetRevision)throw new PrivateError('DELIVERY_STALE');
    };
    guard();const selected=this.#exports.snapshotCiphertext(candidate.exportHandle),old=this.#target();
    const backupRevision=old?.revision?this.#masters.backupDelivery(candidate.masterHandle,this.#bundle.snapshotCiphertext(this.#targetHandle).bytes,guard):null;
    guard();this.#target(true);guard();
    const written=this.#bundle.save(this.#targetHandle,candidate.targetRevision,selected.envelope,guard);this.#candidate=undefined;
    return {revision:written.revision,backupRevision,cleanupPending:written.cleanupPending};
  }
  close(){this.#closed=true;this.#candidate=undefined;this.#exports.close();this.#bundle.close();}
}
