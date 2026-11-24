# Personal Space

韩江恺的个人数字空间：Me 个人介绍、Think 文章与随记、Build 项目档案、Keep 收藏。Personal Space Studio 是同仓库中的 Windows 本地作者工具；后续主线聚焦文章/项目的自动录入、审核与一键发布，现有手动编辑作为精调与备用。

**网站：[hjk202.github.io](https://hjk202.github.io/)** · 最近核验线上源：`dcc5d82`（2026-10-17，文档整理后重新验收发布）。网站面向访客，Studio 只在本机运行。

## 文档入口

| 想了解什么 | 文档 |
| --- | --- |
| 项目是什么、文件在哪里、怎么启动、当前进度 | 本页 |
| 需求、架构、阶段计划、验收状态与历史证据 | [PLAN.md](./PLAN.md) |
| 编辑内容、AI 配置、预览、Agent 调用、验证与发布步骤 | [MAINTENANCE.md](./MAINTENANCE.md#start) |
| 让 AI 修改项目时的授权、范围、验证与停点 | [AGENTS.md](./AGENTS.md) |

本页只保留入口和重点进度；产品与验收以 PLAN 为准，日常操作查 MAINTENANCE。

## 项目结构

**一个 Git 仓库，网站和 Studio 分目录，文章只有一份。** 共用根 `package.json` / lockfile，不需要分别安装两套依赖。

```text
项目根目录/
├── src/                  网站源码：模块、页面、共享基础和界面
│   └── modules/think/content/   Think Markdown 唯一内容源
├── public/               网站公开静态资源
├── studio/               本地作者工具
│   ├── web/              PC 编辑界面
│   ├── server/           HTTP API、Think 读写、预览与 AI
│   ├── contracts/        数据与接口契约
│   ├── adapters/agent/   Node/JSON-lines Agent adapter
│   ├── desktop/          Windows WinForms / WebView2 薄窗口
│   └── windows/          桌面启动、停止与凭据配置
├── tests/                网站与 Studio 测试、非敏感样本
├── scripts/              维护脚本
├── .github/              检查与手动发布流程
├── .vscode/              编辑器目录显示设置
└── 根配置与四份项目文档
```

网站构建输出到 `dist/`，Studio Web 与隔离预览输出到 `.cache/studio/`；Pages 只发布受检的网站产物。架构边界见 [PLAN 仓库组织](./PLAN.md#repository-layout)。

VS Code 兼容编辑器的文件树已配置隐藏 `node_modules/`、`.astro/`、`.cache/`、`dist/`、`test-results/`、`playwright-report/`。文件仍在磁盘，Git 忽略规则不变；需要查看时，在 `.vscode/settings.json` 将对应项临时设为 `false`。不要直接清空运行中的 Studio 缓存。

## 日常使用

Studio 启动图标已换为原创蓝发 Q 版头像，App 窗口图标在正常退出重开后更新。图标与旧入口显示问题见 [维护手册](./MAINTENANCE.md#studio-windows)。

桌面使用 **Personal Space Studio** 图标打开，重复点击激活已有窗口。点窗口 X，处理未保存内容后关闭后台。已有 AI Key 自动从 Windows 加密存储加载。备用停止与故障恢复见 [Studio 手册](./MAINTENANCE.md#studio-windows)。

正式 App 的 AI 配置加载已恢复：原加密文件误存于 Codex 的 Windows 隔离目录，现已复用到桌面 App 的用户存储，原 Key 无须重录。作者从蓝发图标重开后，正式后台确认已配置，非敏感润色实测返回 200，见 [本次修复记录](./PLAN.md#studio-m8-credential-recovery-record)。

平时直接双击蓝发图标。首次打开缺少运行包时，图标会先自动准备，再打开 Studio。已经准备好的版本会直接启动。以下命令均在仓库根运行。新环境先按 `.node-version` 安装 Node 并执行 `npm.cmd ci`。开发更新或手动修复运行包时，正常退出后可用 `npm.cmd run studio:prepare`。真实 App 启动耗时仍待人工验收。

| 操作 | 命令 |
| --- | --- |
| 开发更新或手动修复运行包 | `npm.cmd run studio:prepare` |
| 启动 / 激活 Studio App | `npm.cmd run studio:open` |
| 请求 App 协同退出 | `npm.cmd run studio:stop` |
| 选择 AI 服务或更换 Key | `npm.cmd run studio:configure -- -Provider gemini` 或 `npm.cmd run studio:configure -- -Provider bailian`，配置后重开 App |
| 网站开发预览 | `npm.cmd run dev` |
| 构建网站 / 查看已构建网站 | `npm.cmd run build` / `npm.cmd run preview` |

Studio 默认打开 Think 的 Markdown 写作台。选文章或直接写，可选「AI 整理」，切换到当前段落的快速预览，再保存或确认发布。写作区支持粘贴或拖入图片、代码围栏快捷键和 LaTeX 公式。底栏显示本机累计写作时长。内容选择器也能恢复本机原稿，并进入仍使用既有界面的 Build、Keep、Me。私人资料库从维护入口打开。见[工作台使用方法](./MAINTENANCE.md#studio-writing-workbench)。AI 修改逐项勾选，应用后可撤销；未修改的 Markdown 预览切回无需重渲染。[性能与发布验证记录](./PLAN.md#studio-think-performance)。

录入支持公开 Think/Build 的文字、Markdown 和项目报告，经人工审核后保存或进入发布。发布提供精确差异与最终确认。私人资料库使用仓库外的加密文件，可从库内另行准备网站更新。**保存 ≠ published ≠ Git 提交 ≠ 推送 ≠ 部署。** 见[统一手动验收](./MAINTENANCE.md#studio-mainline-manual)、[私人手册](./MAINTENANCE.md#studio-private)、[AI 配置](./MAINTENANCE.md#studio-ai)和[Agent 调用](./MAINTENANCE.md#studio-agent)。

## 当前进度与待检查事项

- **网站 Phase 1–4 已完成并正式发布**；Phase 5/6 仍延后，不影响日常使用。
- **Studio M0–M6 与 v0 已完成**；基线标签 [studio-v0](https://github.com/hjk202/hjk202.github.io/tree/studio-v0) 指向 `224eea0`，后续网站更新不移动该标签。完整验收与平台限制见 [PLAN](./PLAN.md#studio-v0)。
- **Studio M9–M15 实现与自动验证完成，统一人工待验**：四个公开/私人模块、密文候选交付与外部备份恢复已接入，真实内容源保持。请按[统一人工验收清单](./MAINTENANCE.md#studio-batch-manual)检查 App 启停、中文编辑、四模块保存/预览、私人锁定和交付取消；M8 原生专项也在清单中。收到反馈前不标 Done，范围与证据见 [扩展计划](./PLAN.md#studio-next-plan)。
- **Studio M17 已完成，M18 原生操作单独待验**：M18 实现及自动验证保持，选择器/协同关闭仍按[手动步骤](./MAINTENANCE.md#studio-m18-manual)检查，未标 Done，不再阻塞公开主线。旧专项待验保留。
- **Studio Markdown 写作闭环**先交付 Think，使用 CodeMirror 6 源码模式。Build、Keep、Me 的转换按后续批次实施。[范围与验收](./PLAN.md#studio-think-writing)
- **Think v1.0 · Completed**。Markdown 写作、AI 审核、正式预览和真实文章发布已完成。日常单篇走内容快速发布，程序更新保留完整 CI。[最终收尾](./PLAN.md#studio-think-v1-completed)
- **其他 Studio 主线**：M16.3 性能与 M20 真实整理继续按各自记录验收。M21/M22 保持延期，其他模块后续单独安排。
- **随记四行预览 N1 已发布并通过线上验证**；仍待你检查手机效果。[查看效果](https://hjk202.github.io/think/?v=2a8ff37)，[验收记录](./PLAN.md#notes-n1)。
- **真实私人资料尚未配置**；私人功能已完成，入口提示未配置属正常行为。维护步骤见 [私人内容操作](./MAINTENANCE.md#private-operations)。

最近发布见 [PLAN 发布记录](./PLAN.md#docs-release)。M8 正式 App AI 恢复见 [修复记录](./PLAN.md#studio-m8-credential-recovery-record)；M15 人工待验仍保留。启动旧目标及未达结论见 [M16.2 记录](./PLAN.md#studio-m16-2-manual-review)，准备/运行分离见 [M16.3](./PLAN.md#studio-m16-3)；本批保留已有未提交工作，不控制桌面、不实际提交、推送或发布。
