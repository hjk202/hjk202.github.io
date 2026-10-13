import type { ModulePage } from '../../core/module/types';
import Index from './Index.astro';
import Bookmark from './Bookmark.astro';
import { bookmarks } from './data';
export default [
  { path: '', component: Index, props: {}, head: { description: '整理过的网站、课程和工具，给值得留下来的东西一个好找的位置。' } },
  ...bookmarks.map((bookmark) => ({ path: bookmark.slug, component: Bookmark, props: { bookmark }, head: { title: `${bookmark.title} — Keep`, description: bookmark.description } })),
] satisfies ModulePage[];
