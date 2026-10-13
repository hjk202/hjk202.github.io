import { publicProfile } from './profile.ts';

export const profile = publicProfile({
  published: true,
  name: '韩江恺',
  description: '我是韩江恺，南京大学计算机科学与技术专业本科生。',
  paragraphs: [
    '我对计算机系统、人工智能和那些能够真正被构建出来的东西感兴趣。相比单纯了解一个工具如何使用，我更喜欢继续往下追问：它为什么这样工作，它下面还有什么，以及我能不能自己实现一个。',
    '因此，我做过从 CPU 模拟器、操作系统和 TCP 协议栈，到 Attention、GQA 和个人网站的一系列项目。很多时候，学习对我来说并不是从“学会”到“结束”，而是从一个问题继续长出下一个问题。',
    '这里记录我正在思考的事情、真正做过的项目，以及那些我觉得值得留下来的东西。',
  ],
});
