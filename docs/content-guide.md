# 公开内容维护约定

本指南依据 NEED.md、PLAN.md 的 Phase 2。需求与实施范围仍分别以这两份文档为准；本指南记录内容输入和维护约定，不授权额外功能。

## 当前状态与输入清单

2026-10-13：用户提供的首批真实素材已全部接入；2.1–2.6 已通过技术验收。当前按已批准 DESIGN.md 修订视觉与模块组织，实施状态见 PLAN.md D1–D7。四模块均为一份公开内容；以下为当前已实现的维护约定。

| 模块 | 当前来源 | 首批真实资料 | 公开确认 | 拟用目标 | 对应 milestone |
| --- | --- | --- | --- | --- | --- |
| Me | 用户本轮原文；src/modules/me/data.ts | 韩江恺的简介与三段正文；没有额外链接 | 已确认 | /me/ | 2.2 Done |
| Think | 用户本轮原文；src/modules/think/content/understanding-from-the-bottom.md | 我为什么越来越喜欢从底层理解一个东西；2026-10-13；摘要及完整正文 | 已确认 | /think/understanding-from-the-bottom/ | 2.3 Done |
| Build | 用户本轮原文；src/modules/build/data.ts | NEMU：从指令执行到分页与异常的 x86 模拟器；2025.09—2026.02；没有仓库链接 | 已确认 | /build/nemu/ | 2.4 Done |
| Keep | 用户本轮原文；src/modules/keep/data.ts | The Missing Semester of Your CS Education；https://missing.csail.mit.edu/；原文说明 | 已确认 | /keep/missing-semester/ | 2.5 Done |

首批内容没有缺失项；Me 和 Build 未提供额外链接，对应可选链接不展示。后续新内容仍需来自用户确认的公开资料，不自动填充事实。

## 通用边界

- 内容归所属模块管理，模块互不 import。只共享既有 Module、ModulePage、SearchResult 和 URL 契约，不建立 UniversalContent 或统一内容系统。
- 只有显式公开的集合供列表、详情、count() 和 search() 使用；模块首页始终存在。无公开内容时计数为 0，不生成假详情或内容搜索结果，Spotlight 仍保留模块入口。
- Think、Build、Keep 条目的 published 必须显式为 true 才公开，缺省不公开，错误类型应报告。Me 同样需要明确公开状态。公开过滤不是 Private 功能，也不保护仓库源文件；本阶段只存放可公开、非敏感材料。
- slug 使用当前路由桥允许的小写字母、数字、连字符，非空且模块内唯一；标题可中英文混排。标题修改不自动改变 slug。
- 源地址和搜索地址使用不含部署 base 的站内逻辑路径，例如 /think/example/；页面链接通过 withBase 添加前缀一次。外部 URL 保持原值，不经过 withBase。
- 必填文本不得为空，日期和 URL 应按模块实际需要校验；错误指出模块与条目，不把加载错误吞成空列表。
- 默认保留用户原文和现有界面语言，不添加 i18n。不得推测日期、经历、项目成果、个人体验或收藏理由。
- 当前没有已确认的对外发布。Demo 路由默认随迁移移除，不为样本建立重定向；若用户确认已有外部链接使用，再提出最小迁移方案。

## Me：单份公开资料

目标位置：src/modules/me/data.ts；页面为 Profile.astro，正式目标始终 /me/。

| 字段 | 要求 |
| --- | --- |
| published | 明确的公开状态，仅 true 可进入公开集合 |
| name | 已确认的公开姓名或称呼，非空 |
| description | 简短介绍，非空，用于页面与搜索描述 |
| paragraphs | 用户确认过的正文段落，保持简单文本数组 |
| links | 可选公开链接；标签与 http/https URL，未提供则不显示 |

单份已公开资料计数 1；没有已公开资料计数 0。search() 将姓名/介绍投影到 /me/，不增加重复个人详情页。data.ts 调用 publicProfile()；要移除资料可以传 null。links 格式为 { label, url }[]。

2026-10-13 用户批准 Me 的 Compass 表达为其他启用模块实际数量的算术平均。me/module.ts 声明 compassStatistic: 'peer-average'，共享层根据真实公开快照计算并标为 Avg；零条模块也参与，无其他模块为0，显示最多两位小数但几何用未舍入值。上述资料 count() 和 search() 约定保持不变。

## Think：Markdown 文章

