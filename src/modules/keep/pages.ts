import type { ModulePage } from '../../core/module/types';
import Index from './Index.astro';
import Bookmark from './Bookmark.astro';
import { bookmarks } from './data';
export default [
  { path: '', component: Index, props: {} },
  ...bookmarks.map((bookmark) => ({ path: bookmark.slug, component: Bookmark, props: { bookmark } })),
] satisfies ModulePage[];
