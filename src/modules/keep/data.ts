import { publicBookmarks } from './bookmarks.ts';

export const bookmarks = publicBookmarks([{
  slug: 'missing-semester',
  title: 'The Missing Semester of Your CS Education',
  description: 'MIT 的一门很有意思的课程。它讲的不是某一种编程语言或者某一个理论，而是很多计算机专业学生每天都会使用、却很少被系统教授的工具：Shell、Git、Vim、SSH、调试器、数据整理、自动化等等。',
  published: true,
  category: { id: 'tools', label: '工具与工作流' },
  kind: '课程',
  sourceUrl: 'https://missing.csail.mit.edu/',
  note: ['我很喜欢它背后的一个观点：', '工具本身也是计算机能力的一部分。', '很多时候，一点点对工具和工作流的理解，可以长期改变学习和工作的方式。'],
}]);
