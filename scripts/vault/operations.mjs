import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decryptVault, encryptVault, readEnvelope, validatePayload, MAX_PLAIN } from '../../src/core/vault/crypto.ts';
import { outsideSource, atomicWrite, encryptedSource, externalTarget, root } from './files.mjs';
export async function validateModules(value) {
  const payload=validatePayload(value), modules={};
  const directory=resolve(root,'src/modules');
  const owners=new Set(readdirSync(directory,{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name));
  for(const [id,data] of Object.entries(payload.modules)) {
    if(!owners.has(id)) throw new Error('Unknown Vault module');
    const {default:validate}=await import(pathToFileURL(resolve(directory,id,'vault.server.ts')).href);
    if(typeof validate!=='function') throw new Error('Missing Vault adapter');
    modules[id]=validate(data);
  }
  for(const [,id] of JSON.stringify(modules).matchAll(/asset:([a-f0-9]{32})/g)) if(!Object.hasOwn(payload.assets,id)) throw new Error('Missing encrypted asset');
  return {...payload,modules};
}
export async function pack(source,output,password) {
  const file=outsideSource(source);
  if(statSync(file).size>MAX_PLAIN) throw new Error('Source too large');
  const payload=await validateModules(JSON.parse(readFileSync(file,'utf8')));
  const envelope=await encryptVault(payload,password);
  atomicWrite(output,JSON.stringify(envelope));
}
export async function verify(input,password) { return validateModules(await decryptVault(readEnvelope(encryptedSource(input)),password)); }
export async function rekey(input,output,oldPassword,newPassword) {
  const payload=await verify(input,oldPassword);
  const envelope=await encryptVault(payload,newPassword);
  atomicWrite(output,JSON.stringify(envelope));
}
export function backup(input,output) { const source=encryptedSource(input); readEnvelope(source); atomicWrite(externalTarget(output),source); }
export async function restore(input,output,password) { outsideSource(input); const source=encryptedSource(input); await verify(input,password); atomicWrite(output,source); }
