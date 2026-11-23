import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyReview, writingReview } from '../../studio/web/writing-review.ts';
import { parseOrganized } from '../../studio/server/ai/organize.ts';

test('a cited typo is selectable even if omitted from the candidate; no title or credit is removed as a side effect', () => {
  const body = '## 你是人间的四月天\r\n\n#### 林徽因\r\n\r\n轻灵在春的光艳中教务着变。\n\n星子在无意中闪。';
  const base = { metadata: { title: '你是人间的四月天', summary: '林徽因的诗作' }, body };
  const candidate = { metadata: { summary: '待确认摘要' }, body: '轻灵在春的光艳中教务着变。\n\n星子在无意中闪。' };
  const response = parseOrganized('think', JSON.stringify({ candidate, evidence: [], unknowns: ['请对照原文'],
    edits: [{ before: '教务着变', after: '交舞着变' }, { before: '#### 林徽因', after: '' }] }), body);
  assert.equal(response.module, 'think');
  const review = writingReview(base, candidate, response.evidence, response.edits ?? []);
  assert.ok(review.changes.some(change => 'field' in change && change.field === 'summary' && change.unconfirmed));
  assert.ok(review.notes.some(note => note.includes('署名')));
  const correction = review.changes.find(change => !('field' in change) && change.before === '教务着变');
  assert.ok(correction);
  assert.equal(applyReview(base, [correction]).body, body.replace('教务着变', '交舞着变'));
  assert.match(applyReview(base, review.changes).body, /#### 林徽因/);
});

test('ambiguous replacements and changes to marked quotes, code, math, and links are not actionable', () => {
  const body = '> 原文有误\n\n重复字句，重复字句。\n\n`someCall()` $x^2$ [保留](https://example.invalid)\n\n普通句子有有重复。';
  const base = { metadata: {}, body };
  const proposed = { metadata: {}, body: body.replaceAll('原文有误', '换写').replace('someCall()', 'lost()') };
  const review = writingReview(base, proposed, [], [
    { before: '重复字句', after: '别的写法' }, { before: 'x^2', after: 'x' }, { before: '保留', after: '修改' },
    { before: '有有', after: '有' },
  ]);
  assert.equal(review.changes.length, 1);
  assert.equal(applyReview(base, review.changes).body, body.replace('有有', '有'));
});
