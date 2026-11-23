import katex from 'katex';

/** @param {{type: string, value: string}} node */
function math(node) {
  const displayMode = node.type === 'math';
  const value = node.value.length <= 4000 ? node.value : '\\text{Formula too long}';
  return { type: /** @type {const} */ ('html'), value: katex.renderToString(value, {
    displayMode, throwOnError: false, trust: false, maxExpand: 200, maxSize: 12,
  }) };
}

export const writingMarkdown = {
  features: { math: true },
  mdastPlugins: [{ name: 'writing-math', math, inlineMath: math }],
  hastPlugins: [{
    name: 'writing-soft-breaks',
    text(node, ctx) {
      const parent = ctx.parent(node);
      if (parent?.type !== 'element' || !['p','li','em','strong','del','a','blockquote'].includes(parent.tagName) || !node.value.includes('\n')) return;
      // Sätteri inserts formatting newlines around block children. Keep those,
      // and existing hard breaks, out of the soft-break conversion.
      const leading = node.value.startsWith('\n'), trailing = node.value.endsWith('\n');
      const lines = node.value.trim() ? node.value.slice(leading ? 1 : 0, trailing ? -1 : undefined).split('\n') : [];
      if (lines.length < 2) return;
      ctx.replaceNode(node, lines.flatMap((line, index) => [
        ...(index ? [{ type: 'element', tagName: 'br', properties: {}, children: [] }] : []),
        { type: 'text', value: line },
      ]));
    },
  }],
};
