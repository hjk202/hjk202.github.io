import { array, httpUrl, object, strings, text } from '../../core/vault/validation.ts';
export function validateMe(value: unknown) {
  const payload = object(value,['paragraphs','links']);
  const paragraphs = strings(payload.paragraphs);
  const links = payload.links === undefined ? [] : array(payload.links,20).map(value=>{
    const link = object(value,['label','url']); return {label:text(link.label),url:httpUrl(link.url)};
  });
  return {paragraphs,links};
}
export function meVaultCount(publicCount:number) { return publicCount; }
