import { array, httpUrl, object, opaqueId, strings, text, uniqueIds } from '../../core/vault/validation.ts';
export function validateKeep(value: unknown) {
  const payload = object(value,['bookmarks']);
  const bookmarks = uniqueIds(array(payload.bookmarks).map(value=>{
    const entry = object(value,['id','title','description','sourceUrl','note','category','kind']);
    const category = entry.category === undefined ? undefined : object(entry.category,['id','label']);
    const note = strings(entry.note);
    if (!note.length) throw new Error('Missing Keep note');
    return {id:opaqueId(entry.id),title:text(entry.title),description:text(entry.description),sourceUrl:httpUrl(entry.sourceUrl),note, ...(category?{category:{id:opaqueId(category.id),label:text(category.label)}}:{}), ...(entry.kind===undefined?{}:{kind:text(entry.kind)})};
  }));
  const labels = new Map<string,string>();
  for (const entry of bookmarks) if(entry.category) {
    if(labels.has(entry.category.id) && labels.get(entry.category.id)!==entry.category.label) throw new Error('Conflicting Keep category');
    labels.set(entry.category.id,entry.category.label);
  }
  return {bookmarks};
}
export function keepVaultCount(publicCount:number,payload:ReturnType<typeof validateKeep>) { return publicCount+payload.bookmarks.length; }
