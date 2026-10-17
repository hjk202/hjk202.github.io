# Personal Space

韩江恺的个人数字空间：Me 个人介绍、Think 文章与随记、Build 项目档案、Keep 收藏。Personal Space Studio 是同仓库中的 Windows 本地 Think 作者工具。

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

Windows 推荐双击桌面 **Personal Space Studio**，结束前先保存，再用 **Stop Personal Space Studio** 停止。已保存的 AI Key 会从仓库外的 Windows 加密配置加载，日常无需重新配置。

以下命令均在仓库根运行；新环境按 `.node-version` 准备 Node，再执行一次 `npm.cmd ci`。

| 操作 | 命令 |
| --- | --- |
| 启动 / 复用 Studio 并打开浏览器 | `npm.cmd run studio:open` |
| 停止桌面方式启动的 Studio | `npm.cmd run studio:stop` |
| 首次配置或更换 AI Key | `npm.cmd run studio:configure` |
| 网站开发预览 | `npm.cmd run dev` |
| 构建网站 / 查看已构建网站 | `npm.cmd run build` / `npm.cmd run preview` |

Studio 支持文章编辑、校验、隔离预览和 AI 文本建议；建议经人工采纳后仍须保存。**保存 ≠ published ≠ Git 提交 ≠ 推送 ≠ 部署。** 操作详情见 [Studio 手册](./MAINTENANCE.md#editor)，[AI 配置](./MAINTENANCE.md#studio-ai)、[Agent 调用](./MAINTENANCE.md#studio-agent)也在其中。

## 当前进度与待检查事项

- **网站 Phase 1–4 已完成并正式发布**；Phase 5/6 仍延后，不影响日常使用。
- **Studio M0–M6 与 v0 已完成**；基线标签 [studio-v0](https://github.com/hjk202/hjk202.github.io/tree/studio-v0) 指向 `224eea0`，后续网站更新不移动该标签。完整验收与平台限制见 [PLAN](./PLAN.md#studio-v0)。
- **随记四行预览 N1 已发布并通过线上验证**；仍待你检查手机效果。[查看效果](https://hjk202.github.io/think/?v=2a8ff37)，[验收记录](./PLAN.md#notes-n1)。
- **真实私人资料尚未配置**；私人功能已完成，入口提示未配置属正常行为。维护步骤见 [私人内容操作](./MAINTENANCE.md#private-operations)。

目录与文档整理已测试、提交并正式发布，现有功能和目录结构保持；结果见 [PLAN 发布记录](./PLAN.md#docs-release)。后续开发仍需明确授权。
