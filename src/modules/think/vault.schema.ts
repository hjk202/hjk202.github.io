import { array, date, object, opaqueId, text, uniqueIds } from '../../core/vault/validation.ts';
export function validateThink(value: unknown) {
  const payload = object(value,['posts']);
  const posts = uniqueIds(array(payload.posts).map(value=>{
    const post = object(value,['id','title','summary','date','kind','body']);
    if (post.kind !== 'article' && post.kind !== 'note') throw new Error('Invalid Think form');
    return { id:opaqueId(post.id),title:text(post.title),summary:text(post.summary),date:date(post.date),kind:post.kind as 'article'|'note',body:text(post.body,100000) };
  }));
  return {posts:posts.sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id))};
}
