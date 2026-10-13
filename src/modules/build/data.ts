import { publicProjects } from './projects.ts';

export const projects = publicProjects([{
  slug: 'nemu',
  title: 'NEMU：从指令执行到分页与异常的 x86 模拟器',
  summary: 'NEMU 是我在计算机系统基础实验中完成的一个 x86 模拟器项目。',
  published: true,
  period: '2025.09 — 2026.02',
  sections: [
    { paragraphs: ['它最开始只是一个能够读取并执行指令的简单模拟器，之后逐步加入表达式求值、ELF 解析、Cache、分段、分页、异常、中断和 I/O 等机制，最后形成一个能够支撑操作系统运行的简化计算机系统。'] },
    { title: '我实现过的主要部分', items: ['x86 指令译码与执行', 'ELF 文件解析与符号信息读取', '表达式求值与调试功能', '64 KB、64 B Cache Line、8 路组相联 Cache', '分段机制与 GDTR / CR0', '分页与 CR3、PDE、PTE 地址翻译', '内核高地址映射', '异常与中断处理', 'int 0x80 系统调用路径', '串口、VGA、IDE 等 I/O 设备'] },
    { paragraphs: ['其中让我印象最深的是分页。', '一个虚拟地址最终并不会直接对应内存中的某个位置，而需要经过：'], code: 'Virtual Address\n       ↓\n      CR3\n       ↓\nPage Directory\n       ↓\n      PDE\n       ↓\n  Page Table\n       ↓\n      PTE\n       ↓\nPhysical Address' },
    { paragraphs: ['真正把这条路径写进 page_translate() 以后，课本里的“虚拟内存”第一次从一个抽象概念变成了一套能够一步一步跟踪的具体机制。', '这个项目对我最大的意义并不是实现了多少条指令，而是让我第一次从一个比程序更低的位置观察程序。', '以前运行程序时，我看到的是：'], code: './program' },
    { paragraphs: ['做完 NEMU 之后，我看到的则开始变成：'], code: 'ELF\n→ 指令\n→ 寄存器\n→ 虚拟地址\n→ 页表\n→ 物理地址\n→ Cache\n→ 内存\n→ I/O' },
    { paragraphs: ['计算机不再只是一个执行代码的黑盒。', '它开始变成一套可以逐层解释的系统。'] },
  ],
  keywords: ['C', 'x86', 'Computer Architecture', 'Virtual Memory', 'Cache', 'Operating System'],
}]);
