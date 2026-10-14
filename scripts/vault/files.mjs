import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, parse, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { MAX_ENVELOPE } from '../../src/core/vault/crypto.ts';
export const root = realpathSync(resolve('.'));
function canonical(path) { return existsSync(path) ? realpathSync(path) : resolve(canonical(dirname(path)),basename(path)); }
function within(path) { const local=relative(root,path); return local===''||(!local.startsWith(`..${sep}`)&&local!=='..'&&!isAbsolute(local)); }
function regularPath(path) {
  const requested=resolve(path);
  if(process.platform==='win32'&&requested.slice(parse(requested).root.length).includes(':'))throw new Error('Alternate data streams are not allowed');
  return requested;
}
export function outsideSource(path) {
  const requested=regularPath(path),resolved=canonical(requested);
  if(within(resolved) || !lstatSync(resolved).isFile() || lstatSync(requested).isSymbolicLink()) throw new Error('Source must be a regular file outside the repository');
  return resolved;
}
export function allowedTarget(path) {
  const requested=regularPath(path), resolved=canonical(requested);
  if(existsSync(requested)&&lstatSync(requested).isSymbolicLink()) throw new Error('Symlink output is not allowed');
  if(within(resolved) && resolved!==resolve(root,'public/vault/bundle.json')) throw new Error('Only the encrypted bundle may be written inside the repository');
  if(requested===resolve(root,'public/vault/bundle.json') && resolved!==requested) throw new Error('Production bundle directory must not be a symlink');
  return requested;
}
export function externalTarget(path) {
  if(within(canonical(regularPath(path)))) throw new Error('Backup must be outside the repository');
  return allowedTarget(path);
}
export function atomicWrite(path,source) {
  const target=allowedTarget(path);
  if(source.length>MAX_ENVELOPE) throw new Error('Encrypted output too large');
  mkdirSync(dirname(target),{recursive:true});
  const temporary=resolve(dirname(target),`.vault-${randomUUID()}.tmp`);
  try { writeFileSync(temporary,source,{flag:'wx',mode:0o600}); renameSync(temporary,target); }
  finally { if(existsSync(temporary)) unlinkSync(temporary); }
}
export function encryptedSource(path) {
  const target=realpathSync(regularPath(path));
  if(!lstatSync(target).isFile()||lstatSync(target).size>MAX_ENVELOPE) throw new Error('Invalid encrypted file');
  return readFileSync(target,'utf8');
}
