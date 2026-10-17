import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseFrontmatter } from 'astro/markdown';
import { publicArticles } from '../../src/modules/think/metadata.ts';
import type { EditorResult, ThinkDocument } from '../../studio/contracts/think.ts';
import { parseThinkSource, serializeThinkDocument } from '../../studio/server/think/document.ts';
import { validateThinkDocument } from '../../studio/server/think/validation.ts';

const fixture = readFileSync(new URL('../fixtures/studio/commented-note.md.fixture', import.meta.url), 'utf8');
const current = readFileSync(new URL('../../src/modules/think/content/understanding-from-the-bottom.md', import.meta.url), 'utf8');
const complete = (): ThinkDocument => ({ metadata: { slug: 'example-note', title: '标题', summary: '摘要', date: '2026-10-15', kind: 'note', published: true }, body: '\n## 正文\n\n内容。\n' });
function unwrap<T>(result: EditorResult<T>): T {
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) throw new Error('Expected success');
  return result.value;
}

test('M0 keeps current author source and commented LF/CRLF/BOM fixtures byte-identical on no-op', () => {
  for (const source of [current, fixture, fixture.replaceAll('\n', '\r\n'), '\uFEFF' + fixture, fixture.replace(/\n$/, '')]) {
    const { document, validation } = unwrap(parseThinkSource(source));
    assert.equal(validation.canSave, true);
    assert.equal(validation.publishReady, true);
    const output = unwrap(serializeThinkDocument(document, source));
    assert.deepEqual(Buffer.from(output, 'utf8'), Buffer.from(source, 'utf8'));
  }
  assert.match(unwrap(parseThinkSource(current)).document.body, /<div class="attention-equation"/);
});

test('M0 body-only changes preserve the full original frontmatter and omitted fields', () => {
  const source = '\uFEFF---  \r\n# source comment\r\nslug: draft\r\n---\t\r\n';
  const parsed = unwrap(parseThinkSource(source));
  assert.deepEqual(Object.keys(parsed.document.metadata), ['slug']);
  const body = '\n正文保留空格  \n\n```md\n---\n```\n';
  assert.equal(unwrap(serializeThinkDocument({ ...parsed.document, body }, source)), source + body);
  assert.equal(unwrap(serializeThinkDocument({ ...parsed.document, body: '' }, source)), source);
  for (const ending of ['---', '---\r\n']) {
    const eof = `---\r\nslug: draft\r\n${ending}`;
    const document = unwrap(parseThinkSource(eof)).document;
    assert.equal(unwrap(serializeThinkDocument(document, eof)), eof);
    assert.equal(unwrap(parseThinkSource(unwrap(serializeThinkDocument({ ...document, body: '正文' }, eof)))).document.body, '正文');
  }
});

