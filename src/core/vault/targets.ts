import { withBase } from '../module/urls.ts';
import { opaqueId } from './validation.ts';
export function vaultTarget(route: string,id: string): string { withBase(route);return `${route}#vault=${opaqueId(id)}`; }
export function targetId(hash: string): string | undefined {
  if(!hash.startsWith('#vault='))return undefined;
  return opaqueId(hash.slice(7));
}
export function targetHref(path: string,base='/'): string {
  const split=path.indexOf('#');
  if(split<0)return withBase(path,base);
  const logical=path.slice(0,split),id=targetId(path.slice(split));
  if(!id)throw new Error('Invalid Vault target');
  return `${withBase(logical,base)}#vault=${id}`;
}
