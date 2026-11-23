import type { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';

type Settings = NonNullable<Parameters<typeof createSatteriMarkdownProcessor>[0]>;
export const writingMarkdown: Pick<Settings, 'features' | 'mdastPlugins'> & {
  hastPlugins: NonNullable<Settings['hastPlugins']>;
};
