export interface Bookmark {
  slug: string;
  title: string;
  description: string;
  published?: boolean;
  sourceUrl: string;
  note: string[];
  category?: { id: string; label: string };
  kind?: string;
}

export function bookmarkGroups(entries: readonly Bookmark[]) {
  const groups = new Map<string, { id: string; label: string; entries: Bookmark[] }>();
  for (const entry of entries) {
    const category = entry.category ?? { id: 'uncategorized', label: '未分类' };
    const group = groups.get(category.id);
    if (group && group.label !== category.label) throw new Error(`Keep: category ${category.id} has inconsistent labels`);
    if (group) group.entries.push(entry);
    else groups.set(category.id, { ...category, entries: [entry] });
  }
  return [...groups.values()];
}

export function publicBookmarks(entries: readonly Bookmark[]): Bookmark[] {
  const slugs = new Set<string>();
  return entries.filter((bookmark) => {
    const context = `Keep ${bookmark.slug}`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(bookmark.slug)) throw new Error(`${context}: invalid slug`);
    if (slugs.has(bookmark.slug)) throw new Error(`${context}: duplicate slug`);
    slugs.add(bookmark.slug);
    if (bookmark.published !== undefined && typeof bookmark.published !== 'boolean') throw new Error(`${context}: published must be boolean`);
    if (bookmark.published !== true) return false;
    if (![bookmark.title, bookmark.description, ...bookmark.note].every((text) => typeof text === 'string' && text.trim()) || !bookmark.note.length) throw new Error(`${context}: title, description and note are required`);
    if (!/^https?:\/\//.test(bookmark.sourceUrl) || !URL.canParse(bookmark.sourceUrl)) throw new Error(`${context}: invalid source URL`);
    if (bookmark.category && (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(bookmark.category.id) || bookmark.category.id === 'all' || !bookmark.category.label.trim())) throw new Error(`${context}: invalid category`);
    if (bookmark.kind !== undefined && !bookmark.kind.trim()) throw new Error(`${context}: empty kind`);
    return true;
  });
}
