import assert from 'node:assert/strict';
import test from 'node:test';
import { notePreview } from '../../src/modules/think/note-preview.server.ts';

test('note previews preserve readable Markdown text without executable or interactive HTML', () => {
  assert.equal(notePreview('<h1>一个问题</h1><p>中文 <strong>重点</strong> &amp; <a href="/keep/">参考</a><br>下一行</p><script>secret()</script><style>hidden</style><!-- comment --><img src="/example.png"><p><code>&lt;value&gt;</code></p>'), '一个问题 中文 重点 & 参考 下一行 <value>');
  assert.equal(notePreview('<p>短随记。</p>'), '短随记。');
  assert.equal(notePreview('<script>not a preview</script>'), '');
});

test('long note previews have a bounded excerpt without splitting Unicode characters', () => {
  assert.equal(notePreview(`<p>${'🌞'.repeat(401)}</p>`), `${'🌞'.repeat(400)}…`);
});
