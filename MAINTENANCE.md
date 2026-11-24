# Personal Space · 内容维护与写作接口手册

更新：2026-10-30。适用于当前 Astro 静态站点与 Windows 本地 Studio，按现有源码核对；本文件中的示例均为非敏感教学数据，不会自动成为网站内容。

**日常增删文章不需要再开发模块，也不需要开启 Phase 5。** 公开内容修改模块源文件，再验证、构建并按授权发布；私人内容在仓库外维护，Studio 以加密主文件为唯一作者源，网站只接收密文交付副本。原 JSON/CLI 流程仍可使用，转用 Studio 时需明确迁移，不并行维护两个作者源。公开网站没有在线写入接口；Windows 本地 Studio 的公开/私人四模块操作见第 9 节。

## 目录

- [1. 文档职责与快速选择](#start)
- [2. 文件、路由和已有接口](#interfaces)
- [3. Think：文章与随记](#think)
- [4. Build、Keep、Me：全部公开字段](#public-modules)
- [5. 私人内容：数据协议与全部字段](#private-data)
- [6. 私人维护命令与安全边界](#private-operations)
- [7. 从修改到预览、验证、上线和恢复](#workflow)
- [8. 让 AI 帮忙维护](#ai)
- [9. Studio 作者接口、PC 编辑器与未来扩展](#editor)
- [10. 常见问题与维护记录](#troubleshooting)

<a id="start"></a>
## 1. 文档职责与快速选择

| 文档 | 职责 |
| --- | --- |
| [README.md](./README.md) | 项目入口：简要介绍、目录总览、常用命令、当前进度与待检查事项 |
| [PLAN.md](./PLAN.md) | 产品需求、架构、风格、阶段路线、验收状态及完成证据的 source of truth；历史记录集中于此 |
| 本手册 | 内容字段、真实维护接口、操作步骤、AI 录入规则及未来扩展参考；不产生新功能的实施授权 |
| [AGENTS.md](./AGENTS.md) | 约束 AI 的授权、范围、最小改动、验证与停点 |

Phase 1–4 已完成，Phase 5 可选增强、Phase 6 内容/旅行摄影扩展仍延后。本手册不重新开启它们。实际代码与文档发生冲突时先报告证据及最小建议，不能通过改文档授权重构。

| 想做的事 | 从哪里开始 |
| --- | --- |
| 自己新增一篇公开文章 | 第 3 节复制 Markdown 模板 → 第 7 节验证与发布 |
| 改标题、改正文、取消公开、删除文章 | 第 3.3 节；编辑时保持 slug 稳定 |
| 补充项目进展、收藏或个人介绍 | 第 4 节修改对应模块的数据 |
| 添加私人记录 | 第 5 节准备仓库外完整源 → 第 6 节交互加密 |
| 让 AI 录入公开素材 | 第 8 节复制任务模板；提交和上线分别授权 |
| 使用 Studio 编辑 Think | 第 9.3.2 节 PC 编辑器、第 9.3.3 节隔离预览、第 9.3.4 节 AI 建议、第 9.3.1 节独立 HTTP；[PLAN 6.8](./PLAN.md#studio-plan) 记录架构/状态 |
| 配置 AI、启动或停止 Studio | [第 9 节](#editor)；日常可用桌面快捷方式，AI 配置见 [9.3.4](#studio-ai) |
| 让 Agent 调用 Studio | [第 9.3.5 节](#studio-agent)，复用本机 HTTP API |
| 查 App、其他模块与私人编辑的验收 | [统一人工清单](#studio-batch-manual)、[PLAN M7–M15](./PLAN.md#studio-next-plan)；实现与自动验证后，真实 App 操作待反馈 |
| 查启动诊断与下一轮安排 | [启动基线](#studio-startup-baseline)、[M16.2 复测](#studio-startup-optimization)。[主线使用说明](#studio-authoring-usage)、[PLAN M16.1–M23](./PLAN.md#studio-authoring-plan) |
| 查目录分工、显示被隐藏的生成目录 | [README](./README.md) 的项目结构；[PLAN 仓库组织](./PLAN.md#repository-layout) 说明边界与视图设置 |

<a id="interfaces"></a>
## 2. 文件、路由和已有接口

### 2.1 哪些文件是输入

以下路径相对于仓库根目录 `D:\hjk202`。内容文件用 UTF-8 保存。

| 输入 / 位置 | 维护内容 | 生成的逻辑路由 |
| --- | --- | --- |
| `src/modules/think/content/<slug>.md` | Markdown frontmatter + 正文；只扫描本层 `.md` | `/think/`、`/think/<slug>/` |
| `src/modules/build/data.ts` | `publicProjects([...])` 中的项目对象 | `/build/`、`/build/<slug>/` |
| `src/modules/keep/data.ts` | `publicBookmarks([...])` 中的收藏对象 | `/keep/`、`/keep/<slug>/` |
| `src/modules/me/data.ts` | `publicProfile({...})`，或 `publicProfile(null)` | `/me/` |
| 仓库外，例如 `D:\MyPrivateSpace\vault.json` | 完整私人源 JSON；作者本地持有 | 不生成独立静态正文路由 |
| `public/vault/bundle.json` | CLI 生成的唯一正式密文入口；目前不存在，表示未配置 | `/vault/bundle.json` |

不要手改 `dist/`、生成的 HTML、`dist/search-index.json`、`node_modules/`、`.astro/` 或 `.cache/` 来维护内容。`public/` 中的文件会原样公开，不是私人目录。

### 2.2 从输入到页面

```text
模块内容 → 模块校验/加载 → pages.ts 与 Registry → 静态页面
                                  └→ count()/search() → search-index.json
仓库外私人 JSON → 模块校验 → 本地加密 → bundle.json
浏览器解锁 → 模块私人适配器 → 内存页面、搜索和统计
```

新增已有模块的内容，无需改 Home、Compass、Spotlight、Registry 或 Core。模块彼此独立，不互相 import；跨模块文章引用用普通站内 URL。

### 2.3 已存在的文件/库接口

这些是**本地代码接口**，不是 HTTP CRUD 接口。内容维护通常只需要改输入文件并运行命令。

| 对应源码 | 接口 / 输入 → 输出 | 用途与限制 |
| --- | --- | --- |
| [Think metadata](./src/modules/think/metadata.ts) | `publicArticles(entries)` → 带 `metadata` 的已公开文章，日期倒序 | 输入含 `frontmatter` 和 `rawContent()`；无效 slug/重复或无效公开数据抛错 |
| [Think loader](./src/modules/think/content.server.ts) | `posts` 构建期导出 | 只加载 `./content/*.md`；不是浏览器接口 |
| [Build model](./src/modules/build/projects.ts) | `publicProjects(entries)` → 已公开项目 | 维持数组顺序；校验项目和记录 |
| [Keep model](./src/modules/keep/bookmarks.ts) | `publicBookmarks(entries)`、`bookmarkGroups(entries)` | 前者校验公开条目，后者分组并检查同分类 id 的标签一致性；需要两者都通过 |
| [Me model](./src/modules/me/profile.ts) | `publicProfile(profile或null)` → 已公开 Profile 或 null | 只有一份公开资料，不是文章集合 |
| [模块类型](./src/core/module/types.ts) | `Module`、`ModuleMetadata`、`ModulePage` | 见下表；只在获准扩展模块时修改模块定义 |
| [搜索类型](./src/core/search/types.ts) | `SearchResult`、`PublicModule`、`SearchIndex` | 元数据投影；没有正文存储或写入能力 |
| [路径工具](./src/core/module/urls.ts) | `withBase(path, base?)` → 部署路径 | 逻辑站内绝对路径添加 base 一次；外链不用它 |
| [Vault operations](./scripts/vault/operations.mjs) | `validateModules/pack/verify/rekey/backup/restore` | 本地 Node 操作；真实口令只交互输入，详见第 6 节 |
| [Vault crypto](./src/core/vault/crypto.ts) | `validatePayload/readEnvelope/parseEnvelope/encryptVault/decryptVault` | 协议、尺寸、资源与认证加解密；不是模块业务校验的替代品 |
| 各模块 `vault.schema.ts` | `validateThink/validateBuild/validateKeep/validateMe(value)` | 纯模块 schema 校验；Build 的公开项目依赖还需 server/client 接点检查 |
| [Vault 视图类型](./src/core/vault/types.ts) | `VaultFactory(value,context): VaultView` | 解锁后的受控挂载/搜索/计数/清理接口，不是内容编辑接口 |

**Module 的全部字段**：`id/name/route/icon: string`，`order: number`，可选 `enabled: boolean`、`compassStatistic: 'peer-average'`，以及 `count(): Promise<number>`、`search(): Promise<SearchResult[]>`。id 与目录一致，格式 `^[a-z][a-z0-9-]*$`；id/route/order 各自唯一，order 是安全整数；enabled 默认 true。icon 是 24×24 SVG path 数据。注册模块按 order 排序。

**ModulePage 的全部字段**：`path: string`（模块内相对路径，`''` 表示首页）、`component: AstroComponentFactory`、`props: Record<string, unknown>`，可选 `head: {title?: string; description?: string}`。path 只允许小写字母、数字、连字符和分段 `/`，不能越出模块；每模块必须有首页，最终 URL 不得重复。定义由 `pages.ts` 默认导出数组提供，不是 `pages()` 运行时服务。

**SearchResult 的全部字段**：`{title: string, description: string, url: string, module: string}`。`PublicModule` 是模块元数据加 `count: number`；`SearchIndex` 为 `{modules: PublicModule[], results: SearchResult[]}`。公开搜索匹配标题和描述，不搜索完整正文；不要往协议里添加正文、私人来源或写入状态。

**VaultContext 的全部字段**：`module: PublicModule`、`publicTargets: readonly string[]`、`base: string`、`asset(id: string): string`（返回受控图片 URL）。**VaultView 的全部方法**：`count(publicCount: number): number`、`search(): SearchResult[]`、`hasTarget(id: string): boolean`、`mount(container: HTMLElement, id?: string): void | (() => void)`、`dispose(): void`。mount 可返回挂载清理函数，dispose 清掉适配器持有的数据引用；不能借扩展视图把私人数据写进静态搜索端点或存储。

### 2.4 可读取的 URL 与路径规则

| 地址 | 当前行为 |
| --- | --- |
| `/think/<slug>/` 等 | 已构建的公开详情 HTML；删除/取消公开后新构建不再生成 |
| `/search-index.json` | 公开模块和搜索投影；GET 读取，不能 POST 写文章 |
| `/vault/bundle.json` | 可公开下载的认证密文；未配置时 404 是正常情况 |
| `/think/#vault=<id>` 等 | 模块内定位私人目标；id 为 32 位小写十六进制，不在 URL 写标题或口令 |

站内逻辑地址不包含部署 base。`withBase` 拒绝 query/hash、反斜杠、双斜杠和 `.`/`..` 分段；先给纯路径加 base，再通过 URL API 加必要 query，私人 hash 使用既有目标机制。不要在 Markdown 中假定 `/` 开头的图片/链接一定会自动兼容子路径部署，应在 base 构建下实际检查。

<a id="think"></a>
## 3. Think：文章与随记

### 3.1 全部 frontmatter 字段

依据 [metadata.ts](./src/modules/think/metadata.ts)；正文由 Astro Markdown 编译。

| 字段 | 类型 / 必填情况 | 规则与作用 |
| --- | --- | --- |
| `slug` | string，始终必填，包括草稿 | `^[a-z0-9]+(?:-[a-z0-9]+)*$`；模块内包含草稿也不能重复；决定 URL |
| `title` | string，公开时必填 | 非空白；页面标题与搜索标题 |
| `summary` | string，公开时必填 | 非空白；列表、页面说明与搜索描述 |
| `date` | string，公开时必填 | 引号包裹的有效公历 `YYYY-MM-DD`，如 `"2026-10-15"` |
| `published` | boolean，可省略 | **只有 true 才公开**；false/省略不生成文章页面或搜索条目，字符串 `"true"` 无效 |
| `kind` | `'article'` 或 `'note'`，可选 | 省略按长文展示；note 在模块页显示正文前四行纯文字预览，点标题/阅读全文进入现有详情 URL；不改原文 |
| frontmatter 后的正文 | Markdown，公开时非空 | 页面会自行显示标题、日期、摘要，正文建议从 `##` 开始 |

文件名推荐 `<slug>.md`，实际路由以 frontmatter.slug 为准。修改标题不改 slug。**未来日期不会定时发布**：只要 `published: true`，本次构建就发布。当前验证器不为公开文本设置统一长度上限，也不严格拒绝所有未知 frontmatter 字段；作者/编辑器应只写上表支持字段，不把未知字段当成功能。

### 3.2 新增文章模板

新建 `src/modules/think/content/example-learning-note.md`，以下仅为格式示例，请替换为自己的真实内容：

<!-- example:think-markdown -->
```markdown
---
slug: example-learning-note
title: "一次学习记录"
summary: "记录一个问题、一次尝试和目前的结论。"
date: "2026-10-15"
published: true
kind: article
---

## 从问题开始

这里写正文。可以使用 **加粗**、`行内代码` 和列表。

- 我观察到了什么。
- 我如何验证这个判断。

## 仍需继续思考

这里记录尚未解决的问题。
```

随记使用相同文件与字段，把 `kind` 改成 `note` 即可；不要另造 notes 目录、独立数据系统或新模块。

### 3.3 增删改操作

| 操作 | 修改 | 验收重点 |
| --- | --- | --- |
| 新增 | 增加本层 `.md`，唯一 slug，`published: true` | 列表/详情/搜索各新增正确条目，Think count +1，Me 平均随之变化 |
| 编辑 | 只改目标文件标题/摘要/正文/日期等 | 保留 slug 与旧链接；正文正确，搜索投影同步；条目数量不变 |
| 保存公开草稿 | `published: false`，仍保留合法唯一 slug | 不出现在生成列表/详情/搜索；文件仍可能被公开仓库读取 |
| 取消公开 | 已公开文件改为 `published: false` | 新构建移除详情和搜索；已部署旧版在重新发布前仍可访问 |
| 删除 | 删除目标 `.md`；确认是否有被其他内容使用的图片再处理 | 数量减少，旧详情在新部署中为 404；模块首页仍存在 |
| 改 URL | 显式修改 slug，可同时改文件名以匹配 | 核对站内引用、旧分享链接、搜索和路由冲突；当前没有自动重定向 |

不公开与保密是不同属性。公开仓库中的草稿、Git 历史及 `public/` 文件均可能被他人读取；Markdown 未公开也不保证其导入资源完全不进产物。秘密必须走 Vault，不能靠 `published: false`。

### 3.4 图片、代码、公式与引用

- 公开文章可用常规 Markdown 标题、段落、列表、引用、代码围栏、链接与图片。代码围栏标明语言；代码过长需检查手机横向滚动，不能撑宽页面。
- 公开源图片可放 `content/assets/`，在文章内用 `![说明](./assets/example.webp)` 相对引用。该目录不会被当作文章扫描；具体格式、优化及 base 资源地址以实际 Astro 构建结果验证。
- 使用 `public/` 的资源会原样公开，地址需考虑部署 base；不要上传真实私人图片、口令、源 JSON、无权发布的图片或带敏感元数据的素材。当前工具不替作者自动去除照片元数据。
- 外链图片会请求第三方服务器。私人图片不引用远程地址；使用第 5 节的加密 assets。
- 当前没有通用 LaTeX 数学渲染配置，不能承诺 `$...$`、`$$...$$` 自动变公式。现有 Attention 公式使用文章内特定 HTML；需要新的通用公式能力时另行规划。
- 公开 Markdown 是可信作者源，Astro 可编译其中 HTML。不要让不可信上传内容直接作为编译输入；未来编辑器预览需见第 9 节安全边界。当前 `.mdx`、交互组件、自动目录、代码复制、RSS 等不能视为已支持的维护接口。

<a id="public-modules"></a>
## 4. Build、Keep、Me：全部公开字段

以下模型是模块自己的 TypeScript 数据，不是 Markdown frontmatter。保留各自 `data.ts` 中的 import、export 和原有其他条目，只增改本次目标对象。下面 JSON 示例展示对象格式；嵌入 TS 时放入对应函数参数，不要将整个文件替换成裸 JSON。

共同规则：只有 `published: true` 才公开；slug 唯一性及合法性也检查未公开条目。未公开数据也不是秘密。现有公开校验不等于严格外部 JSON schema；未知字段、恶意对象和错误类型不能交给运行时侥幸处理，未来外部写入需要额外严格解析。当前公开模型没有统一文本/数组长度上限。

### 4.1 Build 项目

依据 [projects.ts](./src/modules/build/projects.ts)。入口 `export const projects = publicProjects([...]);`，清空为 `publicProjects([])`。

| 字段 | 类型 / 要求 |
| --- | --- |
| `slug` | string，合法唯一，必填，决定 `/build/<slug>/` |
| `title`、`summary` | 非空 string，公开时必填 |
| `published` | 可选 boolean，只有 true 公开 |
| `period` | 可选非空 string，展示文本，如 `2026.10 — 至今`；不自动解析为日期 |
| `sections` | `ProjectSection[]`，公开时至少一段；结构见下表 |
| `keywords` | 可选 `string[]`，每项非空 |
| `links` | 可选 `{label: string, url: string}[]`；label 非空，url 为有效 http/https |
| `status` | 可选 `'in-progress'` / `'completed'` / `'paused'` |
| `milestones` | 可选项目阶段数组，字段见下表 |
| `updates` | 可选更新数组，字段见下表；展示按日期倒序 |
| `issues` | 可选问题数组，字段见下表 |

| 子对象 | 全部字段与规则 |
| --- | --- |
| `ProjectSection` | 可选 `title: string`、`paragraphs: string[]`、`items: string[]`、`code: string`；文本非空。当前校验允许仅标题，但维护时应有真正正文；code 用字符串中的 `\n` 换行 |
| `milestones[]` | 必填 `title: string`、`status: 'planned'/'in-progress'/'done'`；可选非空 `description: string` |
| `updates[]` | 必填 `date: 'YYYY-MM-DD'`、`title: string`；可选 `accomplishments/challenges/nextSteps: string[]`；至少一组含实际内容，各项非空 |
| `issues[]` | 必填 `title: string`、`description: string`、`status: 'open'/'resolved'`；可选非空 `resolution: string`，解决后建议填写，当前未强制 |

<!-- example:public-build -->
```json
{
  "slug": "example-project",
  "title": "示例项目",
  "summary": "说明项目要解决的具体问题。",
  "published": true,
  "period": "2026.10 — 至今",
  "status": "in-progress",
  "sections": [{"title": "目标", "paragraphs": ["这是一份格式示例。"], "items": ["第一项工作"], "code": "example\noutput"}],
  "keywords": ["学习"],
  "links": [{"label": "项目地址", "url": "https://example.com/"}],
  "milestones": [{"title": "首次验证", "status": "done", "description": "记录验收结果。"}],
  "updates": [{"date": "2026-10-15", "title": "阶段记录", "accomplishments": ["完成一项验证。"], "challenges": ["记录一个限制。"], "nextSteps": ["继续核对边界。"]}],
  "issues": [{"title": "示例问题", "description": "问题与影响。", "status": "resolved", "resolution": "说明如何解决。"}]
}
```

项目列表与阶段保持数据顺序；updates 展示按日期倒序。同日记录不要依赖隐含时刻排序。一个项目计数为 1，阶段/更新/问题不另算项目。段落和列表是普通文本，不能期待其中 Markdown 自动排版。

**删除、取消公开或改公开项目 slug 前，必须检查外部私人源的 `build.supplements[].publicSlug`。** 私人补充依赖真实公开详情；关联失效会导致本地校验或浏览器整包解锁失败。不要为了删公开项目而静默丢弃私人补充；作者选择改成独立私人项目、修改关联或明确删除，再对同一候选重新打包和验证。

### 4.2 Keep 收藏夹

依据 [bookmarks.ts](./src/modules/keep/bookmarks.ts)。入口 `export const bookmarks = publicBookmarks([...]);`；空为 `publicBookmarks([])`。

| 字段 | 类型 / 要求 |
| --- | --- |
| `slug` | 合法唯一 string，必填，决定 `/keep/<slug>/` |
| `title`、`description` | 非空 string，公开时必填 |
| `published` | 可选 boolean，只有 true 公开 |
| `sourceUrl` | 有效 http/https string，公开时必填；来源外链 |
| `note` | `string[]`，公开时至少一个非空段落；普通文本，不解析 Markdown |
| `category` | 可选 `{id: string, label: string}`；id 同 slug 格式且不能是 `all`，label 非空；相同 id 必须相同 label |
| `kind` | 可选非空 string，如“课程”“工具”“文章”，展示标签，不限制固定枚举 |

<!-- example:public-keep -->
```json
{
  "slug": "example-reference",
  "title": "示例资料",
  "description": "一句话说明为什么值得保存。",
  "published": true,
  "sourceUrl": "https://example.com/",
  "note": ["记录自己的使用感受与适用场景。"],
  "category": {"id": "reference", "label": "参考资料"},
  "kind": "网站"
}
```

分类缺省为 `{id: 'uncategorized', label: '未分类'}`；使用该 id 时保持标签一致。条目和分类按首次出现顺序展示。搜索打开站内收藏详情，详情中的来源链接再打开外站（新标签、noopener/noreferrer）。现有分类使用 `?category=<id>` 保留返回位置；无效值回全部。当前没有局部文本查询、排序控件或自动抓取网站元数据。

新增/编辑/删除/取消公开针对数组中单个对象；同分类的 label 改名需同时改所有相关对象。一个收藏计数为 1，不按分类计数。

### 4.3 Me 个人资料

依据 [profile.ts](./src/modules/me/profile.ts)。入口 `export const profile = publicProfile({...});`；无公开资料用 `publicProfile(null)`，不新造多份 Profile。

| 字段 | 类型 / 要求 |
| --- | --- |
| `published` | 可选 boolean，只有 true 公开 |
| `name` | 非空 string，公开时必填 |
| `description` | 非空 string，公开时必填；摘要和搜索描述 |
| `paragraphs` | `string[]`，公开时至少一个非空段落；普通文本 |
| `links` | 可选 `{label: string, url: string}[]`；label 非空，url 有效 http/https |

<!-- example:public-me -->
```json
{
  "published": true,
  "name": "示例作者",
  "description": "一段简短的自我介绍。",
  "paragraphs": ["这里记录自己的兴趣与经历。"],
  "links": [{"label": "个人链接", "url": "https://example.com/"}]
}
```

资料存在时真实 count 为 1，否则 0。Compass 上 Me 显示其他启用模块实际 count 的算术平均，包含 0；不是手动统计字段。私人补充段落不额外算一份 Me，也不手动修改平均值。

<a id="private-data"></a>
## 5. 私人内容：数据协议与全部字段

### 5.1 完整源文件的顶层结构

源文件只放仓库外，例如 `D:\MyPrivateSpace\vault.json`，不用本仓库 `.cache`。JSON 无注释、无尾逗号，用 `\n` 表示字符串内换行。模块内部模型由模块管理，顶层只做分装，不建立统一文章模型。

```text
VaultPayload = {
  version: 1,
  modules: { think?: ThinkVault, build?: BuildVault, keep?: KeepVault, me?: MeVault },
  assets: { [32位小写十六进制id]: { type: 图片MIME, data: 规范Base64 } }
}
```

协议允许最多 16 个合法 module id，但本项目当前只启用这四个；加入未知/缺适配器模块会失败。可省略不需要的模块，**assets 顶层字段仍必填**，没有图片写 `{}`。模块对象不接受未知字段；不要写 `published`、公开 slug、任意脚本字段或旧格式。

**pack 是完整替换，不是追加接口。** 每次源 JSON 必须包含希望保留的全部模块、条目和 assets。只把一篇新文章交给 pack，会让新密文不再包含之前未提供的内容。外部源是作者日常编辑的原本，密文是它的一次完整发布版本。

### 5.2 私人共用校验规则

依据 [validation.ts](./src/core/vault/validation.ts) 与各模块 schema。

| 项目 | 当前硬限制 |
| --- | --- |
| 业务 string | 非空白，默认最多 2,000 个 JS UTF-16 code unit；原样保存，不自动 trim |
| 数组 | 默认最多 200 项；空数组是否可用由所在字段进一步决定 |
| `id` | `/^[a-f0-9]{32}$/`，随机且稳定，不能从私人标题派生；条目 id 在模块校验集合内唯一 |
| 日期 | 有效 `YYYY-MM-DD`，不做定时发布 |
| URL | 最多 4,000 UTF-16 单位，有效 http/https，禁止用户名/密码，返回 URL 规范化值 |
| 字段 | 严格白名单，未知字段拒绝；必填字段不可省略或用 null 代替 |
| 明文包 | JSON UTF-8 序列化不超过 8 MiB；源文件读取时也有 8 MiB 字节限制 |
| 密文文件 | 本地文件读取不超过 12 MiB；浏览器包文本/输出也受大小界限约束 |
| 图片 | 最多 8 张，每张原始字节最多 512 KiB；仅 PNG/JPEG/WebP，校验文件签名，Base64 必须规范 |

普通字段长度计 UTF-16，包大小计 UTF-8 字节，口令另计 Unicode 字符与 UTF-8 字节，三者不可混用。上述是当前实现边界，不代表图片会自动压缩或文本自动截断。

作者可用 Node 在本地生成新 id；这条命令不读取私人材料：

```powershell
node --input-type=module -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(16).toString('hex'))"
```

### 5.3 ThinkVault

[schema](./src/modules/think/vault.schema.ts)：`{posts: PrivatePost[]}`，posts 必填，最多 200 篇；可为空。

| PrivatePost 字段 | 类型 / 要求 |
| --- | --- |
| `id` | 必填 32 位小写十六进制；本模块唯一，编辑时保留 |
| `title`、`summary` | 必填非空 string，各最多 2,000 UTF-16 单位 |
| `date` | 必填有效 `YYYY-MM-DD` |
| `kind` | 必填 `'article'` 或 `'note'`，私人没有省略默认值 |
| `body` | 必填非空 string，最多 100,000 UTF-16 单位；受控 Markdown |

按日期倒序、同日按 id 排序；每篇独立条目使 Think 解锁后 count +1。

**私人 Markdown 是受控子集，与公开 Astro Markdown 不同。** 当前 [解析器](./src/modules/think/vault.markdown.ts) 与 [DOM 渲染器](./src/modules/think/vault.client.ts) 支持段落、`#`/`##`/`###` 标题（对应内容区 h2/h3/h4）、简单引用、平级有序/无序列表、三反引号代码块、加粗、行内代码、简单链接与加密图片。代码语言标记不提供公开文章相同的高亮；不承诺嵌套列表、表格、脚注、复杂链接、公式或 HTML/MDX 执行。

站内链接使用不带 query/hash 的逻辑绝对路径；外链只允许受检 http/https。图片只能用 `![说明](asset:<id>)`，不加载远程私人图片。任意 `asset:<32hex>` 引用必须在 assets 中存在；别在代码示例中误留不存在的真实格式 asset id。

### 5.4 BuildVault

[schema](./src/modules/build/vault.schema.ts)：`{projects: PrivateProject[], supplements: PrivateSupplement[]}`。两数组都必填，各最多 200 项，可分别为空；**两个数组合起来 id 也不能重复**。

| PrivateProject 字段 | 类型 / 要求 |
| --- | --- |
| `id`、`title`、`summary` | 必填；id 规则同上，title/summary 各最多 2,000 |
| `sections` | 必填、非空，最多 200 段；段内可选 `title`、`paragraphs: string[]`、`items: string[]`、`code`；不能是空对象。title 默认 2,000，paragraphs/items 各最多 200 项、每项 2,000，code 最多 30,000 |
| `period` | 可选非空 string，最多 2,000 |
| `keywords` | 可选 `string[]`，最多 30 项，每项非空且最多 2,000；省略归一为空数组 |
| `links` | 可选 `{label,url}[]`，最多 20 项；label 默认 2,000，URL 规则同上；省略为空数组 |
| `status` | 可选 `'in-progress'/'completed'/'paused'` |
| `milestones/updates/issues` | 可选数组，各最多 200，省略归一为空；字段同第 4.1 节，各普通文本最多 2,000，文本数组各最多 200 项；updates 至少有一组非空内容 |

| PrivateSupplement 字段 | 类型 / 要求 |
| --- | --- |
| `id` | 必填，和独立项目合起来唯一 |
| `publicSlug` | 必填，最多 100，符合公开 slug 规则，必须对应当前确实公开的 Build 项目 |
| `title` | 必填，最多 2,000 |
| `sections` | 可选，省略为空；规则同独立项目 |
| `milestones/updates/issues` | 可选，规则同上；sections 与这三组不能全部为空 |

独立项目 count +1；补充只附着现有项目，不额外计数。[server](./src/modules/build/vault.server.ts) 校验当前公开数据，[client](./src/modules/build/vault.client.ts) 校验实际公开目标，两端都不能有悬空 publicSlug。段落和记录是普通文本，不是 Markdown。段里只放空数组可能通过局部结构检查，但作者应写实际内容，不能依赖边界宽松值制造空卡片。

### 5.5 KeepVault 与 MeVault

| 模块 | 全部字段与限制 |
| --- | --- |
| [Keep](./src/modules/keep/vault.schema.ts) | `{bookmarks: [...]}`，数组必填、最多 200 项；每项必填 `id/title/description/sourceUrl/note`，id 唯一，note 必须非空、最多 200 段。可选 `category: {id,label}`、`kind`；分类 id **也是 32 位小写十六进制**，不是公开分类 slug。同分类 id 的 label 必须一致。文本默认 2,000，URL 规则同上 |
| [Me](./src/modules/me/vault.schema.ts) | `{paragraphs: string[], links?: {label,url}[]}`；paragraphs 必填、最多 200 段，可以是空数组；links 最多 20，省略为空；文本默认 2,000、URL 规则同上。没有第二份 name、id、slug 或 published |

Keep 每个私人收藏 count +1。Me 仅补充原资料，真实 count 不增加；Compass 平均随其他模块的实际数量重新计算。

### 5.6 一份可通过 schema 的完整示例

以下内容与 id 均公开、非敏感，只用来理解格式。实际源替换成真实材料时不要发给聊天 AI；新 id 自行随机生成，编辑已有条目则保留其 id。

<!-- example:private-payload -->
```json
{
  "version": 1,
  "modules": {
    "think": {
      "posts": [{"id": "11111111111111111111111111111111", "title": "示例随记", "summary": "一份非敏感格式示例。", "date": "2026-10-15", "kind": "note", "body": "# 一个问题\n\n这是一段示例正文。"}]
    },
    "build": {
      "projects": [{"id": "22222222222222222222222222222222", "title": "示例私人项目", "summary": "独立项目的格式。", "sections": [{"paragraphs": ["记录思路与验证。"]}], "status": "in-progress"}],
      "supplements": []
    },
    "keep": {
      "bookmarks": [{"id": "33333333333333333333333333333333", "title": "示例链接", "description": "一份参考资料。", "sourceUrl": "https://example.com/", "note": ["说明保存原因。"], "category": {"id": "44444444444444444444444444444444", "label": "私人参考"}, "kind": "网站"}]
    },
    "me": {"paragraphs": ["一段非敏感的补充介绍。"], "links": []}
  },
  "assets": {}
}
```

若给 NEMU 增加私人补充，把下面对象加入**外部源**的 `modules.build.supplements`，不要放公开 `data.ts`。该例依赖目前公开项目 slug `nemu`；未来改名/删除该项目必须同步处理。

<!-- example:private-supplement -->
```json
{"id": "55555555555555555555555555555555", "publicSlug": "nemu", "title": "示例补充", "sections": [{"paragraphs": ["这是一份公开格式示例，不含私人资料。"]}]}
```

### 5.7 私人图片

assets 的 key 是新随机 id，value 只有 `type` 和 `data`；MIME 为 `image/png`、`image/jpeg`、`image/webp`。data 是原图字节的规范 Base64，**不带** `data:image/...;base64,` 前缀。先在作者本地压缩/检查素材，再纳入外部源，不在仓库生成明文缩略图。

文章写 `![说明](asset:图片id)`，同一 id 可重用。删除最后一个引用后可从外部 assets 删除该图，再整包重打；不能先删仍被引用的资源。当前没有上传服务、文件路径引用、SVG/PDF/音视频或任意附件支持。解锁时图片仅转为会话 Blob URL，锁定清理 URL 与挂载，不承诺 JS 运行时绝对内存擦除。

<a id="private-operations"></a>
## 6. 私人维护命令与安全边界

### 6.1 命令的运行方式

在仓库根目录打开本地交互终端。Windows 使用 `npm.cmd`，其他平台使用 `npm`。路径示例是**仓库外、由你选择的目录**，请换成自己的路径；不要选择项目内 `src`、`public` 或 `.cache`。

口令由终端不回显提示输入，不写入命令参数、环境变量、脚本、聊天、CI secrets、截图或日志。CLI 要求 stdin/stdout 是交互 TTY；集成工具不支持时，自己在正常终端运行，不改成明文参数绕过。输入框不自动 trim/规范化/截断，空格与符号按字面参与密钥派生。

| 命令 | 用途 | 推荐参数与口令 |
| --- | --- | --- |
| `vault:pack` | 外部完整 JSON → 新密文包 | 必填 `--source`；可选 `--output`，默认 `public/vault/bundle.json`；输入新口令两次，不使用 `--input` |
| `vault:verify` | 解密并验证载荷、模块和关联，不输出正文 | 可选 `--input`，默认正式包；输入对应口令；不需要 `--source/--output` |
| `vault:rekey` | 验证旧包并用新盐/IV/口令重加密 | 可选 `--input/--output`，默认正式包；旧口令一次、新口令两次 |
| `vault:backup` | 复制密文到仓库外 | 可选 `--input`，必填外部 `--output`；无口令，只检查 envelope 格式，不代表已认证解密 |
| `vault:restore` | 从仓库外备份验证并原子恢复密文 | 必填外部 `--input`；可选 `--output`，默认正式包；输入该备份当时的口令 |

每个 flag 是 `--名称 路径` 一对，路径带空格加双引号；未知、重复或缺值参数失败。不要把解析器偶然接受但命令不使用的 flag 当成稳定接口。成功退出 0，输出 `Vault operation completed.`；失败退出 1，仅输出通用错误，不泄露正文。有效旧包在失败时不被替换；首次没有包则失败后仍无包。

```powershell
# 第一次配置：先在外部编辑完整源，再交互输入口令
npm.cmd run vault:pack -- --source "D:\MyPrivateSpace\vault.json"
npm.cmd run vault:verify

# 以后每次修改前备份，备份名请包含日期/版本以免覆盖唯一副本
npm.cmd run vault:backup -- --output "D:\MyVaultBackup\bundle-2026-10-15.json"
# 在项目外编辑原完整 JSON，保留其他模块与条目
npm.cmd run vault:pack -- --source "D:\MyPrivateSpace\vault.json"
npm.cmd run vault:verify

# 单独更换口令，或恢复某份旧密文；二者不是每次录入都要做
npm.cmd run vault:rekey
npm.cmd run vault:restore -- --input "D:\MyVaultBackup\bundle-2026-10-15.json"
```

上面的 rekey 与 restore 是独立操作示例，不是应连续照抄的发布流水线。外部 source/restore 输入必须是普通文件，不允许源文件符号链接、路径逃逸或 Windows ADS。输出在仓库内只允许固定的 `public/vault/bundle.json`，也可显式输出外部密文；backup 只能写外部。操作使用临时密文文件加原子替换，不生成项目内明文中间文件。

### 6.2 本地库调用接口

[operations.mjs](./scripts/vault/operations.mjs) 当前导出如下；供将来可信本地工具复用，普通作者用 CLI 即可：

| 签名 | 结果 / 责任 |
| --- | --- |
| `validateModules(value): Promise<VaultPayload>` | 校验 envelope 内的解密载荷、存在的模块 server adapter、Build 关联和 assets 引用；返回归一化模块数据 |
| `pack(source, output, password): Promise<void>` | 读取仓库外源、校验、加密并写允许的输出；完整替换 |
| `verify(input, password): Promise<VaultPayload>` | 认证解密并作模块校验；**返回值含明文，调用方不得打印或持久化到项目** |
| `rekey(input, output, oldPassword, newPassword): Promise<void>` | 验证后重新加密；不改变业务内容 |
| `backup(input, output): void` | 密文格式检查后外部备份；不做口令认证 |
| `restore(input, output, password): Promise<void>` | 外部备份通过验证后写回允许位置 |

`source/input/output/password` 均为 string。文件操作以**当前工作目录**为仓库根，调用方必须从正确项目根运行，不接受浏览器提供任意路径。失败抛异常，由 CLI 统一隐藏细节；库本身不是带身份认证的服务。

`encryptVault(value,password): Promise<Envelope>` 和 `decryptVault(value,password): Promise<VaultPayload>` 只负责共用协议/认证，不替代 `validateModules` 的模块业务检查。未来工具要复用模块 schema 与 server/client 边界，不能“解密成功就全部信任”。

### 6.3 加密格式与口令

密文 `Envelope` 的全部字段：`version: 1`、`iterations: number`、`salt: string`、`iv: string`、`ciphertext: string`，后面三项为规范 Base64，未知字段拒绝。盐为 16 字节，IV 为 12 字节；认证标签附在 ciphertext 中。

- 当前新包使用 **PBKDF2-HMAC-SHA-256，600,000 次**，派生非可导出 AES-256 密钥；读包接受整数 600,000–1,000,000 次，不自动降低参数。
- 使用 **AES-256-GCM，128 位 tag**；每次加密重新随机生成盐与 IV。AAD 是 UTF-8 编码的 `JSON.stringify(['personal-space-vault', 1, iterations, salt, iv])`，未来工具必须逐字节兼容，不能自改顺序或格式。
- 新口令至少 16 个 Unicode code point，且 UTF-8 不超过 1,024 字节。允许可打印 Unicode 字母、组合标记、数字、标点、符号与空格分隔符；拒绝控制字符、格式控制/零宽字符、换行及孤立代理字符。**字符白名单不是防破解机制**。
- 建议使用独立、未公开、由密码管理器产生的随机长口令，例如 24–32 个随机字符；不要用姓名、生日、重复字符或公开验收口令。达到最短长度不等于高熵。
- 口令和外部明文源由作者另行可靠保管；没有找回口令、账号重置或服务端托管密钥功能。

读取公开仓库的人可以得到算法、公开内容、当前与历史密文，并离线猜口令。让 AI 爬仓库不会让 AES 自动失效，**但弱口令、曾提交的明文/口令、受控浏览器或被篡改的站点代码仍会泄露**。密文大小与更新时间也不是隐藏的。当前方案不是独立安全审计或“绝对不会被解密”的保证。

### 6.4 修改、删除、转换与会话

1. 修改前外部备份当前密文，保留原完整源与相应口令；新条目生成 id，编辑保留 id。
2. 删除条目从外部 JSON 数组移除，并核对补充关联和图片引用；重新打包、verify、生产预览与发布。不要直接编辑 ciphertext 的字段来删文章。
3. 删除最后一份私人资料时，可保留合法空包，或经作者明确决定删除 `public/vault/bundle.json` 使入口回未配置状态；这是待发布改动，不能顺手删除历史备份或私人原本。
4. “公开 ↔ 私人”不是切换一个字段：两边模型、稳定标识和渲染不同。须作者明确批准，分别迁移、核对链接/计数、构建/重打包；私人转公开尤其要逐项确认可披露信息。公开转私人不能撤销已公开的 Git 历史、下载或缓存。
5. rekey 只保护新包；旧包/备份仍使用旧口令，无法远程销毁别人拿到的副本。restore 恢复密文，不会自动恢复公开项目代码、图片或整个网站版本，必须验证相应 Build 关联仍成立。

解锁后的私人内容与投影在内存中。主动锁定、10 分钟闲置、页面转后台/pagehide、刷新、新标签或 BFCache 恢复会要求重新解锁；正常站内导航可以保留会话。手机软键盘造成的普通焦点变化不应被当成锁定。不要通过 localStorage、IndexedDB、URL、分析事件或持久化预览保存口令、密钥和解密内容来绕开这些约定。

<a id="workflow"></a>
## 7. 从修改到预览、验证、上线和恢复

`astro.config.mjs` 显式设置 `prefetch: false`：公开链接沿用整页导航，私人会话沿用既有受控导航，悬停/聚焦不预先请求文章。此设置避免 Windows WebKit 在整页卸载时启动隐式预取所触发的访问控制错误；不要仅为提速重新开启。变更导航或预取策略时需复验根/base、快速点击与完整 pageerror 记录。

### 7.1 一次维护的完整闭环

1. 读 AGENTS、PLAN、本手册相关章节；查看 Git 状态和目标文件，确认已有用户改动。
2. 列出这次新增/修改/删除的目标、公开性、稳定 slug/id、相关素材与允许文件。只改本次内容，缺事实就询问，不填虚构经历。
3. 公开内容改模块输入；私人源作者自己在仓库外改，交互 pack/verify，项目内仅出现获准密文。
4. 本地开发预览检查内容；再对生产构建运行下列检查和实际浏览器 smoke。发现问题先修复，再继续，不用“只是文案”跳过实际内容/链接校验。
5. 审查差异、验证报告和敏感边界。按用户明确要求提交、推送或发布；三个动作分别说明，修改文件不自动授权上线。
6. 记录本批内容、验证、候选 SHA 与发布结果。没有执行的步骤写未运行，完成获准范围后停止。

文章录入不是自动开启未来功能 milestone。若确需新增字段、通用公式、附件、编辑服务或换数据模型，先指出超出普通内容维护的部分，另行规划授权。

### 7.2 环境与本地预览

项目 `.node-version` 为 **22.23.2**，packageManager 为 **npm 10.9.8**；以仓库版本文件和 package-lock 为准，正常维护不升级依赖。

```powershell
# 初次或锁文件变化后安装
npm.cmd ci
# 开发预览，终端保留运行；浏览器访问输出的地址
npm.cmd run dev -- --host 127.0.0.1 --port 4321
```

修改 `.md`/data.ts 后开发服务器会重载；私人包变化需确认获取的是新包并重新解锁。正式验收使用生产构建，不能只看开发模式。

### 7.3 公开内容和密文改动的检查门槛

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run test:e2e
```

逐条检查退出码，失败先停止定位。`build` 自动运行 `prebuild` 公开/Vault 边界检查，不绕过。首次运行浏览器测试需 `npx.cmd playwright install chromium webkit`。E2E 默认测试真实 `dist`，自动启动 `127.0.0.1:4410`，不要占用该端口或用别的开发服务器代替。

人工生产预览另开终端：

```powershell
npm.cmd run preview -- --host 127.0.0.1 --port 4322
```

| 操作 | 必要 smoke / 独立预期 |
| --- | --- |
| Think 新增/编辑 | 模块列表、note 内联与详情、标题/日期/摘要/正文/代码/图片、刷新/Home/返回；Spotlight 搜索标题或摘要；count/Me 平均正确 |
| 隐藏/删除 | 当前构建没有详情与搜索；旧 URL 新部署为 404；模块首页/空态仍可用；无其他条目误删 |
| Build | 项目详情、阶段/更新/问题与外链；更新倒序；私人 publicSlug 依赖有效；仅项目新增影响 count |
| Keep | 分类/未分类、条目详情与来源链接、保留分类的返回；标签一致、外链正确 |
| Me | 姓名/简介/段落/链接正确；count 和 Compass 平均规则保持 |
| 私人包 | 作者本地真实解锁、四模块私人优先/公开完整、来源与计数、搜索/深链/锁定/后台清理、错误口令；不录制或上传真实正文/口令证据 |
| 手机/样式受影响 | 窄屏和横屏可读、长代码/网址/图片不撑页，搜索软键盘下输入/关闭/结果可达，按钮无旧选中状态 |

公开搜索只有标题/描述：正文新词不一定可搜索，这不是自动的失败。当前真实内容基线各 1 份，测试中可能引用固定标题/数量。内容新增后阅读相关测试，按**独立确认的新事实**更新必要预期，不把实际生成索引当作自己的唯一期望，也不删负例/弱化断言。不要为了让旧基线测试通过而隐藏真实新内容。

路由、资源与内容加载需额外检查 base；测试和发布的完整门槛见 [PLAN 第 7 节](./PLAN.md#verification)。常用 base 检查：

```powershell
npm.cmd run build -- --base /personal-space/ --outDir .cache/base-dist
$env:E2E_BASE_PATH = '/personal-space/'
$env:E2E_DIST = '.cache/base-dist'
npm.cmd run test:e2e
Remove-Item Env:E2E_BASE_PATH, Env:E2E_DIST
```

临时环境用后清理；即使失败也清理后再做根路径检查。发布候选还执行 PLAN 中 WebKit、隔离内容/扩展/设计/移动/会话与发布边界检查；日常变更不能改脚本跳过 CI 必需项。纯文档维护仅做结构、链接、源码对应、范围与状态验证，不因本手册存在而要求每次改文档构建网站。

### 7.4 Git 与 GitHub Pages

现有仓库 `hjk202/hjk202.github.io`，分支 main，GitHub Pages 根路径 `/`。**没有 `npm run deploy`，push 也不会直接发布。** 具体流程依据 [工作流](./.github/workflows/deploy.yml) 与 [PLAN 发布约定](./PLAN.md#release)：

1. 检查 `git status --short`、`git diff --check`、目标文件差异与候选提交，不覆盖别人未提交工作。
2. 获准保存时精确选择文件提交，不无差别 `git add .`。只提交真实公开素材、必要文档/测试或获准密文，绝不提交外部明文/口令。
3. 获准推送时推送目标提交。push/PR 只跑 check；核对 CI 对应的是哪个 SHA。
4. 获准上线时，在 GitHub 仓库 Actions 选择 **Verify and publish Personal Space**，点击 **Run workflow**，分支选 main。手动运行的 check 全通过才上传受测 `dist`，deploy 发布同一产物，不重建。
5. 记录 source SHA、run URL、产物身份/摘要，并按 PLAN 核对线上页面、索引、资源、实际产物一致性与受影响交互；必要时让作者手机复验。

CI 不接受真实明文/口令，不负责 pack/rekey。没有真实私人包时 `/vault/bundle.json` 404 和“尚未配置私人内容”是预期，不应该为了 CI 造正式示例密文。测试只在隔离目录使用公开非敏感 fixture。

### 7.5 恢复与记录

- 普通内容误改优先恢复目标内容，做新的提交后重新验证发布；不 `reset --hard`、不强推、不回滚无关用户改动。
- 整站回退按 PLAN 使用适用的已验证源，在隔离环境验证后以 `git revert` 等明确新提交发布；旧公开版本可能没有 Private，不能只看页面正常就声称功能完整。
- 私人内容从外部密文备份 `vault:restore`，仍需对应旧口令，并核对公开 Build 依赖；口令丢失不能由恢复命令绕开。
- 日常录入可在获准的提交说明/本批报告中记录，不必每篇文章都扩充 PLAN 历史。产品能力、schema 或阶段状态变更才同步 PLAN；本手册在接口/命令实际改变时同步，README 只报主线。

建议每批报告：目标及可见性、涉及文件、slug/id 是否变化、条目增减、运行命令与退出码、smoke 与限制、是否已提交/推送/上线、候选 SHA/Actions 链接（若有）。真实私人记录只报告操作结果，不报告标题/正文。

<a id="ai"></a>
## 8. 让 AI 帮忙维护

### 8.1 录入规则

AI 先读 AGENTS、PLAN 和本手册相关部分，再读目标源、模型/加载器与相关测试；检查工作区已有改动。普通内容任务只维护指定模块和必要预期，不借机做 Phase 5、加新字段、改视觉、升级依赖或搭后台。

公开输入可包括正文、标题、摘要、日期、分类、项目事实与合法公开素材。没有给定的信息可请求确认；可拟标题/摘要供作者批准，但不得虚构作者经历、项目成果、完成状态、项目仓库地址或引用来源。转录时保留原意，结构性排版可以按已支持的模型处理。

真实私人源、口令与解密正文不发给聊天 AI 或远程模型。AI 可以解释格式、用非敏感 fixture 检查工具、指出路径/校验问题；作者本人在外部本地录入与交互加密。现有授权中“私人内容留在本地”不能因让 AI 代写而被默默绕过。

### 8.2 新增公开文章模板

```text
请按 AGENTS.md、PLAN.md、MAINTENANCE.md 维护内容，本次不开发新功能。

目标：在 Think 新增一篇公开 article（或 note）。
slug：<稳定的英文小写 slug>
标题：<标题>
摘要：<摘要；如果没有，先给我建议>
日期：<YYYY-MM-DD>
published：true（或 false；草稿仍属于公开仓库资料）
正文：
<我的真实素材>

只改对应 .md、必要公开图片及与本批事实相关的测试预期。
先说明文件和验收预期；保留现有内容，不修改 slug 以外的链接规则。
运行 lint/typecheck/test/build 和必要根/base 页面、搜索、计数 smoke；失败先修复。
报告实际修改、验证和限制后停止。本次不提交、不推送、不上线。
```

### 8.3 编辑、删除、收藏和项目模板

```text
请仅维护 <模块> 中的 <slug/明确标题>，先读现有数据和相关模型。
操作：<编辑 / 取消公开 / 删除 / 新增收藏 / 补项目更新>
本次准确素材：<正文/来源 URL/分类/项目记录>
保持：<slug、其他条目、现有发布日期等>
允许删除的素材：<明确清单；没有则不删>
若影响 Build 私人补充关联，先报告，不自动删除或读取私人源。
不开发新功能，按维护手册验证，完成后停止。
Git/上线授权：<仅本地修改 / 验证后提交 / 验证后提交推送并手动发布>
```

删除默认不清理 Git 历史或整个图片目录。对大批量录入先列逐项清单和预期数量，逐项校验后做整批验证；不把“整理内容”解释为全站改写。涉及未知模型或新模块先回到规划流程。

### 8.4 要求 AI 继续实施 Studio 时

Studio 方案已整理在 [PLAN 6.8](./PLAN.md#studio-plan)。M0–M6 全部 Done，首版、百炼文本建议与 Agent adapter 本地验收通过；M5 真实五项调用与实际 UI 已于 2026-10-17 核验。后续工作不根据路线顺序自动开始。

**本轮已完成 M5 剩余验收与文档并停止，不新增功能，不提交、推送或发布。** 仅方案认可或本手册中的未来接口不是其他单元的实施批准，不能直接把第 9 节全部做出来。

<a id="editor"></a>
## 9. Studio 作者接口、PC 编辑器与未来扩展

M0 提供作者契约/内存纯函数，M1 提供独立本地文件服务，M2 提供 `/api/authoring/v1/think` HTTP 接口，M3 增加基础 PC Web Editor，M4 增加按钮触发的隔离 Astro 预览；M5 增加百炼单次 AI 建议，真实调用已核验；M6 提供独立 Node/JSON-lines stdio Agent adapter。架构、目录、HTTP 合同、milestone 和验收状态统一以 [PLAN 6.8](./PLAN.md#studio-plan) 为准；本节维护作者 DTO、源文件与实际调用语义，不另行定义实施范围。网站继续是静态读站，Core 和访客页面不增加统一内容写入层。

| 当前本地纯函数 | 输入 → 输出与限制 |
| --- | --- |
| [validateThinkDocument](./studio/server/think/validation.ts) | `value: unknown` → `ValidationReport`；严格字段/类型、草稿及公开就绪诊断；不扫描目录，不检查重复 slug/文件名/revision |
| [parseThinkSource](./studio/server/think/document.ts) | `source: unknown` → `EditorResult<ParsedThinkSource>`，成功值为 `{document, validation}`；只解析字符串，错误不返回空文档替换 |
| [serializeThinkDocument](./studio/server/think/document.ts) | `(value: unknown, originalSource?: string)` → `EditorResult<string>`；返回完整 Markdown 文本，不写文件；传入原始文本才能保留其字节/注释，不接受无效原文覆盖 |

类型定义位于 [studio/contracts/think.ts](./studio/contracts/think.ts)，不依赖文件系统、HTTP 或 Astro runtime。验证仍通过原 `npm.cmd run lint/typecheck/test/build`；typecheck 另接 Studio 的严格 NodeNext 检查（含 Web/独立配置与测试），unit glob 已包含 Studio 测试。编辑器启动为 `npm.cmd run studio`，独立浏览器验证为 `npm.cmd run studio:test`。

### 9.1 已选择的本地方式与边界

| 方式 | 当前决定 | 边界 |
| --- | --- | --- |
| 仅导出 `.md` | 不作为首版路线，不新增 export API | 原格式示例仍可手动使用；不另做一套导出产品 |
| 可信本地工具 | **M0–M4 已完成**：Windows PC Web → 本地 HTTP API → Think 文件 adapter / 隔离预览 | 同仓库独立 `studio/`，Markdown 为唯一原本；预览不保存源码 |
| Agent stdio | **M6 已完成**：Node/JSON-lines → 同一 HTTP API | 默认只读，可信启动开写权限；保留 published/revision，无 MCP/发布 |
| Windows App 窗口 | M8 已实现，In Progress / 待作者手动验收 | WinForms/WebView2 承载原 Web；X/菜单/备用停止走协同关闭，业务仍通过同一 HTTP |
| 远程/多设备/其他桌面框架 | 仍排除 | 不增加云服务、同步、账号、Electron/Tauri/PWA 或 MCP |

当前已接入 Think、Keep、Me、Build 四个公开模块，模型与 adapter 独立。四个私人模块在独立的本机内存会话编辑，仓库外加密主文件为作者源。M9–M15 的技术证据和人工待验状态见 [PLAN 6.10](./PLAN.md#studio-next-plan)，操作见[私人手册](#studio-private)与[统一人工清单](#studio-batch-manual)。启动、录入审核、AI 整理和发布的阶段状态见 [PLAN 6.11](./PLAN.md#studio-authoring-plan)。Studio 默认打开 Think，完整操作入口见[工作台使用方法](#studio-writing-workbench)。真实发布须满足下方前置并获明确许可。

编辑器必须区分：**本地编辑缓冲、源文件 published、Git 是否提交、线上是否部署**。编辑中不等于已保存，保存不等于上线，未来日期不等于预约发布；保存已有公开文章时不能自动切成草稿或擅自上线。

### 9.2 文档 DTO 与序列化

下面的 ThinkDocument、ValidationIssue、ValidationReport、EditorResult 是 **M0 已实现的纯契约**，不是 HTTP 服务；容纳不完整草稿，不放进 Core 形成 UniversalContent。完整机器错误码见契约源码；正文与 frontmatter 分开管理：

```typescript
type ThinkDocument = {
  metadata: {
    slug: string;
    title?: string;
    summary?: string;
    date?: string;
    published?: boolean;
    kind?: 'article' | 'note';
  };
  body: string;
};
type ValidationIssue = {
  field: string; // 如 metadata.slug、body；不包含原私人值
  code: ValidationCode; // 如 INVALID_DATE、DUPLICATE_SLUG
  message: string;
  severity: 'error' | 'warning';
};
type ValidationReport = {
  canSave: boolean;
  publishReady: boolean;
  issues: ValidationIssue[];
};
type EditorResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: EditorErrorCode; message: string; issues: ValidationIssue[]; cleanupPending?: boolean } };
```

M1 已实现 `SourceRevision = string`（原始字节 SHA-256）和 ThinkSummary/ThinkReadResult/ThinkWriteResult，完整定义以契约源码为准。纯解析/序列化仍只返回其原有两类错误；文件服务扩展 EditorErrorCode，不改变 M0 字段规则。

新文档默认 `published: false`、显式 kind；Web 新建时填本机本地当天日期，仍可手动改或清空，跨天后新建会重新取当天。API/Agent 不自动补日期；已有源保留原日期或省略状态，不用今天覆盖。读取旧文档时将显示默认值与实际源表示区分，省略 published/kind 不等于保存时自动补齐。序列化采用 YAML 文档模型保留未改字段/注释，日期写为带引号字符串，正文不自动 trim/格式化/润色；无修改保存保持原始字节。标题里的冒号、引号、换行正确转义，不用字符串拼接生成可执行 TS/JS/MDX。

M0 的 `parseThinkSource` / `serializeThinkDocument` 处理字符串与 DTO/诊断，不读写文件。slug 始终必须合法；M1 服务额外检查目录内唯一性。草稿允许 title/summary/date 尚未完成、正文为空，已提供字段必须类型正确（显式 undefined/null 也拒绝），非空日期必须有效、kind 必须合法。published:true 仍须通过现有全部公开规则。`canSave` 与 `publishReady` 分开：合法但不完整的草稿返回 warning、canSave:true/publishReady:false，已给出的非法日期/类型返回 error。这是作者层规则，网站既有草稿提前过滤行为保留。

解析仅支持文件开头（可含 BOM）的闭合 `---` YAML 1.2 标量映射，LF/CRLF 和正文原样保留；不接受 TOML、额外 YAML 文档标记、嵌套值、标签、锚点/别名、重复键、未知字段或坏 YAML。未加引号的日期会按与 Astro 相同的 timestamp 规则成为 Date，因此拒绝为错误类型，作者应保留日期引号。新增/改动字符串使用引号安全输出，日期形状的标题/摘要也不会被读回成 Date。元数据编辑保留其他字段值/标量形式及注释，但不承诺整个 YAML 排版字节不变；无修改与仅改正文的原 frontmatter 则精确保留。

任何不可保存的原文返回结构化错误，调用方应保留原文供人工修复；不静默丢弃未知字段或重写为空，也不输出 YAML 原始错误中的正文片段。`publicArticles` 仍抛原语义异常；Studio 文件服务调用同一纯字段/序列化逻辑，不能绕过上述限制。

Keep DTO 采用第 4.2 节 Bookmark，Build 采用第 4.1 节 Project，Me 采用第 4.3 节 Profile；它们是不同 adapter，不合并成统一持久化内容实体。现有 TS `data.ts` 是可执行源：未来工具只能维护规定的数据对象，不能 `eval` 导入不可信字符串或正则替换整个 TS 文件。要么采用 AST 保留其他代码，要么先单独批准数据存储迁移；不为编辑器擅自改现有格式。

私人 Think DTO 则为第 5.3 节完整 PrivatePost，id 替代 slug、无 published，body 仍是受控语法。作者本地编排整包 VaultPayload，保留未知于当前编辑面板但已支持的其他模块/条目；不能把只编辑的一篇文章单独当完整源覆盖整包。

### 9.3 Think adapter 操作语义（M1 本地函数，M2 另提供 HTTP）

可信本地程序通过 [openThinkAuthoring](./studio/server/think/service.ts) 获取 `EditorResult<ThinkAuthoring>`，完成操作后在 finally 中调用 `close()`。省略参数时使用模块自身定位的仓库根；可选 repositoryRoot 仅供可信启动代码/隔离测试，不能从客户端请求传入。目标始终是该根下的 `src/modules/think/content/`，无目录选择或通用文件 API。各方法同步返回 EditorResult，同一实例同步串行，重入返回 AUTHORING_BUSY。

服务与 HTTP/UI 解耦；已开放路由/错误映射见 [PLAN API 合同](./PLAN.md#studio-api)。`key` 是受限目录实际文件名的稳定 SHA-256 标识（含 Think 命名域），从扫描结果查找，不解码为路径；与 slug/文件名分开。新建和更新是两个操作，没有 `expectedRevision:null` upsert 或强制覆盖。

| 操作 | 作者侧含义与约定 |
| --- | --- |
| `listThink({status?})` | status 为 all/draft/published，缺省 all；返回摘要、key、revision、editable/deletable/诊断，不含正文。坏文件不因筛选而隐藏，日期降序后按文件名排序 |
| `readThink({key})` | 返回摘要及可选 document；不存在 NOT_FOUND，不偷偷创建；坏/未知源不提供空 document 替代 |
| `createThink({document})` | 缺省 published:false、kind:article，作者明确给出的值保留；合法唯一 slug 生成受控文件名，不覆盖已有目标，返回 ThinkWriteResult |
| `saveThink({key,expectedRevision,document})` | 必填读取时 revision，更新同一文件；返回 ThinkWriteResult，不自动改变 published/kind，不改 slug/文件名 |
| `deleteThink({key,expectedRevision})` | 精确删除该普通文件，返回 deleted:true；不删除图片、其他文章或 Git 历史 |
| `validateThink({document,key?})` | 返回 ValidationReport；字段、目录完整性/slug/文件冲突及单篇资源限额；不写内容，不等于全站 build |
| `close()` | 释放本实例仓库锁，返回 closed:true；已关闭可重复调用，其他方法返回 SERVICE_CLOSED |
| `previewThink` | 独立异步预览服务提供，不混进同步 CRUD；调用及结果见 9.3.3 |

ThinkSummary 含 `{key,fileName,revision,slug?,title?,date?,published?,kind?,editable,deletable,issues}`；ThinkReadResult 另有可选 document；不安全/过大/不可读取的目标 revision:null、不可删除，语法/字段错误但可安全定位的普通源保留 revision，deletable:true、editable:false。重复 slug 的条目均有诊断、不可保存；目录存在任何不可完整校验的源时，新建/保存阻断。删除不制造重复，故允许以准确 key/revision 删除坏普通源来恢复目录，不能删除链接/不安全目标。

ThinkWriteResult 为 `{key,revision,cleanupPending}`。cleanupPending:false 为正常完成；true 表示提交已完成、仅其临时文件清理失败，**不要当作保存失败重试**，先重新读取并处理遗留文件。失败结果也可能标 cleanupPending:true，表示未能安全清理自有临时文件；绝不绕过路径/身份检查清理。新建的 hard-link 落盘若临时链接残留，nlink>1 会暂时触发读取保护，需安全移除该自有 `.tmp` 后再读，不自动放宽 hardlink 检查。

新文件按受控 `<slug>.md` 生成，已有文件保留原名。**首版禁止修改已有 slug/文件名**，改标题保持 URL；若日常必须改 URL，仍按第 3.3 节的源码维护流程和授权核对引用，不借 Studio 普通保存完成迁移。

revision 对原始字节计算，注释/换行变化也算变更；旧版编辑/删除返回 REVISION_CONFLICT，保留本地缓冲，重新读取/人工合并。Studio 写操作串行、每仓库单写服务；原子替换失败保留旧文件。**不能保证任意外部编辑器在最终检查与替换之间并发写入仍绝对无冲突**，不提供强制覆盖按钮绕过检查。

主要错误为 NOT_FOUND、REVISION_CONFLICT、DUPLICATE_SLUG、FILE_EXISTS、VALIDATION_FAILED、UNSUPPORTED_FORMAT；字段可有 INVALID_DATE 等细码。具体状态码以 PLAN 为准，错误不包含密钥、正文、内部路径或堆栈。坏文件/重复 slug 在列表报告，无法可靠判断完整集合时阻止可能制造重复的写入。

M1 另有 INVALID_REQUEST、PROTECTED_PATH、DIRECTORY_INVALID、AUTHORING_BUSY、SERVICE_CLOSED、FILE_OPERATION_FAILED；本地函数自身不含 HTTP 状态码，M2 负责映射。请求拒绝额外字段/任意路径，key/revision 都必须是 64 位小写 hex。作者文件资源上限为 **16 MiB UTF-8 字节（含 frontmatter）**，不是网站新增长度规则；M0 纯校验仍不限制公开文章长度。扫描不递归，不把 assets 子目录里的 Markdown 当文章；`.MD` 等不兼容扩展以诊断呈现，临时 `.tmp` 不当文章。

仓库锁固定为 `.cache/studio/think-authoring.lock`，内容仅版本、pid 与随机 token。整个实例生命周期排他，另一个对象或进程均返回 AUTHORING_BUSY；adapter 不用 pid 存活猜测抢锁。桌面启动器仅按[下文严格归属核对](#studio-windows)恢复可证实的已退出桌面实例，不改变 adapter 排他规则。独立终端/未知来源的遗留锁仍须作者先确认全部调用方已停止、没有写入后，再只处理这个已核对文件；不要删整个 `.cache/studio` 或不明 `.tmp`。没有 unlock 命令/HTTP 端点。

路径检查覆盖真实目录及其身份、junction/symlink、hardlink、Windows 保留设备名/ADS/尾点空格/大小写、无效 UTF-8。更新使用同目录 wx 临时文件、完整写入/fsync/关闭后重验，再 rename；新建用不覆盖目标的 link，删除用核对后的 unlink。拒绝危险静态路径和检测到的中途替换，但普通 Node API 不提供对恶意同权限进程任意时刻替换目录/文件的绝对隔离或原子 CAS，也不承诺断电持久性。依据：[Node 文件系统](https://nodejs.org/download/release/latest-jod/docs/api/fs.html)、[Windows 命名规则](https://learn.microsoft.com/en-gb/windows/win32/fileio/naming-a-file)。

M1 验证入口为 `node --experimental-strip-types tests/verify-studio-think.mjs`（隔离 CRUD/构建）及 `node tests/studio/think-files.smoke.mjs`（读取前一命令的忽略产物、两引擎实际浏览器）；浏览器安装/路径按 PLAN 的本轮记录配置。这些是测试命令，不是作者编辑器或 Studio HTTP 服务。

<a id="studio-windows"></a>
#### Windows 桌面日常入口（M7 已验收；M8 App 待手动验收）

启动图标使用 [蓝发二次元头像 PNG](./studio/desktop/assets/studio-blue-hair.png) 及 [Windows ICO](./studio/desktop/assets/studio-blue-hair.ico)，ICO 含 16/24/32/48/64/128/256 七种尺寸；同一图标嵌入 exe 并用于窗口。生成方式与完整提示词保存在 [资产元数据](./studio/desktop/assets/studio-blue-hair.prompt.txt)。只有正常退出再启动后，已运行 App 才会载入新图标；无需为图标重录 Key。

若桌面仍显示旧 Stop 且删除提示找不到内容，可能是已不存在文件的显示残留。2026-10-23 对本机用户/公共桌面、注册表桌面位置及已存在的 OneDrive 桌面做只读核对，只找到本仓库启动快捷方式，未找到旧 Stop 或同名脚本；这不冒充屏幕显示验收。可由作者手动刷新桌面后核对；不要为此删除图标缓存、重启 Explorer、批量删快捷方式或结束 Node。安装器仍拒绝处理同名外部入口。

桌面只保留 **Personal Space Studio** 启动图标，沿用原快捷目标，现在由 Launcher 启动 Windows App；重复点击激活已有窗口。窗口 X 和菜单“退出 Studio”走同一流程：有未保存内容时选择“保存并退出 / 放弃修改并退出 / 取消”，无修改时直接开始正常停机，等待本实例 API、端口与锁释放后关闭窗口。桌面不再创建停止图标；`npm.cmd run studio:stop` 是命令行备用的同一退出请求，不绕过窗口确认；取消是正常结果，服务继续运行。M7 的双击反馈只覆盖旧浏览器方式，M8 状态见 [PLAN](./PLAN.md#studio-m8-record)。

运行 App 需要 Windows x64、项目 Node、.NET 8 Desktop Runtime 与 WebView2 Evergreen Runtime；自动构建还需要 `studio/desktop/global.json` 指定的 .NET SDK 8.0.404（latestPatch）及首次 NuGet 联网还原条件。当前机器已完成锁定构建；换机器仍须准备这些条件，启动器不会自动安装系统组件。WebView2 包精确为 1.0.4258.31，`packages.lock.json` 必须保留，不用 `dotnet add package` 擅自升级。

退出中的写入/删除/读取/校验或中文组合输入会先等待结果，可取消退出，不能把断线当回滚。保存失败、revision 冲突或响应未知时，窗口与缓冲保留；先取消退出并核对诊断/源文件，不自动重试写入。预览/AI 在取消退出后继续，明确退出时取消；选择保存并退出会先取消它们再保存。原终端启动的服务仍在原终端 Ctrl+C；App 遇到它会报 USE_TERMINAL_CTRL_C。若旧版浏览器 host 仍运行则报 APP_MODE_CONFLICT，先保存全部标签页，再经旧 Stop 正常停止后重开 App；不默默接管。

**日常直接双击原蓝发图标**，也可在仓库根运行 `npm.cmd run studio:open`。首次缺少运行包时，启动器自动准备，完成后打开窗口。首次准备会检查 SDK 和 NuGet，可能比日常启动慢。已经准备好的版本直接运行，文章修改也可直接打开。

开发更新或手动修复运行包时，保存并正常退出，在仓库根运行：

```powershell
npm.cmd run studio:prepare
```

准备检查源码、SDK 与锁定依赖，构建并冻结一套宿主、Web 与 Node 后端到忽略的 `.cache/studio/prepared/`，核验成功后才切换 current.json。失败不替换原完整版本；活动 App 会拒绝准备，不强关窗口。旧完整版本仅在其依赖/环境身份仍匹配时可继续运行。请勿清理正在使用的版本或 WebView profile。准备不读取 Key，不打开窗口。

日常启动只校验已准备程序的文件与运行环境。窗口标题的短版本号表示实际运行版本，正文仍从当前 Markdown/data.ts 读取。看到 `PREPARED_INVALID` 时，请保存并退出后手动准备。看到 `NUGET_SOURCE_UNAVAILABLE` 时，恢复对 `api.nuget.org` 的访问后重试。日常运行需要 .NET Desktop Runtime 与 WebView2，SDK 供准备时使用。

启动窗口、编辑器与 AI 配置分别就绪；AI_INITIALIZING 时文章可继续编辑，AI_CONFIG_UNAVAILABLE 表示读取失败，原配置保留，勿重复录 Key。首次预览/次级面板仍按需加载。无窗口宿主消息契约可运行 `dotnet run --project tests/studio/desktop/ContractTests.csproj --configuration Release`，不代替实际 App 操作。

首次配置或更换 Key：在**普通 Windows PowerShell / Windows Terminal** 中运行 `npm.cmd run studio:configure`，输入兼容 Base URL 和隐藏的 API Key。凭据仅以 Windows 当前用户 DPAPI 密文存到用户 LocalAppData 下的 `PersonalSpaceStudio\bailian.json`（通常为 `%USERPROFILE%\AppData\Local\PersonalSpaceStudio\bailian.json`），不放仓库、.env、Git、浏览器或命令参数。配置与读取共用 Windows Known Folder 定位，不直接拼接 LOCALAPPDATA。该 API 只统一路径，不能关闭宿主进程的 Windows 打包应用文件虚拟化；不要让 Codex 内的工具进程代为录入，以免文件实际写入隔离存储。正常重开不需再次输入；换 Windows 用户/机器、系统凭据保护变化或百炼 Key 失效时需重新配置。可用 `npm.cmd run studio:open` / `studio:stop` 代替快捷方式；更新/重建唯一启动图标用 `powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File studio/windows/Install-Shortcuts.ps1`；安装器只移除可确认属于本仓库的旧停止图标，同名外部目标拒绝处理并保留。

2026-10-23 已对本机这份历史隔离存储做一次性恢复：仅复制原 DPAPI 密文到正式桌面 App 的用户目录，原文件保留，不覆盖已有目标，不重录 Key。作者正常重开后，正式后台已确认可用并完成非敏感润色请求；临时恢复入口与诊断均已移除。日常启动不扫描其他目录，也不依赖 Codex；无需再执行恢复脚本。证据与边界见 [PLAN](./PLAN.md#studio-m8-credential-recovery-record)。

在 Think 打开一篇文章，展开正文下方的“AI 建议”。面板显示“后端已配置”且正文非空时可以请求建议。只读源、进行中操作或组合输入时请求按钮会禁用。缺配置显示 AI_NOT_CONFIGURED，格式错误显示 AI_CONFIG_INVALID，请求失败在面板显示错误码。若已保存 Key 却显示 AI_NOT_CONFIGURED，先保存文章并正常退出，再用蓝发图标重开。仍失败时保留原密文并排查启动链。隔离测试服务使用测试配置。

Windows 的普通 `npm.cmd run studio` 也复用保存配置：未显式提供任一百炼环境变量时使用同一 DPAPI 读取能力；若显式提供任一变量则保留该环境含义，不暗中混搭或覆盖。App 在构建完成后，经私有 Node IPC 的 `studio:start` 消息明确指定本机凭据存储，由 API 后端自行读取、解密；不再依赖把明文 Key 传入子进程环境。该路径不是 HTTP、Agent 或 native 消息参数。测试明确指定自己的存储或不指定存储，不回退读取真实 Key；直接调用 startStudioHttp 的 API/测试契约不变。坏存储报 LOCAL_CONFIG_INVALID/UNSAFE，保留原文件；启动器在配置读取期间失联时不留下自有服务/作者锁。

来源：[Microsoft SecureString/DPAPI](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/convertto-securestring)。本地已能运行的同用户程序不是被隔离的攻击者。只读取这个指定存储，不扫描其他凭据库；解密结果经后端与 PowerShell 的私有子进程管道进入后端内存，绝不转发到控制台/日志/HTTP/native，也不放入 App 启动环境。构建先于解密，构建子进程不继承 AI Key。缺少配置仍可普通编辑；坏配置明确失败，不能假装 AI 已配置。

后台只提供认证命名管道 status/stop/activate，不能执行文件/终端命令，没有 HTTP shutdown。状态在忽略的 `.cache/studio/desktop-session.json`，其中有本机控制 token，请勿上传或粘贴；没有 AI Key。固定错误记录 `.cache/studio/desktop-error.json` 只有日期、pid、错误码，不记录正文/token/Key/原始异常。native 只收有限生命周期消息，不接业务文件路径、shell、Key 或配对 token；仅接受精确 Studio 顶层 origin，禁止外部导航/新窗口、下载、权限和 host objects，预览仍 sandbox。业务继续走原 HTTP。

窗口进程异常会触发自有 API 正常关闭，但崩溃不承诺恢复内存草稿。后台 host 意外退出时自有 API 经 IPC 断开关闭，native 窗口独立于 Node 的 Windows job，保留缓冲并显示失联提示；先复制需要保留的内容，再明确取消/放弃退出。API 自身异常时同样先保留窗口与控制归属，不自动重试保存。停机清理无法确认时保留匹配状态供下次严格恢复，不把错误当已完成停机。启动器不强杀，也不自动清理未知辅助进程。

**旧状态恢复条件**：只核对固定 `desktop-start.lock`、`desktop-session.json`、`think-authoring.lock`；普通单链接文件及目录身份合法、启动锁与会话 token 对应、作者锁 pid 对应该 API、记录的进程均确认已退出、管道不存在、端口空闲，并在删除前重验文件身份和字节，才清除本次匹配的残留。无会话时只可恢复可证实的已退出启动锁；孤立作者锁不自动恢复。Windows 退出后端口尚未释放时，打开最多额外等待 3 秒逐次重验，忙时保留证据。活进程、坏 JSON、来源不明、链接/目录跳转、持续占端口或中途变化均拒绝，不抢锁、不清空缓存。PID 复用时宁可拒绝，普通 Node 文件 API 仍不承诺隔离同权限恶意进程。

| 启动/停止错误码 | 处理方式 |
| --- | --- |
| NODE_NOT_FOUND / NODE_VERSION_UNSUPPORTED / DEPENDENCIES_MISSING | 按 `.node-version` 准备 Node，在根执行 `npm.cmd ci`；重建快捷方式以更新固定 Node 路径 |
| WEB_BUILD_FAILED / WEB_SOURCE_CHANGED | 用 `npm.cmd run studio:build` 查看独立构建错误；完成源码更新后重试，失败不启动旧 UI |
| USE_TERMINAL_CTRL_C | 使用已有终端服务，在其原终端 Ctrl+C；桌面停止不会误停它 |
| PORT_UNAVAILABLE / AUTHORING_BUSY / DESKTOP_BUSY | 核对已知服务来源，保存后经其正常入口停止；不批量结束 Node，不删除活锁 |
| DESKTOP_STATE_INVALID / DESKTOP_STATE_CHANGED / DESKTOP_RECOVERY_REQUIRED | 保留现场，只提供错误码；核对本仓库全部 Studio、构建进程及端口。无法证明归属时停止操作，请求针对性检查，不凭文件存在删锁 |
| DESKTOP_START_TIMEOUT / DESKTOP_STOP_TIMEOUT / DESKTOP_STOP_FAILED / DESKTOP_UNAVAILABLE | 不视为已经启动/停止，先保留缓冲，核对实例后再重试；没有强制结束或自动重试写入 |
| LOCAL_CONFIG_INVALID / LOCAL_CONFIG_UNSAFE | 保留原加密配置，核对当前 Windows 用户和普通文件位置；仅在有意更换配置时运行 studio:configure |
| DOTNET_SDK_MISSING / APP_BUILD_FAILED / APP_SOURCE_CHANGED | 准备锁定 SDK，运行上面的无窗口构建命令；可在 studio/desktop 下用 dotnet restore --locked-mode / build --no-restore --configuration Release 定位，完成源码更新后重试 |
| WEBVIEW2_RUNTIME_MISSING / APP_START_FAILED / APP_EXITED | 核对 .NET Desktop Runtime、WebView2 Evergreen Runtime；不以安装 Edge 代替 Runtime 检测 |
| APP_MODE_CONFLICT | 保存旧浏览器 host 的全部缓冲，使用其原停止入口正常关闭后再打开 App |
| APP_START_TIMEOUT | 保留当前实例，手动检查窗口是否就绪；重复打开只检查/激活，不批量结束进程 |

脚本错误会显示固定代码和处理建议；命令行检查可加 `-NoDialog` 避免启动器错误弹窗，此开关不会跳过 App 的保存/退出确认。脚本仅对子进程设置 RemoteSigned，不更改系统/用户执行策略或绕过组织组策略。快捷方式固定仓库与 Node 路径，Node 旧路径不存在时再查 PATH；移动仓库或更换 Node 后在新位置重建入口。安装器先核对启动及旧停止文件的普通文件身份、项目描述、仓库、PowerShell 目标与完整参数；删除旧停止图标前再次核对内容字节。现有启动目标无需更名；旧停止图标迁移通过上述安装命令完成。

<a id="studio-m8-manual"></a>
#### M8 手动验收（待作者反馈）

以下均由作者操作，代理不再控制桌面。先保存其他正在编辑的内容；只用非敏感测试文字，勿修改真实文章或私人资料。若上一轮隔离窗口仍显示“本机服务连接已中断”，可先在它点 X → 取消，确认测试缓冲还在；再点 X → 放弃修改并退出。该失联窗口的最后确认尚未验收；若已关闭，请注明“未复验”，不要强杀真实服务来制造故障。

1. 核对 **Personal Space Studio** 启动入口的蓝发头像；若仍显示找不到文件的旧 Stop，可先手动刷新桌面再核对。双击启动应出现独立 App，无终端常驻；正常退出重开后窗口也应使用蓝发图标。最小化后再次双击，应恢复/激活同一个窗口。旧浏览器或终端服务冲突时，按上文经原入口先保存、正常停止。
2. 新建草稿，应默认本机当天日期；改成另一天确认可编辑。暂不填 slug，正文输入中文测试句；点 X → 取消，应保留文字且可继续编辑。再点 X → 保存并退出，应报校验问题并留在窗口；取消后能看到诊断。用菜单“退出 Studio” → 放弃修改并退出，应正常关闭且不创建文章。
3. 重开，用一个全新 slug（如 `m8-manual-check`）创建非敏感草稿，按校验提示填好标题、摘要和日期，保持 **draft**；点 X → 保存并退出。再开后应能读回同样正文和 draft 状态。只在确认是自己刚建的测试草稿时按现有删除流程处理，不删除其他文章；若继续下面的预览/AI 检查，先保留测试草稿。
4. 修改测试缓冲，可在终端运行备用 `npm.cmd run studio:stop`：应出现同一退出对话框；取消后 App/服务继续。最后明确放弃或保存退出，再重开应可用。退出后可在仓库根只读检查：`Get-NetTCPConnection -LocalPort 4322 -State Listen -ErrorAction SilentlyContinue` 应无监听；`.cache/studio/` 下 `desktop-start.lock`、`desktop-session.json`、`think-authoring.lock` 正常退出后应不存在。若仍有错误/残留，保留现场并反馈错误码。
5. 重开后打开测试草稿，展开“AI 建议”应显示已配置。输入正文后请求按钮应可用。用非敏感正文预览，构建中点 X → 取消，结果仍能返回。再预览并明确退出，应正常关闭。若要验收 AI 运行中退出，可对同一测试正文请求建议（真实百炼调用可能计费），分别检查取消退出继续请求、明确退出取消请求。
6. 终端服务归属若需本机复验：先正常退出 App，再 `npm.cmd run studio`，然后双击 App，应明确拒绝接管、原终端服务继续工作；在原终端 Ctrl+C 后才重开 App。无需结束其他 Node 进程。

反馈可按“单窗口启动 / 取消与保存失败 / 保存和放弃退出 / 备用停止与重开 / AI 配置与运行中退出 / 失联窗口最终退出”逐项写通过、失败或未测，附错误码即可，不发送 Key、控制 token 或真实正文。响应丢失、进行中写入、桥消息负例已有隔离自动测试；原生外部导航/桥来源的完整运行时负例及失联最终交互未全部签收，不能凭浏览器模拟或本清单存在把 M8 标 Done。这些专项仍保留待验，不要求用真实服务强杀或私人数据自行构造。2026-10-23 已核对本清单与文档，尚未收到新的 App 实测反馈；验收状态统一在 [PLAN M8 记录](./PLAN.md#studio-m8-record) 维护。

#### 9.3.1 M2 本地 HTTP 启动、配对与调用

在仓库根执行 `npm.cmd run studio`，**先独立构建 Web，再固定监听 `127.0.0.1:4322`**；可用 `npm.cmd run studio -- --port 4323` 改端口。没有 host/root/token 命令参数或自动打开浏览器；本机服务地址不由环境配置，M5 模型凭据另见 9.3.4。启动输出仅地址/说明，浏览器手动输入输出的 `http://127.0.0.1:<port>/`，不要换成 localhost 或从其他网站点击进入配对。当前 CLI 根页显示编辑器、隔离预览和 AI 建议面板；不提供仓库静态文件或公开网站页面。只构建用 `npm.cmd run studio:build`，输出仅 `.cache/studio/web/`，不覆盖网站 dist；直接运行 main.ts 前须已有这份产物，否则 WEB_BUILD_UNAVAILABLE。

每次启动生成 256-bit 随机会话令牌；根页的 `#studio-session` JSON 数据节点包含 `{origin,token}`，客户端读取后立即移除，令牌只留在请求闭包中。编辑器 CSP 允许本机固定脚本/同源连接，以及 M4 srcdoc frame 所需的内联样式/data 图片；禁止内联脚本、被外站嵌入、缓存及跨源读取。预览 iframe 自身另有更严格 CSP/sandbox。有 Fetch Metadata 的浏览器只允许正常本机顶层导航，跨站导航/fetch/iframe 被拒绝。可信本地非浏览器程序也可 GET 根页配对，或由可信启动代码调用 [startStudioHttp](./studio/server/http.ts) 得到内存 handle；不传 webDirectory 时保留 M2 无脚本的 API-only 配对页，UI 不是 API 调用前提。`repositoryRoot`/`port:0`/`webDirectory`/`previewBase`/`previewTimeoutMs` 仅可信启动/隔离测试使用，均不是 HTTP 参数；CLI 的 Web 目录和预览 base `/` 固定，子路径由可信集成测试覆盖。不要同时启动第二个服务实例。

**所有内容 API，包括列表、草稿读取、validate 和 preview，必须带 `X-Studio-Token` 自定义头**。Host 必须精确匹配服务地址；存在 Origin 时必须精确同源，`null`、同站不同端口及跨站来源都不允许；重复安全头拒绝。不使用 Cookie 登录、通配 CORS 或 token 查询参数；无 Origin 的可信本机客户端仍需令牌。令牌只放进请求头/内存，不复制到日志、URL、文件、环境变量、命令行或 localStorage/sessionStorage。配对入口与浏览器同源策略防范恶意网页；**不隔离已经能在本机运行程序的其他用户态进程**，这些程序也能本机配对，本工具不是账号/多租户系统。

以下路径相对 `/api/authoring/v1/think`，结果类型与常量见 [contracts/http.ts](./studio/contracts/http.ts)，文档 DTO 仍复用上文 Think 契约：

| 请求 | 精确参数 / 成功状态 |
| --- | --- |
| `GET /documents` | 可选唯一查询 `status=all|draft|published`，200 摘要数组；其他查询拒绝 |
| `GET /documents/:key` | 无查询/正文，200 ThinkReadResult；key 只用列表/写入返回值 |
| `POST /documents` | JSON `{document}`，201 ThinkWriteResult；默认 draft/article |
| `PUT /documents/:key` | JSON `{expectedRevision,document}`，200 ThinkWriteResult；不得额外传 key/路径/文件名 |
| `DELETE /documents/:key` | JSON `{expectedRevision}`，200 `{deleted:true}`；旧版本 409，不能强制覆盖 |
| `POST /validate` | JSON `{document,key?}`，200 ValidationReport；字段错误也以正常报告返回，不写源 |
| `POST /preview` | JSON `{document,key?}`，200 ThinkPreviewResult；必须公开就绪，不接受路径/base/配置/命令 |

写入/validate/preview 只接受 `application/json`（可带 `charset=utf-8`），禁止压缩正文；拒绝坏 JSON、非法 UTF-8、额外 envelope 字段。GET 不接受正文，PUT/DELETE 不接受用 query 替代 expectedRevision。预览不接受查询参数，没有预览资源/文件目录端点。保存仍不等于发布/Git 提交/推送/部署。

错误仍用 `{ok:false,error:{code,message,issues}}`，保留 M1 的 issues/cleanupPending。400 请求结构或非法 key；401 UNAUTHORIZED；403 FORBIDDEN/PROTECTED_PATH；404 NOT_FOUND；405 METHOD_NOT_ALLOWED（含 Allow）；409 版本/slug/文件冲突；413 PAYLOAD_TOO_LARGE 或源超限的 VALIDATION_FAILED；415 UNSUPPORTED_MEDIA_TYPE；422 文档/源格式/目录问题；408 REQUEST_TIMEOUT；503 AUTHORING_BUSY/SERVICE_CLOSED；500 FILE_OPERATION_FAILED/INTERNAL_ERROR。未完成 HTTP 解析的畸形协议/慢请求头只关闭连接或返回无正文 400，不返回原始解析异常。错误不含内部绝对路径、堆栈或原始正文。

传输上限为 **24 MiB 原始请求字节（含 JSON 转义与 envelope）**，与 **16 MiB 序列化源文件**分别检查，因此源未超限也可能因 JSON 转义膨胀先被 413 拒绝。请求头上限 8 KiB、接收时限 5 秒（1 秒周期检查）；完整正文接收上限 15 秒，通常 Node 请求/空闲 socket 超时 20 秒；preview 收完正文后 socket 等待改为 100 秒。最多 16 个连接、同时 2 个已鉴权内容请求（含预览），超出返回 503 或拒绝连接；预览另限一个进行中任务，无队列，响应后关闭连接。它们约束接收资源，不承诺同步 M1 文件校验/落盘的硬实时中断。

终端 Ctrl+C 停止，Windows npm.cmd 若提示 `Terminate batch job (Y/N)?`，输入 Y；程序化调用在 finally 中 `await session.close()`，停止时拒绝新操作、断开未完成请求并释放 M1 仓库锁。完整请求已经落盘后断开不代表回滚，客户端应重新读取 revision；未收完正文不会提交。重启令牌更换，旧标签/客户端须重新配对。关闭终端/任务管理器强杀可能留下锁，按上文 M1 的人工恢复规则处理，不提供抢锁端点。端口占用报 PORT_UNAVAILABLE 并释放本次取得的锁，第二实例报 AUTHORING_BUSY，不自动换端口或清锁。

M2 验证：`npm.cmd run test` 自动发现 `tests/unit/studio-http.test.ts`（真实 HTTP/CLI/超时/安全），`node --experimental-strip-types tests/studio/http.smoke.mjs` 运行 Chromium/WebKit 的 API-only 配对/CRUD/CSRF；历史命令/限制见 [PLAN M2](./PLAN.md#studio-m2) 和 9.10，M3 UI 验证另见下节。M5 建议的配置/接口另见 9.3.4；M6 Agent stdio 调用见 9.3.5，不提供 MCP。

#### 9.3.2 M3 基础 PC Web Editor 操作

1. 启动后在本机浏览器手动打开根页。左侧查看全部/draft/published 列表；筛选或“刷新列表”只更新列表，**不重载右侧缓冲**。只读/坏源带诊断，不会当空文档覆盖。
2. 点文章读取 metadata/正文与文件名/revision；已有 slug 只读，标题可改而 URL 不变。点“新建文章”只创建内存草稿，默认 draft/article 和本机当天日期，仍可修改；尚未在磁盘创建文章。旧文章不补填或更新日期。
3. 编辑 Slug（仅新建）、标题、摘要、YYYY-MM-DD 日期、article/note、候选公开状态与 Markdown。已有 kind/published 省略时显示“源中省略”，不因显示默认值自动补写；仅修改正文不会补全缺省 metadata。清空可选文字字段代表移除该字段，公开必填规则仍由后端校验。
4. 点“校验”查看字段错误/警告、canSave 与 publishReady；校验不写文件，不替代全站 build。修改输入后旧报告清除；正在校验时再输入，迟到报告不会应用到新版本。
5. 点“保存”或 Ctrl/⌘+S，提交完整快照和读取时 revision。界面分别显示未保存/已保存（本地源码）、源 draft/published 与候选状态；published 不表示已上线。保存期间可继续输入；完成后只把提交快照记为已保存，后续修改仍标未保存。组合输入中不提交，Enter 不隐式保存。
6. “重新读取源文件”、切换文章或新建时，有未保存内容先确认是否丢弃；取消保留原缓冲。刷新/关闭标签页有浏览器未保存提示；没有自动保存、恢复草稿、localStorage/IndexedDB 或同步，确实放弃/关闭后只能依靠作者另行保留的内容。
7. 发生 REVISION_CONFLICT/源被外部删除、会话失效或无法确认写入结果的断线时，缓冲保留，保存/删除被阻止，不做自动覆盖重试。先手动复制需要保留的正文/metadata，再刷新列表、重新读取并人工合并；重启服务后的旧页面需先保留内容再刷新重新配对。新建时 slug 重复可改为确认过的新 slug 再显式保存；普通字段/文件错误也保留缓冲并显示错误码。
8. 点“删除文章”会明确显示目标文件名并确认，若有未保存修改会一起提示；取消不删除。确认只删该份 Markdown，不删共享图片/目录，必须携带当前 revision。失败/冲突保留缓冲；完成回到未选中/空列表状态。

正文 textarea 中的 HTML/公式/代码始终是待编辑文本；M4 通过按钮在隔离 iframe 中预览，M5 AI 建议另见 9.3.4。不存在自动 Git commit/push/deploy、MCP、其他模块或 Vault 编辑；Agent 使用独立的 9.3.5 adapter。浏览器不直接导入 server/fs/loader，CRUD、校验、预览与建议均通过同源 API。

`npm.cmd run studio:test` 先构建 Web，再用独立 Playwright 配置运行 Windows Chromium/WebKit 的非敏感隔离场景；不运行 Vite dev server/额外 CORS/WebSocket。只提供根页和固定 `/studio-assets/main.js`、`/studio-assets/style.css`，内容不在静态资源中；后端启动时检查普通文件/真实路径/硬链接/尺寸并读入内存，不开放该目录其他文件。重新构建后需重启才载入新 UI。

本轮中文组合输入通过 Chromium 浏览器 IME 协议执行，验证 composition 期间按钮/Ctrl+S 不写入、提交后键盘保存。WebKit 没有该 CDP 接口，该子项明确 skipped；其实际中文字段输入、CRUD、键盘和未保存/关闭保护均已测。未声称验证 Windows 各输入法的候选窗/真人输入体验。完整命令、截图、失败修复与支持限制见 [PLAN M3](./PLAN.md#studio-m3) 和 9.11。

#### 9.3.3 M4 隔离 Astro 预览操作与结果

先填写合法 slug、标题、摘要、日期、article/note 与非空正文，点“预览”，无须先保存。完整 draft 可以预览；不完整但可保存的 draft 返回 PREVIEW_NOT_READY，并显示公开就绪诊断。预览只在临时副本把候选设为 published:true，源状态、revision、未保存标记和根 dist 均不变。

预览使用真实 Astro Markdown/Think Article/样式，保留现有 HTML 公式、代码与受限本地图片；note 详情使用同一 Article，网站 note 首页另由真实公开构建验收。不是网站交互预览：返回链接不可点击，不执行网站脚本/表单/嵌入内容，不加载 Vault。远程/缺失图片显示阻断提示，复杂 SVG 可能被删减；不提供远程图片代理。CSS 外部资源导入会拒绝整次预览。

构建中可以继续编辑或点“取消预览”，修改任何字段都会撤销请求并移除旧 frame；保存、切换或删除同样使旧结果失效。完成后显示候选指纹，迟到响应不覆盖新缓冲。预览失败后保留输入，处理候选或源码问题再重试；不要为了预览先保存、改 published 或删除坏源。已有其他模块/文章的无关构建错误也会使真实 Astro 失败，不改变网站校验去绕过。

可信本地调用方通过 [createThinkPreview](./studio/server/think/preview.ts) 创建预览服务，复用已打开的 ThinkAuthoring，异步 `previewThink({document,key?}, signal?)`；关闭时先 `await preview.close()` 再释放 authoring。HTTP 对应 `POST /api/authoring/v1/think/preview`，同样必须配对 token。成功结果在 `{ok:true,value}` 中：

```typescript
interface ThinkPreviewResult {
  fingerprint: string;       // document/key/base 的 SHA-256，不是源 revision
  html: string;              // 自包含受控文章 HTML，仅供 sandbox="" 的 srcdoc 显示
  blockedResources: number;  // 被替换的图片数
  cleanupPending: boolean;
}
```

没有可分享的 preview URL、资源下载路由或长期预览仓库；临时派生目录 `.cache/studio/preview/job-*` 在成功/失败/取消/超时后核验身份再清理，HTML 仅留在当前请求/页面内存。文件副本限 4000 个/合计 128 MiB/单文件 16 MiB；读取结果/图片合计及最终 HTML 各限 8 MiB，超过返回 413 PREVIEW_TOO_LARGE。构建子进程最长 90 秒，504 PREVIEW_TIMEOUT；浏览器等待上限 105 秒。复制/解析另受输入/尺寸限制，不承诺整次操作硬实时结束。

其他预览错误：422 PREVIEW_NOT_READY（候选不完整）、422 PREVIEW_RESOURCE_BLOCKED（构建期网络或越界图片/CSS 外部资源）、500 PREVIEW_FAILED（真实构建/受控投影失败）、409 PREVIEW_CANCELLED；已有任务返回 503 AUTHORING_BUSY。错误可能含 cleanupPending:true：先确认所有 Studio 调用方和构建子进程已停止，再核对并手动移除**该次自有 job 目录**；不递归清理整个 `.cache/studio`、不抢不明任务，强杀后的遗留同样人工处理。源保存是否成功仍按 M1 revision 规则独立核对。

构建在受限子进程中运行，禁用遥测/网络，临时用户目录与环境不包含作者凭据；Markdown 本地图片先检查只在副本 src/public，public 只复制图片。HTML 输出重建、SVG 过滤、CSP 与无同源/禁脚本 sandbox 共同约束浏览器展示。**这不是恶意项目配置/插件的 OS 沙箱**：现有 Astro/Vite 需要可信原生插件与 worker，Node 权限模型对它们存在限制；只接受 Think DTO，不接收 JS/MDX、配置或命令。依据与完整测试证据见 [PLAN M4](./PLAN.md#studio-m4)。

<a id="studio-ai"></a>
#### 9.3.4 M5 百炼 AI 文本建议（Done，真实调用已通过）

2026-10-17 作者已在本机配置并完成非敏感五项实测；现已核验成功记录，并在原 Studio 服务上完成一次真实 Chromium 润色/采纳/校验，无保存源文件。真实记录与本轮确定性回归分开保存，完整验收见 [PLAN 9.15](./PLAN.md#studio-m5-acceptance)，原 M5/M6 历史证据保留；剩余公共门槛与范围审计全部通过，M5 Done。

M5 首次接入阿里云百炼 `deepseek-v4.1-flash`。当前 Think 可在配置时显式选择 Gemini 或百炼，使用方法见[工作台与写作](#studio-writing-workbench)。页面显示后端可用状态；点击“请求建议”才发送只读快照中的**当前 Markdown 正文**。请求不包含 metadata、文件名、revision、其他文章或 Vault。请求可能计费，输入最多 32 KiB UTF-8，非流式，百炼请求关闭思考，输出最多 4096 token，超时 60 秒，没有重试、队列、联网工具或对话历史。

v0 润色提示词明确要求修正病句与不自然表达、减少重复和冗余、改善句段衔接，同时保留事实、核心含义和个人语气，不为改而改。润色结果与请求时正文完全相同时，页面显示“本次未产生修改”、禁用采纳，正文/未保存状态/文件均不变；不 trim 或归一化比较，空白差异仍是可采纳的实际建议。

润色/改写/概括的采纳目标是**替换正文**；生成标题/摘要分别替换 title/summary。先核对结果，再点“采纳”写入当前编辑缓冲；结果是只读文本，不执行 HTML。采纳不写文件、不改 published，仍须人工核对事实、校验后显式保存，旧 revision 冲突照常阻止覆盖。点“丢弃”保留原文；编辑/保存/切换/改操作会清除旧建议并取消请求，迟到响应不会覆盖新内容。取消不能撤回已送达模型的内容或保证不计费；不自动落盘/公开。

**后端配置**：终端支持启动进程环境中的 `DASHSCOPE_API_KEY` 和 `DASHSCOPE_BASE_URL`，Windows App 按上述可信启动协议直接读取保存的 DPAPI 配置，Windows 终端未显式配置环境时也可复用。后者是本工具配置名，值取百炼控制台对应业务空间/地域的兼容 Base URL，例如 `https://<业务空间ID>.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`（需替换实际 ID）；当前仅接受官方 workspace HTTPS 地址，不支持任意代理/HTTP/URL 凭据/查询参数。Key 与地域/业务空间须对应，并已开通所选模型。依据：[百炼 DeepSeek API](https://help.aliyun.com/zh/model-studio/deepseek-api)。

不要把 Key 放聊天、仓库、`.env`、浏览器、命令参数或日志。后端不加载 `.env`、不扫描系统凭据；桌面启动器仅指定上述 DPAPI 密文存储，后端直接读取，native 窗口与构建进程不接触凭据；启动后修改配置需正常退出并重开。读取中显示 AI_INITIALIZING、读取失败 AI_CONFIG_UNAVAILABLE；无配置显示 AI_NOT_CONFIGURED、坏配置 AI_CONFIG_INVALID；不影响已有 CRUD/校验/预览。

在本机 PowerShell 的仓库根可以用以下方式隐藏输入，只在该终端/子进程内临时保留 Key；命令历史不包含 Key 字面值。**五项真实验收会各调用一次付费服务，只发送脚本内非敏感测试文本**，不会读取作者文章。现有环境值在结束后恢复。不要把录入的 Key 回传给 AI。

```powershell
$taskPreviousKey = $env:DASHSCOPE_API_KEY
$taskPreviousBase = $env:DASHSCOPE_BASE_URL
$taskAiSecret = Read-Host '百炼 API Key（隐藏输入）' -AsSecureString
try {
  $env:DASHSCOPE_API_KEY = [System.Net.NetworkCredential]::new('', $taskAiSecret).Password
  $env:DASHSCOPE_BASE_URL = Read-Host '百炼业务空间 Base URL'
  node --experimental-strip-types tests/studio/ai.live.mjs
  if ($LASTEXITCODE -ne 0) { throw '真实调用未通过，请查看脱敏错误码。' }
  # 需要立即使用时，在同一 try 块中运行 npm.cmd run studio，Ctrl+C 停止后再退出。
} finally {
  $env:DASHSCOPE_API_KEY = $taskPreviousKey
  $env:DASHSCOPE_BASE_URL = $taskPreviousBase
  $taskAiSecret.Dispose()
}
```

脚本只写 `.cache/studio-m5/live.json` 的时间、模型、五项操作/成功/输出字节数与固定错误码，不存 Key、端点、输入或原始响应。已核验的 `2026-10-17T05:08:45.404Z` 记录五项均成功、simulated:false、complete:true，本轮只读取/复制该记录，没有重复五次调用；另作了一次独立真实 UI 非敏感润色，采纳/校验后未保存，原文章不变。手动终端模式可显式使用进程环境；Windows 未提供百炼环境变量时也加载同一本机 DPAPI 存储，不需日常重复录入，其他终端不会因此获得环境变量。以后仅在需要显式复验时运行上述付费脚本，不把模拟上游当作真实调用。

**独立 API**：认证 `GET /api/authoring/v1/think/suggest` 返回 `{service,model,available,issue}`，无凭据/URL；`POST` 只接受 `{operation,input}`，operation 为 polish/rewrite/summarize/generateTitle/generateSummary，结果 `{operation,text}` 在原 EditorResult envelope 内。无文件路径/模型/Key/命令参数；AI 服务不持有文件 adapter 或 CRUD，未来客户端不能用建议接口保存文章。

错误：400 INVALID_REQUEST；413 AI_INPUT_TOO_LARGE / AI_TOO_LARGE（结果 32 KiB、原始 JSON 128 KiB）、传输超限 PAYLOAD_TOO_LARGE；503 AI_NOT_CONFIGURED / AI_CONFIG_INVALID / AUTHORING_BUSY；502 AI_AUTH_FAILED / AI_FAILED / AI_INVALID_RESPONSE；429 AI_RATE_LIMITED；504 AI_TIMEOUT；409 AI_CANCELLED。本机 401 UNAUTHORIZED 与上游鉴权 502 区分，后者不会误锁作者会话。坏 JSON/UTF-8、空结果、截断、工具调用或标题换行被拒绝，保留原文；所有失败不自动重试，也不回显模型错误原文/堆栈/Key。没有对生成准确性、费用或云端保留策略的保证，作者应按百炼账户设置和实际返回核对。

<a id="studio-agent"></a>
#### 9.3.5 M6 Agent adapter：Node / JSON-lines stdio

[stdio 入口](./studio/adapters/agent/main.ts)是独立客户端，只调用现有本机 HTTP API，不打开文件、不启动第二个服务或浏览器。先在另一个终端启动 `npm.cmd run studio`；可信程序也可用 `startStudioHttp` 启动不带 webDirectory 的 API-only 实例，Agent 不依赖 Web 构建或页面脚本。不可同时为同一仓库再启动第二个作者服务。

在仓库根执行以下只读示例（默认服务端口 4322）：

```powershell
'{"id":"list-1","operation":"listThink","params":{}}' | node --experimental-strip-types studio/adapters/agent/main.ts
```

需要持续会话时，Agent 宿主以子进程启动 `node`，参数为 `--experimental-strip-types` 和入口文件的绝对路径，持续向 stdin 写 UTF-8 JSON 行并读取 stdout。自定义端口增加 `--origin http://127.0.0.1:4323`；严格要求该形式的 IPv4 loopback 地址，无末尾斜杠/凭据/query/path，不接受 localhost、远程地址或重定向。不要用 `npm run` 包装 stdio，npm 启动文字会破坏协议。PowerShell 5.1 若通过管道发送中文，先将该会话 `$OutputEncoding` 设为 `[System.Text.UTF8Encoding]::new($false)`，避免旧默认编码丢失中文。

**默认仅允许 list/read/validate。** 作者明确批准 Agent 会话修改 Think 内容后，由可信启动程序追加 `--allow-write`；它授予本次 adapter 会话 createDraft/saveThink 权限，包括保留 published:true 的既有文章正文编辑。它不是某一篇文章的逐次确认系统，宿主应只在已获作者授权的任务中启用。请求里的 allowWrite/authorization、模型建议或正文指令不能启用写权限；无隐藏环境变量开关。adapter 不运行 AI，不把模型结果自动发送给写接口。

例如已获准写入的会话启动命令：

```powershell
node --experimental-strip-types studio/adapters/agent/main.ts --allow-write
```

协议为自定义 JSON-lines，**不是 MCP 或 JSON-RPC**，不注册工具或修改任何 Agent 全局配置。每行严格 `{id,operation,params}`，id 是 1–64 位 ASCII 字母/数字/下划线/连字符，params 必须是对象；拒绝未知 envelope/参数字段。JSON 中正文换行用 `\n`，不能把一个请求拆成多条 JSON 行；支持 CRLF，EOF 前最后一行可省略换行。响应每行 `{id,...结果}`，结果复用 `{ok:true,value}` 或 `{ok:false,error:{code,message,issues,cleanupPending?}}`；损坏 JSON/UTF-8/无效 id 的响应 id:null。stdout 仅为协议结果，read 的正文是有意返回给选定 Agent 的数据，不是诊断日志。

| operation | params / 行为 |
| --- | --- |
| `listThink` | `{status?}`，all/draft/published；原 ThinkSummary 数组，不含全部正文 |
| `readThink` | `{key}`；原 ThinkReadResult，含 revision、只读 fileName、可选 document；坏源不替换为空 |
| `validateThink` | `{document,key?}`；原 ValidationReport，canSave/publishReady/issues；可校验公开候选，但不授予写入/公开权限 |
| `createDraft` | `{document}`；须启动写权限，拒绝 published:true，其余字段仍由原 HTTP/Think 服务校验；缺省 published:false/kind:article，返回 ThinkWriteResult |
| `saveThink` | `{key,expectedRevision,document}`；须启动写权限，提交完整候选；先 read 核对版本与 published，再由原 HTTP 服务重验并保存，返回 ThinkWriteResult |

document 仍为第 9.2 节的 ThinkDocument，不新增文章模型。key/expectedRevision 必须是原响应中的 64 位小写 hex；不接受文件路径、repositoryRoot、token、模型/端点、force、patch、终端命令或未来能力。已有 slug/文件名不可修改，metadata/正文完整候选不能丢掉未编辑字段。save 的 published 值和是否省略必须与当前源**完全一致**；不允许 draft→published、published→draft 或把省略自动补 false。需要改变公开状态时由作者另用现有 Web/源码流程明确操作，仍不自动上线。没有 Agent delete/preview/AI/build/Git/push/deploy 操作。

示例请求（key/revision 占位值须替换为真实 read 结果；仅示意，不自动执行）：

```json
{"id":"draft-1","operation":"createDraft","params":{"document":{"metadata":{"slug":"agent-example","published":false,"kind":"note"},"body":"非敏感、已确认的草稿。\n"}}}
{"id":"check-1","operation":"validateThink","params":{"document":{"metadata":{"slug":"agent-example"},"body":"候选正文"}}}
{"id":"read-1","operation":"readThink","params":{"key":"<list 返回的 key>"}}
{"id":"save-1","operation":"saveThink","params":{"key":"<read 返回的 key>","expectedRevision":"<read 返回的 revision>","document":{"metadata":{"slug":"agent-example","published":false,"kind":"note"},"body":"确认后的完整候选正文。\n"}}}
```

**重试与资源限制**：逐行串行处理，id 在该进程成功接收后即消耗，失败也不复用。相同 id 返回 DUPLICATE_REQUEST，不重放成功结果；进程最多接收 128 个 id，之后 SESSION_LIMIT，需重启并重新读取当前源。跨进程不保存去重状态，不承诺 exactly-once。不同 id 重复 create 由原 DUPLICATE_SLUG/FILE_EXISTS 拒绝；重复变更 save 用旧 revision 返回 REVISION_CONFLICT。无修改保存可能返回同一 revision，不能把它当每次递增的计数器。

单行输入与内容 HTTP 响应各限 24 MiB，配对 HTML 限 64 KiB；HTTP 请求含收完响应最多 20 秒。超大输入行返回 PAYLOAD_TOO_LARGE，丢弃到下一个换行后继续，不回显原文；非法 JSON/UTF-8 为 INVALID_REQUEST。大目录/JSON 转义使响应超过限额时返回 AGENT_INVALID_RESPONSE，不返回半截文章。Node 可信构造参数可缩短 timeoutMs 用于隔离验证，stdio 请求不能修改限额/超时。

新增错误包括 AGENT_CONFIG_INVALID、AGENT_CONNECTION_FAILED、AGENT_INVALID_RESPONSE、AGENT_TIMEOUT、AGENT_WRITE_FORBIDDEN、AGENT_PUBLICATION_FORBIDDEN、AGENT_BUSY、AGENT_CLOSED、DUPLICATE_REQUEST、SESSION_LIMIT。HTTP 的校验、revision、路径、会话和 cleanupPending 结果原样保留，不靠英文文本推断。adapter 不自动重试、重新配对、强制保存或吞掉冲突；服务重启后旧会话返回 UNAUTHORIZED，作者应核对源后重启 adapter。

**写请求发出后超时、断线或坏响应**返回 AGENT_WRITE_OUTCOME_UNKNOWN，因为文件可能已经写入。先重新 list/read 对比 slug、内容和 revision，再由作者决定下一步；不要换 id 直接重试，也不要把进程退出或取消当回滚。cleanupPending:true 同样先按 9.3 节核对已提交状态。原服务仍有最终检查与 rename 间外部进程竞争的既有限制。

配对只解析既有根页的固定 JSON 节点，不执行页面脚本；会话 token 仅在闭包/请求头，不放 stdout/stderr/参数/URL/环境/文件。原配对不是本机账号隔离；已能运行本地程序的其他进程也能配对。输入/输出由宿主管理，adapter 不持久化正文或凭据；不要让宿主的通用日志记录这些协议内容。关闭 stdin 的 EOF 或 Ctrl+C 结束会话并清内存，不关闭仍供 Web 使用的 HTTP 服务。

验证入口：`npm.cmd run test` 中的 [studio-agent.test.ts](./tests/unit/studio-agent.test.ts)运行真实子进程/stdin/stdout、API-only、权限/冲突/路径/限额与写后断线测试；`npm.cmd run studio:test` 中的 [agent.spec.ts](./tests/studio/editor/agent.spec.ts)在 Chromium/WebKit 验证 Agent/Web 双向冲突和缓冲保留。全部使用隔离的非敏感 fixture，不修改真实文章；本轮验收记录在 PLAN 9.14。

<a id="studio-keep"></a>
#### 9.3.6 Keep 公开收藏编辑器（M9，自动验证后统一人工验收）

在 Studio 顶部选择 Keep，点击列表读取已有收藏，或“新建收藏”。填写 slug、标题、说明、来源链接、说明段落，可选分类 ID/名称与类型；公开状态区分省略、draft、published。说明段落各自支持换行，新增/删除段落不会改写其他条目。保存前先校验；草稿也要求字段结构、文字和来源链接合法，保存不等于发布。已有 slug 首版不可修改。Think 与 Keep 切换会保留各自内存缓冲，关闭时“保存并退出”显式处理两者；取消退出保留全部缓冲。

“预览收藏”使用候选在隔离副本中调用原 Keep Astro 模板，预览 draft 时仅在副本中临时纳入公开，不保存源码、根 dist 或 published。可取消预览；修改候选使旧结果失效。删除需确认；重新读取会询问是否放弃当前修改。保存/删除发生版本冲突或结果不明时保留缓冲、阻止盲重试；先核对源码，重新读取并人工合并。刷新列表不会更新当前编辑版本以绕过冲突。

源仍是 src/modules/keep/data.ts。后端只解析原 publicBookmarks([...]) 的受支持字面量，不执行候选；读完整数组、保留 draft 和顺序。无修改保存保持原始字节，修改只替换受管理表达式，外围 imports/代码/注释保持；表达式内注释无法保留时阻断写入，不静默丢弃。源结构不支持时显示错误，不能保存为空集合替代。原子写入仍有最终检查与外部编辑器写入之间的既有限制。

作者 API 位于 /api/authoring/v1/keep，使用既有同源/token 规则和 EditorResult envelope，界面不读写文件。GET /documents 返回 {entries,revision}；GET /documents/:slug 返回 {bookmark,revision}；POST /documents 与 PUT /documents/:slug 接收 {bookmark,expectedRevision}；DELETE /documents/:slug 接收 {expectedRevision}；POST /validate、/preview 接收 {bookmark,key?}。revision 覆盖完整 data.ts，因此不同收藏的外部修改也会冲突。客户端没有路径、源码、命令、模型或凭据参数；现有 AI 和 stdio Agent 仍仅支持 Think，不自动获得 Keep 写权限。

<a id="studio-me"></a>
#### 9.3.7 Me 公开资料编辑器（M10，统一人工验收）

在顶部选择 Me，读取唯一资料。编辑姓名、介绍、介绍段落、可选链接和公开状态；段落各自支持换行，链接按原顺序维护。省略或 draft 只取消公开，仍保留资料源；“清空资料”须确认，并将源显式保存为 null。源为 null 时显示空态，不自动创建姓名或介绍；只有点击“新建资料”才出现空表单。新资料默认 draft，实际文字由作者填写。字段/链接不合法时阻断保存；缺省 links/published 不因打开表单而补写。

保存仍写入 me/data.ts 的 publicProfile(...) 数据表达式，不执行候选源码。revision 覆盖完整文件；清空与保存都检查它。无修改保存保持字节；注释、不支持 AST、原子失败与路径边界沿用已验证的受限源能力。冲突或写入结果不明保留缓冲，需显式重新读取并核对，不自动覆盖或重试。跨模块切换不丢缓冲，关闭时按明确决定保存/放弃；不产生第二份 Profile 或新增 slug。

“预览资料”在隔离副本使用原 Me 模板，draft 仅在副本临时纳入；null 展示真实空态，不写正式源或根 dist，预览 iframe 禁脚本/无同源权限。Me 不使用 Think 的 AI/Agent 权限。

HTTP 边界为 /api/authoring/v1/me：GET /profile 返回 {profile,revision}；PUT /profile 接收 {profile,expectedRevision}，profile 必须是对象，不能借此隐式清空；POST /clear 仅接收 {expectedRevision}；POST /validate、/preview 接收 {profile}（允许 null 候选）。沿用既有认证、同源、错误 envelope、请求限额和取消；无任意路径/源码/命令输入。模型字段仍以 src/modules/me/profile.ts 为准，保存、公开状态、Git 与发布彼此独立。

<a id="studio-build"></a>
#### 9.3.8 Build 公开项目编辑器（M11，统一人工验收）

顶部选择 Build，读取项目或“新建项目”。分步表单包括基本信息、技术内容、阶段目标、进展记录、问题与复盘；切换步骤不保存也不丢字段。基本信息维护 slug/标题/摘要、可选周期/状态/关键词/链接及公开状态；技术内容按章节维护可选标题、段落、列表和原样代码；记录分别使用原模型的阶段/更新/问题字段。新增空行或记录后须填写合法内容才可保存，不生成项目成果或统计。日期、状态与链接由后端复用原 projects.ts 规则校验，草稿也要求完整合法；已有 slug 首版不可改。

保存原 build/data.ts 的 publicProjects([...])，不转换为 Markdown 或 JSON 源。所有未编辑项目、可选字段、省略与空数组、代码换行、各数组顺序保持；整文件 revision 冲突不会自动合并。无修改字节保持，外围源码/注释保留，不支持的 AST 或无法保留的内部注释阻断。删除须确认；失败/断线/结果未知保留缓冲并阻止盲重试。预览仅在派生副本调用原项目 Astro 模板，保留代码与记录展示，输出无脚本 sandbox，不改源、公开状态或根 dist。

**私人关联保护**：正式 public/vault/bundle.json 存在时，后端无法在不解密的前提下证明没有私人 supplements.publicSlug 关联，因此阻止已有公开项目的删除和取消公开，返回 PRIVATE_REFERENCES_UNKNOWN。仍可编辑其公开字段或管理普通 draft；没有强制覆盖按钮，不自动解密。存在性占位、未知包或异常路径都不能被解释为“无关联”。请先由作者在本机核对，不能靠重复请求绕过保护。

HTTP 位于 /api/authoring/v1/build：GET /documents 返回 {entries,revision}，GET /documents/:slug 返回 {project,revision}；POST /documents、PUT /documents/:slug 接收 {project,expectedRevision}；DELETE /documents/:slug 接收 {expectedRevision}；POST /validate、/preview 接收 {project,key?}。使用 Project 自有 DTO、既有 token/同源/错误 envelope，不接受任意路径、源码或命令。现有 AI/stdio Agent 仍只支持 Think；公开 Build 与私人 Build 不是同一模型，不能混用 slug/id。

### 9.4 验证、Git 与发布边界

公开 Think/Build 的固定审核发布已实现，操作与恢复见[发布手册](#studio-publish)。手工命令仍见[第7节](#workflow)。发布能力实现不等于实际发布已获许可。本批没有提交、推送或上线。Keep/Me/私人仍没有自动发布，原 Agent 不新增发布权限，不提供通用 shell/Git 工作流。

原 source of truth、source revision、dirty/index 保护保持。新提案可直接准备发布，不必先另点保存草稿。一次最终确认只授权页面显示的精确范围，变化重新准备。GitHub 认证只在后端，不复用百炼 Key。未知结果先核对，不宣称全部回滚。

### 9.5 Studio 本地文件、HTTP 与预览约束

M1 文件服务、M2 本地 HTTP 与 M4 隔离预览已接入（启动/配对见 9.3.1，预览操作见 9.3.3）；详细合同及验证见 [PLAN Studio 计划](./PLAN.md#studio-plan)。作者需要了解的边界如下：

- 本地服务固定只监听 127.0.0.1；验证 Host、Origin 与会话/配对 token，写入用 CSRF 防护，禁止任意跨域。仅绑定 127.0.0.1 不能代替请求认证，不使用 `Access-Control-Allow-Origin: *` 暴露写权限。
- 浏览器提交逻辑 key，不提交任意绝对路径/文件命令；服务端固定允许目录与扩展名，解析真实路径并阻断 `..`、符号链接逃逸、编码绕过、Windows ADS。接口不能读 `.git`、凭据、外部私人源或写任意源码。
- 写入先验证再原子替换，保存前检查原始字节 revision；删除必须明确，取消任务不能留下半写文件。首版不提供素材上传，不自动清理共享图片；新建还需检查 Windows 设备名/大小写/尾点空格等文件名限制。
- Markdown 预览不能将不可信 HTML/脚本注入当前站点或编辑器的受信任 origin。使用隔离、禁脚本的 sandbox 预览或另源渲染，禁读编辑凭据；公开 Astro 编译只能处理作者信任的源，不能直接编译访客上传 MDX/任意项目配置。
- 首版按按钮触发隔离 Astro 构建，复用 Think 原模板/样式/Markdown，保留现有 HTML 公式；草稿完整校验后仅临时副本参与渲染。`.cache/studio/` 内派生副本可丢弃，不是第二套正文，不修改真实 published/源码/根 dist。预览用禁脚本、无同源权限的 sandbox，资源受限；不预览其他模块/Vault/网站交互脚本。
- 构建期及浏览器端都禁止预览偷偷请求远程资源；无远程图片代理，不发内容到统计/AI 服务。错误/日志无正文与 token。编辑缓冲只在内存，预览耗时/超时需反馈，旧预览不能覆盖新候选；未经单独授权不做浏览器自动持久化正文。

<a id="studio-private"></a>
### 9.6 私人编辑器的额外接口边界

私人 Think、Keep、Me、Build 与密文交付已实现，App 操作最后统一人工验收；阶段状态与自动验证证据见 [PLAN M12–M15](./PLAN.md#studio-next-plan)。真实资料不自动迁移或导入；既有 CLI 仍可按第 5–6 节使用，转用 Studio 时须明确选择唯一加密主文件。

日常只需：打开私人资料库 → 选择模块编辑 → 校验/预览 → 保存私人资料库。资料库就是仓库外的加密主文件，是唯一作者源；仅本机使用可停在保存。供网站使用时，另点“准备网站更新”，按下方向导操作。现有密文也在本机内存解密，不将明文送到在线站点或远程 API。

M12 隔离原型已增加 `studio/private/`：`validatePrivatePayload(value, publicBuildSnapshot)` 校验完整包、资产引用及当前公开项目关联；`PrivateSession` 提供纯内存 create/unlock/snapshot/replaceCandidate/validate/seal/markSaved/lock。局部未完成表单可以暂留内存，仍受完整包尺寸与 JSON 编码限制；预览与加密前须完整业务校验，schema 的排序或归一化结果不覆盖未编辑原数据。迟到解密/加密不能恢复已锁定会话，口令不存入会话对象。浏览器复用原纯 Web Crypto，不导入 Node `operations.mjs`。

保留 PBKDF2 参数、随机盐/IV、AAD、尺寸、MIME、口令规则与两端兼容；不要自造密码算法。口令不放 URL、localStorage/IndexedDB、后台 API 或日志；锁定/关闭/取消清理预览 DOM、引用和 Blob。Studio 不提供明文文件导入或保存功能；既有明文原本由作者在仓库外自行处理，不做项目内自动保存、云端草稿或后台上传。

`studio/server/private/files.ts` 只管理密文：可信 Windows 文件选择器在仓库外选择 JSON，通过受限 native → launcher → backend 通道绑定为单个随机 handle；浏览器拿不到文件路径，不能自行绑定路径。打开只接受合法 envelope，创建只接受尚不存在的目标，重新选择使旧 handle 失效。曾存在的主文件被外部删除后报冲突，不静默改成空包或重新创建。保存检查 SHA-256 整文件 revision，使用拥有身份的临时文件原子替换，并保留旧密文 `.studio-vault-backup-<revision>.json`；链接、跳转目录、硬链接、设备名和 ADS 均拒绝。backend 只能验证 envelope，不能声称已验证其中业务明文。

仓库外加密主文件是私人作者源，网站 bundle 仅为派生交付副本。已有 JSON 仍可使用第 5–6 节的本地 CLI；如转用 Studio，先在仓库外加密、验证并保留密文备份，再由作者显式选择密文主文件，之后不并行维护两个可编辑源。本路线不增加明文导入/导出接口。Vault 口令不沿用 AI Key 的 DPAPI 记住机制，不接 AI/Agent；私人预览不能进入 Astro 构建或缓存目录。浏览器私人状态不写 localStorage、sessionStorage、IndexedDB 或日志，锁定撤销 Blob/清理 DOM。测试中的配置目录与 canary 均为非敏感隔离样本，不是用户资料。

原生宿主禁止继承外部 WebView2 profile/debug/security 环境覆盖。私人资产只允许既有 PNG/JPEG/WebP 模型，Studio CSP 允许内存 Blob 图片，连接仍仅同源，原生资源过滤只放行本服务拥有的 Blob URL。无窗口 WebView2 原型验证正常锁定/退出后的配置目录中无测试 canary，不代表能抵抗同权限恶意程序、OS 内存取证、崩溃转储或备份软件；不承诺 JavaScript 字符串物理清零。真实选择器与 App 人工操作最后统一验收。

#### 私人 Think 操作（M13，人工待验）

1. 正常退出重开 App 后，点顶部“私人”。独立浏览器入口不提供文件选择，不要用它代替正式 App 验收。
2. “打开私人资料库”由 Windows 选择仓库外合法密文 JSON；“新建私人资料库”选择尚不存在的仓库外 JSON。不会创建明文文件。选择前即锁定并清理内存；选择器若使页面隐藏，锁定照常执行，只保留本次选择的随机事务和非敏感句柄。返回可见 App 后现有密文重新读文件、输入口令解锁；新文件建立空内存包，首次保存时设置口令。取消选择或取消口令均保持锁定，不自动写入文件。
3. 选择私人文章或新建。字段沿用原私人模型：稳定 id、title、summary、date、kind、body；不添加 slug/published。新日期默认本机当天且可改。暂缺字段可留在内存，完整校验不通过时不能预览或保存。
4. 点“校验资料库”或“内存预览私人文章”。校验所有模块、资产及最新公开 Build 关联；预览使用原私人受控 DOM/Markdown，原始 HTML 当文字显示。图片仅内存 Blob，预览链接不导航，不启动 Astro，不发正文给服务器。
5. “保存私人资料库”重新输入并确认口令，保存至少 16 个字符，沿用原口令字符/字节规则；无记住口令功能。保存检查密文 revision 和当前公开 Build 源 revision，保留其他条目/模块/资产和旧密文备份；不替换网站 bundle。
6. 私人修改的删除先确认，写入主文件仍须显式加密保存。冲突、清理未确认或发送后结果未知保留内存候选并禁止盲重试；请先核对外部文件，再明确锁定/放弃并重新选择或解锁，不能强行覆盖。
7. 手动锁定或切换公开模块时，未保存内容先确认；取消可继续编辑。后台隐藏、页面离开或闲置十分钟立即锁定，清除未保存缓冲、口令输入、预览 DOM 和 Blob，请及时保存。关闭 App 的“保存并退出”会单独询问私人口令；取消口令不会冒充保存成功，需回到退出对话框选择取消或明确放弃。

#### 私人 Keep 操作（M14.1，人工待验）

在已解锁的私人面板点“私人 Keep”，可编辑收藏列表、标题、说明、来源链接、说明段落、可选类型和分类；所有修改仍只在当前完整包内存中，切换私人 Think/Keep 保留各自候选。新建收藏生成稳定的 32 位 id，不提供公开 slug/published。删除先确认，再经“保存私人资料库”落盘。

来源必须为合法 HTTP/HTTPS，说明段落至少一项非空。私人分类 id 同样是 32 位十六进制，不是公开分类的短 slug；“添加私人分类”生成 id，可修改以复用已有分类，但同 id 的分类名称必须一致。“移除私人分类”仅移除当前收藏的可选字段。预览复用原私人收藏 DOM，链接被阻止导航；校验、冲突、锁定、退出与完整包保存规则同上，不新增接口或第二份源。

#### 私人 Me 操作（M14.2，人工待验）

在私人面板点“私人 Me”，选择“私人介绍”或显式“新建 / 编辑私人介绍”。仅支持原私人模型的 paragraphs 和可选 links：可以增删段落、保留段落换行和链接顺序，不提供公开资料的 name/description/published/null。空源保持缺省，显式新建只得到空段落数组，不补造介绍。

“省略私人介绍 links 字段”明确移除可选字段；不操作时保留原有省略状态。“清空私人介绍”确认后仅从完整包候选移除私人 Me，再加密保存才落盘；取消保留缓冲，公开 Me 和其他模块/资产保持。空介绍预览为空，非空预览复用原受控 Me 客户端，在 Studio 当前挂载位置显示，不更改真实路由；链接不导航。非法链接、版本冲突、锁定与退出规则沿用同一私人会话，不新增 HTTP 接口。

#### 私人 Build 操作（M14.3，人工待验）

在私人面板点“私人 Build”，列表分别显示“项目”和“补充”。“新建私人项目”创建独立私人项目；“新建公开项目的私人补充”创建 supplement，仅填写已有公开项目 slug，不创建或公开项目。两种记录都使用稳定的私人 id，不能修改公开项目自身的 slug/published。

独立项目支持 title/summary、可选 period/status/keywords/links、sections 以及 milestones/updates/issues；补充支持 title/publicSlug 与原有章节/记录，不添加独立项目专有字段。嵌套字段复用实际 Build 控件，代码/换行/数组顺序及未触碰的可选字段保持。进展日期默认本机当天，可修改；全包验证会拒绝非法日期、状态和缺失资产。

每次校验、预览、加密保存重新读取当前公开 Build 关联；输入口令期间公开源变化也会阻断落盘。原模型允许不同 id 的多条补充关联同一公开 slug，重复 id 或不存在的目标拒绝。预览复用原私人 Build 客户端、链接不导航，不发正文到 Astro/HTTP；确认删除只修改目标候选，其他项目/补充/模块/资产保留。保存不替换网站 bundle，锁定/退出/冲突规则同上。

<a id="studio-private-delivery"></a>
#### 准备网站更新、备份与恢复（M18 向导，实际选择器待验）

**资料库是唯一作者源，更新文件是一次交付副本，本地网站文件是派生包。** 日常界面只需认识这三种角色，技术版本和 SHA 放在“文件版本与恢复详情”里。本节替代旧版同时展示四个交付按钮的操作方法；底层 M15 的密文、备份和版本保护保持。

1. 打开资料库，完成四模块编辑，点“校验资料库”及“保存私人资料库”。必须已保存、无冲突和未确认写入；未编辑模块、稳定 id、数组顺序和资产完整保留。仅本机使用可结束，不用生成更新文件。
2. 点“准备网站更新”展开三步向导，再选“选择新的更新文件位置”。Windows 选择器只接受仓库外**尚不存在**的 JSON；选择前锁定，返回可见 App 后须重新解锁已保存资料库。取消会保持锁定，资料库未变；可点顶部“解锁所选资料库”后重新进入向导。位置句柄不改变作者源，不接受浏览器路径，不覆盖旧更新文件。
3. 第 2 步点“校验并生成更新文件”，输入并确认**当前资料库口令**。App 再查完整包、最新公开项目关联与资料库当前版本，并核对口令后重新加密；不用于换口令。成功只生成仓库外更新文件，网站未改。详情显示资料库、更新文件及本地网站预期版本。
4. 第 3 步点“确认更新本地网站”，核对最后对话框再确认，才替换固定 public/vault/bundle.json；取消不替换，可“返回资料库”。后台仍检查资料库/更新文件/公开关联/网站目标版本，修改、保存、锁定或切换源会使已有准备失效，须重新准备。
5. 旧网站密文先备份到**仓库外资料库同目录**的 .studio-delivery-backup-<旧包SHA256>.json；资料库保存备份另为 .studio-vault-backup-<revision>.json。已有同名备份须字节/身份匹配，不覆盖坏备份。成功只显示本地已更新、尚未上线；不会提交、推送或部署。
6. 断线、响应异常或 cleanupPending 不能当回滚。展开“文件版本与恢复详情”，点“读取本地网站文件状态”只读核对；若版本等于刚尝试的更新可确认本地已更新。未确认前不能换一份文件绕过网站替换的不确定结果，不自动重试。生成更新文件若结果未知，只能核对后明确选择另一个尚不存在的新位置，不能覆盖旧文件；无法确认时保留现场。原 prebuild 仍拒绝 public/vault/ 中除 bundle 外的文件，不能跳过。

恢复时先保留当前密文及其口令，将选定的旧**密文备份复制为仓库外另一个新的主文件名**，不要直接把备份文件当可编辑源。显式选择、用对应旧口令解锁，核对四模块/资产及当前公开项目关联，保存并重新导出新候选，再按上面确认流程替换本地正式包。恢复不等于网站回退；若要上线，另按第 7 节取得提交/发布授权。旧备份依然使用旧口令，不会远程撤销。

#### 密文 HTTP 边界

仅可信启动代码可向 `startStudioHttp` 注入 `privateFiles` 与 `createPrivateDelivery`，CLI 独立服务默认无该能力；文件绑定只走原生选择通道，不是 HTTP 参数。原生仅接受 open/create/export 三种有限选择消息，浏览器只得到随机句柄。所有下列路由仍要求原同源/Host/Token/限额规则，不扩大现有 Agent/AI 范围：

| 操作 | 请求 | 返回 |
| --- | --- | --- |
| 最新公开关联快照 | `GET /api/studio-private/public-build` | `revision` 与已公开项目 slugs，无私人数据 |
| 读取所选主文件密文 | `GET /api/studio-private/files/{handle}` | `handle/revision/envelope`，新文件 envelope 为 null |
| 保存所选主文件密文 | `PUT /api/studio-private/files/{handle}`，仅 `envelope/expectedRevision/publicRevision` | `revision/backupCreated/cleanupPending` |
| 只读正式包版本 | `GET /api/studio-private/delivery/status` | `targetRevision`，尚未配置为 null |
| 导出新密文候选 | `POST /api/studio-private/delivery/export`，仅 `handle/masterHandle/masterRevision/publicRevision/envelope` | `id/revision/masterRevision/publicRevision/targetRevision` |
| 显式替换固定正式包 | `POST /api/studio-private/delivery/replace`，仅 `candidateId/expectedTargetRevision` | `revision/backupRevision/cleanupPending` |

没有接受路径、口令、明文 payload、单篇私人文章或强制覆盖的端点。backend 不解密，提交前再次检查公开 Build 文件 revision；密文与跨文件关联不承诺对同权限恶意进程提供全文件系统事务隔离。

### 9.7 验收与当前停点

Studio 逐项 Done Criteria/Verification 集中在 [PLAN 6.8](./PLAN.md#studio-plan)、[6.10](./PLAN.md#studio-next-plan) 与 [6.11](./PLAN.md#studio-authoring-plan)，不在本手册维护另一套 milestone 状态。下表保留能力核对索引。M9–M15 自动验证后仍需下方统一人工反馈，公开 Think/Build 的 Git/部署能力见本批手册，实际发布尚未验收。

| 能力 | 至少应验证 |
| --- | --- |
| 解析/导出 | 中文、引号/冒号/多行、日期、Markdown 围栏和非 ASCII；往返保留语义，draft/note 等字段不丢 |
| CRUD | 添加/编辑/取消公开/删除/全空；稳定 slug、重复冲突、404、计数/索引、根/base 链接，未触及条目保持 |
| 并发/文件边界 | revision 冲突不覆盖，写失败不破坏旧文件，路径/符号链接/ADS/未知字段/错误类型被拒绝 |
| 预览 | 与真实 Think 渲染相符；不可信脚本不能执行或读凭据；代码/图片/长文 PC 可读，网站受影响时按 PLAN 跑既有根/base/响应式回归，不新增 Studio 手机支持 |
| 发布（若选择） | 保存不部署、校验失败阻断、源变化使验证失效、精确提交、Actions SHA/产物/线上一致、可恢复 |
| Private（若选择） | Node/browser 互通、模块与资源负例、关联依赖、整包保留、口令规则、锁定清理、不在网络/存储/日志留下明文 |

Studio M0–M6 全部 Done；M5 于 2026-10-17 完成真实五项记录核验、真实 UI 与余下验证。随后作者授权的 v0 润色优化、本机 DPAPI 凭据与桌面启动，以及 WebKit 预取最小修复、提交/正式部署与最终验收均已完成；基线为 studio-v0 / 224eea0，状态与证据见 PLAN 6.9 / 9.16 起的记录。Studio 服务仍只在本机，发布的仍是静态网站。真人输入法候选窗与恶意项目 OS 沙箱未验收；既有首版证据见 PLAN 9.12，AI 不能用模拟结果冒充真实接通。

<a id="studio-next-usage"></a>
### 9.8 扩展使用方式与统一验收

本节集中列出统一人工步骤；阶段 Scope、状态和自动验证证据在 [PLAN 6.10](./PLAN.md#studio-next-plan)，不在手册复制历史记录。作者自行操作，代理不控制桌面；自动通过不代替以下本机反馈。

- **启动/退出**：桌面使用一个 **Personal Space Studio** 图标，重复点击激活已有窗口；正常关闭先处理未保存内容及写入，再停止本次 App 拥有的服务。保留命令行备用停止，不接管终端实例，使用与恢复见[桌面操作](#studio-windows)。作者已确认日常操作，原生专项保留最后统一验收；关闭独立浏览器页仍不会停服务。
- **其他公开模块**：Keep/Me/Build 已有专属表单与隔离预览；AST 解析/序列化受支持的数据表达式，不执行用户提交代码。revision 覆盖整份源文件，保留草稿、其他条目和未编辑字段；已有 slug 首版保持。
- **私人内容**：四个私人面板编辑同一个完整内存包，其他模块与资产保持；不新增资产编辑器。私人 Build 关联在本机核对，不能由后台密文结构检查冒充完整业务校验。
- **交付**：按[密文交付步骤](#studio-private-delivery)执行；主文件保存、候选导出、正式密文替换与 Git/部署分别处理。Agent 仍只有既有 Think 权限，AI 仍仅用于公开 Think。

<a id="studio-batch-manual"></a>
#### M8 专项与 M9–M15 统一人工验收

先保存现有工作，仅用非敏感测试文字；不要导入真实私人资料，不向聊天发送 Key、口令、控制 token、文件路径或真实正文。私人试验使用仓库外的新密文主文件及新候选名，自己的口令自行保管。测试后仅清理明确属于本次的测试记录，保留其他未提交修改。可以分次完成；未测写“未测”，无需为制造故障强杀真实服务。

1. **启动、单窗口与配置**：双击桌面蓝发 **Personal Space Studio** 图标，应出现独立窗口且无常驻终端。重复双击应激活同一窗口，最小化再打开也如此。打开 Think 文章并展开“AI 建议”，检查是否显示已配置。正常退出后再开应可用，必要时按 [M8 清单](#studio-m8-manual)只读核对服务与锁退出状态。
2. **公开编辑与预览**：分别在 Think、Keep、Build 新建自己能识别的临时 **draft**，使用中文、换行及合法链接；日期默认今天且可修改，校验、隔离预览、保存/重新读取、删除取消与确认应正常。Build 加一个章节/进展，Keep 加一段说明。公开 Me 是现有单例，**只在未保存缓冲中**试编辑/校验/预览，然后明确放弃，避免覆盖真实个人介绍。确认现有文章/收藏/项目/介绍完整。中文输入法组合输入与 Ctrl+S 需要真人检查；不要将测试稿改成 published。
3. **私人主文件与四模块**：点“私人”→“新建私人资料库”，在仓库外选一个新 JSON 名；选择器取消后应能继续。分别新建 Think、Keep、Me、独立 Build，输入非敏感字段；Build 可加章节/代码/进展，并增加一条关联现有公开项目 slug（如 `nemu`）的私人补充。切换私人面板应保留各自内容；非法 URL/日期等应阻止完整校验/预览。修正后每个面板预览、加密保存（至少 16 字符口令）、锁定再解锁，四模块应全部还在。测试记录删除/Me 清空须确认，取消应保留；保存后重解锁应只改变指定记录。没有资产编辑按钮是本轮范围，已有资产保持已由自动测试验证。
4. **隐私与关闭**：先保存私人包，再预览并“立即锁定”，应无旧正文、字段或预览；重新解锁后最小化/切换后台应锁定。闲置十分钟亦应锁定，**未保存私人缓冲会被清除**。有修改时切换公开模块，取消应留在私人面板，确认离开应清理。点 X 取消退出应保留缓冲；“保存并退出”应分别处理公开稿与私人口令，取消口令不能冒充成功；正常退出重开可读回已加密内容。AI Key 仍保留，Vault 口令不会自动记住。
5. **交付与取消**：保存主文件后，按上文选择一个仓库外新候选位置并重新加密导出。选文件不应把主文件切走；错误口令不生成候选。确认显示 SHA 和目标版本。点击替换按钮后，在**实际仓库选择取消**，网站 bundle 应保持，主文件仍可继续使用。修改源候选后旧交付应失效。正向替换、旧包备份和恢复已经在隔离副本自动验证；若还要人工验证完整写入/恢复，只在另一份隔离仓库及其非敏感测试主文件中做：先正常退出实际 App，再从副本根运行 `npm.cmd run studio:open`，不要使用指向实际仓库的桌面图标。未准备副本可把该项写“未测”，不把测试包写进本仓库或发布。
6. **M8 原生专项**：按原 [M8 手动清单](#studio-m8-manual)补预览运行中取消/确认退出、菜单/备用停止的同一退出流程。若自行选择做 AI 请求中退出，只送非敏感文本，真实调用可能计费。服务归属/终端冲突按清单先正常退出再测试，不能结束不相关 Node。旧失联窗口若已经关掉，最终取消/退出写“未复验”；无窗口自动探针验证了非可信 frame/外部导航拒绝，真实 App 的完整专项交互仍不据此签收，不要求在真实服务强制制造故障。

反馈按以上六组写“通过 / 失败 / 未测”，失败只附界面错误码和触发步骤。正式交付的原生正向操作、失联/异常退出等未操作项单列；收到反馈后再核对 PLAN 的对应验收项，不凭清单存在将 M8–M15 标 Done。本轮不要求提交、推送、上线或配置真实私人资料。

<a id="studio-authoring-usage"></a>
### 9.9 文章/项目的日常使用流程（实现完成，统一人工待验）

自动录入流程是 **打开“录入与待审” → 放入文字或 Markdown/项目报告 → 自动填写 → 本人审核并补缺项 → 保存草稿，或进入发布确认**。也可直接打开对应模块手动编辑。详细步骤见[录入手册](#studio-intake)、[自动整理](#studio-organize)、[审核发布](#studio-publish)。阶段状态与验收依据见 [PLAN 6.11](./PLAN.md#studio-authoring-plan)。

| 使用环节 | 当前能做什么 / 后续目标 |
| --- | --- |
| 打开 App | 双击蓝发图标。首次缺少运行包时自动准备，随后直接打开。日常耗时待验 |
| 放入文章或项目材料 | 粘贴一份文字/MD 或导入 UTF-8 文件/结构化报告。选择 Think/Build 和新建/明确已有目标，可直接导入或显式发送百炼自动整理。无须安装 Skill |
| 审核成稿 | 并列材料、候选、来源、缺项和预览，默认以自动填写为主，现有手动表单保留精调/备用。本人主要核对事实和补未知项，不让 AI 编造经历、贡献、成果或日期 |
| 保存到本地源 | 原表单保存和审核保存均复用原模块校验与 revision，新建为 draft、已有修订保留公开状态。真正内容只写回 Markdown/data.ts，保存不等于上线 |
| 审核后一键发布 | 可从已审核材料或内容源出发，一次最终确认精确内容/差异/目标后，程序代办固定检查、提交、推送、部署与结果核验。不必先点一次保存草稿。远端 workflow 守卫尚需另获许可安装，当前不执行真实发布。手工发布仍见第7节 |
| 其他管理与输入 | 已有 Keep/Me/私人资料库继续使用原手册，不新增导入/AI/Agent/自动发布；M18 原生选择器/关闭仍待反馈。M21 Pi Skill、M22 DOCX/文本 PDF 等延期，不阻塞首版文字/MD 发布闭环 |

可以先准备一份拟公开材料：文章正文，或项目目标/背景、本人角色、已完成事项、仍在计划的事项、章节/代码说明、阶段/进展/问题、可核对的日期/数据、来源文件/提交标识及待确认项。代码存在不能证明本人完成某项贡献。只选择确实希望处理/外传的本份材料，不把私人资料或凭据交给外部 AI/Agent；材料里的命令或“忽略规则”只是数据，不会授予执行权限。

后续“自动整理”会先展示并仅发送这份选中材料，复用已保存的百炼配置；模型结果先成为 Think 或 Build 候选，不自动写源或发布。已有结构化报告走确定性识别，不强制再调用一次模型。收件箱只在仓库外存拟公开材料/候选供重启恢复，不是第二内容库；应用后清除材料/正文或仅留不可编辑回执，之后重新读真实源。更新已有目标必须显式选择，候选、来源、源版本或目标变更会使原批准失效。

“一键发布”保留一次最终审核，不对每个已批准步骤重复询问。最终确认明确发布态、精确 diff、版本和仓库/分支；既有 dirty/index 和同文件其他条目必须保留，不能整仓暂存。界面须区分已保存/待发布/部署中/已上线，失败显示已完成到哪一步，结果未知先查源/Git/run，不自动重试或假称回滚。实际提交、推送与部署只能在该次明确授权范围执行；现在尚无此能力。

Pi Skill 和 DOCX/PDF 的原输入安全边界保留于 PLAN，均待主线完成后另行授权。当前原 M6 Think Agent adapter 的调用/权限不变，未安装新 Skill，也未赋予 Agent 应用提案、私人与发布权限。

<a id="studio-startup-baseline"></a>
### 9.10 M16.1 启动诊断与手动基线（已完成）

作者已确认启动、重复激活、关闭重开与 AI 配置正常，无需重复配置 Key；本轮确认采用 manual 中现有 6 份独立 ready/cold 诊断，已完成基线核对，不需要再补四次。统计、原十次条件调整及 M16.2 目标见 [PLAN 收尾记录](./PLAN.md#studio-m16-1-acceptance)。未收集双击全链路秒表数值或真实首次准备耗时，不将宿主内诊断冒充这些数据。以下为以后复测的留存方法，当前无需重跑。

M16.1 只采集与反馈；本轮 M16.2 延迟普通启动不需要的编译器加载，复测方法见下节。正常入口、Key 存储和关闭归属保持；代理不操作桌面，也不会要求重配 Key。窗口出现后区分“正在初始化 WebView2”和“正在载入编辑器”，启动前半段仍保持原来先准备后显示窗口的顺序。

正式 App 启动时在固定 `.cache/studio/startup-latest.json` 写一份最多 2 KiB 的诊断，包含随机 runId、starting/ready/failed、单调相对毫秒及白名单阶段：宿主检查/restore/build、Web 检查/build、凭据定位、后端、凭据读取、API 就绪、窗口、WebView2 和编辑器握手。缓存原因 hit/missing/changed/invalid 不含 hash、文件名或位置；不写 Key、token、正文、原始异常。链接/不安全诊断文件不覆盖，写入失败只报固定 STARTUP_DIAGNOSTICS_UNAVAILABLE，不改变服务权限或跳过原检查。不要删除未知锁或上传整个 .cache；其他会话文件可能含控制 token。

时间口径：host-monotonic-ms 从宿主 Node 的 startAppHost 入口开始，排除此前 PowerShell/Node 模块导入和启动器等待；opener-monotonic-ms 仅用于重复激活。各阶段 atMs 为进入该阶段的相对时间，相邻差值含观测写入成本；窗口通知按父进程收到消息计时，含 IPC 调度延迟。window-visible 不代表 WebView 已可用，editor-ready 是既有编辑器握手，不保证所有列表已读完；真实首次可见/可编辑必须由作者同时观察。

scenario 是观察标签：initial-preparation 表示有收据/产物缺失，不证明系统全新安装；updated-or-recovery 表示变更/坏收据重建；cold 表示两项缓存均命中；activation 表示激活已有窗口。失败或测试跳过构建时可为 unclassified。只保留最新一份，重复激活会覆盖；早于诊断接点的失败可能没有新报告，应核对文件更新时间与 runId，不将旧结果当新结果。

以后复测请只用非敏感测试文字，先保存现有内容：

1. 正常退出，再从蓝发图标打开。把此次更新后首次准备单独记录，不计入普通冷启；确认窗口反馈、最终编辑可用、原 AI 配置自动加载。无需新建或导入真实私人资料。
2. 无源码变化时按 PLAN 的当前目标做至少 6 次“正常退出 → 双击打开”，保持同机同条件。可另用秒表记录从双击到窗口首次可见和能输入文字的时间；未记录就注明未测。ready 后立即复制最新 JSON，再正常退出；不要重复双击混入激活样本。若不是 cold 或未 ready，单列原因，不计入有效样本。
3. 可以在仓库根自行运行以下命令，先创建目录，再在每次 ready 后重复 Copy-Item 一行；时间戳文件名不覆盖本批已有样本。新一轮对比应使用新的目录（例如 manual-m16-2），不要把两轮合并统计。只复制诊断，不操作窗口：

```powershell
New-Item -ItemType Directory -Path .cache/studio-m16-1/manual -Force | Out-Null
Copy-Item .cache/studio/startup-latest.json (".cache/studio-m16-1/manual/cold-{0}.json" -f (Get-Date -Format "yyyyMMdd-HHmmss-fff")) -PassThru | Select-Object -ExpandProperty Name
```

4. 另外测试已有窗口重复双击，应该激活同一窗口且记录 activation；确认取消退出、正常关闭重开与 AI 配置保持。不要为构造失败强杀真实服务；故障/取消负例由隔离测试覆盖，未实际观察的窗口项目注明未测。
5. 按独立 runId 去重，汇总有效样本的 p50（nearest-rank：升序第 ceil(样本数×0.5) 项，6 次取第 3 项）和最慢值。各区间先逐次相减再汇总，不能相加区间 p50；已记录的手动全链路时间与 JSON 宿主内时间不能混算。把第一次准备、重复激活单列；反馈各阶段耗时和观察结果即可，不发送凭据/正文或其他会话文件。

自动测试的 10 次隔离后端样本关闭了构建且没有可见窗口、没有真实凭据，只证明采集/启停链路；未与六次真实 App 数据混算。六次仅作为本机工程基线，不估算长期分布或更高分位数。M16.1 已收尾，M16.2 真实性能结果见下节；作者已允许余项延后并进入 M17，不将其冒称性能达标。

<a id="studio-startup-optimization"></a>
### 9.11 M16.2 启动优化与复测（本批已核对，主性能目标未达）

M16.2 的旧主性能目标未达，保持 Deferred，不标 Done。当前优先顺序改为先实施另行授权的 M16.3“日常运行与更新准备分离”，仍是 Pending；它不是恢复旧项或宣布旧目标通过。以下旧批次诊断/复测方法仅供历史对照，当前不用再测六次启动，新验证在 M16.3 获准实施时按 PLAN 固定前后基线。

本批六份诊断已核对，AI 配置、首次预览、关闭重开正常反馈已收到，不需要再配置 Key 或重复测试同一版。实际 editor-ready p50 改善约 8.1%，尚未满足至少 25% 的目标，M16.2 性能余项保持 Deferred；统计及当时排查方向见 [PLAN](./PLAN.md#studio-m16-2-manual-review)。原 manual 目录和 M16.1 基线均保留；后续完成新一轮优化后再按以下方法使用新空目录复测，不将这批旧样本混入下一批。

普通启动现在不加载 Markdown 编译器和 TypeScript AST 编译器：首次合法的公开模块预览才加载 Markdown 编译器，首次读对应 data.ts 才加载 AST。首次预览可能承担这部分准备成本，原“正在隔离构建…”提示、取消和退出保护继续有效；无需手动安装编译器或重新配置 Key。构建缓存、安全检查、窗口握手含义与后台归属不变，关闭后仍停止自有后台。

代理不操作你的窗口；此前已运行隔离 API/无头浏览器验证，本轮只读核对你保存的记录。正式 App 性能目标及完成状态以 [PLAN M16.2](./PLAN.md#studio-m16-2) 为准；依赖导入或无窗口 API 的提速不能替代 App 达标。以下仅供后续新版复测，当前无需重跑：

1. 正常退出旧 Studio，再从蓝发图标重开。确认文章列表、编辑输入、原 AI 配置可用；不重录 Key。若出现一次性重建，单独记录，之后再计普通 cold 样本。不要清缓存或强杀后台。
2. 建立新一轮目录，在仓库根运行一次 New-Item；每次重开并等待编辑器可用后运行 Copy-Item，再正常退出，至少保存六份。勿混入旧 M16.1 文件；记录前不要重复双击已打开窗口。

```powershell
New-Item -ItemType Directory -Path .cache/studio-m16-2/manual-next -Force | Out-Null
Copy-Item .cache/studio/startup-latest.json (".cache/studio-m16-2/manual-next/cold-{0}.json" -f (Get-Date -Format "yyyyMMdd-HHmmss-fff")) -PassThru | Select-Object -ExpandProperty Name
```

3. 保持同机同条件和无源码变化。可以另用秒表记录从双击到可见/可编辑的耗时，注明是否实测；诊断沿用原宿主内起点，不能混算。目标为 editor-ready p50 ≤1844ms、最慢 ≤2498ms，window-visible p50 ≤1947ms、最慢 ≤2011ms，不靠提前发送 ready 达标。
4. 另用非敏感测试缓冲检查首次 Think 预览、Keep/Me/Build 第一次打开及预览，确认等待提示、取消预览后仍能编辑、取消关闭保留缓冲、正常关闭重开和重复激活正常。无需改动或发布真实文章，也不导入私人材料；保存草稿或测试 AI 仅按你自己的日常需要操作。
5. 以后明确恢复 M16.2 并完成新优化后，再告知新批次目录及功能结果；当前不需要做此步。当前这批未达标是性能差距，不是缺少你的反馈；余项现为 Deferred，恢复实施时再记 In Progress，不把功能正常或隔离提速当作性能达标。

<a id="studio-workbench"></a>
<a id="studio-writing-workbench"></a>
### 9.12 工作台与写作

1. 从蓝发图标打开，默认可直接写 Think 原稿。左上选择器可以新建、打开网站文章或恢复本机原稿。已保存文章开头的「文章信息」可展开编辑标题、摘要、日期等 YAML 字段。旧文章 slug 保持原值，公开状态由发布动作处理。
2. 按「保存」或 Ctrl+S。信息足够时显示「已保存至网站源码」。缺少或无法解析文章信息时显示「原稿已保存」，仍可从选择器继续。自由原稿可以通过提示里的「添加文章信息」手工补齐。补信息时提供本机当天日期，可修改。待审箱原稿单篇上限为 64 KiB。
3. 「AI 整理」向当前选定的服务发送这篇拟公开文章，单篇上限 32 KiB。可选择 Gemini `gemini-3.5-flash-lite` 或百炼 `deepseek-v4.1-flash`。用 `npm.cmd run studio:configure -- -Provider gemini` 或 `npm.cmd run studio:configure -- -Provider bailian` 选择，已有 Key 可复用，正常退出重开后生效。两家的 Key 分别由当前 Windows 用户的 DPAPI 保护。Build 整理继续使用已存的百炼配置。仍需另行保存或发布。
   - 桌面后端启动时复用现有 `HTTPS_PROXY` / `HTTP_PROXY`，保留 `NO_PROXY` 并补齐 `localhost`、`127.0.0.1` 与 `[::1]`。若变量只在 Git Bash 会话内定义，蓝发入口无法继承，需让同一受信代理的设置对 Windows 用户启动环境可见。网络超时、鉴权、模型不可用、限额、上游暂不可用与结果解析失败分别提示，原稿均保留。正常重开即可重用加密 Key。
   - 审核时逐项勾选接受的替换或字段，默认全不选。「待确认」的字段先核实；只有提醒、没有可定位替换的建议不会修改原文。可展开正文对比查看上下文，两栏共用滚动条，不显示重复的 frontmatter。底部「应用选中修改」只更新编辑区，Ctrl+Z 可撤销；「取消」不改稿。
   - 新原稿未填 slug 也可应用所选正文和字段修改；按「保存」时只进本机原稿，补上有效 slug 后才可能写入网站源码。格式错误的 YAML 仍须手工修复。
4. 点「预览」渲染当前缓冲，包括缺少公开字段的原稿。正文上限为 512 KiB。编辑光标所在的段落优先进入视野，点「编辑」回到原选区和滚动位置。普通正文单次 Enter 可见换行，空行分段。用 `$...$` 写行内公式，独占行的 `$$` 包围独立公式，保留已有 HTML 公式。快速预览与 Astro 共用 Sätteri、Shiki 和 KaTeX 公式转换，快速预览使用浏览器原生 MathML，字形和版式可能略有差别。网络资源和跳转在预览中关闭，相对图片限 Think 内容目录，根路径图片限网站 `public`，受限 HTML 有提示。同一份正文切回预览时直接显示最近的安全预览；正文更改后自动重新渲染。外部替换了本机图片时，用「刷新」清掉上次预览，未保存的缓冲仍会保留。正式 Astro 预览仍可从维护界面打开。
   - 用 `Ctrl+Alt+C` 插入代码围栏或包裹选区，再填语言标记。可粘贴或拖入 PNG、JPEG、WebP、GIF，单个上限 2 MiB，宽高各不超过 8192，另有像素总量限制。Studio 根据文件类型校验，在 Think 的 `content/assets` 保存并插入相对链接。撤销可移除 Markdown 引用，已保存的去重图片留在本地；图片本身不会随单篇发布提交，须单独审核同步到远端 `main`。
5. 点「发布」核对当前文章、目标与差异。确认一次后由 M23 执行，状态显示在工作台。发布结果异常时用对应记录的「核对发布」或「复核上线」。较长的未保存候选超出待审箱上限时，先保存至源码再准备发布。见[发布边界和前置条件](#studio-publish)。
6. Build、Keep、Me 暂从同一个选择器进入各自已有编辑器。需要私人资料库、旧待审箱或维护操作时按 Ctrl+Shift+M 进入维护界面。浏览器可打开本机根页的 `#maintenance` 片段，私人文件选择仍由正式 App 提供。窗口 X 继续处理未保存内容后退出。见[私人手册](#studio-private)。

实际 Windows App 可在保存后正常退出，再从蓝发图标重开，检查中文输入、编辑与预览切换、原稿恢复和取消关闭。发布检查可停在差异与确认页。

Think 原有 `date` 继续使用日历日期，供网页显示和排序。写作台第一次保存新文章时记录 `createdAt` 和 `updatedAt`，格式为带引号的 UTC 秒级字符串，例如 `"2026-11-12T08:00:00Z"`。旧文章保留已有日期和已知创建时间，第一次修改正文或文章字段时才加更新记录。预览、AI 整理、无改动保存和仅切换公开状态不更新时间。直接发布未保存内容时，时间随确认前的候选一起冻结。

底栏累计时长从实际编辑起算，30 秒无编辑、切走文章、预览、窗口失焦或关闭时暂停。草稿先按本机提案关联，写入正式源码后继续沿用。累计数据约每 10 秒写入 Windows 本机的 `PersonalSpaceStudio/writing-time` 仓库专属目录。时长不会写进 Markdown。文件名或 slug 单独变化仍可关联，两者同时被外部修改时缺少可靠依据，强制结束也可能丢失最后尚未确认的计时。

<a id="studio-m18-manual"></a>
### 9.13 M18 实际 App 手动验收

只用你自行准备的非敏感资料库或测试副本，不导入真实私人资料，不发送口令/正文到聊天。无需重配 AI Key、重测启动，代理不操作桌面。

1. 保存当前内容并正常退出，从蓝发图标重开。进入“私人”，检查“私人资料库”和折叠的可选网站更新入口。
2. 在仓库外新建非敏感测试资料库，编辑测试文章，校验/预览并保存。锁定后重新解锁，确认记录仍在；仅保存应不改变网站文件。
3. 分别测试“打开资料库”的文件选择取消、输入口令取消，以及选择器打开时切换其他窗口再返回。应保持锁定或在可见 App 重新询问口令，旧缓冲/预览不会自行出现。新建时取消也不生成文件。
4. 保存测试资料库，进入“准备网站更新”。选择仓库外尚不存在的新文件，确认选择前锁定、返回后重新要求口令；取消后仍可重新解锁进入向导。再生成更新文件，展开版本详情，最后对话框选取消，网站文件应未变。本轮不用确认替换真实仓库 bundle，实际替换/备份/恢复已由隔离 fixture 自动验证。
5. 编辑一条非敏感未保存记录后点 X，取消退出应保留缓冲；再次选保存并退出、按提示输入口令，重开确认记录保存。不要在尚未确认的写入后反复点击。

反馈上述选择器、切换窗口和协同关闭结果后，才能核对 M18 的必需原生验收；当前以 Awaiting author acceptance 单独保留，不标 Done，不继续扩展。公开主线改依赖 M16.3，不把此私人专项作为 M19.1 的串行前置；受影响的共享启停/安全仍需回归。旧 M8/M9–M15 未验专项保留，不以本次排序或泛化反馈全部补齐。

<a id="studio-m16-3-manual"></a>
### 9.14 M16.3 统一手动验收：运行与更新分离

1. 双击原蓝发图标。若首次自动准备，单独记录准备耗时。开发更新后的运行包可用 `npm.cmd run studio:prepare` 手动准备。
2. 看见初始化窗口、随后可编辑；原 AI 配置稍后应显示已配置。首次 Think/Build 预览、次级模块切换、私人锁定（仅非敏感测试资料）、取消关闭/保存退出正常。
3. 重复双击只激活一个窗口，关闭后重开正常；无源码变化普通启动不出现编译或 SDK 还原。若自行测性能，单列六次当前版冷启和双击秒表；当前没有同版优化前配对基线，不能据此声称达到原改善门槛。
4. 只保存非敏感诊断：host 的 startup-latest.json、opener 的 startup-opener-latest.json、启动脚本的 startup-launcher-latest.json；各自时钟不同，不相加，不复制 desktop-session 等含 token 文件。损坏/断网/缺 SDK 负例由隔离自动测试承担，不需要破坏真实环境自行构造。


<a id="studio-intake"></a>
### 9.15 公开录入与待审箱（M19.1 已实现，App 人工待验）

1. 点击顶栏当前工作区，选择“录入与待审”。同一入口也可打开 Think 或 Build 手动表单。
2. 选择内容类型和新建或修订目标，粘贴拟公开材料。“导入设置与文件”可选择格式或载入至多 64 KiB 的 UTF-8 .md/.txt/.json 文件。Markdown frontmatter 自动填字段，纯文字作为正文，缺项留待审核补充。
3. 点“开始审核”。展开“原材料与字段来源”，核对来源、目标/源版本、slug、日期及正文。精调后点“保存待审候选”，可退出后从待审列表恢复。Ctrl+S 或保存并退出也可把尚未导入的文字存为不完整提案。
4. 校验诊断消除后可预览；原 Astro 隔离预览不会写源。批准按钮只针对当前已保存候选，改动立即失效。确认事实后点“批准并保存草稿/修订”：新建固定 draft，修订保持原 published，不提交/上线。成功后原材料和候选正文清除，列表仅留回执；后续去真实内容库编辑。
5. 待审箱单仓库最多 64 条、总 16 MiB，单条 384 KiB；用“丢弃本条”管理待审项/回执，不删除源。损坏条目不会被当空提案覆盖。写入未知先重读本条及真实内容源，未确认前不得重复应用。生产位置由 Known Folder 定位，为 LocalAppData/PersonalSpaceStudio/inbox/仓库身份；不要当缓存清空，不存私人资料/Key。

结构化报告的固定格式（整体 JSON，或放在唯一 personal-space 围栏中）：

```json
{"version":1,"module":"think","candidate":{"metadata":{"slug":"example","title":"标题"},"body":"Markdown 正文"}}
```

单份报告只针对一个目标。候选可缺项但未知字段拒绝。材料中的 shell/Skill/忽略规则等文字不执行。AI 自动整理及审核发布已接入。当前这条“直接导入”仍不调用远程模型。


#### Build 项目报告与审核

在录入页选 Build 项目，再选择新建或明确的已有目标。文字/MD 先填入章节，可逐项补标题/摘要/slug；完整报告使用同一个 v1 格式：

```json
{"version":1,"module":"build","candidate":{"slug":"example-project","title":"项目标题","summary":"有依据的摘要","sections":[{"title":"背景与构思","paragraphs":["材料中的真实说明"],"code":"保留换行的代码"}],"milestones":[{"title":"仍在计划的事项","status":"planned"}]}}
```

章节、链接、阶段、进展和问题在原项目控件中精调，代码/顺序/省略字段保留。完整字段与枚举仍按本手册 Build 章节。未知字段拒绝，不完整或日期/状态/链接非法只留待审。项目草稿也须满足原完整校验。创建提案时绑定整份 data.ts，别人改了同文件的另一个项目也会冲突，必须重新读取/核对，不盲覆盖。审核成功清除原材料，继续编辑真实源。原 published 不因导入而改变，新建固定 draft。发布需另一项明确最终批准。


<a id="studio-organize"></a>
#### 自动整理并填写（M20 实现/模拟通过，真实调用待统一验收）

在“录入与待审”中选 Think 或 Build，粘贴并核对拟公开材料及目标。展开“用 AI 整理”，点击“发送并整理”。发送范围限当前材料快照与模块整理指令。沿用已保存的百炼配置。AI 读取中或不可用时仍可直接点“开始审核”。Think 写作区的五种文本建议独立提供。

系统提示要求整理为原模块专属字段，修正组织但不补造事实；区分项目功能/本人贡献/已完成/计划，缺日期或数据就留空待核对。要求候选 JSON、逐字段原文片段及 unknowns；材料中的命令不执行，模型不给路径、published 或发布权。实际提示与严格解析见 studio/server/ai/organize.ts，请求沿用 server/ai/suggest.ts 的固定模型、非流式 OpenAI 兼容 chat/completions、system + 本份原材料 user 消息。

AI 输入/输出各至多 32 KiB、4096 输出 tokens、60 秒，无自动重试；本机直接导入仍允许 64 KiB。超限/限流/截断/坏结构/伪造引用显示错误，保留材料，不静默截断。原文引用仅证明位置，不保证事实/本人贡献；未引用字段标 unconfirmed，仍须本人审核。改一字段会把该字段标为作者编辑，其他引用保留。

返回后进入待审核，补缺项/核对/预览，再选择保存草稿或明确批准发布。整理本身不会写源、提交或上线。取消、编辑材料或退出会使旧请求失效，已送达上游的调用可能计费。真实验收用两份非敏感文章/项目材料核对效果和预览即可，不发送私人资料或 Key。


<a id="studio-publish"></a>
### 9.16 审核与发布（M23）

1. 打开 Think 文章，选择「发布」，核对本机变化与远端差异，再按一次「确认发布」。发布目标固定为站点仓库的 `main`，授权范围限当前文章。新增附件须先独立审核进入远端。差异或源版本变化时重新准备。
2. Studio 校验内容和资源、保存获批源码、创建隔离提交并原子快进远端。已无远端差异的文章无需重新发布。可快速核验的单篇文章由 GitHub 执行内容校验、一次 Astro 构建和产物边界核验。程序、依赖和范围不明的变化使用完整检查。
3. 看到「已推送，等待部署」后可以继续写作或退出。Studio 显示真实 Pages 状态，并以线上发布清单的 SHA 和目标详情页散列核对「已上线」。关闭后重开会读取旧回执。失败或线上仍待核对时用「核对发布」或「复核上线」。这两个操作只读取 GitHub 和网站，不会发起新的提交或调度。

发布只写获批源码，保留开发分支和暂存区。发布回执保存在 Windows 的本机应用数据中，记录边界和版本，不存正文或 Key。若窗口在推送或调度前遇到中断，先核对回执再决定后续操作。GitHub CLI 登录可用 `gh auth status --hostname github.com` 核对。手动部署使用获批的完整 main SHA 和 `studio_request=manual`，继续走完整门槛。

验证记录见 [Think v1.0 最终收尾](./PLAN.md#studio-think-v1-completed)。

<a id="studio-mainline-manual"></a>
### 9.17 本批统一人工验收（M16.3 → M19.1 → M19.2 → M20 → M23）

代理不操作桌面。仅用拟公开、非敏感测试材料，先保存原缓冲。按组反馈“通过/失败/未测”及错误码即可，不发送 Key、token 或私人正文。M21/M22 延期，不需安装 Pi Skill 或测试 DOCX/PDF。

1. 双击蓝发图标。验证首次缺少运行包时能自动准备，日常重复启动只激活同一窗口。确认 AI 自动加载旧配置，取消关闭、保存退出和重开正常。打开 Think/Build 检查首次预览。若测性能，单列准备与普通启动耗时，记录方法见[留存步骤](#studio-m16-3-manual)。
2. **文章录入**：从顶栏进入“录入与待审”，粘贴一份非敏感 Markdown（包含 slug/title/summary/date 和正文），导入、改一字段、保存候选、预览。取消或退出重开后可恢复待审。“批准并保存草稿”只创建本地 draft，材料清除为回执。到 Think 读取检查。明确选择新建或修订目标。
3. **项目录入**：选择 Build，使用上方报告模板，检查背景/章节/代码、本人贡献、计划/已完成状态。补字段、保存候选、预览，再保存为草稿。修订明确选已有项目，确认其他项目保持。只测一份目标，不拿整仓库代码或私人材料试验。
4. **自动整理**：分别在 Think/Build 导入区放一份非敏感文字，检查发送范围后点击百炼整理。核对标题/摘要/正文或项目章节、逐字段引用及未知项，不允许编造贡献/日期。精调再预览。试取消/改材料，旧响应不得覆盖。原 Think 润色仍正常、无修改时提示“本次未产生修改”。这两次真实调用可能计费，不需要重配 Key。
5. **发布审核与取消**：从待审提案直接准备发布，或从发布页选真实内容。核对两份差异、固定目标和执行条件。取消最终确认应无源/远端变化。当前远端尚未纳入守卫时只检查禁用原因，不绕过、不点击实际发布。本轮没有授权任何真实提交/推送/部署。
6. **真实发布（另行授权后才测）**：先完成守卫安装发布，再对获准的一个真实目标最终确认，等待精确 SHA/run/artifact/线上核验，查边界回执与网站。有暂时失败只核对结果，不盲重试。这组未做前 M23 不标 Done。

原 M18 的[原生选择器/私人协同关闭](#studio-m18-manual)、M8–M15 的[旧专项](#studio-batch-manual)仍按原清单待验。公开主线反馈不能替它们一并盖章。实际 App/性能、真实新 AI 和实际发布未反馈前，本批为自动验证完成、人工待验，不能宣布整个 Studio Done。

<a id="troubleshooting"></a>
## 10. 常见问题与维护记录

| 现象 | 先检查什么 |
| --- | --- |
| 启动等待较久 | 区分源码更新后的重建与无变更普通启动，保留诊断；M16.3 已分离日常运行/准备，真实 App 耗时待统一验收，见[目标流程](#studio-authoring-usage)，不要靠清缓存、重录 Key 或强杀进程提速 |
| 桌面启动/停止入口不可用 | 查[桌面操作与错误码](#studio-windows)，核对入口目标、Node/依赖、端口与归属；手动实例在原终端停止，未知状态不删锁、不清缓存、不批量结束 Node |
| 新文章不出现 | 是否在 Think `content/` 本层 `.md`；published 是否布尔 true；是否重新构建/部署；slug/日期/正文校验是否失败 |
| 写了未来日期却已出现 | 当前没有定时发布，需先 published false；Git 源仍可公开读 |
| `.mdx` 或子目录文章没读取 | 加载器只扫描 `./content/*.md`，不能通过维护操作宣称扩展已接入 |
| 标题改了，URL 没变 | 这是稳定 slug 的预期；显式改 URL 另行核对旧链接，没有自动重定向 |
| 搜正文搜不到 | Spotlight 当前仅搜索 title/description，文章对应 title/summary |
| 分类改名报错 | Keep 同一 category.id 的 label 是否所有条目一致，含默认 uncategorized |
| 测试数量仍按 1 断言 | 先确认实际变化正确，再独立更新必要内容预期；不弱化错误/隐藏/删除/空态测试 |
| 手机/子路径图片 404 | 检查相对引用、base、大小写与实际构建产物，未误用根地址 |
| Vault 操作退出 1 | 是否本地交互 TTY、外部普通文件、正确完整 JSON/字段/尺寸/口令；Build publicSlug 和 asset 引用是否存在；不要为查看错误而打印真实正文 |
| 私人文章减少了 | 源是否包含原有全部模块/条目；pack 是全量替换；从外部备份恢复并检查完整原本 |
| 换口令后旧备份打不开 | 旧备份仍用当时口令；rekey 不回写历史备份 |
| 线上入口提示未配置 | 目前就是这个状态；只有明确打包并发布真实包后才有资料；不要恢复公开验收样本当生产数据 |
| 发布后还是旧内容 | 核对 Actions 是否手动 deploy 成功、main SHA 是否正确、实际线上文件/缓存；push 检查成功不等于部署 |

### 本手册的维护依据

本手册自 2026-10-15 起按实际模块模型、内容加载、校验、Vault CLI、Studio 接口和发布流程维护。首次编写与规划入档记录见 [PLAN 完成记录](./PLAN.md#records) 的 9.6 / 9.7；旧阶段当时的“未实现 / 待验”属于历史停点，不代表当前能力。

Studio M0–M6 的实现、实际命令、失败处理、平台跳过及验收证据集中在 PLAN 9.8–9.15；[M5 最终验收](./PLAN.md#studio-m5-acceptance)已取代早期待验状态。[Studio v0](./PLAN.md#studio-v0) 与 PLAN 9.16–9.18 记录润色、Windows 加密凭据、桌面启动和正式发布；[N1](./PLAN.md#notes-n1)记录随记列表预览及最近网站发布。本手册保留实际操作与限制，不再复制整段交付日志。

2026-10-17 按作者要求理顺四份文档入口：项目总览与常用命令在 README，产品/架构/状态及验收历史在 PLAN，AI 执行规则在 AGENTS，字段与操作在本手册。保留一个 Git 和原目录，仅增加编辑器生成目录隐藏配置；未改变文章、Studio 接口、密钥存储或发布方式。本轮验证与改动范围见 [文档整理记录](./PLAN.md#docs-organization)。

随后作者追加授权的测试、提交与正式发布已完成，完整结果集中在 [PLAN 9.21](./PLAN.md#docs-release)；本手册不重复交付日志，日常操作不变。
