# Personal Space · 项目进度

韩江恺的个人数字空间。以一枚玻璃 Compass 探索不同领域，用 Spotlight 快速查找；每个模块拥有自己的排版和内部秩序。

**网站：[hjk202.github.io](https://hjk202.github.io/)** · 最近核验的线上版本：`4f2d6b9`（2026-10-15）。

## 现在有什么

| 空间 | 用途与风格 |
| --- | --- |
| Me | 有个人气质的主页，介绍自己、兴趣与公开链接 |
| Think | 温暖、写意的文章和随记空间 |
| Build | 严谨的项目档案，可记录阶段、成果、更新与问题 |
| Keep | 按类别整理的网站收藏夹，说明与来源入口分开 |
| 私人模式 | 在以上四个模块中展示各自私人内容；深墨色烟玻璃环境，私人在前、公开仍完整可读 |

全站保持一致的液态玻璃材质，但四个模块不套用同一种排版。首页只做入口，手机以清楚可读、操作可用为目标。

## 主线进度

| 阶段 | 结果 | 状态 |
| --- | --- | --- |
| Phase 1 | 架构、首页、Compass、Spotlight、模块扩展基础 | 已完成 |
| Phase 2 | 四模块真实公开内容、独立布局及统一玻璃风格 | 已完成 |
| Phase 3 | 基础移动适配、GitHub Pages 发布与手机验收 | 已完成 |
| Phase 4 | 私人加密、解锁/锁定、四模块、搜索、内室风格 | 已完成，手机验收与最终发布通过 |
| Phase 5 | 收藏查找/排序、代码复制、目录等可选增强 | 按你的决定延后，不影响当前使用 |
| Phase 6 | 一个合并的旅行/摄影模块、后续内容充实 | 延后，按需要推进 |

目前公开内容包括个人介绍、Think 的“从底层理解”文章与“阳光正好”随记、NEMU 项目、Missing Semester 收藏。以后逐步补充内容，不要求现在填满。

## Phase 4 收尾

**Phase 1–4 已全部完成。** 2026-10-15，你已确认手机等检查无问题；临时样本已清理，最终版本通过完整本地/云端及线上验证并发布。

Phase 4 最终发布：[4f2d6b9](https://hjk202.github.io/?v=4f2d6b9)。本地构建、实际发布产物与线上 25 个文件完全一致，公开页面、搜索、返回及私人入口正常。

本地与线上均已移除非敏感验收样本。目前尚未配置真实私人资料，入口提示“尚未配置私人内容”；私人空间功能已完成。以后由你使用未公开的随机长口令，在本地加密真实资料后再发布，具体操作见 [内容维护手册](./MAINTENANCE.md#private-operations)。

## 后续安排

**当前已是可正常使用的正式版本，无需继续开发 Phase 5 才能使用。** 收藏分类、项目记录、公开/私人搜索及锁定等已有功能均已完成；内容可按需要逐步补充。

你已决定将这些非必要增强留待以后，[Phase 5 储备方案](./PLAN.md#phase-5-plan)保留参考，所有单元均延后；Phase 6 也不自动开始。网站内容仍可按[维护手册](./MAINTENANCE.md)直接维护。

## Personal Space Studio（M0–M6 全部完成）

同一仓库中的 Windows PC 本地作者工具：独立 Web 编辑器 → 本地 Authoring API → 现有 Think Markdown。源文件仍是唯一数据源，Studio 不进入公开网站产物；保存、published、Git 提交和上线分别处理。

首版 **M0–M4 Done，本地验收完成**：PC 浏览器可查看、新建、编辑 Think metadata/Markdown、校验、隔离预览、保存及确认删除，支持未保存提示和版本冲突保护；核心仍是独立 API/受限文件服务。M5 百炼文本建议的真实调用/浏览器验收已通过，M6 Agent adapter 也已完成；**Studio M0–M6 全部 Done**。

Windows 日常可双击桌面 **Personal Space Studio**，自动启动/复用本地服务并打开编辑器；保存后用 **Stop Personal Space Studio** 停止。首次用 `npm.cmd run studio:configure` 隐藏录入 AI Key，按当前 Windows 用户加密保存在仓库外，日常重开不必再配置。命令入口为 `npm.cmd run studio:open` / `studio:stop`。手动终端方式仍可在仓库根运行 `npm.cmd run studio`（先独立构建 Web），浏览器手动打开 `http://127.0.0.1:4322/`；可用 `-- --port 4323` 换端口，Ctrl+C 停止。点“预览”按需构建真实 Astro 候选，完整草稿也可预览，**不先保存、不改变源 published**。展示禁脚本、禁远程资源，链接不导航；构建限 90 秒，可取消，编辑后旧预览失效。编辑缓冲与解密后的凭据仅在内存；冲突/断线先保留内容、重新读取核对。操作、清理与可信构建限制见[手册第 9 节](./MAINTENANCE.md#editor)。

**M5 Done（2026-10-17）**：百炼五项真实调用和真实 UI 润色/人工采纳/校验已通过；采纳不写源文件、不改 published，之后仍须显式保存。证据见 [PLAN 最终验收](./PLAN.md#studio-m5-acceptance)，配置/操作见[手册 9.3.4](./MAINTENANCE.md#studio-ai)。手动模式 Key 在进程中；桌面模式从仓库外 DPAPI 密文加载，均不写源码/Git/浏览器。

**M6 Done**：Node/JSON-lines stdio 调用同一 HTTP API，默认只读，作者启动时显式 `--allow-write` 才能创建草稿/保存；保留 published 与 revision 边界，不提供 MCP/删除/发布。协议和命令见[手册 9.3.5](./MAINTENANCE.md#studio-agent)，验证与平台限制见 [PLAN M6](./PLAN.md#studio-m6) / 9.14。

**Studio v0 收尾进行中**：本轮已获授权优化润色、在 Windows 本机加密记住 AI Key、提供桌面快捷启动，并提交/正式部署为 `studio-v0` 基线；`sunshine.md` 按原 published:true 纳入。润色与 Windows 启动已完成验证：真实新版润色有效，桌面重复打开/停止/重开免配置通过；完整网站 75/75、Studio 37 通过/1 既有平台跳过。原样响应显示“本次未产生修改”。现进入发布前专项检查；各项状态与验证集中在 [PLAN 6.9](./PLAN.md#studio-v0)，完成前不把本地修改当上线。

## 文档入口

- 给 AI 的执行守则：[AGENTS.md](./AGENTS.md)。
- 给 AI 的完整需求、架构、风格及分阶段计划：[PLAN.md](./PLAN.md)。
- 自己或让 AI 增删内容、私人打包、预览发布，以及未来写作前端所需的字段和接口：[MAINTENANCE.md](./MAINTENANCE.md)。建议先看其中的快速选择，再查对应模块。

本页只报告重点进度。产品与验收依据在 PLAN，日常内容维护操作在 MAINTENANCE；Studio 首版已可本地使用，后续扩展需另行授权。