test('M0 metadata edits retain comments, scalar forms, body, order and source newline convention', () => {
  const titleOnly = unwrap(parseThinkSource(fixture)).document;
  titleOnly.metadata.title = '只修改标题';
  assert.match(unwrap(serializeThinkDocument(titleOnly, fixture)), /date: '2026-10-15' # 日期旁注/);
  for (const source of [fixture, fixture.replaceAll('\n', '\r\n')]) {
    const { document } = unwrap(parseThinkSource(source));
    document.metadata.title = '新标题: "双引号" 与 \'单引号\'\n第二行 🌱';
    document.metadata.date = '2026-10-16';
    const output = unwrap(serializeThinkDocument(document, source));
    for (const comment of ['# 非敏感 M0 格式样本', '# 保留稳定标识', '# 标题旁注', '# 日期旁注']) assert.ok(output.includes(comment));
    assert.ok(output.includes('summary: |-'));
    assert.match(output, /date: "2026-10-16"/);
    assert.ok(output.indexOf('slug:') < output.indexOf('title:'));
    const roundTrip = unwrap(parseThinkSource(output)).document;
    assert.deepEqual(roundTrip, document);
    assert.equal(roundTrip.body, unwrap(parseThinkSource(source)).document.body);
    const untouched = unwrap(parseThinkSource(source)).document;
    assert.equal(untouched.metadata.date, '2026-10-15', 'serializer must not mutate source state');
    if (source.includes('\r\n')) assert.doesNotMatch(output.slice(0, output.indexOf('## 正文')), /(?<!\r)\n/);
  }
});

test('M0 distinguishes incomplete draft warnings from invalid types and publication errors', () => {
  for (const metadata of [{ slug: 'draft' }, { slug: 'draft', published: false }, { slug: 'draft', title: '', summary: '  ', date: '', kind: 'article' }]) {
    const report = validateThinkDocument({ metadata, body: '' });
    assert.equal(report.canSave, true);
    assert.equal(report.publishReady, false);
    assert.deepEqual(report.issues.map(issue => [issue.field, issue.code, issue.severity]), [
      ['metadata.title', 'REQUIRED_FIELD', 'warning'], ['metadata.summary', 'REQUIRED_FIELD', 'warning'],
      ['metadata.date', 'REQUIRED_FIELD', 'warning'], ['body', 'REQUIRED_FIELD', 'warning'],
    ]);
    assert.equal(unwrap(parseThinkSource(unwrap(serializeThinkDocument({ metadata, body: '' })))).validation.canSave, true);
  }
  const report = validateThinkDocument({ metadata: { slug: 'draft', published: true }, body: '' });
  assert.equal(report.canSave, false);
  assert.ok(report.issues.every(issue => issue.severity === 'error'));
  assert.equal(serializeThinkDocument({ metadata: { slug: 'draft', published: true }, body: '' }).ok, false);
  assert.deepEqual(validateThinkDocument(complete()), { canSave: true, publishReady: true, issues: [] });
});

test('M0 rejects unknown fields, non-objects, null, wrong types and explicitly undefined fields', () => {
  for (const candidate of [null, [], 'text', 1, new Date(), {}, { metadata: [], body: '' }, { metadata: { slug: 'valid' } }, { ...complete(), extra: true }, { ...complete(), body: null }, { ...complete(), metadata: { ...complete().metadata, extra: 'value' } }]) {
    const report = validateThinkDocument(candidate);
    assert.equal(report.canSave, false, JSON.stringify(candidate));
    assert.equal(report.publishReady, false);
    assert.equal(serializeThinkDocument(candidate).ok, false);
  }
  for (const [field, value] of [['slug', 1], ['title', null], ['summary', []], ['date', new Date()], ['published', 'false'], ['published', undefined], ['kind', undefined], ['title', undefined], ['kind', 'command']] as const) {
    const report = validateThinkDocument({ ...complete(), metadata: { ...complete().metadata, published: false, [field]: value } });
    assert.equal(report.canSave, false, field);
    assert.ok(report.issues.some(issue => issue.field === `metadata.${field}` && issue.severity === 'error'));
  }
  const inherited = Object.create({ slug: 'hidden' }) as object;
  assert.equal(validateThinkDocument({ metadata: inherited, body: '' }).canSave, false);
  const symbols = { ...complete(), [Symbol('unknown')]: true };
  assert.equal(validateThinkDocument(symbols).canSave, false);
});

test('M0 shares real calendar, slug and kind rules for drafts and public documents', () => {
  for (const published of [false, true]) {
    for (const date of ['2026-02-30', '2025-02-29', '2026-13-01', '2026-1-01', '2026-10-15T00:00:00Z', 'not-date']) {
      const report = validateThinkDocument({ ...complete(), metadata: { ...complete().metadata, published, date } });
      assert.ok(report.issues.some(issue => issue.field === 'metadata.date' && issue.code === 'INVALID_DATE' && issue.severity === 'error'), date);
    }
    for (const date of ['2024-02-29', '2000-02-29', '2026-10-15']) assert.equal(validateThinkDocument({ ...complete(), metadata: { ...complete().metadata, published, date } }).canSave, true);
    for (const slug of ['', '../escape', 'Upper', 'two--hyphens', 'two words', '中文', 'one/two']) assert.equal(validateThinkDocument({ ...complete(), metadata: { ...complete().metadata, published, slug } }).canSave, false, slug);
    for (const kind of ['article', 'note']) assert.equal(validateThinkDocument({ ...complete(), metadata: { ...complete().metadata, published, kind } }).canSave, true);
  }
  const withoutKind = complete();
  delete withoutKind.metadata.kind;
  assert.equal(validateThinkDocument(withoutKind).publishReady, true);
});

test('M0 serializes arbitrary text safely and agrees with the actual Astro frontmatter parser', () => {
  for (const title of ['中文 🌱', '冒号: "引号" 与 \'单引号\'', '第一行\n第二行\n', '---\nslug: injected\n---', 'true', '2026-10-15', '<script>alert(1)</script>', '`code` $() \\path']) {
    const document = complete();
    document.metadata.title = title;
    document.metadata.summary = `摘要: ${title}`;
    const text = unwrap(serializeThinkDocument(document));
    assert.match(text, /date: "2026-10-15"/);
    const frontmatter = parseFrontmatter(text).frontmatter;
    assert.deepEqual(frontmatter, document.metadata);
    assert.equal(unwrap(parseThinkSource(text)).document.body, document.body);
    const posts = publicArticles([{ frontmatter, rawContent: () => document.body }]);
    assert.equal(posts[0].metadata.title, title);
    assert.equal(posts[0].metadata.kind, 'note');
  }
});

test('M0 refuses unsupported or damaged YAML without returning partial replacements or source values', () => {
  const invalid = [
    'body only', '---\nslug: missing-close', '+++\nslug="toml"\n+++\n',
    '---\n- list\n---\n', '---\nslug: one\nslug: two\n---\n',
    '---\nslug: [broken\n---\n', '---\nslug: draft\nextra: SOURCE_VALUE_CANARY\n---\n',
    '---\nslug: draft\ntitle: {nested: value}\n---\n',
    '---\nslug: &id draft\ntitle: *id\n---\n', '---\nslug: !!str draft\n---\n',
    '---\nslug: !unknown draft\n---\n', '---\nslug: draft\ndate: 2026-10-15\n---\n',
    '---\nslug: draft\npublished: "false"\n---\n', '---\nslug: draft\n__proto__: x\n---\n',
    '---\nslug: draft\n...\n---\nslug: second\n---\n',
  ];
  for (const source of invalid) {
    const result = parseThinkSource(source);
    assert.equal(result.ok, false, source);
    assert.ok(!('value' in result));
    assert.ok(!JSON.stringify(result).includes('SOURCE_VALUE_CANARY'));
    assert.equal(serializeThinkDocument(complete(), source).ok, false, 'must not overwrite unsupported originals');
  }
  assert.equal(parseThinkSource(null).ok, false);
});

test('M0 adds and removes optional metadata without inventing defaults or changing body whitespace', () => {
  const source = '---\n# keep\nslug: draft\nkind: note\n---\n  正文  \n';
  const document = unwrap(parseThinkSource(source)).document;
  delete document.metadata.kind;
  document.metadata.summary = '摘要\n多行';
  const text = unwrap(serializeThinkDocument(document, source));
  assert.match(text, /# keep/);
  assert.doesNotMatch(text, /published:|kind:|date:|title:/);
  assert.deepEqual(unwrap(parseThinkSource(text)).document, document);
  assert.equal(document.body, '  正文  \n');
});
