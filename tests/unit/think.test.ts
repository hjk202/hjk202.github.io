import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicArticles } from '../../src/modules/think/metadata.ts';
const article = (slug = 'one', date = '2026-10-13', published: unknown = true) => ({ frontmatter: { slug, title: '标题', summary: '摘要', date, published }, rawContent: () => '正文' });

test('Think filters unpublished files, sorts dates and slugs, and rejects broken public metadata', () => {
  assert.deepEqual(publicArticles([]), []);
  const entries = [article('z'), article('older', '2025-01-01'), article('a'), article('draft', 'bad date', false), article('omitted', 'bad date', undefined)];
  // Explicitly omit the flag rather than use the helper default.
  delete (entries[4].frontmatter as { published?: unknown }).published;
  assert.deepEqual(publicArticles(entries).map((entry) => entry.metadata.slug), ['a', 'z', 'older']);
  assert.throws(() => publicArticles([article(), article()]), /duplicate slug/);
  for (const date of ['2026-02-30', 'invalid', '2026-13-01']) assert.throws(() => publicArticles([article('one', date)]), /date/);
  assert.throws(() => publicArticles([article('../escape')]), /slug/);
  assert.throws(() => publicArticles([article('one', '2026-10-13', 'yes')]), /published/);
  assert.throws(() => publicArticles([{ ...article(), rawContent: () => '' }]), /empty body/);
  assert.throws(() => publicArticles([{ ...article(), frontmatter: { ...article().frontmatter, summary: '' } }]), /summary/);
});

test('Think accepts optional article/note forms without changing publication and count semantics', () => {
  const note = { ...article('note'), frontmatter: { ...article('note').frontmatter, kind: 'note' } };
  assert.equal(publicArticles([note])[0].metadata.kind, 'note');
  assert.equal(publicArticles([article()])[0].metadata.kind, undefined);
  assert.throws(() => publicArticles([{ ...note, frontmatter: { ...note.frontmatter, kind: 'command' } }]), /kind/);
});
