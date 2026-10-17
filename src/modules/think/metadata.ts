export interface ArticleMetadata {
  slug: string;
  title: string;
  summary: string;
  date: string;
  published?: boolean;
  kind?: 'article' | 'note';
}

export interface ArticleFieldIssue {
  field: 'slug' | 'published' | 'title' | 'summary' | 'date' | 'body' | 'kind';
  code: 'INVALID_SLUG' | 'INVALID_TYPE' | 'REQUIRED_FIELD' | 'INVALID_DATE' | 'INVALID_KIND';
  message: string;
}

export function articleIdentityIssues(data: Record<string, unknown>): ArticleFieldIssue[] {
  const issues: ArticleFieldIssue[] = [];
  if (data.published !== undefined && typeof data.published !== 'boolean') issues.push({ field: 'published', code: 'INVALID_TYPE', message: 'published must be boolean' });
  if (typeof data.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) issues.push({ field: 'slug', code: 'INVALID_SLUG', message: 'invalid slug' });
  return issues;
}

function publicationMetadataIssues(data: Record<string, unknown>): ArticleFieldIssue[] {
  const issues: ArticleFieldIssue[] = [];
  for (const field of ['title', 'summary'] as const) {
    if (typeof data[field] !== 'string' || !data[field].trim()) issues.push({ field, code: 'REQUIRED_FIELD', message: 'title and summary are required' });
  }
  if (typeof data.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !Number.isFinite(Date.parse(data.date)) || new Date(data.date).toISOString().slice(0, 10) !== data.date) issues.push({ field: 'date', code: 'INVALID_DATE', message: 'invalid date' });
  return issues;
}

export function publishedArticleIssues(data: Record<string, unknown>, body: string): ArticleFieldIssue[] {
  const issues = publicationMetadataIssues(data);
  if (!body.trim()) issues.push({ field: 'body', code: 'REQUIRED_FIELD', message: 'empty body' });
  if (data.kind !== undefined && data.kind !== 'article' && data.kind !== 'note') issues.push({ field: 'kind', code: 'INVALID_KIND', message: 'kind must be article or note' });
  return issues;
}

export function publicArticles<T extends { frontmatter: Record<string, unknown>; rawContent(): string }>(entries: readonly T[]): (T & { metadata: ArticleMetadata })[] {
  const slugs = new Set<string>();
  const articles = entries.flatMap((entry) => {
    const data = entry.frontmatter;
    const context = `Think ${String(data.slug ?? '(missing slug)')}`;
    const identityIssue = articleIdentityIssues(data)[0];
    if (identityIssue) throw new Error(`${context}: ${identityIssue.message}`);
    const slug = data.slug as string;
    if (slugs.has(slug)) throw new Error(`${context}: duplicate slug`);
    slugs.add(slug);
    if (data.published !== true) return [];
    // Preserve the existing fail-fast ordering before reading the Markdown body.
    const metadataIssue = publicationMetadataIssues(data)[0];
    if (metadataIssue) throw new Error(`${context}: ${metadataIssue.message}`);
    const publicationIssue = publishedArticleIssues(data, entry.rawContent())[0];
    if (publicationIssue) throw new Error(`${context}: ${publicationIssue.message}`);
    return [{ ...entry, metadata: data as unknown as ArticleMetadata }];
  });
  return articles.sort((a, b) => b.metadata.date.localeCompare(a.metadata.date) || a.metadata.slug.localeCompare(b.metadata.slug));
}
