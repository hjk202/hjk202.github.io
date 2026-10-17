# Personal Space · 内容维护与写作接口手册

更新：2026-10-17。适用于当前 Astro 静态站点与 Windows 本地 Studio，按现有源码核对；本文件中的示例均为非敏感教学数据，不会自动成为网站内容。

**日常增删文章不需要再开发模块，也不需要开启 Phase 5。** 公开内容修改模块源文件，再验证、构建并按授权发布；私人内容在仓库外编辑完整 JSON，本地加密后只发布密文。公开网站没有在线写入接口；Windows 本地 Studio 已提供 Think 编辑器和隔离预览，操作见第 9 节。

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
| [AGENTS.md](./AGENTS.md) | 约束 AI 的授权、范围、最小改动、验证与停点 |
| [PLAN.md](./PLAN.md) | 产品需求、架构、风格、阶段路线和验收状态的 source of truth；原 NEED.md 的有效内容已归入其中，旧文件只供 Git 历史参考 |
| 本手册 | 内容字段、真实维护接口、操作步骤、AI 录入规则和未来编辑器的设计参考；不产生新功能的实施授权 |
| [README.md](./README.md) | 给所有者看的简要介绍和主线进度 |

Phase 1–4 已完成，Phase 5 可选增强、Phase 6 内容/旅行摄影扩展仍延后。本手册不重新开启它们。实际代码与文档发生冲突时先报告证据及最小建议，不能通过改文档授权重构。