目标位置：src/modules/think/content/*.md；通过模块内构建期加载器渲染，仍由 pages.ts 提供页面，不把文件读取或编译逻辑发送到浏览器。

| 字段 | 要求 |
| --- | --- |
| slug | 稳定且模块内唯一，遵循上述格式 |
| title | 真实文章标题，非空 |
| summary | 用户提供的摘要，非空；搜索只使用标题和摘要 |
| published | 显式 true 才公开 |
| date | 作者提供的有效 YYYY-MM-DD 日期，不推测，不自动填当前日期 |
| 正文 | Markdown 文本；公开文章应有实际正文 |
| kind | 可选 article 或 note，缺省 article；随记可在 Think 首页直接读，不单独增加统一内容模型 |

按 date 降序，同日按 slug 稳定排序；每篇公开文章计数 1。章节、代码块和图片不额外计数。默认不使用交互 MDX；有实际需要时才使用既有 MDX 能力。

正文站内链接与图片优先采用可在项目子路径工作的相对地址。正文根绝对路径不能直接假定适配 /personal-space/；2.3 必须用实际文章和资源验证。公开取消后页面、列表、数量和搜索同步消失，不能只隐藏链接。

## Build：结构化项目

目标位置：src/modules/build/data.ts；Index.astro 列表与 Project.astro 详情共用公开项目集合。

| 字段 | 要求 |
| --- | --- |
| slug / title / summary | 稳定 slug、真实标题和摘要，非空 |
| published | 显式 true 才公开 |
| 说明 | 用户提供的项目说明，最小段落结构；不强制凑齐问题/做法/成果模板 |
| 项目链接 | 可选真实仓库或演示 URL，未提供不显示；有值时校验 http/https |

数组顺序即手工展示顺序，每个公开项目计数 1；search() 指向本站项目详情。项目说明、阶段、更新、问题和外链不单独计数。已批准 DESIGN.md 的可选本地记录；不增加看板、任务后台、跨项目聚合或远程 GitHub 同步。

data.ts 调用 publicProjects([...])。sections 是本模块的小段落结构：每节可有 title、paragraphs（字符串数组）、items（字符串数组）、code（原样文本）。可选 period 为用户提供的显示文字，keywords 为字符串数组，links 为 { label, url }[]。每节至少有实际文字，未提供链接不显示占位项。

可选记录字段只填真实资料：status 为 in-progress/completed/paused；milestones 为 { title, status: planned/in-progress/done, description? }[]；updates 为 { date: YYYY-MM-DD, title, accomplishments?, challenges?, nextSteps? }[]，三个可选数组中至少一个有非空文字；issues 为 { title, description, status: open/resolved, resolution? }[]。更新按日期降序，阶段按手工顺序；进度只显示实际完成阶段 x/y。没有字段时不放空 Tab、假百分比或假日志。NEMU 未提供这些历史记录，正式 data.ts 不补造。项目导航使用段内链接，更新用原生 details 展开，仍属于同一个项目详情。

## Keep：收藏与外部来源

目标位置：src/modules/keep/data.ts；Index.astro 列表进入 Bookmark.astro 本站详情。

| 字段 | 要求 |
| --- | --- |
| slug / title / description | 稳定 slug、真实标题和简述，非空 |
| published | 显式 true 才公开 |
| sourceUrl | 真实 http/https URL，必填；与本站详情 URL 分开 |
| note | 用户提供的简短个人说明，不代写体验或推荐 |
| category | 可选 { id, label }，id 使用 slug 格式且不能是 all；同 id 保持同一名称；缺省显示未分类 |
| kind | 可选资源类型文字，例如课程；不影响主分类 |

数组顺序即手工展示顺序，每项公开收藏计数 1。分类只从真实公开集合生成，无空分类。列表用 ?category=id 筛选并保留刷新/回退状态；本站详情与外链分开。Spotlight 打开本站详情，“打开网站/打开来源”用明确的新标签提示和 noopener noreferrer 保留收藏夹位置。不自动抓取网页、图标、摘要或缩略图。

data.ts 调用 publicBookmarks([...])；note 使用字符串数组逐段展示。sourceUrl 只允许 http/https。

## 目标维护流程

当前操作如下；2.6 用隔离副本核对新增、隐藏、全零与删除，不改真实源文件。

1. 新增：只修改所属模块的数据或内容文件，填写必填字段与稳定 slug，明确公开状态。
2. 编辑：修改内容，保留已使用的 slug；修改标题不创建新目标 URL。
3. 公开或取消公开：调整公开状态，重新构建；核对列表、详情、count/search 同步变化。
4. 删除：删除对应条目或文件并重建，不手改 dist。检查旧详情不再生成，搜索目标同步移除。
5. 验证：按对应 milestone 执行 lint、typecheck、test、build、test:e2e 和必要 smoke test。正文链接/资源改动应先做子路径检查。

不把 Markdown 草稿资源放进 public/ 来期待过滤保护它们；未发布产物检查使用隔离的非敏感唯一标记。此约定不构成私有数据保密方案。

实际隔离验证发现：Astro 的 Markdown 导入即使不渲染草稿，也可能输出该文件引用的原始 SVG 等资源；页面正文、列表、详情、数量与搜索过滤不等于资源保密。草稿及其资源只可放非敏感资料，Private 资源保护属于 Phase 5。

### 新增 Think 文章示例

在 src/modules/think/content/ 新增一个 .md 文件，示例仅用于说明字段，不自动成为本站内容：

```markdown
---
slug: your-stable-slug
title: 你的文章标题
summary: 你的文章摘要
date: '2026-10-13'
published: true
---

你的真实正文。
```

修改标题时保留 slug；改为 published: false 后重建，即取消公开。删除文件后重建，即移除文章。列表、详情、计数与搜索无需手工改动；新增模块也仍沿用原有注册约定。集成测试中当前首批内容的预期矩阵随经确认的内容基线更新，纯规则与隔离 fixture 测试保持独立。

### 修改其他模块与空状态

Me 修改 publicProfile({...}) 内的 name、description、paragraphs；取消公开改 published 为 false，无资料传 null。Build 在 publicProjects([...]) 中增删项目，Keep 在 publicBookmarks([...]) 中增删收藏；保持稳定 slug，明确 published。传空数组即为无公开条目，不改 module.ts 或 pages.ts。

修改后运行 npm run lint、npm run typecheck、npm run test、npm run build、npm run test:e2e，再生产预览检查。隔离发布验证用 node tests/verify-content.mjs；子路径和浏览器 probe 命令见 README。更新内容后重新 build，避免旧 dist 页面残留。

## Demo 迁移与测试调整

| 实施项 | 移除的当前 Demo | 对应测试调整 |
| --- | --- | --- |
| 2.2 Me | A small introduction 与 Demo Profile 文案 | 实际公开资料计数/投影、浏览器资料入口与页面断言 |
| 2.3 Think | a-space-to-think、small-observations 两篇样本 | 搜索中文样本、固定计数、文章路由；Node 直接导入构建加载器的兼容性；新增/未发布/非法元数据探针 |
| 2.4 Build | quiet-interface 虚构项目 | 项目计数、列表/详情、固定 Demo 搜索目标、有效/无效外链 |
| 2.5 Keep | reading-the-web、designing-with-space 两份样本 | 中文搜索、收藏计数、本站详情与真实来源 URL 区分 |
| 2.6 阶段验收 | 检查六份 Demo 不在正式页面、JSON、脚本中 | 根路径、子路径、第五模块自动接入、公开/取消公开/删除的集成验证 |

已识别的测试文件：tests/unit/search.test.ts、registry.test.ts、pages.test.ts；tests/e2e/acceptance.spec.ts、spotlight.spec.ts、visual.spec.ts。受影响时阅读实际用例后最小调整，不弱化键盘、焦点、IME、重试、长列表或架构边界覆盖。

测试排序和边界使用独立 fixtures；真实内容集成验证对照输入的预期公开集合，不能只让生成 JSON 与自身相等。Node 纯逻辑测试不直接执行 import.meta.glob；Astro 加载和 Markdown 渲染通过隔离构建与浏览器验证。不引入额外测试框架。

## 文档验收记录

2026-10-13，2.1 Done：核对本指南与 NEED.md、PLAN.md、现有模块和测试；文档结构、四模块字段/计数/排序/地址、素材清单、迁移策略及现有路径校验通过，脚本退出 0。本项不改代码；lint、typecheck、test、build、页面 smoke test 不适用且未运行，不标为已通过。当时登记的缺失资料随后由用户提供。

2026-10-13，2.6 Done：本指南已更新为真实维护流程。18 项单元测试、根/子路径各 19 项 e2e、内容新增/隐藏/删除/全零隔离构建、资源与空集合浏览器探针、第五模块验收均通过；完整记录见 PLAN.md。真实源文件未被隔离测试修改。本站仍只在本地验收，部署与 Private 留到后续获准阶段。
