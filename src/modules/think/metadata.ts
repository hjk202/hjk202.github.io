export interface ArticleMetadata {
  slug: string;
  title: string;
  summary: string;
  date: string;
  published?: boolean;
  kind?: 'article' | 'note';
}

export function publicArticles<T extends { frontmatter: Record<string, unknown>; rawContent(): string }>(entries: readonly T[]): (T & { metadata: ArticleMetadata })[] {
  const slugs = new Set<string>();
  const articles = entries.flatMap((entry) => {
    const data = entry.frontmatter;
    const context = `Think ${String(data.slug ?? '(missing slug)')}`;
    if (data.published !== undefined && typeof data.published !== 'boolean') throw new Error(`${context}: published must be boolean`);
    if (typeof data.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) throw new Error(`${context}: invalid slug`);
    if (slugs.has(data.slug)) throw new Error(`${context}: duplicate slug`);
    slugs.add(data.slug);
    if (data.published !== true) return [];
    if (![data.title, data.summary].every((text) => typeof text === 'string' && text.trim())) throw new Error(`${context}: title and summary are required`);
    if (typeof data.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !Number.isFinite(Date.parse(data.date)) || new Date(data.date).toISOString().slice(0, 10) !== data.date) throw new Error(`${context}: invalid date`);
    if (!entry.rawContent().trim()) throw new Error(`${context}: empty body`);
    if (data.kind !== undefined && data.kind !== 'article' && data.kind !== 'note') throw new Error(`${context}: kind must be article or note`);
    return [{ ...entry, metadata: data as unknown as ArticleMetadata }];
  });
  return articles.sort((a, b) => b.metadata.date.localeCompare(a.metadata.date) || a.metadata.slug.localeCompare(b.metadata.slug));
}