| 想做的事 | 从哪里开始 |
| --- | --- |
| 自己新增一篇公开文章 | 第 3 节复制 Markdown 模板 → 第 7 节验证与发布 |
| 改标题、改正文、取消公开、删除文章 | 第 3.3 节；编辑时保持 slug 稳定 |
| 补充项目进展、收藏或个人介绍 | 第 4 节修改对应模块的数据 |
| 添加私人记录 | 第 5 节准备仓库外完整源 → 第 6 节交互加密 |
| 让 AI 录入公开素材 | 第 8 节复制任务模板；提交和上线分别授权 |
| 使用 Studio 编辑 Think | 第 9.3.2 节 PC 编辑器、第 9.3.3 节隔离预览、第 9.3.4 节 AI 建议、第 9.3.1 节独立 HTTP；[PLAN 6.8](./PLAN.md#studio-plan) 记录架构/状态 |

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
| `kind` | `'article'` 或 `'note'`，可选 | 省略按长文展示；note 在模块页内展开，但也有自己的详情 URL |
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
| 远程/多设备/原生 App | 首版明确排除 | 不因未来客户端方向增加云服务、同步、账号、Electron/Tauri/PWA 或 MCP |

首版只支持 Think 的公开源文章/随记及非敏感草稿，不支持 Vault、Build/Keep/Me 编辑。PLAN 中 M0–M6 全部完成，M5 真实调用与浏览器验收已通过；不是网站 Phase 5/6 的重启。未来不同模块用各自 adapter，不合并内容模型。第 9.4/9.6 节保留的发布/私人设计参考不属于 Studio 已选范围。

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

新文档默认 `published: false`、显式 kind；日期由作者确认。读取旧文档时将显示默认值与实际源表示区分，省略 published/kind 不等于保存时自动补齐。序列化采用 YAML 文档模型保留未改字段/注释，日期写为带引号字符串，正文不自动 trim/格式化/润色；无修改保存保持原始字节。标题里的冒号、引号、换行正确转义，不用字符串拼接生成可执行 TS/JS/MDX。

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

仓库锁固定为 `.cache/studio/think-authoring.lock`，内容仅版本、pid 与随机 token。整个实例生命周期排他，另一个对象或进程均返回 AUTHORING_BUSY；不用 pid 存活猜测自动抢陈旧锁。异常退出/初始文件错误可能遗留锁：先确认该仓库所有 Studio 调用方已停止且没有在写，再由作者在本机手动移除**这一个**锁文件，重新打开；不要删整个 `.cache/studio` 或不明 `.tmp`。目前没有 unlock 命令/HTTP 端点，不把未证实陈旧的锁当作可自动删除。

路径检查覆盖真实目录及其身份、junction/symlink、hardlink、Windows 保留设备名/ADS/尾点空格/大小写、无效 UTF-8。更新使用同目录 wx 临时文件、完整写入/fsync/关闭后重验，再 rename；新建用不覆盖目标的 link，删除用核对后的 unlink。拒绝危险静态路径和检测到的中途替换，但普通 Node API 不提供对恶意同权限进程任意时刻替换目录/文件的绝对隔离或原子 CAS，也不承诺断电持久性。依据：[Node 文件系统](https://nodejs.org/download/release/latest-jod/docs/api/fs.html)、[Windows 命名规则](https://learn.microsoft.com/en-gb/windows/win32/fileio/naming-a-file)。

M1 验证入口为 `node --experimental-strip-types tests/verify-studio-think.mjs`（隔离 CRUD/构建）及 `node tests/studio/think-files.smoke.mjs`（读取前一命令的忽略产物、两引擎实际浏览器）；浏览器安装/路径按 PLAN 的本轮记录配置。这些是测试命令，不是作者编辑器或 Studio HTTP 服务。

#### Windows 桌面日常入口（v0）

桌面 **Personal Space Studio** 双击即可打开，第一次冷启动先构建独立 Web，再后台启动本机服务并打开浏览器；以后再次双击复用同一个实例。关闭浏览器不会自动停止服务。保存全部编辑缓冲后，双击 **Stop Personal Space Studio** 可正常停止并释放仓库锁；更新源码后也应先停止再打开，既有手动终端实例仍需在原终端 Ctrl+C。

首次配置或更换 Key：运行 `npm.cmd run studio:configure`，输入兼容 Base URL 和隐藏的 API Key。凭据仅以 Windows 当前用户 DPAPI 密文存到 `%LOCALAPPDATA%\PersonalSpaceStudio\bailian.json`，不放仓库、.env、Git、浏览器或命令参数。正常重开不需再次输入；换 Windows 用户/机器、系统凭据保护变化或百炼 Key 失效时需重新配置。可用 `npm.cmd run studio:open` / `studio:stop` 代替快捷方式；重建快捷方式用 `powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File studio/windows/Install-Shortcuts.ps1`。

来源：[Microsoft SecureString/DPAPI](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/convertto-securestring)。本地已能运行的同用户程序不是被隔离的攻击者。启动器只读取这个指定存储，不扫描其他凭据库；解密结果经私有子进程管道进入内存和后端子进程环境，绝不转发到控制台/日志/API。构建先于解密，构建子进程不继承 AI Key。缺少配置仍可普通编辑；坏配置明确失败，不能假装 AI 已配置。

后台生命周期仅提供带本地随机令牌的命名管道 status/stop，不能执行文件/终端命令；状态在忽略的 `.cache/studio/desktop-session.json`，不含 API Key。异常强杀可能留下 `desktop-start.lock` / `desktop-session.json` 及原作者锁：先确认所有 Studio 与构建子进程都停止，再由作者核对后只移除这些确定遗留文件；不要自动抢锁或清理整个缓存。固定错误码在 `.cache/studio/desktop-error.json`，无正文、密钥或原始异常。脚本仅对子进程设置 RemoteSigned，不更改系统/用户执行策略，不绕过组织组策略。 快捷方式依赖当前仓库路径、Node 与已安装依赖；移动仓库后在新位置重新运行 Install-Shortcuts.ps1，不是独立桌面 App。

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
2. 点文章读取 metadata/正文与文件名/revision；已有 slug 只读，标题可改而 URL 不变。点“新建文章”只创建内存草稿，默认 draft/article，日期由作者确认；尚未在磁盘创建文章。
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

当前只接入阿里云百炼 `deepseek-v4.1-flash`，不自动切换其他模型/服务。页面显示后端可用状态；点击“请求建议”才发送只读快照中的**当前 Markdown 正文**。不发送 metadata、文件名、revision、其他文章或 Vault；不发送私人资料。请求可能计费，输入最多 32 KiB UTF-8，固定非流式/关闭思考、输出最多 4096 token，超时 60 秒，没有重试/队列/联网工具或对话历史。

v0 润色提示词明确要求修正病句与不自然表达、减少重复和冗余、改善句段衔接，同时保留事实、核心含义和个人语气，不为改而改。润色结果与请求时正文完全相同时，页面显示“本次未产生修改”、禁用采纳，正文/未保存状态/文件均不变；不 trim 或归一化比较，空白差异仍是可采纳的实际建议。

润色/改写/概括的采纳目标是**替换正文**；生成标题/摘要分别替换 title/summary。先核对结果，再点“采纳”写入当前编辑缓冲；结果是只读文本，不执行 HTML。采纳不写文件、不改 published，仍须人工核对事实、校验后显式保存，旧 revision 冲突照常阻止覆盖。点“丢弃”保留原文；编辑/保存/切换/改操作会清除旧建议并取消请求，迟到响应不会覆盖新内容。取消不能撤回已送达模型的内容或保证不计费；不自动落盘/公开。

**后端配置**：后端本身仍仅从启动 Studio 的同一进程环境读取 `DASHSCOPE_API_KEY` 和 `DASHSCOPE_BASE_URL`。后者是本工具配置名，值取百炼控制台对应业务空间/地域的兼容 Base URL，例如 `https://<业务空间ID>.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`（需替换实际 ID）；当前仅接受官方 workspace HTTPS 地址，不支持任意代理/HTTP/URL 凭据/查询参数。Key 与地域/业务空间须对应，并已开通所选模型。依据：[百炼 DeepSeek API](https://help.aliyun.com/zh/model-studio/deepseek-api)。

不要把 Key 放聊天、仓库、`.env`、浏览器、命令参数或日志。后端不加载 `.env`、不扫描系统凭据；桌面启动器按作者本轮授权读取上述指定 DPAPI 密文，再只给后端子进程提供配置；启动后修改配置需停止并重启。无配置显示 AI_NOT_CONFIGURED、坏配置 AI_CONFIG_INVALID；不影响已有 CRUD/校验/预览。

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

脚本只写 `.cache/studio-m5/live.json` 的时间、模型、五项操作/成功/输出字节数与固定错误码，不存 Key、端点、输入或原始响应。已核验的 `2026-10-17T05:08:45.404Z` 记录五项均成功、simulated:false、complete:true，本轮只读取/复制该记录，没有重复五次调用；另作了一次独立真实 UI 非敏感润色，采纳/校验后未保存，原文章不变。手动终端模式仍按进程环境配置，验收不会让其他终端自动获得 Key；桌面模式则从本机 DPAPI 存储加载，不需日常重复录入。以后仅在需要显式复验时运行上述付费脚本，不把模拟上游当作真实调用。

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

### 9.4 验证、Git 与发布 adapter（未选的远期参考）

本节保留此前远期参考，**不属于已认可 Studio M0–M6 的实施范围**，不提供相关 API/按钮/占位。当前校验/提交/推送/发布仍按第 7 节由作者依授权分别执行；任何未来自动化必须重新规划独立受权操作：

| 操作（未实现） | 安全与完成约束 |
| --- | --- |
| `validateCandidate({expectedWorktreeRevision})` | 只执行固定允许的 lint/typecheck/test/build/相关浏览器脚本；返回 job id、状态、候选身份和脱敏报告；不是通用 shell |
| `getJob({jobId})` | `queued/running/succeeded/failed/cancelled` 及步骤结果；不能把后台已启动视为已通过 |
| `commitCandidate({validatedCandidate, paths, message})` | 路径白名单、工作区版本未变化、精确差异已审阅；不夹带其他用户工作；返回提交 SHA |
| `pushCandidate({commitSha})` | 单独授权，推送预定仓库/分支；无强推、无浏览器自带长期凭据 |
| `publishCandidate({commitSha})` | 明确发布授权后触发现有 main 手动 Actions；运行绑定该 SHA，返回 run URL；跟踪最终部署和线上验证 |

`expectedWorktreeRevision` 应覆盖允许输入的内容哈希及 Git 状态，校验完成后源有变化就使候选失效，重新验证。构建/预览在隔离受控目录运行，避免覆盖作者生产产物；多个发布任务串行处理。GitHub 凭据仅由可信本地凭据存储或独立服务端持有，最小权限，不写进公开页面/仓库。

当前 Studio 不实现这些操作。不能为了“将来完整”提前建立任务数据库、通用命令中心或统一内容服务。

### 9.5 Studio 本地文件、HTTP 与预览约束

M1 文件服务、M2 本地 HTTP 与 M4 隔离预览已接入（启动/配对见 9.3.1，预览操作见 9.3.3）；详细合同及验证见 [PLAN Studio 计划](./PLAN.md#studio-plan)。作者需要了解的边界如下：

- 本地服务固定只监听 127.0.0.1；验证 Host、Origin 与会话/配对 token，写入用 CSRF 防护，禁止任意跨域。仅绑定 127.0.0.1 不能代替请求认证，不使用 `Access-Control-Allow-Origin: *` 暴露写权限。
- 浏览器提交逻辑 key，不提交任意绝对路径/文件命令；服务端固定允许目录与扩展名，解析真实路径并阻断 `..`、符号链接逃逸、编码绕过、Windows ADS。接口不能读 `.git`、凭据、外部私人源或写任意源码。
- 写入先验证再原子替换，保存前检查原始字节 revision；删除必须明确，取消任务不能留下半写文件。首版不提供素材上传，不自动清理共享图片；新建还需检查 Windows 设备名/大小写/尾点空格等文件名限制。
- Markdown 预览不能将不可信 HTML/脚本注入当前站点或编辑器的受信任 origin。使用隔离、禁脚本的 sandbox 预览或另源渲染，禁读编辑凭据；公开 Astro 编译只能处理作者信任的源，不能直接编译访客上传 MDX/任意项目配置。
- 首版按按钮触发隔离 Astro 构建，复用 Think 原模板/样式/Markdown，保留现有 HTML 公式；草稿完整校验后仅临时副本参与渲染。`.cache/studio/` 内派生副本可丢弃，不是第二套正文，不修改真实 published/源码/根 dist。预览用禁脚本、无同源权限的 sandbox，资源受限；不预览其他模块/Vault/网站交互脚本。
- 构建期及浏览器端都禁止预览偷偷请求远程资源；无远程图片代理，不发内容到统计/AI 服务。错误/日志无正文与 token。编辑缓冲只在内存，预览耗时/超时需反馈，旧预览不能覆盖新候选；未经单独授权不做浏览器自动持久化正文。

### 9.6 私人编辑器的额外接口边界（未选的远期参考）

本节保留此前安全参考，**不属于 Studio M0–M6 范围**，不是私人编辑功能授权。当前私人维护仍使用第 5–6 节既有仓库外工作流；未来若另行选择私人编辑器，才适用以下建议。

先只支持作者本机：内存编辑完整 payload → 用既有模块规则校验 → 交互输入口令 → 复用协议加密 → 导出 bundle。读取现有密文也应在本地内存完成，不将明文送到在线站点或远程 API。

可以规划本地函数 `validatePrivatePayload(value)`、`encryptPrivatePayload(value, passphrase)`、`decryptPrivateEnvelope(envelope, passphrase)`；必须同时复用第 6.2 节模块校验和第 6.3 节协议，不能只调用原始 AES。它们目前不是现成编辑器服务，也不能由静态浏览器直接 import Node 的 `operations.mjs`；浏览器应使用安全共享代码与独立模块 adapter。

保留 PBKDF2 参数、随机盐/IV、AAD、尺寸、MIME、口令规则与两端兼容；不要自造密码算法。口令不放 URL、localStorage/IndexedDB、后台 API 或日志；锁定/关闭/取消清理预览 DOM、引用和 Blob。明文原本若需保存，由作者明确选择仓库外位置，本地保存；不做项目内自动保存、云端草稿或后台上传。

未来本地文件权限与“作者本地明文源”的选择必须清楚显示，不能让“保存”按钮有时保存明文到仓库。导出密文和替换正式包分开；完整包缺其他模块/资产时提示影响，不默默清空。

### 9.7 验收与当前停点

Studio 已选范围的逐项 Done Criteria/Verification 现集中在 [PLAN 6.8](./PLAN.md#studio-plan)，不在本手册维护另一套 milestone 状态。下表保留能力核对索引；发布/Private 行仅适用于以后另行选定的工作。

| 能力 | 至少应验证 |
| --- | --- |
| 解析/导出 | 中文、引号/冒号/多行、日期、Markdown 围栏和非 ASCII；往返保留语义，draft/note 等字段不丢 |
| CRUD | 添加/编辑/取消公开/删除/全空；稳定 slug、重复冲突、404、计数/索引、根/base 链接，未触及条目保持 |
| 并发/文件边界 | revision 冲突不覆盖，写失败不破坏旧文件，路径/符号链接/ADS/未知字段/错误类型被拒绝 |
| 预览 | 与真实 Think 渲染相符；不可信脚本不能执行或读凭据；代码/图片/长文 PC 可读，网站受影响时按 PLAN 跑既有根/base/响应式回归，不新增 Studio 手机支持 |
| 发布（若选择） | 保存不部署、校验失败阻断、源变化使验证失效、精确提交、Actions SHA/产物/线上一致、可恢复 |
| Private（若选择） | Node/browser 互通、模块与资源负例、关联依赖、整包保留、口令规则、锁定清理、不在网络/存储/日志留下明文 |

Studio M0–M6 全部 Done；M5 于 2026-10-17 完成真实五项记录核验、真实 UI 与余下验证。随后作者授权 v0 润色优化、本机 DPAPI 凭据与桌面启动，并提交/正式部署网站；逐项状态与证据见 PLAN 6.9 / 9.16 起的记录。Studio 服务仍只在本机，发布的仍是静态网站。真人输入法候选窗与恶意项目 OS 沙箱未验收；既有首版证据见 PLAN 9.12，AI 不能用模拟结果冒充真实接通。

<a id="troubleshooting"></a>
## 10. 常见问题与维护记录

| 现象 | 先检查什么 |
| --- | --- |
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

**首次手册编写记录（历史）**：

2026-10-15 从当前工作区核对模块模型/加载器、Module/Search/Vault 类型、校验器、crypto/passphrase、CLI/文件操作、package.json、Playwright 配置和 Pages 工作流。产品阶段仍为 Phase 1–4 Done，Phase 5/6 延后；未新增内容、修改源码、实现写作前端或部署。

**文档专项 Verification（2026-10-15，通过）**：内联 Node 校验退出 0，10 个主章节/代码围栏、四份文档的 73 处相对链接/锚点有效；6 份示例（1 份 YAML/Markdown、5 份 JSON）由现有公开/私人校验器检查通过，完整私人示例及 NEMU 补充还通过本地模块/关联校验，未产生密文。核对 12 个实际 npm 命令、74 个接口属性与 59 处私人白名单字段，阶段与授权表述一致；149 个非目标跟踪文件 SHA-256 未变。`git diff --check` 退出 0。

只新增本手册并同步 AGENTS/PLAN/README 的职责、入口与本轮记录，保留此前 Phase 5 规划/延后改动。工程 lint/typecheck/test/build/E2E 和页面 smoke 本轮未运行（纯文档，不改工程输入）；未提交、推送或部署，未实现编辑器，完成后停止。

**Studio 同步记录（2026-10-15）**：按已认可且仅获准入档的方案更新第 8.4/9 节和入口；作者字段/草稿/版本冲突语义与 PLAN 6.8 一致，Git/发布与私人编辑参考仍未选，不扩大实施范围。文档审计退出 0，四份文档 100 处相对链接/锚点有效、Studio 状态与 7 个单元一致；`git diff --check` 退出 0，150 个非目标文件哈希不变。完整记录见 PLAN 9.7。本轮仅改三份文档，保留已有未提交改动；M0 未开始，未运行工程检查/页面 smoke，未提交、推送或发布。

**Studio M0 交付记录（2026-10-15）**：已实现第 9 节列明的契约/纯函数，保留正文、注释、字段省略与无修改字节往返，严格区分草稿可保存和公开就绪；网站旧过滤/校验/排序行为保留。lint/typecheck/52 unit/根与 base build 退出 0，原内容浏览器 4/4 与根/base×Chromium/WebKit 四组合 Think smoke 通过、0 pageerror。146 个非目标文件哈希及既有非根锁条目不变，证据在 `.cache/studio-m0/`，命令/失败处理/已知限制完整记录在 PLAN 9.8。M0 Done，M1 未开始；仍无文件写入/HTTP/UI，未提交、推送或发布，保留已有未提交改动后停止。

**Studio M1 交付记录（2026-10-15）**：第 9.3 节文件服务已实现、M1 Done；六项非预览方法、key/revision、仓库锁和安全落盘/错误语义与契约源码一致。lint/typecheck/build 退出 0；67 项 unit 中 66 通过、0 失败，普通文件 symlink 建链因 Windows 账户 EPERM 明确 skipped，实际 junction/hardlink/ADS 已验证。隔离 CRUD 后七次构建、根/base×三种内容状态×Chromium/WebKit 的 12 组合浏览器通过，0 pageerror/失败请求；原内容浏览器 4/4 通过。155 个非目标文件与依赖/真实源哈希不变，证据 `.cache/studio-m1/`，完整命令/限制见 PLAN 9.9。锁/临时文件人工恢复与竞争限度见第 9.3 节；HTTP/UI/预览仍未实现，M2 未开始。保留已有未提交改动，未提交、推送或发布，停止。

**Studio M2 交付记录（2026-10-16）**：第 9.3.1 节 HTTP 已实现、M2 Done，M1 文件服务原样复用；固定 loopback、Host/Origin/token、JSON/限额/超时/错误映射及启动/配对/关闭均验证。lint/typecheck/根与 base build 退出 0；76 项 unit 中 75 通过、0 失败、1 个继承的普通文件 symlink 权限 skipped。两个浏览器配对/CRUD/CSRF 通过，WebKit 5 条预期跨源拒绝 pageerror 全量记录/核对，正常页面无错误；既有内容 4/4、网站根/base×双引擎 smoke 通过。Windows Ctrl+C 清锁、同端口重启及无凭据/正文日志已实测，160 个非目标文件哈希不变。证据 `.cache/studio-m2/`，完整命令/恢复/边界见 PLAN 9.10；配对不是本机账号隔离，编辑器/预览/AI/Agent 未实现。保留已有未提交改动，不进入 M3，不提交、推送或发布，停止。

**Studio M3 交付记录（2026-10-16）**：第 9.3.2 节基础编辑器已实现、M3 Done，六项操作只用现有 M2 同源 HTTP，字段省略/源版本/文件边界保留。lint/typecheck/unit/网站根与 base/独立 Web build 退出 0；unit 77 通过，1 个继承的 symlink 权限 skipped；编辑器两引擎 13 通过、0 pageerror，WebKit 无 CDP IME 的子项 skipped，真实 Chromium 组合输入/快捷键通过。既有内容 4/4、根/base 双引擎 smoke、API-only 安全回归通过，npm 启动/浏览器读取与 Ctrl+C 清锁已实测。161 个非目标文件和 438 个非根 lock 条目不变，证据 `.cache/studio-m3/`，完整限制/失败处理见 PLAN 9.11。未验证真人输入法候选窗，不宣称首版全部完成；预览、AI/Agent 均未实施。保留已有未提交改动，未进入 M4，未提交、推送或发布，停止。

**Studio M4 交付记录（2026-10-16）**：第 9.3.3 节按钮隔离预览完成，M0–M4 Done、首版本地验收通过；M5/M6 Deferred。预览复用真实 Astro，在临时副本公开完整候选，再以受控 HTML/data 图片交给无权限 sandbox；不保存源、不改源 published/根 dist，编辑后旧结果失效。lint/typecheck/unit/根与 base/独立 Web build 通过；unit 81 通过、1 项既有 symlink 权限跳过；Studio 两引擎 23 通过、1 项 WebKit CDP IME 跳过，新增预览十项全通过、0 pageerror。网站完整默认 E2E 75/75、四组合 smoke、额外预览视觉检查及 API 安全回归通过。165 个非目标文件、438 个依赖条目及历史记录保持，证据 `.cache/studio-m4/`；详细命令、截图、清理/可信构建与未运行项见 PLAN 9.12。保留已有未提交工作，未进入 M5/M6，未提交、推送或发布，按授权停止。

**Studio M5 实施/待验记录（2026-10-16）**：仅接入用户选定的百炼 `deepseek-v4.1-flash`，第 9.3.4 节操作、后端环境配置、建议接口和非敏感真实调用脚本已加入。建议只在人工采纳后进入缓冲，再走原校验/revision 保存，不自动写入/公开。lint/typecheck/根与 base build 退出 0，unit 88 通过、1 项既有 symlink 权限跳过；Studio 双引擎 33 通过、1 项既有 WebKit CDP IME 跳过，新 AI 十项全通过、0 pageerror；网站四组合 smoke/API-only 回归通过。构建环境 canary、公开产物/Web bundle/日志、176 个非目标文件及原 package/lock/历史记录审计通过。真实调用入口因本机 Key/Base URL 缺失返回 AI_NOT_CONFIGURED，未向真实服务发请求，不能冒称已接通；M5 仍 In Progress，待本机配置后的真实五项调用验收。证据 `.cache/studio-m5/`，完整命令/限制/停点见 PLAN 9.13；保留已有未提交改动，未进入 M6，未提交、推送或发布。


**Studio M6 交付记录（2026-10-16）**：用户选定的轻量 Node/JSON-lines stdio 已完成，M6 Done；五项操作经原 HTTP/Think 服务执行，默认只读，可信启动开写权限；createDraft 不公开，save 保留 published（含省略）与 revision，未知写结果不重试。lint/typecheck/test/根与 base build 退出 0；unit 95 通过、1 项继承的 Windows symlink 权限跳过，新增 Agent 七项全通过；Studio 两引擎 35 通过、1 项继承的 WebKit CDP IME 跳过，新增 Agent/Web 双向冲突两项全通过、0 pageerror。网站默认 E2E 75/75、四组合 smoke 和原 API 安全回归通过。188 个非目标文件、package/lock、真实内容与 M0–M5 历史记录不变；证据 `.cache/studio-m6/`，详见 PLAN 9.14。M5 继续 Awaiting Verification（真实百炼调用待验），未执行真实模型调用；不新增依赖/MCP/AI 调用或发布能力，未提交、推送或发布，保留已有工作并停止。


**Studio M5 最终验收（2026-10-17）**：已核验作者本机 `live.json` 五项成功、simulated:false、complete:true，原记录保留；另经作者已配置的原服务作一次真实 Chromium 非敏感润色/采纳/校验，只有内存缓冲变化，源文件和 published 不变，无外部浏览器请求/Authorization/pageerror。lint/typecheck/test/根与 base build 退出 0，unit 95 通过、1 项既有 symlink 权限跳过；AI 双引擎 10/10、默认网站 E2E 75/75、四组合 smoke 全通过。193 个非目标文件、package/lock、真实源和历史记录不变，仅 PLAN/README/MAINTENANCE 更新；证据 `.cache/studio-m5-acceptance/`，详见 PLAN 9.15。M5 Done，Studio M0–M6 全部完成。生成内容仍须作者逐次核对，凭据仍按本机进程配置；未读取/记录 Key，未修改作者源或关闭原服务，未提交、推送或发布，保留全部已有工作并停止。
