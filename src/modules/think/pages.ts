import type { ModulePage } from '../../core/module/types';
import Index from './Index.astro';
import Article from './Article.astro';
import { posts } from './content.server';
export default [
  { path: '', component: Index, props: {}, head: { description: '在理解、好奇和不确定之间，留一点空间给新的问题。' } },
  ...posts.map((post) => ({ path: post.metadata.slug, component: Article, props: { post }, head: { title: `${post.metadata.title} — Think`, description: post.metadata.summary } })),
] satisfies ModulePage[];
