import type { MarkdownInstance } from 'astro';
import { publicArticles } from './metadata.ts';

const entries = import.meta.glob<MarkdownInstance<Record<string, unknown>>>('./content/*.md', { eager: true });
export const posts = publicArticles(Object.values(entries));
