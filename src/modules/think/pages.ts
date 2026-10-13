import type { ModulePage } from '../../core/module/types';
import Index from './Index.astro';
import Article from './Article.astro';
import { posts } from './content.server';
export default [
  { path: '', component: Index, props: {} },
  ...posts.map((post) => ({ path: post.metadata.slug, component: Article, props: { post } })),
] satisfies ModulePage[];
