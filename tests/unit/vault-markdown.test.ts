import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownBlocks } from '../../src/modules/think/vault.markdown.ts';
test('Think Markdown keeps code and raw HTML as text, separating ordinary reading blocks',()=>{
  const blocks=markdownBlocks('# 标题\n\n段落\n第二行\n\n- 第一项\n- 第二项\n\n> 引用\n\n```js\n<script>never executed</script>\n```');
  assert.deepEqual(blocks.map(block=>block.type),['heading','paragraph','list','list','quote','code']);
  assert.equal(blocks[1].text,'段落\n第二行');assert.equal(blocks[5].text,'<script>never executed</script>');
});
