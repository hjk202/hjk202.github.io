# Personal Space · 需求、设计与实施计划

更新：2026-10-17。本文是产品需求、目标架构、风格设计、分阶段实施及验收状态的 **source of truth**；执行守则见 [AGENTS.md](./AGENTS.md)，所有者简报见 [README.md](./README.md)，完整内容维护与未来写作接口参考见 [MAINTENANCE.md](./MAINTENANCE.md)。

此前按用户要求合并原需求书、设计稿、架构/内容/加密/维护/发布指南；随后用户明确要求一份完整内容维护手册，现维护以上四份文档。README 是项目入口，AGENTS 约束 AI 执行；本文集中保存产品与阶段依据、完成记录和验收证据，维护手册集中记录实际字段、操作、已实现 Studio 接口及未来扩展参考，不另立需求来源或启动未来功能。旧文档及完整历史验证记录可从整理前提交 `6202827` 读取，例如 `git show 6202827:NEED.md`；不再以旧文档作为并行依据。

## 阅读索引

- [当前状态](#current-state)
- [产品与架构](#architecture)
- [仓库组织与网站 / Studio 边界](#repository-layout)
- [模块接口与内容维护](#contracts)
- [公开与内室风格](#design)
- [私人协议、安全与维护](#vault)
- [Phase 路线与 milestone](#roadmap)
- [Phase 5 评估与实施草案](#phase-5-plan)
- [Personal Space Studio 架构与 milestone](#studio-plan)
- [验证流程](#verification)
- [发布与回退](#release)
- [完成记录与风险](#records)

<a id="current-state"></a>
## 1. 当前状态与授权停点

| 项目 | 现状 |
| --- | --- |
| 本次任务 | 文档整理的测试、提交与正式发布已完成；结果见 [9.21](#docs-release)。保留单一 Git 和现有目录，N1 手机反馈仍待作者，完成后停止 |
| 已完成 | **Phase 1–4 全部 Done**；公开设计 D1–D8 与内室 V1–V5 完成 |
| 当前 milestone | 无；N1 Done，Studio M0–M6、v0.1/v0.2/v0.3 全部 Done，Phase 5/6 仍延后 |
| 最近已核验线上产品源 | `dcc5d826631935d20ef8378056c46617bb8e3513`（26 文件三方哈希一致，线上 Chromium/WebKit 无 pageerror/失败请求；公开内容与 N1 相同） |
| 最近发布 | [Actions 39019825142](https://github.com/hjk202/hjk202.github.io/actions/runs/39019825142)，完整 check/deploy 成功；本轮仅整理文档与编辑器视图，线上全站验证通过 |
| 访问地址 | [正式网站](https://hjk202.github.io/)；[随记预览验收入口](https://hjk202.github.io/think/?v=2a8ff37) |
| 私人数据状态 | 本地/产物/线上均无验收密文，真实 Vault 未配置；私人功能完整，入口显示未配置提示 |
| 后续阶段 | Phase 5 按用户决定延后，方案保留为储备；Phase 6 仍延后，均不影响当前可用状态 |
| Studio | 独立本地作者工具路线，Windows PC、同仓库、Think 优先；不是访客网站新模块，也不重启 Phase 5/6，详见 [6.8](#studio-plan) |

2026-10-15 用户澄清要求完成 Phase 4 及以前全部工作，并明确表示“我都检查过了，没有问题”。手机复验据此记通过；此前 Closed 是误解收尾意图的历史停点。本次已完成原 4.8 的样本清理、完整复验及最终发布，全部标准满足，标 Done 并停止；Phase 5/6 未开始。

<a id="architecture"></a>
## 2. Overall Architecture

### 2.1 产品目标与边界

Personal Space 是韩江恺的个人数字空间：有辨识度的入口，各领域独立组织，公开与私人内容共用所属模块。

```text
正常浏览：Home → Compass → Module → Content
快速查找：Spotlight → Module / Content
私人访问：本地密文 → 成功解锁 → 原有模块内的公开 + 私人内容
```

- Home 只含 Compass、搜索入口和少量身份信息。Compass 用于 Explore，Spotlight 用于 Find。
- 全局导航只有 Compass、Spotlight、Home link；保留现有锁定控制。不增加 Dock、Navbar、Sidebar。
- 不往 Home 加 Feed、About、最近文章/项目、Recent Activity、Dashboard 或私人预览。
- 模块相互独立，跨模块引用用普通 URL，不互相 import。Core 不理解 Post/Project/Bookmark 等业务模型。
- 不建立 UniversalContent、Relations、全站 Activity/Timeline、知识图谱或数据库后台。项目内更新不属于全站时间线。
- 功能优先，真实内容以后逐步录入；旅行与摄影是**一个**未来模块，正式名称/id 留到启动时确认。

### 2.2 技术与代码地图

Astro 静态输出 + TypeScript strict + 原生 SVG/CSS/浏览器脚本；公开文章使用 Markdown。已安装 MDX 集成，但当前 Think 加载器只读取 `content/*.md`，不假定 `.mdx` 已自动接入。GitHub Actions 构建并发布至 GitHub Pages，无运行时服务器。

| 位置 | 当前职责 / 修改入口 |
| --- | --- |
| `src/pages/index.astro` | 首页组合，不读取模块内部数据 |
| `src/pages/[...path].astro` | 通用静态路由桥，汇总模块 pages |
| `src/pages/search-index.json.ts`、`404.astro` | 公开搜索端点与错误页 |
| `src/core/module/` | 类型、自动 Registry、页面收集、base URL、私人适配器发现 |
| `src/core/search/` | 构建期公开投影、浏览器匹配、会话内私人投影及来源判断 |
| `src/core/vault/` | 密文协议、口令/载荷校验、内存状态、受控目标；不放模块内容模型 |
| `src/shell/layout/` | Base/ModuleShell、搜索按钮、导航与生命周期 |
| `src/shell/home/` | Compass、几何/统计、Spotlight UI 与交互 |
| `src/shell/theme/`、`glass/` | 全站环境、设计变量、玻璃与焦点/触摸基础样式 |
| `src/shell/vault/` | Unlock/Lock、模块挂载、DOM/Blob 清理与 UI 状态 |
| `src/modules/{me,think,build,keep}/` | 各自 module/pages、模型/数据/页面、背景、私人 schema/server/client/style |
| `scripts/vault/` | 本地交互打包、验证、换口令、备份恢复与公开边界预检 |
| `tests/unit/`、`tests/e2e/`、`tests/fixtures/` | 纯逻辑、生产浏览器及非敏感边界样本 |
| `tests/verify-*.mjs`、`tests/serve.mjs` | 隔离接入/内容/设计/移动/会话/发布验证及测试服务 |
| `.github/workflows/deploy.yml` | 检查与手动 Pages 发布，部署已测试的同一 dist |

配置：`astro.config.mjs` 为 static，`SITE_URL` 默认 `https://hjk202.github.io`，`BASE_PATH` 默认 `/`；环境输入只用于配置。`tsconfig.json` 继承 Astro strict；ESLint 检查 JS/TS/Astro。Playwright 单 worker、零自动重试、不复用已有测试服务。

当前锁定依赖为 Astro 7.3.8、TypeScript 6.0.3、Playwright 1.64.0，精确版本见 package.json/package-lock.json；不随任务升级。`.node-version` 为 22.23.2，npm 10.9.8；其他 Node 范围以 engines 为准。

<a id="repository-layout"></a>
**仓库组织与网站 / Studio 边界**：

- 维护一个 Git 仓库，保留根目录的 Astro 项目与独立 `studio/`；不搬到 `website/`、不拆仓库或引入 workspaces。根 `package.json` / lockfile 管理两者依赖与命令。
- 网站源码是 `src/` 和 `public/`；Studio 的界面、服务、契约、Agent 与 Windows 启动脚本都在 `studio/`，细分职责见 [6.8.2](#studio-plan)。Think Markdown 仍只有 `src/modules/think/content/*.md` 一份源，不向 Studio 复制持久化正文。
- 网站静态产物为 `dist/`，Pages 只部署该受检产物；Studio Web 产物和隔离预览位于 `.cache/studio/`，本地服务不进入公开网站。网站不 import Studio，Studio 后端只按既有边界复用 Think 纯模型/校验。
- `tests/`、`scripts/` 和根配置保留原位，不借本次整理重分测试、修改启动或发布行为。项目目录总览及常用命令见 [README](./README.md)，具体维护操作见 [MAINTENANCE](./MAINTENANCE.md#start)。
- `.vscode/settings.json` 通过 `files.exclude` 隐藏根目录的依赖、构建、缓存和测试输出，适用于支持该设置的编辑器。不删除文件，不修改 Git 忽略规则，不额外配置搜索或文件监听；编辑器搜索是否继承隐藏规则取决于其搜索设置。临时查看可把对应项设为 `false`，结束后恢复；不要为整理视图删除运行中的 Studio 缓存/锁。

### 2.3 构建期与浏览器边界

```text
构建期：模块 module.ts / pages.ts / 本地内容
        → Registry + 页面验证 → 静态 HTML
        → count/search → 可序列化元数据与公开 search-index.json

浏览器：公开投影 → 轻量文本匹配 → Spotlight
        密文 → 口令派生/认证解密 → 模块私人适配器 → 内存投影/页面
```

浏览器不得导入文件读取、Markdown/MDX 编译、构建 Registry、`.server.ts` 或内部构建加载器。Shell 消费模块接口，模块可使用共享类型和 Shell；模块不互相依赖。

<a id="contracts"></a>
## 3. 模块契约与内容维护

### 3.1 自动注册与路由

以 [模块类型](./src/core/module/types.ts)、[Registry](./src/core/module/registry.ts) 和 [页面收集](./src/core/module/pages.ts) 为实现对应点：

| 契约 | 约定 |
| --- | --- |
| `module.ts` 默认导出 | `id/name/route/icon/order`，可选 `enabled`、`compassStatistic`，以及 `count(): Promise<number>`、`search(): Promise<SearchResult[]>` |
| id/order/route | id 与目录一致；id、规范化 route、order 唯一；enabled 缺省 true，按 order 排序；icon 为 24×24 SVG path |
| `pages.ts` 默认导出 | `ModulePage[]`：相对 `path`、Astro `component`、模块自有 `props`，可选 `head.title/description`；`path: ''` 为模块首页 |
| 路径 | 公开 route/url 为不含部署 base 的站内逻辑绝对路径；页面 path 为模块内相对路径，不穿越目录 |
| 公开数据 | count 为真实非负安全整数；search 只生成实际公开页面的四字段投影，不接收访客查询 |
| 错误 | 无效/重复注册、路由、数据或目标使构建失败，不吞错为 0 或空数组 |

新增模块只增加 `src/modules/<id>/` 内定义、页面和自身数据，通过固定 `import.meta.glob` 自动发现；不修改 Home/Compass/Spotlight/Core 的模块名单或添加模块 id 分支。模块目录不会自行成为 Astro 路由，由通用路由桥生成。

站内 href 通过 `withBase` 添加 base 一次；外链不经过它。公开 slug 使用小写字母/数字/连字符且模块内唯一，标题变化不自动改 slug。页面 head 由模块声明、Base 输出，canonical 包含 site/base；head 不扩充搜索字段。

### 3.2 Compass 与 Spotlight

- 外层按真实启用模块数量动态生成等角 N 边形，内层半径按 `log1p(count)` 在当前集合归一化；全零回中心，少于三个方向不伪造 Radar 面。几何实现见 `shell/home/geometry.ts`。
- 对外展示真实数值。Me 声明 `compassStatistic: 'peer-average'`，仅 Compass 使用其他启用模块 count 的算术平均，含零，无同伴为 0；标为 Avg，最多两位小数，几何用未舍入值。Me 资料 count/search 不变，不能按 id 写特例。
- SearchResult **仅** `title/description/url/module`，见 `core/search/types.ts`。构建期公开 JSON 不含私人字段、正文或来源标签。
- 查询大小写不敏感，中文子串匹配；排序为标题精确 → 标题前缀 → 标题包含 → 描述包含，再按模块 order/标题/URL 稳定排序；匹配后按 URL 去重。
- 空查询仅 Registry 模块入口，打开时无默认选中项，不突出 Build；输入后选择首个结果。焦点与选中分离，静止指针不能误选。
- 点击搜索/Ctrl 或 Cmd+K 打开并聚焦输入；上下键、Enter、Esc、点击遮罩/关闭、IME composition、防误提交、Tab 焦点约束与还焦均保留。`/` 不作为默认新增快捷键。
- 加载失败可重试，模块入口仍可用；结果区可滚动。开启/关闭动画衔接，减少动态偏好立即完成；快速重开取消旧计时任务。
- 解锁后组合模块私人投影，只在内存更新搜索与真实统计。按实际命中对象来源标“公开/私人/混合”，不猜 URL；快捷入口始终中性，空查询不泄露私人摘要，相关性排序不为私人结果让位。

### 3.3 公开内容维护

本节保留架构摘要；全部字段、增删改示例、草稿/链接/素材规则、AI 录入模板与未来编辑器接口集中见 [维护手册](./MAINTENANCE.md)。手册中的建议接口不等于当前能力或执行授权。

当前真实素材：Me 介绍与 GitHub 链接；Think《我为什么越来越喜欢从底层理解一个东西》（2026-10-13）和《阳光正好》（2026-10-17，note）；Build NEMU（2025.09–2026.02）；Keep Missing Semester。模块原始公开 count 为 Think 2、Build 1、Keep 1、Me 1，搜索五条，Compass 的 Me 按其他三模块平均显示 1.33；这是当前内容基线，不是永久数量断言。

| 模块 / 来源 | 必填内容与计数 | 可选能力与组织 |
| --- | --- | --- |
| Me `me/data.ts` → `publicProfile` | `published: true`、name、description、paragraphs；一份已公开资料计 1，空/null 计 0；搜索 `/me/` | `links: {label,url}[]`；姓名/动机/叙述/兴趣/链接，不建立第二份 Profile |
| Think `think/content/*.md` → `metadata.ts` / `content.server.ts` | frontmatter `slug/title/summary/date/published: true` + 正文；date 为真实有效 YYYY-MM-DD；每篇计 1 | `kind: article或note`，缺省 article；date 降序，同日 slug 稳定排序；搜索仅标题/摘要 |
| Build `build/data.ts` → `publicProjects` | `slug/title/summary/published: true/sections`；每项目计 1，数组顺序展示 | period、keywords、links、status、milestones、updates、issues；无数据不显示空控制 |
| Keep `keep/data.ts` → `publicBookmarks` | `slug/title/description/published: true/sourceUrl/note`；note 为段落数组，每收藏计 1，数组顺序展示 | category `{id,label}`、kind；只从真实集合生成平面分类，同 id 同 label，id 不能为 all |

Build 的 sections 为 `{title?, paragraphs?, items?, code?}[]`，每节必须有实际文字。status 为 `in-progress/completed/paused`；milestones 为 `{title,status: planned/in-progress/done,description?}[]`；updates 为 `{date,title,accomplishments?,challenges?,nextSteps?}[]`，至少一组实际内容；issues 为 `{title,description,status: open/resolved,resolution?}[]`。更新按日期降序，阶段手工顺序；仅依据真实阶段显示 x/y，不造百分比。NEMU 尚无过程日志/仓库链接，不补造。

Keep 公开分类为本模块 `?category=<id>`，刷新/返回恢复，非法值回全部；标题/查看说明进本站详情，打开来源是独立外链，新标签并带 `noopener noreferrer`。来源/公开 links 仅 http(s)，不自动抓取网页、缩略图或 favicon。

Think 新文章最小例子（仅格式说明，不生成生产样本）：

```markdown
---
slug: your-stable-slug
title: 作者确认的标题
summary: 作者提供的摘要
date: '2026-10-15'
published: true
---

真实正文。
```

维护步骤：只改所属模块 → 保留稳定 slug → 新增/编辑/取消公开/删除 → 重建并核对列表、详情、count、search 同步变化 → 公共检查与相关根/base 浏览器验证 → 依明确授权发布。不手改 dist。无公开条目时模块首页和 Spotlight 模块入口仍存在，数量为 0，不造详情。

`published: false` **不是保密机制**：仓库内容可见，Markdown 导入还可能输出引用资源；草稿和资源只放非敏感材料，不把私人媒体放 public。正文站内链接/图片须验证子路径，不假定根绝对资源适配 base。

<a id="design"></a>
## 4. 风格设计与交互约定

### 4.1 全站 Quiet Liquid Glass

目标是简洁、精致、有层次、有数学秩序；清楚得像只隔一层玻璃。对称属于环境与几何骨架，正文按阅读习惯对齐，真实 Radar 不必对称。

| 层次 | 设计方法 | 避免 |
| --- | --- | --- |
| 环境 | 连续暖中性浅色/蓝黑深色，少量静态环境光与纵深 | 大团色雾、点阵、满屏网格/粒子、明显水平接缝、强烈模块色墙 |
| 内容 | 稳定清楚的阅读表面，适当宽度与留白 | 所有段落套同款玻璃卡、正文后有可辨文字/线条 |
| 控制玻璃 | Compass、Spotlight、Unlock、搜索按钮、必要筛选；薄亮边/内侧暗边/接触阴影 | 横穿中部的反光条、巨大灰雾阴影、只靠过低不透明度 |

同一字体体系、图标笔画、主要光线方向、焦点与操作反馈；8px 节奏，大区块约 48–80px，小控制约 12px 圆角，面板约 20–24px。正常文字对比目标 ≥4.5:1、大字 ≥3:1，触摸目标 ≥44px。此处为设计尺度，验收以实际叠加背景和浏览器结果为准，不把候选值当成全部已测证明。

公开主题跟随系统。模糊不可用时采用足够实的表面；减少动态偏好下完整静态可用。公开 Compass 入场约 500–800ms，局部反馈约 150–250ms；不添加持续运动、追鼠标或卡片倾斜。Spotlight 必须稳定可读，透出光色而非背景内容，展开与收起连贯。

### 4.2 各模块具有不同内容秩序

| 页面 | 构图与内容顺序 | 交互 / 不做 |
| --- | --- | --- |
| Home | 精确 Compass 为主对象，轻量身份文字，中性连续环境；丰富度来自玻璃厚度/边缘/真实 Radar | 节点打开模块，hover 临时强调；返回/前进/BFCache 清理旧指针高亮，保留真实键盘 focus-visible |
| Me | 个人主页：姓名身份与静态个人几何对象平衡 → 动机 → 完整叙述 → 兴趣与真实链接 | 无头像时不造肖像/空框，不做熟练度雷达、简历表格或动态 Feed |
| Think | 温暖写意的思想空间；首屏少量光谱/光学形体 → 文章主入口与真实随记 → 安静窄列正文 | 文章进入详情；随记列表为正文前四行纯文字预览，标题/阅读全文进入现有详情；代码/公式优先可读，不做散乱拖拽、自动关联或梦幻动态壁纸 |
| Keep | 一眼能认出收藏夹：标题用途 → 薄玻璃分类 → 规则资源目录；卡片含域名、类别、短说明和独立动作 | 来源访问与本站说明分开；有多少展示多少，不靠复制填满、不造空分类，不把外链套进整卡链接 |
| Build | 严谨项目档案：较宽项目概览/成果与紧凑事实区 → 真实阶段/更新/问题 → 技术阅读区 | 局部锚点与原生 details；有记录才显示，文字状态不只靠颜色，不用终端/蓝图壁纸伪装严肃 |

Shell 保持中性内容槽，不将所有模块限制为一个 720px 模板，不增加四模块专属 if 分支。布局和局部背景分别留在模块内。只有一条内容也要控制合理宽度，不能拉伸填空。

### 4.3 隐藏模式：内室

气质是隐蔽、安宁、内省，边缘可以幽暗，阅读区始终有稳定的光；不做恐怖场景、黑客终端、霓虹或巨大 PRIVATE 横幅。**只有真正解密和模块校验成功后**启用 `data-vault-unlocked`；错误/取消不预览。固定内室色盘独立于系统主题，锁定立即恢复当前系统主题，不保存私人主题偏好。

| 角色 | 已批准色彩起点 / 表达 |
| --- | --- |
| 环境 / 阅读面 | 深墨 `#0D1219` / `#18212B`，宽过渡、弱中轴光，四周更深 |
| 文字 / 辅助 | 稍暖 `#E8E9E5` / `#B1BBC5`，不做难读灰字 |
| 私人标记 / 焦点 | 暖银 `#D8C6A4` / 浅蓝 `#B7D5E5`；文字标记不能仅用颜色 |
| 玻璃 | 烟色透明小控制，细银边；大搜索面板以约 94%–98% 基底的稳定感为目标 |

内室 Home 仍只有原入口，沿用微小状态与锁定操作；不恢复私人 Compass 入场动画、不展示私人内容预览。静态 CSS 光线/深度足够，不引入渲染库或远程背景。

模块首页真实 DOM 顺序为**必要身份/引导 → 私人区域 → 完整公开区域**，两区默认展开。公开内容正常字号/可读性，不降透明度、不折叠藏起来；详情仍专注当前条目，不把整个模块堆进一页。

- **Me**：紧凑身份 → “更内在的一面”私人叙述/链接 → 完整公开介绍、兴趣/链接；沉静暖灰，不造第二份档案。
- **Think**：少量琥珀/灰紫夜间光 → 私人文章/随记 → 公开文章/随记；两区各自按日期排序，详情安静清楚。
- **Keep**：私人收藏柜 → 公开收藏柜，独立“全部私人收藏/全部公开收藏”与实际类别；私人筛选仅内存，公开分类沿用 URL，互不误筛。
- **Build**：独立私人项目 → 完整公开项目。公开项目若有补充仅标“含私人记录”，详情为身份/概览 → 私人内部记录 → 完整公开档案；不复制项目或重复计数。
- 空私人区域可有简短说明，不造空卡片；仅私人/仅公开/全空都按实际数据呈现，Me 无公开资料时仍能挂载补充。
- `data-vault-slot` 指定模块阅读位置；无 slot 保留通用回退。`mount` 可返回清理回调，切页/重挂载/锁定都清除公开卡片上的私人装饰。
- Spotlight 保持相关性排序，标记真实命中来源，模块入口中性，无默认 Build 高亮。来源只在内存，不扩充公开四字段 JSON。

中心长按及 Unlock **无进度、缩放、位移或淡入淡出**，无悬停提示。公开 Spotlight 开关动画保留；私人导航不捕获画面快照，锁定即时清理，不等退出动画。

<a id="vault"></a>
## 5. 私人协议、安全与维护

### 5.1 数据链路与模块接口

```text
作者仓库外 vault.json → 模块 vault.server.ts 白名单校验
→ 本地加密 → public/vault/bundle.json → 静态托管
→ 浏览器认证解密 → vault.client.ts 再校验/呈现/投影 → 锁定清理
```

Private 是现有模块的访问状态，不是第五模块。四模块共用一次解锁、一份包与口令，不提供模块间权限隔离。

| 适配器 | 契约与边界 |
| --- | --- |
| `vault.schema.ts` | 模块自身纯校验与模型，可被本地/浏览器复用，不跨模块 import |
| `vault.server.ts` | 默认校验函数 `validate(payload: unknown): unknown`，只供本地打包；输出严格白名单序列化数据 |
| `vault.client.ts` | 默认 `create(value, context): VaultView`，自动发现且仅启用模块可用；模块自己校验/管理内容 |
| context | 本模块公开元数据/count、publicTargets、base 与受控 `asset(id)`；不传其他模块业务数据 |
| VaultView | `count(publicCount)`、`search()`、`hasTarget(id)`、`mount(container,id?)`、`dispose()`；mount 可返回销毁回调 |

私人 search 仍只返回四字段结果，count 不得小于公共 count。投影/目标由共享层验证；未知/禁用模块或无效数据失败关闭。具体字段/限额见各模块 `vault.schema.ts` 和共享 `validation.ts`，不能未经授权放宽。

| 模块 | 包内形状 | 计数 / 约束 |
| --- | --- | --- |
| Think | `{posts:[{id,title,summary,date,kind,body}]}` | 每篇私人文章/随记增加 1；kind 必填 article/note，日期降序 |
| Keep | `{bookmarks:[{id,title,description,sourceUrl,note,category?,kind?}]}` | 每收藏增加 1；note 段落数组，来源 http(s)，不自动预览 |
| Build | `{projects:[...],supplements:[{id,publicSlug,title,sections?,milestones?,updates?,issues?}]}` | 独立项目增加 1，补充不增加；publicSlug 必须指向本模块确实公开的项目 |
| Me | `{paragraphs:[string],links?:[{label,url}]}` | 资料补充，不增加第二份 Profile；Compass 平均用同伴当前可访问数量 |

私人 Build 独立项目使用 opaque id，沿用自身项目字段语义，必须有 title/summary/sections；不加入公开 slug/published。补充必须有实际正文或记录。所有模块拒绝重复/非法 id、日期/状态/链接错误、未知字段和超限输入。

私人条目/资产 id 为随机 16 字节的 32 位小写 hex，编辑保留 id。详情地址是已有模块路径加 `#vault=<id>`，先处理 base 再拼受控片段；不放私人标题、类别或查询。刷新/新标签先锁定，中性提示可调用同一 Unlock，成功后恢复目标；未知目标安全反馈。document.title/canonical/OG/history title 保持公开或中性。

Think 私人正文仅安全 Markdown 子集：段落、标题、列表、引用、代码、安全链接、`asset:<id>` 图片；不执行 HTML、MDX、JS，不获取远程私人图片。渲染使用安全 DOM/白名单，不把整包交给 innerHTML。

### 5.2 密文与口令合同

以 [crypto.ts](./src/core/vault/crypto.ts) 和 [passphrase.ts](./src/core/vault/passphrase.ts) 为实现对应点，不自创密码算法：

- envelope 严格只有 `version:1/iterations/salt/iv/ciphertext`，规范 Base64，ciphertext 包含认证 tag。
- Web Crypto **PBKDF2-HMAC-SHA-256，600000 次 → AES-256-GCM，128-bit tag**；v1 接受 600000–1000000 整数，限制恶意计算参数，不自动降级。
- 每次打包 CSPRNG 新生成 16 字节 salt 与 12 字节 IV；同密钥不得复用 IV。AAD 为 UTF-8 `JSON.stringify(["personal-space-vault",1,iterations,salt,iv])`，顺序固定；派生 key 不可导出、按操作给最小用途。
- payload 为 `{version:1,modules:{},assets:{}}`；最多 16 模块，明文最多 8MiB，envelope 输入上限 12MiB。资产最多 8 张、每张 512KiB，仅签名校验的 PNG/JPEG/WebP；不支持 SVG/PDF/视频/任意附件，不能转为公开文件凑支持。
- 口令新建/换口令至少 16 个 Unicode 码点，最多 1024 UTF-8 字节。允许 L/M/N/P/S/Zs 类别的正常字母、标记、数字、标点、符号和空格；拒绝控制、格式/零宽/双向控制、行段分隔符及孤立代理等不在集合内字符。
- 界面与核心在 KDF 前校验；**不 trim、不规范化、不删字符、不静默截断**。原始 paste 在 input 自动剥离换行前校验，拒绝时保留原值；移动输入关闭自动大写/纠错。错误不回显口令。

### 5.3 会话与交互

- `locked → unlocking → unlocked`；错误/取消/lock 回 locked。generation 防止迟到解密结果复活会话，取消待执行导航。
- 中心指针长按约 1500ms；短按无操作，松手/离开/取消/位移超阈值取消；键盘可聚焦 Enter/Space。Unlock 与 Spotlight 互斥，口令不回显，缺包/错误/加载/API 不支持有文字反馈。
- 解锁后通过最小 Astro ClientRouter 接入保留同一 window 的内存会话；公开状态用普通文档导航。脚本按 `astro:page-load` 初始化、换页销毁，监听器/计时器可取消，防重复绑定。
- 不用 localStorage/sessionStorage/IndexedDB/Cookie 持久化口令、key、私人内容/索引/主题。
- 主动锁定、前台 10 分钟无操作、页面进入后台、真正 pagehide、BFCache 恢复、刷新/新标签均锁定；**input blur/软键盘收起本身不锁定**。
- 锁定同步清除私人 DOM、模块装饰/投影、查询/选择、缓存引用、目标片段、Blob URL、旧计时/异步任务，再释放 payload/key 引用；不承诺 JS 物理内存擦除。普通站内换页只清当前 DOM，会话延续。
- 私人导航先取消模态完整子树动画、关闭并等两帧，再导航；原生 View Transition 创建后立即 skip，不捕获私人页面快照。只处理主动 skip 导致的预期 ready AbortError，其他异常继续报告，全程检查 pageerror，防 WebKit 合成层崩溃。不要为加动画撤销此边界。

### 5.4 保密能做到什么

目标是未解锁访客无法从公开产物读取真实私人明文，并能检测错误口令/篡改。PBKDF2 的原生支持与依赖规模是当前取舍，不声称优于 Argon2id，也不声称独立审计、形式化证明或安全认证。

公开源码、salt/IV、算法参数和密文可被任何人或 AI 抓取，**读懂源码不等于拿到未泄露的强口令**；攻击者可以下载密文离线猜测，前端限次不能阻止。建议密码管理器生成独立随机 24–32 字符口令；16 字符只是输入下限，不代表足够熵。

口令只作为密码学数据，没有拼入 HTML/JS/SQL/系统命令的执行路径；字符限制是输入完整性/资源边界，不是防注入保护。站点已遭 XSS/脚本替换、恶意扩展、已解锁设备均可读到内容，入口隐蔽不能隐藏功能存在或屏幕内容。

明文/口令一旦进入 Git 历史，删文件不能撤回；旧密文的历史/下载副本不因 rekey 失效。忘记口令无服务端找回。结构/canary 扫描不等于完整历史审计或独立安全审计，未实施的审计不得写成通过。

测试 fixtures 及此前的公开验收包/口令 `phase4-nonsensitive-acceptance` **本来就允许任何人解密**，仅供功能验收，不用于真实资料。线上验收包现已清除；无真实材料时最终版本允许 Vault 未配置，不设置默认生产密码。

参考保留为方案依据，不表示本次文档整理重新核验了最新标准：[Web Crypto AES-GCM](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams)、[OWASP 口令派生](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)、[认证加密](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)、[输入校验](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)、[Astro 生命周期](https://docs.astro.build/en/guides/view-transitions/)。

### 5.5 作者本地维护操作

完整字段、全量替换注意事项、CLI 参数与备份/换口令/恢复示例见 [维护手册第 5–6 节](./MAINTENANCE.md#private-data)；本节保留架构和原验收依据。

真实源放作者明确选择的**仓库外目录**，不进聊天、src、public、.cache、Git 或 CI；外置路径本身不是加密。命令使用真实交互 TTY，口令无回显，不接受口令参数/环境变量/管道；新包/rekey 两次输入新口令。

```powershell
npm.cmd run vault:pack -- --source D:\MyPrivateSpace\vault.json
npm.cmd run vault:verify
npm.cmd run vault:rekey
npm.cmd run vault:backup -- --output D:\MyVaultBackup\bundle.json
npm.cmd run vault:restore -- --input D:\MyVaultBackup\bundle.json
```

路径为示例，实际由作者选择。pack/rekey 默认写固定 `public/vault/bundle.json`；输出仅允许这个仓库内位置或明确外部位置，backup 必须在仓库外。路径校验拒绝目录逃逸、符号链接绕过和 Windows NTFS ADS。失败不损坏上一有效包；restore 先用备份对应口令解密/校验再原子替换，backup 只复制有效格式密文。

空源结构可只保留需要的模块键，不要求填满：

```json
{
  "version": 1,
  "modules": {
    "think": { "posts": [] },
    "keep": { "bookmarks": [] },
    "build": { "projects": [], "supplements": [] },
    "me": { "paragraphs": [], "links": [] }
  },
  "assets": {}
}
```

生成 id：`node -e "console.log(crypto.randomBytes(16).toString('hex'))"`。私人图片正文用 `![描述](asset:<id>)`，assets 同 id 为 `{type,data}`，data 是原图字节规范 Base64；说明和图像一起加密，不把私人图片放 public。

维护闭环：先备份密文到外部 → 外部源增改删 → pack → verify → 审查 Git 差异只有获准密文及相关改动 → 公共/浏览器/边界检查 → 明确授权后发布。rekey 后旧口令不能解新包，但旧备份仍需当时口令。明文和口令由作者另行备份，不自动上传或生成明文副本。恢复密文和回退整个网站是两种操作。

<a id="roadmap"></a>
## 6. Phase Roadmap

| Phase | 目标 / 范围 | 状态 | 依赖 / 停点 |
| --- | --- | --- | --- |
| Phase 1 | 架构、契约、首页、Compass、Spotlight、可扩展基础 | Done | 无；1.8 后停止 |
| Phase 2 | 四模块最小实用内容与各自布局，统一玻璃修订 | Done | Phase 1；不捆绑后续内容增长 |
| Phase 3 | 基础移动可用性、元信息、可重复静态发布与手机验收 | Done | Phase 2 + D1–D8；公开站已验收 |
| Phase 4 | 加密/本地维护/内存解锁/模块私人适配/搜索/锁定/内室 | Done | 手机通过，4.8 无样本最终验证/发布完成，停止 |
| Phase 5 | Keep 局部查找/排序、Think 阅读辅助等可选增强 | Deferred，用户确认非必要 | 不属于当前可用版本的完成前提；未来明确重新启用才执行 |
| Phase 6 | 合并旅行/摄影模块、首次正式录入和后续内容维护 | Pending，延后 | 对应功能已验收 + 用户指定 + 所需素材 |

历史“Photography/Travel 分开”和“Private Phase 5”草案已撤回；不按旧编号执行。完成阶段不授权下一阶段。下文已完成项是保留的范围/验收合同，不要求重新开发；历史证据见第 9 节及整理前 Git 版本。

### 6.1 Phase 1 — 已完成的架构基础

每项都限定自身 Scope，后续项不能提前实现。公共实现门槛统一见[第 7 节](#verification)，表中 Verification 为额外专项；1.1 建测试前无可运行测试的历史情况应记不适用。

| Milestone / 状态 | 目标、任务与技术方案 / 涉及文件 | Done Criteria | Verification / 前置依赖 |
| --- | --- | --- | --- |
| **1.1 Done** 工程基线 | Astro static、TS strict、lint/typecheck/build/preview；根配置、package/lock、最小 pages/Base；不提前做 Registry 或搜索 | 可运行与构建，边界/目录明确，无额外框架或后端 | 公共命令（当时 test 不适用）、最小页生产预览；无依赖 |
| **1.2 Done** 模块契约 | Module 类型、glob Registry、校验/排序；`core/module/` 与模块 module.ts | 自动发现、启用开关、唯一字段与非法输入硬失败 | Registry 独立单元/构建；依赖 1.1 |
| **1.3 Done** 页面桥与 Shell | pages 描述、通用路由、最小可访问演示；`core/module/pages*`、`pages/[...path].astro`、Shell/模块模板 | Home→模块→内容成立，无模块跨 import，无独立模板体系 | 路由冲突/遍历负例、Home/详情/返回 smoke；依赖 1.2 |
| **1.4 Done** 公开投影 | 构建期 count/search、四字段 JSON；`core/search/`、静态端点/模块投影 | count 真实，搜索只指向已生成公开目标，浏览器无构建依赖 | 独立预期数量/字段/目标与失败负例，产物检查；依赖 1.2、1.3 |
| **1.5 Done** Home/Compass | SVG 等角 N 边形、log Radar、节点/标签/真实读数；`shell/home/Compass.astro`、geometry、首页 | 动态 N、零值可用、真实数据与键盘/指针入口，无 Feed | 几何边界/零集合、点击/焦点/返回 smoke；依赖 1.2–1.4 |
| **1.6 Done** Spotlight | 原生 dialog、模块入口、加载/匹配/重试、键盘/IME/还焦；Spotlight 模板与脚本/search | 打开、查询、无结果/失败、选择/跳转/关闭均可用，不做命令系统 | 浏览器快捷键/Tab/IME/方向键/Enter/Esc/遮罩/重试；依赖 1.3–1.5 |
| **1.7 Done** 材质与动画 | 共享主题/玻璃/少量入场与开关；theme/glass/Home/Spotlight | 明暗、清晰度、动画衔接、静态与模糊降级可用 | 桌面/窄屏并排截图、减少动态/无模糊与真实操作；依赖 1.5、1.6 |
| **1.8 Done** 扩展验收 | 隔离第五模块、根/base 全链路；tests 与计划记录 | 新模块不改共享层即可有入口/路由/count/search，全部门槛通过 | 公共 + 隔离 extension、根/base 浏览器及生产 smoke；依赖 1.1–1.7 |

Phase 1 当时不含复杂模块功能、Private、完整移动端、部署或数据系统；后续阶段的已批准实现不反向扩大 Phase 1 范围。

### 6.2 Phase 2 — 已完成的公开模块

技术方案为模块自有 Markdown/TS 数据模型与静态页面，不统一所有内容类型。公共门槛 + 表内专项是每项验收要求。

| Milestone / 状态 | 任务、方案与文件 | Done Criteria | Verification / 依赖 |
| --- | --- | --- | --- |
| **2.1 Done** 素材/契约 | 确认四份公开材料、字段/计数/排序/URL，现已并入第 3 节 | 输入与维护边界明确，不编造素材 | 文档/路径/字段核对，纯文档不运行工程；依赖 Phase 1 |
| **2.2 Done** Me | profile 校验、真实介绍/页面/count/search；`modules/me/` | 一份真实资料完整可读，空态正确，无假信息 | 公共 + 公开/空资料、页面/搜索/根/base；依赖 2.1 |
| **2.3 Done** Think | 元数据、模块内 Markdown 加载、列表/详情；`modules/think/` | 真文完整，日期/slug/发布过滤/计数一致，编译不进浏览器 | 公共 + 非法元数据、未发布/资源边界、文章链接/代码/根/base；依赖 2.1 |
| **2.4 Done** Build | 真实 NEMU 数据、项目列表/详情；`modules/build/` | 项目可读可搜，计数按项目，未提供字段不造 | 公共 + 字段/链接负例、项目详情/返回/搜索；依赖 2.1 |
| **2.5 Done** Keep | 真实收藏、说明/外部来源；`modules/keep/` | 本站说明与来源目标明确，各计一项 | 公共 + URL 校验、收藏/外链/搜索/返回；依赖 2.1 |
| **2.6 Done** 内容联动 | 新增/隐藏/删除/全零隔离检查；tests/content 与各模块适配 | 演示移除、列表/详情/count/search 同步，无源文件污染 | 公共 + 根/base、verify-content、extension 和资源/空态 smoke；依赖 2.2–2.5 |
| **2.7 Done** 内页背景修订 | 首次背景反馈修复；模块 background.css/必要共享环境 | 四内页可读，入口/搜索不退化 | 公共 + 明暗/窄屏截图/交互；依赖 2.2–2.6；最终风格以 D1–D8 与第 4 节为准 |

### 6.3 D1–D8 — 已完成的公开设计反馈单元

这组用户追加任务属于已完成的视觉/交互迭代，不是一个待启动 Phase。实现要求公共门槛，各单元额外专项如下；按 D1→D7 验收，D8 依赖 D7。

| 单元 / 状态 | 范围与文件 | Done Criteria | Verification |
| --- | --- | --- | --- |
| **D1 Done** 返回状态 | Compass/生命周期，拆开 pointer hover 与 keyboard focus | 进入/返回不残留高亮，键盘焦点仍清楚 | 点击/触摸/前进后退/BFCache 与键盘 |
| **D2 Done** 材质/Home | theme/glass/Compass/Spotlight，连续中性环境 | 无中央丑反光，玻璃有边界，搜索清晰 | 明暗/模糊降级/减少动态/截图 |
| **D3 Done** Me | Me 自有 Profile/背景 | 识别为个人主页，完整原文，无假头像 | 身份/叙述/链接、桌面/窄屏 |
| **D4 Done** Keep | 模型/分类/Index/Bookmark | 真实分类、目录与两类动作清楚，URL 返回正确 | 多项隔离样本、筛选/回退/外链/键盘 |
| **D5 Done** Think | 类型/Index/Article/背景 | 温暖写意且正文稳定，随记可用 | article/note、排序/代码/链接、截图 |
| **D6 Done** Build | 项目模型/页面/背景 | 真阶段/更新/问题可表达，无假百分比/空 Tab | 有/无记录、状态/展开/链接/窄屏 |
| **D7 Done** 整体回归 | 相关 tests，必要范围内修复 | 共享材质一致、布局独立、真实集合/扩展不退化 | 根/base、第五模块、content/design 探针与截图 |
| **D8 Done** 收起/平均 | Spotlight 关闭流程、module 元数据、Compass 通用统计 | 关闭有衔接/可重开；Me 为同伴平均，实际 profile count 不变 | Esc/遮罩/快速重开/还焦/减少动态，含零/无同伴/小数与扩展 |

### 6.4 Phase 3 — 已完成的移动与公开发布

目标是手机能看、能用，不扩大复杂设备兼容或新增专属导航。每项公共门槛 + 专项；真机按用户决定集中在上线后的 3.8。

| Milestone / 状态 | 任务、技术方案与文件 | Done Criteria | Verification / 依赖 |
| --- | --- | --- | --- |
| **3.1 Done** 发布基线 | 支持矩阵、构建/线上验收清单，现归第 7–8 节 | 缺口、设备与可发布标准明确 | 文档与当时工程基线核对；依赖 Phase 2/D1–D8 |
| **3.2 Done** 移动 Compass | CSS/SVG 命中与标签，Home/geometry/tests | 保留 Compass，最小 44px，标签不重叠 | 320 起/短横屏/4–7 模块两引擎碰撞/真实点击；依赖 3.1 |
| **3.3 Done** 移动搜索 | dialog、visualViewport、输入/滚动 | 软键盘空间中输入/关闭/结果可达，锁滚动/还焦正常 | 移动模拟/键盘/开关/旋转；真机转 3.8；依赖 3.2 |
| **3.4 Done** 移动阅读 | 四模块页面/局部控制/媒体样式 | 字体放大可读，代码局部滚动、长域名不撑页，操作可点 | 四模块/详情/分类/外链/横竖屏；依赖 3.2、3.3 |
| **3.5 Done** 页面元信息 | Base、ModulePage head、favicon、404 | 中文语言/真实标题摘要、site/base canonical、404 入口正确 | 根/base head/资源/真实 404 搜索及返回；依赖 3.4 |
| **3.6 Done** 管线 | 锁定环境、Actions 只上传受验 dist、manifest | 干净安装复现，push 只检查，manual main 才部署 | 本地/干净候选、工作流边界/哈希、根/base；依赖 3.5 |
| **3.7 Done** 首发 | 保留 v0/旧 demo/远程历史，main Pages 发布 | 真实 Actions 成功、受验产物与线上一致，覆盖旧 demo | 实际发布源/run/artifact/8 公开路由/404/资产/搜索；依赖 3.6 |
| **3.8 Done** 更新/手机 | Me 真实 GitHub 链接、再次发布、修复手机闪块/标签、隔离回退 | 用户确认 OPPO 基础操作正常，两问题解决；更新/回退可复现 | 真机反馈、二次更新与最终 9e7d878 线上、隔离恢复；依赖 3.7 |

3.8 的 OPPO 反馈只证明当时公开版；不能代替 Phase 4 新界面的手机验收。系统/浏览器版本未提供，iOS 真机未测。

### 6.5 Phase 4 — 私人功能闭环

范围是第 5 节协议、四模块私人能力和第 4 节内室设计。无需真实私人素材。非目标：账号后台、云同步/远程撤权、多人分享、复杂媒体、未来模块、批量补内容。实施逐项独立验证，依赖不等于授权。

| Milestone / 状态 | 任务、方案与文件 | Done Criteria | Verification / 依赖 |
| --- | --- | --- | --- |
| **4.1 Done** 协议/接口 | 冻结加密、威胁边界、适配/会话/地址合同，现并入第 5 节 | 公开/浏览器/CLI 分工与失败关闭、锁定策略明确 | 文档与既有源码/测试/标准 API 核对；纯设计不借机实现；依赖 Phase 1–3 |
| **4.2 Done** 本地维护 | crypto/validation、模块 server、scripts/vault | pack/verify/rekey/backup/restore 可用，外置明文、失败保护/无回显 | 公共 + 向量/Node-browser 互通、篡改/KDF/尺寸/路径/schema、真实交互恢复；依赖 4.1 |
| **4.3 Done** 内存会话 | session、lifecycle、runtime/适配发现 | 同 window 私人导航可续，刷新/后台锁定、无持久化或迟到复活 | 公共 + 根/base/两引擎跨页/BFCache/取消竞态/存储网络检查；依赖 4.2 |
| **4.4 Done** 入口/锁定 | Compass 中心、Unlock/Lock 脚本/模板 | 静默长按/键盘、取消/错误/缺包、主动/自动锁定正确 | 公共 + 手势取消/IME/输入/互斥/焦点/后台/闲置；依赖 4.3；入口动画按 V1–V5 后续批准结果 |
| **4.5 Done** Think 链路 | Think vault schema/server/client/markdown/style | 私人文章/随记可读可搜可计数，无 HTML/脚本执行/媒体泄漏 | 公共 + 实际密文、Markdown/asset/目标与注入负例/根/base/锁定；依赖 4.4 |
| **4.6 Done** 三模块适配 | Keep/Build/Me 各自 vault 文件 | 分类收藏、独立项目/公开补充、资料补充可用，真实计数 | 公共 + 三模块合法/非法/空数据、父项目/链接、独立计数/搜索/清理；依赖 4.5 |
| **4.7 Done** 搜索/统计清理 | vault-projection、Spotlight、Compass、DOM 生命周期 | 公开 JSON 不变，内存组合/同 URL 命中正确，锁定全部清理，无默认 Build | 公共 + 根/base/两引擎真实第五适配会话、4–7 几何、IME/迟到请求/导航异常；依赖 4.6 |
| **4.8 Done** 阶段验收 | 安全/维护/恢复/线上/手机与阶段内修复，详见下节 | 手机通过；样本清理、完整检查与最终发布证据齐全 | 第 7–8 节完整检查/线上通过；依赖 4.1–4.7 全 Done |

#### 4.8 最终收尾（Done）

**目标 / Scope**：验证已有私人功能、安全/维护与手机可用性；不改架构，不以内容缺失阻塞验收。涉及 tests、现有发布接点、必要阶段内修复、密文样本以及三份文档。每次具体执行仍遵守当次授权。

已获准并完成的反馈子项：

| 单元 / 状态 | 技术任务 / 文件 | Done Criteria | Verification |
| --- | --- | --- | --- |
| **V1 Done** 内室环境 | theme/glass、Vault 标记/生命周期；成功解密后固定深墨主题，锁定恢复系统 | 无预览/主题残留/私人快照，公开主题不退化 | 公共 + 明暗/错误/取消/跨页/锁定/截图 |
| **V2 Done** 模块组织 | 四模块模板/vault client/style 与 slot/cleanup | 私人在前且真实 DOM 顺序，公开完整，两区空态正常，补充不重复项目 | 公共 + 各模块/混合/仅私人/仅公开/全空、根/base 与清理 |
| **V3 Done** 搜索层级 | 会话投影身份 Set、Spotlight/详情标记 | 来源按实际命中，同 URL 混合准确，排序不变，公开四字段不变 | 公共 + 公开/私人/混合/空快捷入口、锁定与独立预期 |
| **V4 Done** 整体回归 | tests 与必要修复 | 内室一致、公开独立布局保留、空集合/手机/模糊降级可用，0 pageerror | 公共 + 根/base、WebKit、第五真实会话、扩展/设计/内容/移动/发布边界 |
| **V5 Done** 输入/触摸 | passphrase/crypto、Unlock、theme；原样口令校验、原始粘贴与继承 tap highlight | 符号兼容；不可见/超长在 KDF 前拒绝；支持引擎中高亮透明，键盘焦点保留 | 公共 + 原始字符/粘贴负例、实际旧包解锁、根/base、WebKit 能力探针/触摸与焦点；线上已发布，用户确认手机检查无问题 |

**最终收尾任务（本次明确授权，已完成）**：

1. 用户已明确确认手机等检查无问题；记录实际反馈，不推测系统/浏览器版本。
2. 已移除临时非敏感 `public/vault/bundle.json`，最终未配置真实 Vault；未填真实资料或生成默认密码包。
3. 实际无样本候选的公共/完整专项、产物/候选 Git/CI 边界和生产预览通过；隔离 fixture 验证私人能力，生产缺包状态正确。
4. 已核对发布源、同一受验产物及线上公共路径/缺包行为，4.8/Phase 4 标 Done，保存记录后停止。

**Done Criteria**：

- [x] 4.1–4.7 功能与公共/专项验证完成；真实加解密、四模块、搜索/统计、锁定与刷新有效。
- [x] 公开产物/候选 Git/CI 与浏览器持久化/URL 边界已验证；非敏感维护增改删、换口令、恢复/失败保护可复现；不把扫描当安全证明。
- [x] V1–V5 已实现、验证、部署，最近线上检查通过。
- [x] 用户明确确认手机等已检查无问题；按此前 OPPO Find X7 Ultra 默认浏览器验收上下文记录，未提供系统/浏览器版本，iOS 真机未测。
- [x] 临时样本清理，最终无样本候选检查与发布/线上验证齐全，最终源/run/artifact 见 9.5。
- [x] 功能不依赖真实材料，最终无测试记录冒充作者内容，状态汇总一致，用户已确认验收，停止等待下一明确指令。

**Verification**：第 7 节完整本地/隔离/浏览器/安全检查、第 8 节真实 Actions/产物/线上均已通过，OPPO 用户反馈通过，具体结果见 9.5。**后续依赖**：Phase 4 Done 后停止，Phase 5/6 仍需另行明确选择和授权。

<a id="phase-5-plan"></a>
### 6.6 Phase 5 — 可选功能储备（Deferred，用户明确延后）

**当前决定（2026-10-15）**：用户审阅后认为这些功能目前非必要，明确留待以后。Phase 5 全部延后，不再等待本轮方案批准或启动；当前网站已经可正常使用，不需要完成本阶段才算可用。以下实现方案保留为未来储备，不是必做需求或实施/上线授权，Phase 1–4 的 Done 状态不变。

旧 5.1–5.4 是未实施的候选清单，本次按实际源码重新拆分并替换编号：旧 Keep 候选拆为新 5.1/5.2，旧 Think 阅读辅助拆为新 5.3/5.4；旧 RSS 候选延后，不按旧编号执行。复盘结果已写在本节，不另设“写计划即可完成”的实施 milestone。

#### 现有能力与候选评估

当前功能闭环可用，没有需要靠扩张架构解决的必修缺陷。四模块各一份公开内容，真实 Vault 未配置；功能验收可用隔离非敏感样本，不需要先填满网站。

| 候选 | 源码依据与当前缺口 | 价值 / 代价判断 | 本轮建议 |
| --- | --- | --- | --- |
| Keep 局部查找与排序 | `keep/Index.astro` 只有公开分类/URL 状态，`vault.client.ts` 只有私人分类；Spotlight 搜标题/摘要，不能在 Keep 中按来源域名查找或组合分类/排序 | 收藏增长后用途明确，能复用现有数据与卡片；无需远程服务或新字段。当前只有一项，排序控件应按数据量显隐 | **推荐优先**，拆 5.1/5.2，公开/私人分别验证 |
| Think 代码块复制 | `Article.astro` 的 Markdown 和 `vault.client.ts` 的安全渲染均可输出 pre/code，尚无复制按钮 | 技术文章的实际常用操作，改动局部；当前真实文章仅行内代码，不能为了展示按钮改作者正文，可用隔离代码样本验证 | **推荐其次**，5.3；无代码块时不显示控件 |
| Think 页内目录 | 公开正文没有目录；私人解析器将正文标题映射为 h2–h4。当前真实文章没有分节标题 | 结构化长文时有价值，但当前立即收益较低；私人详情 hash 冲突与焦点清理需要单独处理 | **保留可选、默认延后**，5.4 仅在用户选中时执行 |
| 公开 Think RSS | 现无 feed 端点；评估时只有一篇公开文章，尚无稳定更新/订阅需求 | 能做成静态摘要，但不改善当前站内操作；应在确有公开订阅需求时投入 | 本轮不纳入，不预建端点或安装 feed 库 |
| 公式排版增强 | 当前 Attention 公式已用局部 HTML 清楚展示；私人安全 Markdown 不解释公式 | 未来数学内容可能需要，但会引入语法、字体资源和私人渲染安全边界；现有一例不构成必做需求 | 延后，待实际公式写作需求再规划，不升级渲染器 |
| Build 进度/问题管理 | 已有真实 status、milestones、updates、issues 与详情局部导航、展开记录；缺的是作者记录 | 重做看板/时间线会重复已有能力并扩大架构 | 不新增；后续按现有格式录入 |
| Me 扩充、旅行/摄影、更多收藏/文章 | Me 已有公开/私人补充；旅行/摄影已约定合并；当前内容数量少 | 内容充实不等于缺功能，不应拿虚构素材填 UI | 保持 Phase 6 延后，未改其范围 |
| 编辑后台/云同步/自动抓取/全文搜索 | 不是现有静态维护与轻量搜索的缺口修复 | 引入账号、服务、来源处理或额外数据系统，成本与边界变化大 | 排除；本轮不做评论/点赞/AI 助手/统计 Dashboard/地图 |

**未来重新启用时的参考集合**：Keep 查找/排序 + Think 代码复制，以及相应回归和正式发布单元，即 5.1 → 5.2 → 5.3 → 5.5 → 5.6。目录 5.4 原为可选，全部当前均不执行。未来由用户重新选择范围，再同步必需项/依赖与 5.5 标准；实施者不能按参考顺序自动开始，未做项不标 Done。RSS 不分配本轮实施 milestone，不宣称已经实现。

#### 本阶段共同实现约定与默认假设

- **架构**：继续只改所属模块及必要 tests/PLAN/README。不改 Module/SearchResult/VaultView 契约，不给 Core、Home、Compass、Spotlight 增加模块专属分支，不引入依赖/后台/统一内容模型。
- **样式**：复用 Quiet Liquid Glass 的薄控制、正文色、间距、focus-visible 与至少 44px 命中；Think 温暖阅读、Keep 规则目录及内室私人优先/公开完整保持。无新页面改版、固定 Sidebar、悬浮工具栏或额外入场动画。
- **Keep 查询**：只在各自集合的 title、description、`new URL(sourceUrl).hostname` 上做 trim 后不区分大小写的连续子串匹配，字段间任一命中即可；不搜长 note、URL 参数/路径，不分词/模糊/语义检索，不调用网络。仅非空集合显示查找框。
- **Keep 排序**：默认保持作者数组顺序；另提供“名称”“域名”升序，使用 Intl.Collator 的 zh-CN、numeric=true、sensitivity=base，比较相同时按原集合序号稳定排列。只在至少两项时显示排序控制，不加日期字段或假“最近收藏”。仍按现有类别分组，类别顺序不变，排序作用于类别内；状态文字明确“分类内排序”。
- **Keep 状态**：公开 category 继续使用既有 URL；**新增查询和排序全部只在当前列表内存中**，公开/私人都不写 URL、存储、日志或 history.state。离开列表/刷新/历史恢复时清空新增查询并恢复作者顺序，公开 category 按 URL 恢复；不承诺跨详情保留新增筛选，不为此改变导航架构。锁定/解锁也重置新增临时状态。此取舍优先简单和避免自由输入泄漏，可在审阅时调整，但实施者不能自行加持久化。
- **Keep 分区**：公开集合和私人集合各自一套明确标注的查找/分类/排序，作用互不穿透；分类按钮保留各类别总数，结果状态显示当前可见数/本区总数。无匹配时说明原因并提供清空本区查询；不把“无结果”当原集合为空。count/search/Me 平均不随局部筛选改变。
- **Think 作用域**：仅独立文章/随记详情的正文，不给 Think 首页每张条目装工具；只消费已经安全渲染的 DOM，不扩大 Markdown/HTML/MDX 执行范围。公开文章处于内室时仍是公开文章，不能按深色主题猜可见性。
- **Think 生命周期**：模块内小函数返回清理回调；公开页通过既有 onPage 初始化/销毁，私人详情由 vault.client.ts 的 mount 返回清理函数，复用现有 VaultView 能力。清除监听器/计时/观察器/异步完成反馈，禁止重复挂载和锁定后复活控制。
- **内容与验证**：保留当前四份作者材料，真实文章没有标题/代码块不补造；用隔离多条收藏、标题/代码、私人 canary 验证，生产继续无测试密文包。新文件均为候选位置，不在规划阶段创建占位文件。

#### Milestone 状态、依赖与执行顺序

| Milestone | 建议范围 | 状态 | 前置 / 停点 |
| --- | --- | --- | --- |
| **5.1** | Keep 公开局部查找与稳定排序 | Deferred，用户延后 | 未来重新启用并明确指定后开始 |
| **5.2** | Keep 私人分区查找与锁定清理 | Deferred，用户延后 | 未来重新启用且 5.1 Done |
| **5.3** | Think 正文代码块复制 | Deferred，用户延后 | 未来重新启用；技术依赖为 Phase 4 |
| **5.4** | Think 条件式页内目录 | Deferred，用户延后 | 未来明确选中 + 5.3 Done |
| **5.5** | 跨功能回归与发布候选验收 | Deferred，用户延后 | 未来实际选定的实现项全部 Done |
| **5.6** | 正式发布与阶段结束 | Deferred，用户延后 | 未来 5.5 Done + 明确发布授权 |

Deferred 表示用户决定延后，不是已实现、失败或当前待办。未来明确重新启用时才调整为 Pending，并按当次指定范围执行、逐项验证；依赖和以下储备方案都不构成授权。当前没有 In Progress 单元，也不将未实施项标 Done。

#### Milestone 5.1 — Keep 公开局部查找与稳定排序

- **目标 / Scope**：在现有公开收藏区增加轻量查找、分类组合、稳定排序与清空/无结果反馈；不读取或修改私人条目。
- **Tasks / Technical Approach**：先给公开内容明确的模块内 DOM 根，保留其之前的 data-vault-slot。公开控制器只查询该根，不扫描整个 keep-directory 下的私人卡片。用模块内纯函数完成共同约定的过滤/稳定排序；按原分类组织更新可见卡片/组和结果状态，既有 category pushState/popstate/pageshow/详情返回继续有效；新状态按约定在离页/历史恢复重置，监听器在 onPage cleanup 中解除。
- **Files**：`src/modules/keep/Index.astro`、`background.css`；候选模块内 `query.ts`（只放实际用到的查询/排序纯函数）；`tests/unit/keep.test.ts`、`tests/e2e/design-probe.spec.ts` 或必要 Keep 专项、隔离 fixtures；PLAN/README。无理由不改 Bookmark 模型/data/详情页。
- **Non-goals**：不增加标签/日期模型、分页、抓取、全局 Spotlight 过滤、查询 URL/存储，不预做 5.2 的私人 UI，不修改作者收藏/公开排序原数据。
- **Done Criteria**：
  - [ ] 名称/说明/域名匹配、中文/英文大小写、前后空白和无匹配符合固定规则；清空后恢复本区当前分类。
  - [ ] 三种排序结果有独立预期、相同值保持作者顺序，分类内顺序与说明一致；0/1/多条的控件与空态真实。
  - [ ] URL category、刷新/前进后退/详情返回仍正确；查询/排序按约定重置，不增加 URL 参数/history.state/存储或网络。
  - [ ] 外链/本站详情的独立动作、公开 count/search/Compass/Me 平均不变；解锁时私人列表/类别不被公开控制器选中或筛除。
- **Verification**：公共门槛 lint/typecheck/test/build；查询/排序/组合规则的独立单元预期；隔离多类别/同名/同域/中文/零条/一条样本的真实根/base 浏览器；分类回退、输入 IME/清空、键盘/320px/短屏、外链、实际请求与存储/URL检查；解锁混合页面回归现有私人分类。不得将生成结果与自身相比当验收。
- **依赖 / 后续**：Phase 4 已完成、用户批准并指定；通过后记录命令/证据并停止，或仅按明确批量授权进入 5.2。

#### Milestone 5.2 — Keep 私人查找与清理

- **目标 / Scope**：为现有私人收藏区提供同等的局部查找/排序，保持两区独立、私人在前与公开完整。
- **Tasks / Technical Approach**：私人适配器只将自己的已校验模型映射到同一 Keep 查询/排序纯函数；不强行使用公开 slug/published，也不合并成全站内容。私有类别继续使用既有 opaque id，控制文字明确“搜索私人收藏/全部私人收藏/本区结果”；输入 autocomplete=off、spellcheck=false，无向 URL 提交的表单。mount 建立局部控制器并返回 cleanup，dispose 清理数据；锁定、重新解锁、切页和重挂载清除新增输入/排序与延迟回调，公开区也按约定重置临时输入。沿用现有 vault:change/销毁接点，不扩 Vault 状态接口。
- **Files**：`src/modules/keep/vault.client.ts`、`vault.css`、5.1 的模块内查询函数及必要公开 cleanup；现有 `vault-modules.spec.ts`、`inner-room.spec.ts`/必要 Keep 专项和非敏感 fixtures；PLAN/README。不改 schema/加密包格式、Core 或正式生产载荷。
- **Non-goals**：无跨公开/私人合并类别、统一搜索框、私人条件 URL/存储、抓取来源、私人页面快照或新测试密文上线。
- **Done Criteria**：
  - [ ] 私人/公开即使同标题、同类别名称，也按各自集合过滤/排序；改变一区不隐藏另一区，实际 DOM 顺序不变。
  - [ ] 私人查询和来源不进入 URL、history.state、持久化、日志、额外请求或公共索引；筛选不改变真实 count/Me 平均。
  - [ ] 锁定同步清除私人控件/查询/结果/引用，公开区可用；错误口令/取消/未配置时没有私人工具；重开/返回无残留或重复监听。
  - [ ] 私人 0/1/多条、公开全空但有私人条目、全空以及查询无结果均正常；私有类别在详情往返后的行为仍符合原会话约定。
- **Verification**：公共门槛；使用真实加解密的隔离混合 fixture，在 Chromium/WebKit、根/base 验证两区独立、准确排序/计数与 DOM 顺序；私人 canary 的 DOM/URL/storage/history/网络/日志负例；主动锁定/后台/刷新/新标签/BFCache/取消与延迟任务回归，流程结束检查全部 pageerror 为 0。
- **依赖 / 后续**：5.1 Done；完成后停止，5.3 不因依赖表自动获准。

#### Milestone 5.3 — Think 代码块复制

- **目标 / Scope**：公开与已解锁私人详情的非空 pre/code 各有一个“复制代码”动作和简短成功/失败反馈；无代码块不放空工具。
- **Tasks / Technical Approach**：模块内 `reading-controls.ts` 候选小函数从 code.textContent 取得实际文本，复制时排除按钮/行号等 UI，保留空格、Unicode、换行和末尾换行，不用 innerText 或 HTML 源码。仅在显式点击/键盘激活时调用原生 Clipboard API；不支持、被拒绝或写失败均明确反馈并允许正常手工选择，不自动降权或用隐藏输入/后台复制兜底。公开通过 onPage、私人通过 mount cleanup 接入同一模块函数；已有请求无法撤销，但失效后的 Promise 不得重建反馈或引用旧私人 DOM。
- **Files**：`src/modules/think/Article.astro`、`vault.client.ts`；候选模块内 `reading-controls.ts` 与 `reading-controls.css`（只做实际复制能力，不预建目录/全站工具框架）；Think/Vault 浏览器用例及隔离代码样本，必要纯规则测试；PLAN/README。
- **Non-goals**：不加 Build/其他模块复制、不复制行内 code、不更换高亮或 Markdown 解析器、不读剪贴板/持久化代码/统计点击、不改变作者文章或加入复杂权限设置 UI。
- **Done Criteria**：
  - [ ] 普通/语法高亮/中文/长行/多行/末尾换行代码复制准确，每块仅一个控件；行内代码/空块无冗余按钮，当前真实文章不产生假工具。
  - [ ] 鼠标/触摸/Enter/Space 正常，失败与成功反馈清楚，不靠颜色；焦点、横向代码滚动、44px 命中和既有阅读宽度保留。
  - [ ] 私人复制是用户主动导出：锁定前未发起的写入不得继续，锁定清除 DOM/回调反馈；已经发起或完成的系统剪贴板写入不能保证撤回，不尝试清空用户剪贴板。
  - [ ] 公开/私人导航与重挂载无重复按钮/监听/计时器，代码不因工具执行、泄入 URL/请求/存储或构建产物；公开搜索/统计不变。
- **Verification**：公共门槛；根/base 的公开和真实解密私人详情，校验传入复制文本与实际写入结果、拒绝/不可用路径；Chromium/WebKit 按真实能力记录结果，不能只用 mock 冒充成功。使用隔离浏览器/非敏感测试剪贴板，不读取用户原有剪贴板或私密内容；环境无法完成真实验证则记录限制，不静默算通过。覆盖键盘/窄屏/减少动态/无模糊、路由往返、锁定前后及延迟 Promise，最终 pageerror 为 0。
- **依赖 / 后续**：技术依赖 Phase 4 Done，建议在 5.2 后执行；完成后进入下一项仍需授权。选择目录时做 5.4，否则进入获准的 5.5。

#### Milestone 5.4 — Think 条件式页内目录（Deferred，可选）

- **目标 / Scope**：仅当用户选中本项时，为详情中至少 3 个有效正文 h2–h4 提供顶部可折叠目录；当前无分节标题文章不出现空目录。
- **Tasks / Technical Approach**：在 Think 模块内从实际安全 DOM 收集标题，不解析另一份 Markdown 或扩私有语法。保留公开已有 id，缺失/重复时生成不冲突的局部 id，目录文字用 textContent。公开条目可使用正常片段锚点，支持刷新定位/返回；**私人详情已有 `#vault=<id>`，目录必须使用按钮与局部滚动/聚焦，保持该片段完全不变**，不得把私人标题或章节写入 URL/history。只处理当前可见正文，折叠默认关闭，无固定侧栏；退出/锁定取消尚未执行的滚动与焦点任务。
- **Files**：5.3 的 Think 详情/私人 mount 与模块内 reading-controls 文件；必要标题规则与浏览器测试/隔离样本；PLAN/README。不修改 `core/vault/targets.ts`、withBase、Shell 路由或作者正文来绕过片段冲突。
- **Non-goals**：无自动文章分节、阅读进度、滚动监听高亮、目录收藏/持久化、首页随记批量工具或全站 Sidebar。
- **Done Criteria**：
  - [ ] 0/1/2 标题不显示，3 个及以上按真实层次/顺序显示；同名/中文/特殊字符/已有 id 的目标唯一正确，代码中的伪标题不纳入。
  - [ ] 公开锚点和 base 下刷新/返回正确；公开文章即使处于内室仍按公开行为处理。
  - [ ] 私人目录定位后仍保留原 `#vault=<id>`、当前详情与会话，重开仍锁定保护；URL/历史标题无章节文本，锁定/导航清除私人目录与失效焦点。
  - [ ] 可折叠、键盘可达、定位不被控件遮挡，窄屏正常；尊重减少动态偏好，不依靠私人快照或延迟清理实现滚动效果。
- **Verification**：公共门槛；独立标题/重复 id 预期与根/base 公开/私人浏览器；将 hash、目标内容、focus 与 history 作为明确断言；真实加解密后锁定/后台/刷新/BFCache、重复挂载、无标题文章截图与 0 pageerror 检查。
- **依赖 / 后续**：用户明确选中、5.3 Done 后执行；未选择时保留 Deferred，5.5 不以它为必需依赖，也不能标它 Done。

#### Milestone 5.5 — 集成回归与发布候选验收

- **目标 / Scope**：验收实际批准的集合及 Phase 1–4 不退化；只修本阶段必要问题，形成可发布候选。
- **Tasks / Technical Approach**：按固定独立矩阵核对 Keep 与 Think 新功能、现有 Home/Spotlight/统计、全部模块和私人生命周期；0/1/多条、默认/无匹配、公开/私人/混合/全空分别验证。隔离 fixture 永不写入正式内容/生产密文。将新用例接入已有测试方式，更新 PLAN/README 的实测记录，不重建测试框架或追求固定用例数量。
- **Files**：实际涉及的 tests/fixtures/验证探针、必要范围内模块修复、PLAN/README；只有必需时调整既有 Playwright/发布检查接点，不改部署目标、依赖或工作流触发权限。
- **Non-goals**：不顺便修改 Me/Build 排版、补内容、做 RSS/公式/未选目录，不在本项执行线上发布或索取真实私人资料。
- **Done Criteria**：
  - [ ] 5.1–5.3 及实际选中的 5.4 全部 Done；未选项明确不在本轮，不靠删标准或吞错过关。
  - [ ] 完整公共与专项验证通过；当前四份作者内容/计数/搜索、Compass 自动接入/Me 平均、Home/返回/Spotlight 与私人安全边界不退化。
  - [ ] 根/base、两引擎相关交互、内室与公开明暗、320px/短屏/键盘/无模糊/减少动态通过；正式产物无 canary/测试密文/源码或新持久化。
  - [ ] 候选差异/源与文件清单、回退目标、验证命令/退出结果/限制齐全；本地可验收，发布状态仍单列为未执行。
- **Verification**：第 7 节公共门槛、完整根/base e2e、WebKit 移动/私人、extension/content/design/mobile/真实第五私人会话与新探针；verify-release/verify-vault-release、候选 Git/公开索引/产物扫描、真实生产预览。测试结果按实际数量记录。手机新输入/复制如自动化不能覆盖，提交明确的最小真机检查项，在 5.6 集中收齐实际反馈，不逐单元反复要求用户检查、不扩机型矩阵、不把模拟当真机。
- **依赖 / 后续**：依赖本轮选定实现项；通过后停止并提供可发布结果，只有已获明确发布授权才进入 5.6。

#### Milestone 5.6 — 正式发布与 Phase 5 完成

- **目标 / Scope**：在用户明确授权上线时，发布受验候选并完成必要线上/手机检查；避免再次将“关闭阶段”代替实际收尾。
- **Tasks / Technical Approach**：沿用第 8 节现有 main 手动 Actions/Pages 流程；审查真实候选 Git 差异与源，云端完整检查后部署同一 dist，记录 run/artifact/hash 并实际检查线上两项新能力及原入口。生产继续无测试包；公开真实素材不足的场景用隔离测试验收，不为线上演示填假数据。用户实际反馈未到时保留验收状态，不自行假定通过。
- **Files**：获准候选提交、PLAN/README 与必要发布证据；不新增服务/域名/账号/真实私人数据，不做无关线上回退演练。
- **Non-goals**：不把本次规划、方案认可或 5.5 本地通过当作上线授权；不进入 Phase 6、不重新开始未选候选。
- **Done Criteria**：
  - [ ] 5.5 Done、发布获得明确授权，实际 Actions 检查/部署成功，源/run/artifact/线上身份齐全。
  - [ ] 线上产物与受验产物一致，公开页面/搜索/Keep 筛选返回及未配置 Vault 提示正确，0 pageerror；Think 有真实代码块时工具可用，没有时无空工具，完整复制/私人能力的隔离验证证据保留，不以缺素材阻塞功能交付。
  - [ ] 如有正式内容可触达且自动化未覆盖的必需手机新输入/复制项，已收到真实反馈并修复复验；无代码块/真实私人包时如实记录未触达范围，不伪称真机复制已测，也不为此上线测试内容。无待清理样本/未完成必需验收。
  - [ ] 仅本轮必需单元全 Done，5.4 未选仍 Deferred、RSS 未做仍未做；阶段与简报/维护说明一致、Git 保存完成，停止。
- **Verification**：实际云端完整门槛、下载产物/本地/线上文件对比、全部当前公开路径及 404/索引/资产/Spotlight/受影响交互，必要 OPPO 默认浏览器输入/复制/返回检查；核对正式 Vault 仍未配置与无测试文字，更新第 9 节真实记录。
- **依赖 / 后续**：5.5 Done + 当次明确发布授权；授权可与阶段批量指令一并给出，已有明确发布许可不重复询问。没有发布授权时如实停在可发布状态，不宣称阶段全部完成。完成后 Phase 6 仍需新的明确指定。

#### Phase 5 规划保留与延后决定

- **评估记录**：此前建议两类能力（Keep 查找/排序、Think 代码复制），目录可选，RSS/公式/后台等不纳入默认集合；现已由用户决定全部延后。
- **当前停点**：不再等待本轮选择、不开始实施或发布；当前站点基于 Phase 1–4 已可用，后续按实际内容和使用需求再决定是否启用。
- **合理默认**：不修改当前真实素材；新控件按内容显隐；不改变既有导航、会话/加密或公开分类 URL；不让内容数量不足阻塞隔离功能验证。若上述取舍以后改变，先局部修订获准范围，不重做架构。
- **文档 Verification（2026-10-15，通过）**：规划交付时核对了 6 个单元及 24 项 Done Criteria、方案/文件/验证/依赖与编号迁移；用户决定延后后，再次检查 6 项 Deferred、Phase 1–4 Done 与简报可用状态一致。内联校验和 `git diff --check` 退出 0，25 处相对链接/锚点有效，150 个非目标跟踪文件哈希未变，仅 PLAN/README 有改动。未运行工程命令/页面 smoke，未提交、推送或部署；当前按用户决定延后并停止，不再等待本轮方案审阅。

### 6.7 Phase 6 — 合并模块与内容，Pending / 延后

#### Milestone 6.1 — 一个旅行/摄影模块（按需）

- **目标 / Scope**：一个 Registry 入口承载旅行记录与照片；启动前确认名称/id、记录/作品层次和计数。
- **任务 / 技术方案**：先固定一种简单组织方式，再做模块内列表/详情、响应式图片与打开/返回；沿用 module/pages/count/search，Compass 只多一个方向。无正式材料不在生产放测试作品或强行启用空模块；私人媒体仅在明确选择时接入现有 Vault。
- **Files**：未来 `src/modules/<合并id>/`、相关 tests 与 PLAN；不改共享导航的模块分支。
- **Non-goals**：不拆两个入口，不预建相册框架、地图、EXIF/地理分析或素材后台。
- **Done Criteria**：列表/详情/媒体/返回、真实统计/搜索与自动接入正确，无假经历/重复占位图片，公开/私人媒体保护边界有记录。
- **Verification**：公共门槛 + 第五模块接入、根/base/媒体请求/尺寸/移动防溢出、独立计数/目标与必要 Vault 资源回归；启用前核对真实材料。**依赖** 已验收基线 + 用户指定，不强制依赖未选 Phase 5。

#### Milestone 6.2 — 首次正式录入与维护演练

- **目标 / Scope**：只录入本次明确提供/批准的一小批材料，验证作者维护方式，不要求全站同时更新。
- **任务 / 技术方案**：按本模块格式核对公开范围后录入，检查 count/search/链接/资源及必要发布。私人源由作者在本地外部目录处理，不在聊天收秘密；缺素材保持 Pending，不代造。
- **Files**：选定模块内容或获准密文、PLAN/必要 README，不改 Core 模型。
- **Non-goals**：不将未来持续写作列为一次代码任务，不以内容增长暗中新增功能。
- **Done Criteria**：本批内容真实、可见性符合作者选择、页面/搜索/计数/维护正常，作者能据第 3/5 节增改删，验证/必要发布记录齐全。
- **Verification**：公共门槛 + 受影响页面/搜索/Me 平均 smoke、必要线上检查，私人录入复验密文/锁定边界。**依赖** 材料就绪、相应模块功能已完成及用户指定。

<a id="studio-plan"></a>
### 6.8 Personal Space Studio — 本地作者工具（M0–M6 全部 Done）

**授权记录（2026-10-15）**：用户认可基于当前源码的架构与阶段方案，明确本轮仅整理 PLAN、同步 README/MAINTENANCE，保留已有未提交改动；不开始 M0，不提交、推送或发布。认可方案不等于实施授权。Studio 独立于网站 Phase 5/6；原阶段状态与生产版本不变。

**后续实施授权（2026-10-15）**：用户明确指定开始 Studio M0，仅作者契约/解析/序列化/校验与该项验证、文档同步；保留已有未提交改动，不进入 M1，不提交、推送或发布。本条取代上条对当前 M0 的文档停点，其他单元未获实施授权。

**M1 实施授权（2026-10-15）**：用户明确指定 Think 文件 adapter 与安全 CRUD，完成该项验证并同步文档；保留已有未提交改动，不进入 M2，不提交、推送或发布。M0 保持 Done，只有 M1 进入 In Progress。

**M2 实施授权（2026-10-16）**：用户明确指定仅本地 HTTP API、该项验证与文档同步；保留已有未提交改动，不进入 M3，不提交、推送或发布。M0/M1 保持 Done，M2 从 In Progress 实施/验证后标 Done；无下一单元授权。

**M3 实施授权（2026-10-16）**：用户明确指定仅基础 PC Web Editor、该项验证与文档同步；保留已有未提交改动，不进入 M4，不提交、推送或发布。M0–M2 Done 保留，M3 从 In Progress 实施/验证后标 Done；没有下一单元授权。

**M4 实施授权（2026-10-16）**：用户明确指定隔离预览与首版验收、对应验证和文档同步；保留已有未提交改动，不进入 M5/M6，不提交、推送或发布。M0–M3 Done 保留，M4 从 In Progress 实施/验证后标 Done；无后续实施授权。

**M5 实施授权（2026-10-16）**：用户明确指定 AI 文本建议、该项验证与文档，保留已有未提交工作，不进入 M6，不提交/推送/发布；随后选择阿里云百炼 DeepSeek V4.1 Flash。M0–M4 Done 保留，仅 M5 In Progress。按官方文档核实模型 ID 为 `deepseek-v4.1-flash`，采用后端进程 `DASHSCOPE_API_KEY` / `DASHSCOPE_BASE_URL`；当前均未配置，真实调用验收不能由模拟结果代替。

**M5 停点确认（2026-10-16）**：用户明确选择“稍后配置；本轮完成实现及模拟验证，真实调用待验，M5 不标 Done”。本轮到此停止，不继续索取凭据或执行真实调用；待用户配置后再继续该项验收，M6 仍 Deferred。

**M6 实施授权（2026-10-16）**：用户明确指定仅 Agent adapter、该项验证与文档；随后选定轻量 Node/JSON stdio，复用现有 HTTP API，不增加 MCP 或依赖。M6 不依赖 M5，从 In Progress 实施并在完整验证后标 Done；M5 状态记 Awaiting Verification，保留真实调用待验、不得标 Done 的停点。不提交、推送或发布。

**M5 剩余验收授权（2026-10-17）**：用户已在本机配置 Key 并运行非敏感真实实测，授权检查结果、完成 M5 剩余验收并同步文档，保留已有未提交改动，不提交、推送或发布。M5 从 Awaiting Verification 恢复 In Progress；M0–M4/M6 Done 不变。本轮不读取用户凭据，不重复五项付费调用；核验既有真实记录，复验当前工程与浏览器边界。

#### 6.8.1 目标、边界与源码依据

首版仅供 **Windows PC 本地浏览器**使用，处理 Think 文章/随记的列表、读取、新建、编辑 metadata/Markdown、校验、保存、删除和预览。优先级为正确性 → 架构清晰 → 可维护 → 使用体验 → 视觉效果。公开内容源仍为 `src/modules/think/content/*.md`，不建立数据库、不维护第二套正文。

**Non-goals**：Build/Keep/Me 编辑器、私人 Vault 编辑、素材上传/自动清理、已有文章 slug 修改/文件改名；云端/远程访问、账号/OAuth、多人协作、多设备同步、手机/iPad、Mac/树莓派部署、数据库 CMS/PostgreSQL/Redis、Docker 微服务、Electron/Tauri/PWA、插件/通用 workflow/Agent 框架；自动 Git commit/push/部署。首版不实现 AI/MCP；不增加无明确必要的 WebSocket，不大规模重构 Astro。

这里的首版为已完成的 M0–M4；M5 加入百炼文本建议，2026-10-17 已核验真实五项调用与真实浏览器采纳，公共验收已完成，M5 Done，记录见 9.15；M6 轻量 Agent adapter 已完成，仍不实现 MCP 或其他非目标。

当前真实链路及复用边界：

```text
Think content/*.md
  → Astro Markdown 编译（frontmatter / rawContent / Content）
  → content.server.ts 的 import.meta.glob('./content/*.md', { eager: true })
  → metadata.ts / publicArticles：校验、公开过滤、日期与 slug 排序
      ├→ pages.ts → Index / Article → pages.server.ts → [...path].astro → ModuleShell → 静态 HTML
      └→ module.ts 的 count/search → 构建期公开投影 → search-index.json
```

| 源码证据 | 实际行为 / Studio 最小调整 |
| --- | --- |
| [metadata.ts](./src/modules/think/metadata.ts)、[unit](./tests/unit/think.test.ts) | slug 合法性、重复（含草稿）、published 类型先检查；非 true 提前过滤，只有公开文章完整检查 title/summary/date/body/kind。不能把空结果当草稿合法；可小幅抽取纯诊断函数，保持网站过滤顺序和排序语义 |
| [content.server.ts](./src/modules/think/content.server.ts) | 只扫描本层 `.md`，不是普通 Node loader；API 新增受限目录枚举，不 import 构建 loader。已安装 MDX 不等于已接入 `.mdx` |
| [pages.ts](./src/modules/think/pages.ts)、[Index.astro](./src/modules/think/Index.astro) | URL 取自 frontmatter.slug；note 首页四行正文纯文字预览且有详情，缺省 kind 按 article 展示。文件名与 slug 不必相同，需区分 key/slug/实际文件名 |
| [Article.astro](./src/modules/think/Article.astro)、[当前文章](./src/modules/think/content/understanding-from-the-bottom.md) | 正文用 Astro Content，含原生 HTML 公式；不能用 Vault Markdown 子集替代公开预览 |
| [module.ts](./src/modules/think/module.ts)、[搜索构建](./src/core/search/build.ts) | count 为公开篇数，搜索仅标题/摘要并校验真实页面目标；不新增全文/作者状态到公开索引 |
| [package.json](./package.json)、[Astro 配置](./astro.config.mjs) | 静态构建；build 自动先跑 prebuild；dev 读取磁盘，preview 展示已构建 dist，均不是未保存草稿 API |
| [Vault 文件工具](./scripts/vault/files.mjs) | 写入目标、限额为密文专用且无文章 revision；只参考安全思路，不直接复用为文章写入 |
| [内容隔离验证](./tests/verify-content.mjs)、[内容浏览器探针](./tests/e2e/content-probe.spec.ts) | 已有隔离复制、构建、根/base 资源与源哈希保护方式；扩充验证，不把测试脚本直接当生产服务 |

#### 6.8.2 架构与目录

```text
PC Web Frontend
  → 同源 HTTP / JSON
  → Studio HTTP Server（认证、输入限额、错误转换）
  → Think Authoring Service（校验、版本检查、操作编排）
  → Think File Adapter（受限读写、序列化、revision）
  → 现有 Think Markdown → 原 Astro 网站构建

Agent Node/JSON stdio → 同一 HTTP API → 同一 Think Service
未来 Desktop / Mobile → 同一 Authoring 能力
```

稳定边界是**不依赖 UI/HTTP 的服务函数 + 版本化 HTTP 契约**。文件操作集中在后端 adapter；Web 只用 HTTP。未来模块按各自模型添加 adapter，不建立 UniversalContent、模块插件注册框架或全站内容服务，不把业务写入层放进 `src/core`。

目录按已获准单元增加，不为 AI/Agent 创建占位文件：

```text
studio/
├── contracts/{think,http,preview,ai}.ts # Think DTO、HTTP、预览与 AI 结果/限额
├── server/
│   ├── main.ts                # 本地入口
│   ├── http.ts                # 路由及请求/响应转换
│   ├── security.ts            # loopback、Host/Origin、会话保护
│   ├── ai/{config,suggest}.ts # 单一百炼配置与文本建议，无文件/CRUD 权限
│   └── think/
│       ├── document.ts        # YAML/Markdown 解析和序列化
│       ├── validation.ts      # 作者校验、公开就绪诊断
│       ├── files.ts           # 目录边界、revision、写入/删除
│       ├── service.ts         # 模块操作编排
│       ├── preview.ts         # 派生副本、完整校验、构建/取消/清理
│       ├── preview-build.mjs  # 受限子进程中的真实 Astro build
│       └── preview-html.ts    # 文章 HTML/本地图片的受控静态投影
├── adapters/agent/{client,main}.ts # M6：受限 HTTP 客户端、JSON-lines stdio 入口
├── web/{index.html,main.ts,api.ts,styles.css}
├── tsconfig.json
└── vite.config.ts             # M3 独立 Web 构建
tests/
├── unit/studio-*.test.ts
├── studio/                    # HTTP、独立浏览器配置与集成验证
└── fixtures/studio/            # 非敏感样本
```

- 保留根 package.json/lockfile，不引入 workspaces 或独立包发布；沿用 Node/TypeScript，后端原生 HTTP，前端原生 TypeScript/表单/textarea。到相应 milestone 才显式声明 YAML、Web 构建所需直接依赖，不升级既有依赖，不依赖偶然存在的传递依赖。
- 单个本地服务提供 UI 和 API；首版无需 WebSocket/跨域服务。`npm.cmd run studio` 先独立构建 Web，再启动同源编辑器/API（默认 127.0.0.1:4322）；仅构建用 `studio:build`。Vite 显式固定为现有 8.3.4；M4 显式声明已安装的 Markdown processor / ultrahtml / entities，均不升级依赖；不启动 Vite dev server。
- Studio 输出、测试、预览放忽略的 `.cache/studio/`，不覆盖根 `dist`。网站不得 import Studio；Studio 后端可复用 Think 纯模型和校验。Web 不导入 server、node:fs、构建 Registry/loader。
- 不注册为网站模块，不放 `src/pages`/`public`，不添加 Compass/导航入口。Studio 左侧文章列表属于独立作者界面，不改变访客网站的无 Sidebar 约定。部署仍只消费原受验 dist。

<a id="studio-api"></a>
#### 6.8.3 Authoring API 合同（M2 CRUD，M4 预览，M5 文本建议）

命名空间 `/api/authoring/v1/think`；以下接口均已接入，所有内容请求（含预览、AI 状态/建议）使用相同认证。M5 的真实五项调用与浏览器采纳已于 2026-10-17 核验，完整验收见 9.15。纯 DTO 与作者字段、启动/配对和精确 envelope 见[维护手册第 9 节](./MAINTENANCE.md#editor)，接口责任以本节为准。

| 服务操作 | HTTP（相对命名空间） | 输入 / 返回与边界 |
| --- | --- | --- |
| `listThink` | `GET /documents` | 全部/草稿/公开筛选；摘要、key、revision、诊断，不返回全部正文 |
| `readThink` | `GET /documents/:key` | 文档、revision、只读 fileName、editable/诊断；不存在不偷偷新建 |
| `createThink` | `POST /documents` | 候选文档，缺省草稿；生成受控文件名；重复 slug/目标已存在失败；返回 key/新 revision |
| `saveThink` | `PUT /documents/:key` | 完整候选 + 必填 expectedRevision；校验后更新同一文件，返回新 revision；无 upsert/强制覆盖 |
| `deleteThink` | `DELETE /documents/:key` | 必填 expectedRevision；仅删除该文章，返回 deleted；不删图片、其他文章或历史 |
| `validateThink` | `POST /validate` | 文档及可选 key；返回 canSave、publishReady、issues；不写文件，也不代表全站 build 通过 |
| `previewThink` | `POST /preview` | `{document,key?}`；完整公开候选 → `{html,fingerprint,blockedResources,cleanupPending}` 或诊断；自包含 HTML，无预览文件 URL；不保存、不改变源 published |
| AI 配置状态 | `GET /suggest` | `{service,model,available,issue}`，不返回 Key、端点或环境值；不调用模型 |
| `suggestThinkText` | `POST /suggest` | 严格 `{operation,input}` → `{operation,text}`；只建议文本，不接受 document/key/revision、模型/端点/Key，不执行 CRUD |

`key` 由后端从允许目录内发现的条目生成/映射，不需要数据库，不把客户端值解码成任意路径；与 slug 分离以正确定位原文件。新文件用受控 `<slug>.md`，现有文件名保留；首版禁止改已有 slug/文件名，标题修改不改变 URL。

**作者校验**：slug 始终合法唯一，published 只能为 boolean 或省略；草稿可缺少 title/summary/date，可有空正文，已提供字段必须类型正确，非空 date 必须是有效 YYYY-MM-DD，kind 只能为 article/note。published:true 必须满足现有全部公开规则。canSave 与 publishReady 分开，草稿缺项作为公开就绪诊断，不能误阻止合法草稿保存或误报可公开。此项替代维护手册旧的“所有草稿必须完整”建议，不放宽网站公开校验。

严格拒绝 API 新增未知字段/错误类型。旧文件的损坏 YAML、未知字段、重复 slug 必须在列表诊断中出现；不能默默丢弃字段或当空文档覆盖，不支持的源保持不可编辑。无法可靠识别完整集合时，阻止可能制造重复的写入，交由作者在现有源码维护流程修复。

序列化保留正文、未改字段及注释；无修改保存保持原始字节，显示默认值不等于补写源字段。日期写为带引号字符串，不用字符串拼接生成可执行 TS/JS/MDX。新文档默认 published:false、显式 kind，日期由作者确认；正文不自动 trim、润色或格式化。

结果采用 `{ok:true,value}` 或 `{ok:false,error:{code,message,issues?}}`；issue 含 field/code/message/severity，不依赖解析英文异常文本生成机器错误码。建议 HTTP 映射：

| 状态 | 错误 / 语义 |
| --- | --- |
| 400 | INVALID_REQUEST：请求结构、未知字段、非法 key |
| 401 / 403 | UNAUTHORIZED / FORBIDDEN：会话令牌无效、Host/Origin 不允许；PROTECTED_PATH 也为 403 |
| 404 | NOT_FOUND |
| 409 | REVISION_CONFLICT、DUPLICATE_SLUG、FILE_EXISTS |
| 413 | 请求/文档超过明确限额 |
| 405 / 408 / 415 | METHOD_NOT_ALLOWED（Allow）、REQUEST_TIMEOUT、UNSUPPORTED_MEDIA_TYPE |
| 422 | VALIDATION_FAILED、UNSUPPORTED_FORMAT、DIRECTORY_INVALID |
| 500 / 503 | 文件/预览失败或服务忙；不返回内部路径/堆栈 |
| 422 / 413 | PREVIEW_NOT_READY / PREVIEW_RESOURCE_BLOCKED；PREVIEW_TOO_LARGE 为 413 |
| 500 / 504 / 409 | PREVIEW_FAILED / PREVIEW_TIMEOUT / PREVIEW_CANCELLED |

正常完成的 validate 即使报告字段问题也返回 200；保存校验失败拒绝写入。字段诊断用 INVALID_DATE 等细码。M2 传输上限 24 MiB（包含 JSON 转义），M1 序列化源上限仍为 16 MiB；源超限的写入错误为 413 + VALIDATION_FAILED/SOURCE_TOO_LARGE。畸形 HTTP/慢请求头在协议解析阶段关闭或无正文 400，不回显解析异常。无通用文件、shell、Git、发布或任意资源下载接口。

#### 6.8.4 文件边界、并发与本地服务

**revision / expectedRevision 从第一次可写版本开始使用**：revision 为源文件原始字节 SHA-256，不是 mtime、解析后 JSON 或 Git SHA。注释/换行变化也使旧版本失效。编辑/删除强制携带读取时版本；冲突返回错误、保留编辑缓冲，由作者重新读取/人工合并，不自动最后写入覆盖。

```text
取得 Studio 写锁 → 重新检查目录/路径与目标字节 revision
→ 校验候选及全目录 slug 唯一性 → 序列化/公开契约复核
→ 同目录排他创建临时文件 → 完整写入、flush、关闭
→ 替换前再次核对路径和目标版本 → 原子替换 → 返回新 revision
```

- 每仓库单个写服务实例，服务内写操作串行；单有进程内锁不能防止第二个服务实例。新建的最终落盘须“不覆盖现有文件”，不能只先 exists 再普通覆盖。
- 替换失败保留旧文件，不用“先删旧文件再 rename”兜底；删除检查 key、目标身份和 revision。异常清理仅限本次拥有的临时文件，临时扩展名不能被文章 glob 读取。
- 内容写入限定在固定 `src/modules/think/content/` 本层普通 `.md`；根由后端确定，不接受 HTTP 切换根/路径。检查真实路径、symlink/junction、Windows ADS/设备名、大小写冲突、尾点/空格、分隔符、编码绕过；禁止任意目录递归读写。新文件的文件名约束与现有公开 slug 语法分开解释，不暗改网站路由规则。
- Studio 构建/预览临时输出另受固定 `.cache/studio/` 白名单约束，只允许内部生成，不开放为任意写入参数。
- **保护限度**：版本比较保护已经发生的外部编辑和经 Studio 串行处理的请求；普通 Node 的最终检查与替换不是针对任意外部编辑器的跨进程原子 CAS。外部程序在最后时间窗写同一文件仍可能竞争，不能宣称事务式绝对无冲突；首版不预建原生锁服务。
- 服务固定监听 127.0.0.1，严格 Host/Origin 检查；每次启动随机会话令牌，通过本机启动/配对流程提供，UI 仅内存持有。所有内容 API 均需令牌，写入仅 JSON/自定义认证头，不开放任意 CORS。令牌不放查询参数、持久化存储或日志；本地请求保护不是账号系统。
- 不提供仓库根静态服务，只提供 Studio 固定产物；预览 HTML 通过认证 JSON 返回，不开放预览资源通配路由。请求大小、超时和预览并发有界；日志无正文/令牌，错误不泄露服务器路径。具体凭据交付在 M2 验证，不假设 loopback 天然安全。

#### 6.8.5 预览、状态与未来接口

首版采用**按钮触发的隔离 Astro 构建**，接受比逐键预览慢，以复用真实 Markdown、模板和样式：

1. 从可信项目文件创建受控临时构建目录，不接收任意配置/MDX/命令。
2. 将内存候选叠加到临时 Think 文件；草稿须公开就绪，仅临时副本参与公开渲染，真实 published 不变。
3. 复用原 Astro 模板/配置构建，临时输入/输出为可丢弃派生物，不构成第二套正文，不覆盖生产 dist/源码。
4. 用禁脚本、无同源权限的 sandbox iframe 显示受控产物；限定本地预览资源，阻断远程资源，构建期图片处理也不能偷偷发请求。HTML 公式、代码、本地图片应保留可读效果。
5. 返回候选指纹，旧预览不覆盖新缓冲；超时/错误明确反馈，失效目录清理。无逐键构建、通用任务队列、远程图片代理。

**M4 实际边界**：独立的 `createThinkPreview(service, trustedOptions)` 提供异步 `previewThink(input, signal?)` / `close()`，不把构建放进同步 CRUD，也不依赖 Web。先复用 M1 的目录/字段校验，要求 `canSave && publishReady`；既有 key 定位实际文件名，新建候选用受控 slug，副本中才设置 published:true。每个实例最多一个预览，没有队列；临时目录为 `.cache/studio/preview/job-*`，只复制可信 src、配置和本地图片，不复制 public 中的 Vault 包/JS/map。单文件 16 MiB、4000 文件、合计 128 MiB；结果/读取图片合计及最终 HTML 各限 8 MiB。

真实 Astro build 的输入、out/cache、临时配置/用户目录都在 job 中；子进程不继承密钥类环境，不回显日志/路径/正文。Node permission 限制 JS 文件读写，关闭遥测，并在载入 Astro 之前阻断 fetch/TCP/UDP；Markdown processor 预先检查本地图片不得越出副本的 src/public，防止原生 bundler 读取外部图片。构建上限 90 秒、预览响应 socket 上限 100 秒、浏览器等待上限 105 秒；接收正文限额不变。这不是对前置复制/解析的硬实时截止，复制/输入另有尺寸限制。取消/断线/关闭会终止子进程，完成后核对自有 job 身份再删除；清理失败返回 cleanupPending，不清理不明目录，强杀遗留由作者核对后处理。

从真实文章构建结果解析并重建允许的文章 HTML，保留真实 CSS、Astro scoped 属性、HTML 公式和代码。删除脚本、事件、表单、子 frame、链接目标；本地图片转 data URL，SVG 再做受控过滤，远程/缺失图片显示阻断提示，CSS 外部导入/URL 直接拒绝。只在 `sandbox=""` 的无同源、禁脚本 iframe 中显示，自身 CSP 只允许内联样式/data 图片；父页仅为此允许 srcdoc frame 与内联样式，仍禁止内联脚本、跨源连接、被其他站点嵌入。没有预览文件路由、长期副本或后台自动更新；编辑/保存/切换/删除会清掉旧 frame，并以候选版本/请求序号拒绝迟到结果。

**构建保护限度**：当前 Astro/Vite 必须允许已安装的原生插件与 worker。Node permission + 网络 hook 是对可信项目/依赖的纵深保护，**不是任意恶意 Node/配置/插件的 OS 沙箱**；不接受客户端配置、JS/MDX 或依赖安装。普通 Markdown 的资源输入由预检、输出重建和浏览器 CSP/sandbox 各自约束。Node 官方也明确 native addon/worker 的权限模型限制，不能把此实现描述为恶意程序隔离：[Node 22 Permission Model](https://nodejs.org/download/release/latest-v22.x/docs/api/permissions.html)。

预览针对公开文章内容/样式，不承诺网站交互脚本、导航或 Vault 行为。预览成功不等于 lint/typecheck/test/build 全部通过。UI 明确区分未保存/已保存、draft/published；published 表示下次网站构建纳入，不能显示成已经上线。**保存 ≠ published ≠ Git commit ≠ push ≠ deploy**；不暗改已有公开文章的状态。

M5 仅后端单次文本建议，不在浏览器存 Key/调用模型，不自动写回；M6 通过 stdio 薄封装现有 HTTP，保存完整候选并走校验/revision。本轮不提供 patch、AI/preview/delete 的 Agent 操作，不创建 Provider、workflow、MCP 或多模块占位框架。

#### 6.8.6 单元状态与共同验证

| 单元 | 目标 | 状态 | 依赖 / 停点 |
| --- | --- | --- | --- |
| Studio M0 | Think 作者契约、解析、校验 | Done | 原验证与记录保留，是 M1 已完成的前置 |
| Studio M1 | 文件 adapter 与安全 CRUD | Done | 前置验证与记录保留 |
| Studio M2 | 本地 HTTP API | Done | 前置验证与记录见 9.10 |
| Studio M3 | 基础 PC Web Editor | Done | 原记录见 9.11，本轮回归通过 |
| Studio M4 | 隔离预览与首版验收 | Done | 原记录见 9.12，首版本地完成；扩展另获授权 |
| Studio M5 | AI 文本建议 | Done | 真实五项调用、真实 UI 与剩余验收全部通过；记录见 9.15 |
| Studio M6 | Agent adapter | Done | Node/JSON stdio、原 HTTP 复用、独立协议与双引擎冲突验证；记录见 9.14，不依赖 M5 |

每个实现单元运行实际 `npm.cmd run lint`、`npm.cmd run typecheck`、`npm.cmd run test`、`npm.cmd run build`，保留 prebuild，并完成下列专项与受影响页面 smoke。新增 TS/测试必须接入真实检查命令，不能被现有 unit glob、Playwright 固定 testMatch 或类型配置漏掉。Studio 浏览器测试使用独立配置和非敏感隔离内容，网站既有测试不弱化。

网站加载/资源/路由按[第 7 节](#verification)核对根/base、相关 Chromium/WebKit；Studio 支持范围为 Windows PC，不借此增加手机/iPad 真机需求。无新浏览器行为时如实记录，不将构建代替交互验证；UI/安全负例检查全部 pageerror。测试样本不写正式作者内容，记录实际命令、退出码、截图/trace/证据和限制。

<a id="studio-m0"></a>
#### Studio M0 — Think 作者契约、解析与校验（Done）

- **Goal / Scope**：建立与真实源码兼容的纯函数边界：Think DTO、结构化错误、YAML/Markdown 解析/序列化、草稿与公开就绪规则；仅最小提取既有纯校验。
- **Non-goals**：不读写正式内容目录，不启动服务，不做 UI、预览、AI；不升级依赖或改变网站内容。
- **文件/目录**：新增 `studio/contracts/think.ts`、`studio/server/think/document.ts`、`validation.ts`、`studio/tsconfig.json`、`tests/unit/studio-think-document.test.ts`、`tests/fixtures/studio/`；最小修改 `src/modules/think/metadata.ts`、`tests/unit/think.test.ts`、根 package/lock（显式 YAML 依赖与类型检查接点）、PLAN/README/MAINTENANCE。实际文件与证据见 9.8。
- **接口**：`parseThinkSource`、`serializeThinkDocument`、纯文档校验；既有 `publicArticles()` 对外语义不变。
- **数据流**：源文本 → YAML 文档/Think DTO → 诊断 → Markdown 文本；没有文件系统写入。
- **Done Criteria**：
  - [x] 当前文章无修改往返保持字节；中文、引号/冒号、多行、日期、Markdown 围栏、HTML 公式不损坏，未改字段/注释保留。
  - [x] 不完整草稿可表达/保存就绪；字段类型与公开就绪分别诊断，公开非法内容仍拒绝，未知字段不静默丢失。
  - [x] 原公开过滤、重复 slug、日期/同日排序及 note 语义不变；新代码进入类型/测试门槛，无 HTTP/文件写入。
- **Verification**：共同门槛；解析/序列化独立预期、草稿/公开/错误类型/YAML/未知字段负例；既有 Think unit；当前 Think 列表/详情 smoke，真实内容不变。
- **风险**：YAML 类型与注释/换行变化；抽取校验误改草稿提前过滤行为。
- **依赖 / 下一阶段接口**：用户明确指定后才开始；M1 消费纯函数，不再复制字段规则。完成记录后按授权停点停止。

**M0 实际交付/限制**：已有纯函数为 `validateThinkDocument(value)`、`parseThinkSource(source)`、`serializeThinkDocument(value, originalSource?)`；解析成功返回 `{document,validation}`，失败不提供空文档替换。序列化需传原始文本才保留其注释/字节；无修改及仅改正文精确保留原 frontmatter，元数据修改保留值/注释/标量形式但不承诺整个 YAML 排版字节不变。仅支持开头闭合的 YAML 1.2 标量映射，拒绝标签/锚点/别名、额外文档标记、嵌套值、重复键、未知字段及错误类型；与 Astro 相同的 timestamp 解析要求源日期加引号，新建/修改字符串安全加引号。M0 本身不含目录唯一性或文件身份/revision，现由 M1 承接；HTTP、UI、预览仍属后续单元。原 M0 验证与证据见 Completion Record 9.8。

<a id="studio-m1"></a>
#### Studio M1 — Think 文件 adapter 与安全 CRUD（Done）

- **Goal / Scope**：通过本地服务函数读写现有 Markdown；实现 list/read/create/save/delete、目录索引/key、原始字节 revision、串行写入、受限路径与原子替换。
- **Non-goals**：HTTP/UI、改 slug/文件名、素材上传/清理、自动保存、Git 操作。
- **文件/目录**：`studio/server/think/files.ts`、`service.ts`，文件系统 unit、隔离 fixtures/构建验证及必要文档。
- **接口**：六项非预览服务操作（含 validateThink）；编辑/删除必填 expectedRevision，新建不覆盖。
- **数据流**：服务调用 → 受限扫描/版本检查 → M0 校验/序列化 → 指定源文件。
- **Done Criteria**：
  - [x] CRUD、全空、重启重读正常；旧文件名保留，坏文件有诊断，不伪装空文档。
  - [x] 重复 slug/文件、旧 revision、越界路径拒绝；多个 Studio 写请求/服务实例不能绕过串行约定。
  - [x] 写入失败保留旧文件，删除仅目标文件；其他文件哈希不变，临时文件不进入文章列表。
- **Verification**：共同门槛；Windows ADS/设备名/大小写/路径/junction/symlink 负例；并发 create/save/delete、外部修改、替换失败注入；隔离 CRUD 后构建，列表/详情/count/search/空态/404 与根/base 浏览器。权限不支持的测试如实记录，不能假称通过。
- **风险**：Windows 占用/权限、进程异常、外部编辑器最后时间窗竞争；按 6.8.4 记录保护限度。
- **依赖 / 下一阶段接口**：M0 Done；M2 只调用服务，不自行拼路径/复制写入。

**M1 实际交付/边界**：`openThinkAuthoring(repositoryRoot?)` 仅接受可信启动配置（缺省为自身仓库根），返回六项同步服务方法及 close；无 HTTP、启动服务器命令或 UI。key 是文件名的命名域 SHA-256 映射，revision 是原始字节 SHA-256。固定本层 `.md`，不递归；检查目录身份/真实路径、junction/symlink、hardlink、Windows ADS/保留名/尾点空格/大小写、UTF-8，单篇 16 MiB 为作者工具资源边界，不改网站 schema。新建默认草稿/article、wx 临时写入/fsync 后 link 不覆盖落盘；更新保留原文件名、原 published/kind，重验 staged 字节、目录及目标版本/身份后 rename；无修改保存不重写；删除只对准确 key/revision 的普通文件 unlink。

仓库 `.cache/studio/think-authoring.lock` 为生命周期排他锁，其他实例/进程返回 AUTHORING_BUSY；同步串行、重入拒绝，不自动抢陈旧锁。坏文件始终在诊断列表可见，新建/保存遇不完整目录阻断；可安全读取且有 revision 的坏普通源允许明确删除以修复目录，链接/过大目标不允许删除。成功写入的 cleanupPending:true 表示已提交但自有临时文件清理失败，不当作未保存；错误也可报告未能安全清理。路径身份变化时不绕过检查清理，可能遗留自有 `.tmp`/锁，维护操作见手册。仍不承诺对外部编辑器或同权限恶意进程的最终检查/替换窗口进行原子 CAS，或断电持久性。

**M1 验证支持限制**：真实 Windows junction、hardlink、ADS 和目录中途替换负例通过；普通文件 symlink 建链被当前账户 EPERM 阻止，该额外子项记 skipped/未运行，不冒称通过，也未开启开发者模式/调整系统权限。已用实际 junction 验证相同的 lstat/真实路径/禁止跟随边界；完整结果及限制见 Completion Record 9.9。

<a id="studio-m2"></a>
#### Studio M2 — 本地 HTTP API（Done）

- **Goal / Scope**：独立客户端安全调用 M1；版本化路由、JSON 契约、会话/Host/Origin 保护、限额、错误映射、启停。
- **Non-goals**：编辑界面、账号、远程访问、任意 CORS、WebSocket、shell 接口、预览实现。
- **文件/目录**：`studio/server/main.ts`、`http.ts`、`security.ts`、`studio/contracts/http.ts`、`tests/unit/studio-http.test.ts`、`tests/studio/http.smoke.mjs`；根 package 启动脚本与三份文档，无新增依赖。
- **接口**：6.8.3 非预览 HTTP 路由；preview 到 M4 才开放，不放伪成功占位。
- **数据流**：HTTP → 鉴权/请求解析 → M1 → 统一 JSON。
- **Done Criteria**：
  - [x] 有效客户端完成 CRUD；无令牌/非法来源不能读草稿或写文件，所有错误符合契约。
  - [x] 仅监听 loopback；启动/配对、服务重启、单实例规则明确，无宽泛静态仓库服务。
  - [x] 请求大小/超时有界，日志无正文/令牌，响应无内部路径/堆栈；UI 不是调用前提。
- **Verification**：共同门槛；真实 HTTP CRUD、坏 JSON/未知字段/超限/无令牌/伪 Host-Origin/跨站请求；端口冲突、启停/重启；实际浏览器来源与 CSRF 行为验证，既有网站 smoke。
- **风险**：误认为 localhost 天然安全，令牌交付/日志泄漏，底层异常直接透出。
- **依赖 / 下一阶段接口**：M1 Done；M3 通过 HTTP 工作，相同 API 可供非浏览器客户端使用。

**M2 实际边界（API-only 调用保留，当前 CLI 编辑器见 M3/M4）**：原生 Node HTTP 固定绑定 127.0.0.1；默认 4322，只允许 CLI `--port`，可信测试可用随机端口/根。API-only 的 `GET /` 是无文章控件的本机配对文档，JSON 数据节点 `#studio-session` 只在内存交付本次随机令牌；CLI 不输出凭据，无 Cookie/CORS/持久化。浏览器顶层本机导航通过 Host/Origin/Fetch Metadata 检查，跨站配对/读取/表单或自定义头预检被拒绝；可信本地程序也可配对，不声称防御其他已在本机执行的程序。M2 六项内容 API 与 M4 preview 均需要 `X-Studio-Token`，其余路径无静态仓库兜底。

接收上限：24 MiB JSON、8 KiB 请求头、正文 15 秒、请求头 5 秒（1 秒轮询）、Node 请求/空闲 socket 20 秒、16 连接/2 个已鉴权内容请求；响应关闭连接，同步 M1 操作不承诺可硬实时中断。M2 不复制文件校验/写入逻辑，只映射现有结果、revision/cleanupPending 与错误；close 断开未完成请求后释放 lease，重启 token 失效。CLI SIGINT/SIGTERM、可信父进程 IPC `studio:stop` 均只用于本机启停，不是 Agent/MCP 或 HTTP shell 接口。Windows Ctrl+C、IPC 正常退出/重启与端口冲突已实际验证，完整证据/限制见 9.10。

<a id="studio-m3"></a>
#### Studio M3 — 基础 PC Web Editor（Done）

- **Goal / Scope**：列表、新建、metadata/Markdown 编辑、校验、保存/删除；左侧列表、textarea、dirty 状态、字段错误、冲突处理、删除确认。
- **Non-goals**：复杂富文本、云草稿、浏览器持久化正文、协作、AI；预览留 M4。
- **文件/目录**：`studio/web/{index.html,main.ts,api.ts,styles.css,env.d.ts}`、`studio/vite.config.ts`、`server/web.ts`；最小接入 `http.ts`/`main.ts`、Studio 类型检查、package/lock；`tests/unit/studio-web.test.ts`、独立 `tests/studio/playwright.config.ts` 和 `editor/editor.spec.ts`；M2 CLI unit 仅补隔离静态 fixture，三份文档同步。
- **接口**：只消费 M2；不 import server、node:fs 或 Astro loader。
- **数据流**：读取 → 内存缓冲 → 校验/显式保存 → 新 revision → 列表更新。
- **Done Criteria**：
  - [x] 完整 CRUD/空态可用；切换/关闭有未保存提示，保存失败保留缓冲，冲突不自动覆盖重试。
  - [x] 未保存/已保存与 draft/published 分开，公开状态不冒充部署；已有 slug 不可编辑。
  - [x] 乱序响应不覆盖新输入，不自动持久化正文；前端和 API 同源，网站产物没有 Studio。
- **Verification**：共同门槛；实际 Windows PC 浏览器 CRUD、中文 IME/键盘、双标签冲突/外部修改、服务断开、删除取消/空列表；受影响网站 smoke 和产物隔离检查。
- **风险**：迟到请求、刷新丢稿、错误状态文案；textarea 体验有限但不借机扩编辑器框架。
- **依赖 / 下一阶段接口**：M2 Done；M4 接收内存候选，不能为预览隐式保存。

**M3 实际边界**：原生 TypeScript/表单/textarea，左侧文章列表/状态筛选，右侧 Think metadata/Markdown、校验、显式保存、确认删除、源版本/文件名只读；坏源只读并显示诊断。正文在输入框中为文本，M4 另加隔离预览面板。现有源字段的省略状态保留，显示默认值不补写源；新建默认 draft/article，不自动填日期。源 published 与候选状态、未保存缓冲与已保存源码分别显示，保存不提交/部署。

Web 只消费 M2 六项同源 API 与纯 DTO，不导入 server/fs/loader。根页将凭据交给客户端闭包后移除配对数据节点，不写浏览器存储。读/list 用独立序号，校验用输入版本，保存对提交时快照更新基线；保存期间继续输入不会被迟到响应抹掉或误报已保存。版本冲突、会话失效和无法确认落盘的断线保留缓冲并禁用自动重试；重新读取/切换/新建须确认丢弃，刷新/关闭用 beforeunload，组合输入不触发保存。

UI 产物仅 `.cache/studio/web/{index.html,main.js,style.css}`；后端启动只读这三个受控普通文件，内存中固定 `/studio-assets/main.js`、`/studio-assets/style.css` 映射，无目录静态兜底/资源通配。CLI 载入构建产物，同源根页 CSP 仅允许本地脚本/样式；API-only `startStudioHttp()` 仍不依赖 UI，M1/M2 内容逻辑/认证契约未变。独立浏览器命令 `npm.cmd run studio:test`；Windows npm.cmd 的 Ctrl+C 若出现终止批处理确认，输入 Y，M1 锁已由 Node 正常释放。验证/截图与支持限制见 9.11。

<a id="studio-m4"></a>
#### Studio M4 — 隔离预览与首版验收（Done）

- **Goal / Scope**：闭合编辑 → 校验 → 预览 → 保存 → 原网站构建；实现按需隔离构建、草稿叠加、sandbox/资源边界、超时/清理及首版集成回归。
- **Non-goals**：逐键实时构建、通用任务系统、远程图片代理、MDX、自动发布、网站交互脚本/Vault 预览。
- **文件/目录**：`studio/contracts/preview.ts`、`studio/server/think/preview{,-html}.ts` / `preview-build.mjs`、现有 HTTP 与 Web 面板、隔离构建/浏览器 tests 与文档；自包含结果使资源路由不再必要。
- **接口**：previewThink；自包含 HTML、候选指纹、图片阻断数与清理标志，旧结果不能覆盖新候选。
- **数据流**：编辑缓冲 → 完整校验 → 临时副本 → Astro → 隔离页面 → 清理。
- **Done Criteria**：
  - [x] 现有 HTML 公式、article/note、代码、本地图片及根/base 可验证；草稿预览不改源或根 dist。
  - [x] 不可信脚本不能执行/读凭据；构建期及浏览器远程资源均受限；预览超时/失败可恢复，失效目录清理。
  - [x] M0–M3 Done，全链路验证通过，正式产物无 Studio/草稿预览，作者内容哈希保护与限制记录齐全；首版本地完成不表示已发布。
- **Verification**：共同门槛；真实 Astro 与预览对照；script/事件属性/iframe/外链资源负例、慢请求/超时/重启；隔离 CRUD 后列表/详情/搜索/count/404/根/base；实际浏览器与源哈希检查，相关 WebKit 覆盖按第 7 节执行。
- **风险**：构建耗时、相对资源、HTML 隔离，以及已有无关坏源使构建失败；不改网站规则掩盖失败。
- **依赖 / 下一阶段接口**：M3 Done；M0–M4 全 Done 才完成首版。AI/Agent 不影响本项 Done，结束后停止等待新授权。

<a id="studio-m5"></a>
#### Studio M5 — AI 文本建议（Done）

- **Goal / Scope**：仅阿里云百炼 `deepseek-v4.1-flash`，后端单次 polish/rewrite/summarize/generateTitle/generateSummary，结果由作者采纳。
- **Non-goals**：自动写回/published、复杂 Provider/workflow、私人内容、浏览器持有密钥。
- **文件/目录**：新增 `studio/server/ai/`、AI DTO、小型建议面板与测试；不创建其他 Provider/Agent 占位。
- **接口**：`suggestThinkText({operation,input})` 返回候选文本，不执行 CRUD。
- **数据流**：作者明确触发 → 后端模型调用 → 建议 → 人工采纳至缓冲 → 原保存流程。
- **Done Criteria**：
  - [x] 密钥不进浏览器/仓库/日志，发送内容范围明确；失败/超时保留原文。
  - [x] 输出不自动落盘/公开，采纳后仍走同一校验/revision；不引入未选 Provider 或任务框架。
- **Verification**：共同门槛；确定性错误测试、获准的实际模型调用、浏览器网络/产物/日志检查。
- **风险**：费用、内容外发、生成失真；启动时确定模型/凭据方案，不提前承诺服务商。
- **依赖 / 下一阶段接口**：首版完成及另行授权；AI 无文件写权限，不作为 M6 前置。

**M5 当前实现**：只接百炼 `deepseek-v4.1-flash`，用 Node fetch 调用 HTTPS workspace Chat Completions，固定关闭思考、非流式、4096 输出 token，无 tools/会话/检索/重试。后端读取进程环境中的 Key 与 Base URL；地址仅允许官方列出的五个地域 workspace 域名及 `/compatible-mode/v1`，不接受 HTTP/重定向/查询/URL 凭据，不扫描其他配置或密钥库。用户明确选择服务/模型；官方 API 依据：[百炼 DeepSeek](https://help.aliyun.com/zh/model-studio/deepseek-api)。不引入 SDK 或新依赖。

AI 服务不持有 Authoring service/文件系统，仅接收严格 operation/input；输入最多 32 KiB UTF-8，HTTP envelope 最多 128 KiB，响应 JSON 最多 128 KiB、结果最多 32 KiB。每实例一个请求，无队列，60 秒超时；HTTP 响应 socket/浏览器等待 70 秒。拒绝空/坏 UTF-8、截断/工具/坏 JSON/空结果，不把半截建议交给采纳；密钥不放输入/输出或错误。错误仅返回固定 code/message，模型鉴权失败为 502 AI_AUTH_FAILED，与本机 401 UNAUTHORIZED 区分。完整映射与配置见 MAINTENANCE 9.3.4。

Web 只把当前 Markdown 正文快照送给后端，明确显示发送范围与服务；不发送 metadata、文件名、revision、其他文章或私人 Vault。五种操作结果以只读文本显示，不能执行 HTML；作者点“采纳”才替换正文或 title/summary 缓冲，published 不变、文件未写，之后仍走原校验/expectedRevision 保存。编辑/切换/保存/操作改变使旧建议失效；取消、失败/超时保留原文，迟到结果不覆盖新输入。无配置时 AI 不可用，普通编辑器仍可使用。

**真实验收证据（2026-10-17）**：已核验作者本机生成的 `.cache/studio-m5/live.json`，记录时间 `2026-10-17T05:08:45.404Z`，模型匹配，simulated:false、五种 operation 均成功、complete:true；输出依次为 141/138/114/39/45 bytes。该记录只含操作/字节数，不含凭据或原文，校验后原样复制至 `.cache/studio-m5-acceptance/live.json`，没有重复这五次付费调用。另用作者已配置的原 Studio 服务进行 Chromium 真实非敏感润色一次：采纳前正文不变，采纳后仅进内存，published:false、源文件不变，校验与旧建议失效通过，无浏览器直连百炼/Authorization 头/持久化。已查看结果截图，文本可读且保留本样本含义；这不保证所有生成事实或质量，仍须作者逐次核对。验收 agent 未读取或接收 Key，仍仅原后端使用其进程配置。确定性错误测试仍使用明确标识的模拟上游，不能混写为真实服务证据；本轮命令与限制集中在 9.15。

<a id="studio-m6"></a>
#### Studio M6 — Agent Adapter（Done）

- **Goal / Scope**：按用户选定的轻量 Node/JSON-lines stdio，薄封装 list/read/create-draft/validate/save，调用已运行的同一 HTTP API，无 Web UI 也可使用。
- **Non-goals**：MCP/JSON-RPC、Agent 框架/模型调用、patch/delete/preview/发布操作、工具自动注册、任意文件/终端访问、多模块通用模型、新依赖。
- **文件/目录**：新增 `studio/adapters/agent/{client,main}.ts`、`tests/unit/studio-agent.test.ts`、`tests/studio/editor/agent.spec.ts`；仅给 `studio/tsconfig.json` 补 adapters 检查范围，不改网站/HTTP/文件服务/AI 实现。
- **接口**：每行严格 `{id,operation,params}` → `{id,...原结果}`；operation 为 `listThink` / `readThink` / `createDraft` / `validateThink` / `saveThink`。完整参数和调用示例见 [维护手册 9.3.5](./MAINTENANCE.md#studio-agent)。可信启动参数仅 origin/allowWrite，不能由 Agent 请求覆盖。
- **数据流**：Agent UTF-8 JSON line → envelope/操作/权限检查 → 内存配对 token → 原 HTTP → 原 Think 校验/文件 adapter → stdio 统一结果。stdout 只作协议，不用 npm 包装以免混入启动日志。
- **权限与并发**：默认只读；作者明确启动 `--allow-write` 才授权会话写入。createDraft 拒绝 published:true；save 必填完整候选/expectedRevision，先读当前源，published 的值及省略状态必须一致，实际提交仍由原服务再次检查 revision。可以编辑原 published:true 正文，但不能改变其公开状态，不自动 build/Git/deploy。
- **重试/限额**：单进程串行；同一 id 不再次执行，最多 128 个已接收 id，之后 SESSION_LIMIT，重启不持久化去重。重复创建由原 slug/文件冲突拒绝，重复变更保存由原 revision 拒绝；无修改保存不承诺新 revision。输入每行/内容响应各限 24 MiB、配对响应 64 KiB、HTTP 20 秒；只接受精确 `http://127.0.0.1:PORT`，拒绝重定向。写请求已发出后失联/超时/坏响应记 AGENT_WRITE_OUTCOME_UNKNOWN，先 list/read 核对，不自动重试/重配对。
- **Done Criteria**：
  - [x] 无 Web UI 也可调用；不能绕过目录、published、校验或 revision，不新增第二套保存实现。
  - [x] 过期版本/重复请求/越权输入有明确处理，模型建议不自动变成写入授权。
- **Verification**：共同门槛；实际 Node stdio 客户端执行全部五项操作；API-only 配对、默认只读/启动写权限、过期 revision/重复 id/重复创建/非法输入/路径越权；提交后丢响应不重试、提交前外部竞争仍冲突；Chromium/WebKit 中 Agent/Web 双向冲突、缓冲保留和原网站 smoke。
- **风险**：会话启动授权有权修改 Think 内容，不能把模型文字当该授权；stdout 按调用者要求包含文章，应由作者选定的 Agent 处理，不作为调试日志。128 id 去重不是跨进程 exactly-once；保留 M1 最终检查与 rename 间外部进程竞争限制。本机配对不是 OS 用户隔离，可信启动与 HTTP 服务必须由作者控制。
- **依赖 / 下一阶段接口**：M0–M4 Done 与本轮授权已满足，不依赖 M5；未来只扩客户端传输/交互，Markdown 仍是唯一数据源。此次不新增后续实施单元，不自动配置 Agent/MCP 或执行 AI 真实调用。

**本轮停点**：M5 两项 Done Criteria 和全部 Verification 满足并标 Done，Studio M0–M6 全部完成；本轮仅验收与文档，没有产品代码变更。不启动新单元，保留已有未提交改动，不提交、推送或发布，完成后停止。

<a id="studio-v0"></a>
### 6.9 Studio v0 收尾与发布（2026-10-17 授权）

用户明确授权依次完成润色优化、API Key 本机保留/快捷启动、验证与文档，并把当前版本提交和正式部署为 v0；随后确认新增 sunshine.md 一并纳入、按当前 published:true 原样处理。原 M0–M6 Done 与 Phase 5/6 Deferred 不变。保护已有未提交工作，凭据不进源码/Git/日志/浏览器；已有历史 tag `v0` 不移动，本次基线 tag 用 `studio-v0`。以下三项均获授权，前项验证通过才进入下一项，不因记录计划扩大实现。

| 单元 | 状态 | Goal / Scope | Non-goals | 文件 / 接口 / 数据流 | Done Criteria / Verification | 风险 / 下一边界 |
| --- | --- | --- | --- | --- | --- | --- |
| v0.1 润色优化 | Done | 明确修正病句、减少重复、改善衔接，保留事实和作者语气；原样响应显示“本次未产生修改” | 不新增 Provider、自动重试/保存或通用提示词系统 | suggest.ts、web/main.ts、AI unit/browser 测试；原 HTTP/DTO 保持，返回文本→与请求时原文精确比较→状态/采纳按钮 | 共同 lint/typecheck/test/build；双引擎验证原样结果不采纳、不写源、空白差异仍可采纳；本机上游核对新请求指令，真实新进程润色归入 v0.2 集成验收；授权新文章的公开计数/路由测试与 smoke 不弱化 | 不保证模型每次都改；通过后仅进入已授权 v0.2 |
| v0.2 Windows 本机启动 | Done | Key 用当前用户 DPAPI 加密保存在仓库外；一次录入后复用；桌面快捷方式启动/复用服务并打开浏览器，提供停止/重新配置方式 | 不存明文 Key、不做账号/云同步/后台开机常驻/MCP，不把 localhost 服务部署公网 | studio/windows/ 启动/配置脚本及必要本地进程管理、Windows 协议测试；本地密文→可信启动内存/子进程配置→原 HTTP | 共同门槛；真实 DPAPI 保存/加载/坏密文/无配置/更新、快捷方式实际目标、首次/重复启动、停止/重启/浏览器与新提示词非敏感真实调用；Key 不进 args/日志/Git，原内容不变 | 同用户程序不是安全隔离；首次保存需要作者本机安全录入，不能从旧进程窃取；通过后进入 v0.3 |
| v0.3 v0 基线提交与正式部署 | Done | 审阅并提交当前 Studio/文档/授权文章，推送 main，手动触发原 workflow，核对实际公开产物与线上，创建 studio-v0 基线；补充获准关闭 Astro 隐式预取及行为回归 | 不移动历史 v0、不夹带凭据、无强推、不把 Studio/本地配置上传 Pages | 现有 release/Vault 检查、Git、固定 GitHub Actions 与验收记录 | lint/typecheck/unit/build/默认 E2E 与原发布专项；云端检查/deploy 成功，源 SHA/下载 artifact/本地与线上哈希/受影响页面一致，浏览器无异常 | 不从本地通过推断已部署；保留实际 run/commit/tag 和限制，完成本授权后停止 |

<a id="verification"></a>
## 7. Verification：执行命令与证据

### 7.1 本地启动及公共门槛

Windows 使用 npm.cmd/npx.cmd；其他平台使用 npm/npx。按 `.node-version` 与锁文件安装，不无故升级依赖。

```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 4321
```

每个实现 milestone 必须实际运行，记录退出码和结果：

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run test:e2e
```

build 自动执行 prebuild 的公开/Vault 边界检查，不能跳过；build 不代替 astro check。浏览器先安装 `npx.cmd playwright install chromium webkit`，默认测试已构建 dist，用 `tests/serve.mjs` 启动 127.0.0.1:4410，不复用其他服务。人工生产预览：`npm.cmd run preview -- --host 127.0.0.1 --port 4322`。

纯文档单元只做结构/链接/范围/状态/证据引用检查，记录工程命令未运行，不能把历史通过写成本次验证。

### 7.2 根/base、引擎与隔离验证

页面、路由、资源、共享导航/Vault 等改动按影响运行以下专项；发布候选必须跑完整工作流，不因局部通过跳过。

```powershell
# 不覆盖根 dist，验证部署子路径
npm.cmd run build -- --base /personal-space/ --outDir .cache/base-dist
$env:E2E_BASE_PATH = '/personal-space/'
$env:E2E_DIST = '.cache/base-dist'
npm.cmd run test:e2e
Remove-Item Env:E2E_BASE_PATH, Env:E2E_DIST

# WebKit 相关交互：先确保上述 base 环境已清理
$env:E2E_BROWSER = 'webkit'
$env:E2E_MOBILE = '1'
npm.cmd run test:e2e
Remove-Item Env:E2E_MOBILE
npm.cmd run test:e2e -- --grep 'Vault|private|Unlock|opening and reopening'
Remove-Item Env:E2E_BROWSER

# 不污染正式 src/modules 的独立契约验证
npm.cmd run test:extension
node tests/verify-content.mjs
node tests/verify-design.mjs
node tests/verify-mobile.mjs
node tests/verify-vault-session.mjs
$env:E2E_DIST = (Get-Content .cache/vault-session-output.txt -Raw).Trim()
$env:E2E_SESSION_PROBE = '1'
npm.cmd run test:e2e
Remove-Item Env:E2E_DIST, Env:E2E_SESSION_PROBE

# 确认正在检查真实根 dist 及正确候选源码
node tests/verify-release.mjs
node --experimental-strip-types tests/verify-vault-release.mjs
```

临时环境变量用后清理；若命令失败先停止并修复，不把示例当无条件流水线。其他 E2E_* probe 开关以 playwright.config.ts 为准，不用筛选掩盖必需测试。会话扩展需在第二引擎核对时设置 E2E_BROWSER 后重跑对应 probe。

| 验证方向 | 必须观察的行为 |
| --- | --- |
| 公开导航 | 全部当前正常页面（本版 9 页）+ 真实 404，Home/模块/详情/返回/深层刷新，资源/索引/head/canonical/base |
| Compass | 真实 count/平均/log 几何，全零/少量模块/第五模块，4–7 模块长名/44px/文字玻璃碰撞 |
| Spotlight | 快捷键/点击/关闭动画/快速重开/还焦/Tab、IME/键盘选择、空/长列表/失败重试、无默认选中 |
| 内容 | 真实素材与独立预期，新增/隐藏/删除/全空，日期/slug/URL/类型负例；草稿资源不当保密 |
| Private | 真实 Node/browser 互通、错误口令/篡改/版本/KDF/尺寸/schema/资源/字符负例，四模块与同 URL 来源/计数 |
| 清理 | DOM/Blob/查询/目标/持久化/URL/日志/网络，后台/闲置/刷新/新标签/BFCache/迟到解密/导航取消 |
| 视觉/移动 | 系统明暗/内室/减少动态/无模糊，320 起窄屏及短横屏、软键盘可用空间、文字/代码/公式/域名/媒体不撑页 |
| 维护/发布 | CLI 真实 TTY 增改删/换口令/备份恢复/失败保护/路径；dist/候选 Git/CI 边界与真实线上同产物 |

测试 fixture 必须非敏感、独立预期、不冒充作者内容；密文解密验证不能只靠 mock isUnlocked。全流程结束检查 pageerror，不只在私人操作前检查，也不过滤真实异常。截图/trace/探针日志留在忽略的 `.cache`/test-results；证据可能随本地清理消失，长期身份以 Git/Actions 与汇总记录为准。

Windows WebKit 未暴露 `-webkit-tap-highlight-color`：颜色断言按 CSS.supports 记不适用，但触摸展开/键盘焦点及其他交互仍执行。Chromium 的透明断言不代表 OPPO 已通过。

### 7.3 OPPO 最小真机验收

设备为 OPPO Find X7 Ultra 默认浏览器，系统/浏览器版本未知，不猜测；以“能看能用”为目标，不扩机型矩阵。记录日期/访问版本与用户原始反馈：

1. Home 四入口无重合/旧高亮/蓝色闪块；模块进入/返回、横竖屏阅读正常。
2. 搜索“底层”或“NEMU”，软键盘下输入、关闭、结果可达，关闭后页面能继续用。
3. 中心长按静默打开 Unlock；输入/粘贴与取消可用，正常口令解锁后四模块私人优先/公开完整，来源标记正确。
4. 站内搜索/返回会话正常，主动锁定、后台和刷新立即回公开，无旧正文/主题残留。

未测 iOS 真机，不宣称全平台兼容。真机发现问题先做本阶段最小修复并逐项复验，不能转移到未来 Phase 躲过验收。

<a id="release"></a>
## 8. 发布与恢复

目标仓库 `hjk202/hjk202.github.io`，public/main，站点根域名、base `/`；保留旧 demo 历史和已有标签，不改可见性/域名。所有上线按本次明确发布授权执行。

1. 核对 Git 差异、候选源 SHA、实际账号权限与发布目标；完整检查候选，保护未提交工作，不把旧源通过当新源证据。
2. push/PR **只检查**；在 main 通过 `workflow_dispatch` 手动触发 `Verify and publish Personal Space` 才发布。`.github/workflows/deploy.yml` 使用锁定 Node/npm、官方 Action 固定 SHA。
3. check 运行 lint/typecheck/unit/root build/root e2e、WebKit、真实第五私人适配会话、extension/content/design/mobile、隔离 base build/e2e 与发布/密文边界。
4. 只上传 check 实际测试的 `dist`；deploy 消费同产物，不重建。CI 不接真实明文/口令，不运行 pack/rekey。
5. 记录真实 run 链接、源 SHA、artifact/digest、manifest；核对实际下载产物、本地受验构建、线上文件哈希，检查全部当前正常路由（本版 9 页）/404/索引/资产/导航/搜索及受影响私人链路，全程 pageerror 为 0。
6. 记录手机待验事项并停止；云端成功不替代用户真机，纯文档完成记录不需要重新发布网站。

回退优先最近适用的已验证源，在隔离目录干净安装/构建/smoke 后用新的 `git revert` 提交按同流程发布；不 reset --hard、不强推、不在正常线上无必要演练。单检出旧标签再发布 main 不会回退 main。整站回退可能撤销新功能，密文恢复还需相应备份口令，两者分别核对。

历史保留点：`v0`（初始本地基线）、`demo-before-phase3`、`phase3-first-release`（`d3ccc76`）及已验收公开源 `9e7d878`。首发与 `9e7d878` 都做过隔离复现；恢复 `9e7d878` 会撤回 Phase 4。Phase 4 手机验收已由用户确认；未来版本仍须按实际结果记录，不以自动验证替代必要手机验收。

<a id="records"></a>
## 9. Completion Record 与当前风险

### 9.1 保留的主线记录

| 日期 / 单元 | 实际结果与证据摘要 | 限制 / 状态 |
| --- | --- | --- |
| 2026-10-11 至 10-13 / Phase 1 | 1.1–1.8 工程/契约/Home/搜索/玻璃与第五模块、根/base 验证完成；后续视觉修订获用户认可 | 历史逐项命令/截图/失败修复记录在 `6202827:PLAN.md` 对应 Completion Record；不当作本轮重跑 |
| 2026-10-13 / Phase 2、D1–D8 | 首批四份真实材料、独立布局/分类/项目记录能力、返回状态/搜索收起/Me 平均完成；公共/浏览器/内容与设计隔离验证通过 | 新素材以后维护；不造缺失项目日志 |
| 2026-10-13 / Phase 3 | 最终公开源 `9e7d878`，[Actions 38501761237](https://github.com/hjk202/hjk202.github.io/actions/runs/38501761237)；15 线上文件同哈希，OPPO 用户确认蓝块/重合均解决、操作正常；Me 链接更新和隔离回退完成 | Phase 3 Done，未知系统/浏览器版本、iOS 未实测 |
| 2026-10-14 / 4.1–4.7 | 协议/CLI/会话/入口/四模块/搜索统计与清理完成；当时公共命令退出 0，4.7 根/base 各 60 浏览器、38 unit、第五真实会话两引擎通过 | 维护交互与 canary/路径/资源负例仅用非敏感样本；4.8 留后验收 |
| 2026-10-14 至 10-15 / 4.8、V1–V4 | 维护恢复、隔离回退、安全边界及静默入口/转场取消修复；内室主题、真实私人优先/公开完整、来源标记完成；`1520c2f` 发布并线上验证 | 仍非敏感验收环境，不代表真实私人材料已录入 |
| 2026-10-15 / V5 | 共享可打印 Unicode/1024 字节规则、原始 paste 校验、移动属性、原生点击高亮继承/keyboard focus 区分；未改包/口令/加密参数 | lint/typecheck（126 文件 0 诊断）/42 unit/build（9 HTML 页）退出 0；根/base 各 75 浏览器、WebKit 相关 31 通过；原验收密文互通通过 |
| 2026-10-15 / V5 发布 | `1f3ce49` 经 Actions 38731022976 全部 check/deploy 成功；本地/下载产物/线上 26 文件哈希一致；8 公开页/404/搜索/输入负例/真实解锁/四模块/来源/锁定均通过，0 pageerror | 手机结果随后由用户确认，已由 9.5 的无样本最终版取代 |
| 2026-10-15 / 文档归并 | 用户授权将 11 份项目文档归并为 AGENTS/PLAN/README；旧需求/风格/接口/安全/维护/发布有效内容迁入本文，源码结构核对，保留历史 milestone 编号/状态 | 仅文档，不实现/部署；工程检查未重跑。文档专项结果见下 |

最新最终发布 artifact `11976255759`，digest `sha256:495ce267a61dd7b7439f7f5ad87e54db93087c54aeb666ef981af4ea89520563`，详见 9.5。V5 修复前的失败证据与后续修复均保留在旧记录，未通过吞异常/删测试过关。同源重复 push 运行取消不替代手动运行中的完整验证。

此前 V5 证据索引：`.cache/v5-final-root.log`、`v5-final-base.log`、`v5-final-webkit.log`、`v5-boundaries.log`、`v5-existing-sample.json`；发布证据 `.cache/v5-release-manifest.json`、`v5-ci-manifest.json`、`v5-release-artifact.json`、`v5-release-jobs.json`、`v5-release-run.json`、`v5-release-live.log`、`v5-release-live.json`、`v5-release-live-home.png`。最终收尾的新执行证据见 9.5，不与历史记录混用。

已退役验收密文 SHA256 `fa84cfa3c72c1b183e4bfccdc438c5d8cf1ebc8ce0095e4f6f5cdaefe26e0856`；该文件已在最终收尾中删除，仅历史/隔离测试保留非敏感样本。真实明文/口令未作为本次输入，不在本轮补录。

### 9.2 Open Questions / Risks

- **当前状态**：用户手机验收、样本清理、无样本完整验证/最终发布均完成，Phase 1–4 Done，没有本阶段遗留执行项。
- **保密边界**：公开密文可离线猜口令；旧副本不能远程撤回，浏览器/站点代码须可信。完整 Git 历史泄漏审计和独立密码学审计未做。
- **性能/支持**：KDF 不因手机慢自动降级；Web Crypto 不可用保持锁定。Windows WebKit 私有点击高亮颜色不可检测；OPPO 已由用户确认检查无问题，系统/浏览器版本仍未知。
- **候选需求**：Phase 5 已按用户决定全部延后，不是当前使用前提；旅行/摄影等 Phase 6 仍延后。保留规划不构成实施或上线授权。
- **Studio**：M0–M6 全部 Done，首版、百炼文本建议与轻量 Agent adapter 均完成本地验收；M5 真实五项调用/实际 UI、确定性回归与范围证据见 9.15。M1 文件限制见 9.9、HTTP 本机配对边界见 9.10、M3 缓冲/IME 见 9.11、M4 可信构建/隔离预览见 9.12、Agent 协议/授权/恢复见 9.14。生成事实/质量仍由作者逐次核对；没有真人输入法、OS 恶意代码沙箱或发布验收声明。
- **内容维护**：真实私人材料以后由作者本地处理；内容缺失不制造假数据，未公开 Markdown/资源不能承担秘密。
- **文档一致性**：本文更新产品需求/架构/风格/阶段状态，MAINTENANCE 集中维护实际内容字段/操作与作者工具接口，明确区分已实现与远期参考，README 同步主线，AGENTS 仅管执行；保持交叉引用，不再拆分重复专题文档。

### 9.3 文档归并 Verification（历史）

检查范围：三份项目文档数量；相对链接与锚点；旧文档引用迁移；历史 milestone 编号/Done Criteria/Verification 与当前状态；需求/设计/安全/维护覆盖；Git diff 空白；非文档文件 SHA256 与整理前基线一致。

**2026-10-15 验证完成**：`node .cache/verify-doc-consolidation.mjs` 与 `git diff --check` 均退出 0。仅保留三份项目文档，23 处相对链接/锚点有效；43 个已完成单元、当前 4.8 和 6 个未来单元的范围/状态及验收结构核对通过，旧专题引用已移除，需求/设计/安全/维护覆盖检查通过。150 个非文档跟踪文件 SHA256 与整理前完全一致，包括源码、配置、测试、真实文章与验收密文；Git 改动仅上述文档合并。证据为 `.cache/docs-consolidation-before.json`、`.cache/docs-consolidation-result.json`，辅助脚本也仅在忽略的 .cache 内。

未改工程输入，该次 lint/typecheck/test/build/页面 smoke 未运行；此前通过记录见 9.1，不能声称该次重跑。该次整理交付时未提交或部署；随后用户批准 Git 保存与 Phase 4 收尾，见下节。

### 9.4 文档保存与临时关闭（历史停点，已由 9.5 取代）

文档整理已在 `5eff33e` 保存。当时误解“结束”为仅记录 Closed，保留了手机/样本收尾项而未发布；用户随后澄清需要全部完成。该临时状态已由 9.5 的完整验收与最终发布取代，不是当前状态。

Verification：`node .cache/verify-phase4-closure-docs.mjs` 与 `git diff --check` 均退出 0；23 处相对链接/锚点、43 个历史完成单元/6 个未来单元、Phase 4/4.8 Closed 与未勾选遗留项核对通过。150 个非文档文件哈希与整理前一致，Git 差异仅 11 个文档的归并及状态更新；无既有暂存内容需要保护。证据为 `.cache/phase4-closure-doc-result.json`。工程输入未变，lint/typecheck/test/build/页面 smoke 未重跑；历史功能与线上结果见 9.1。Git 保存后核对提交范围与工作区，随后停止。

### 9.5 Phase 4 Completion Record（2026-10-15，Done）

用户澄清“把 phase4 及以前的所有内容完成，我都检查过了，没有问题”，确认已部署 `1f3ce49` 的整体/手机复验通过，并授权完成样本清理和最终发布。沿用此前 OPPO Find X7 Ultra 默认浏览器的设备上下文，未提供版本、不声称 iOS 真机通过。前节 Closed 是历史误解停点，由本次完整收尾取代。

本次实际产品改动仅删除 `public/vault/bundle.json` 非敏感验收样本；应用代码、加密参数、作者真实内容不变。另修正 `tests/e2e/content-empty.spec.ts` 的旧空查询默认选择假设：明确验证无默认选中/Enter 不跳转，再按方向键选择并进入，保留全零/空态/404 断言。最终生产未配置真实 Vault，入口应显示“尚未配置私人内容”；私人能力用隔离非敏感 fixture 保持完整验证，不创建默认生产口令。

本地 lint/typecheck（126 文件零诊断）/test（42 项）/build（9 HTML 页、25 文件）均退出 0；根/base 完整浏览器各 75、WebKit 移动 16/私人 29、第五模块真实会话两引擎各 3、extension/content/design/mobile/session 隔离契约、第五模块浏览器 1/设计浏览器 5 通过。实际生产预览的 25 文件哈希、8 公开路由/404/搜索/Home/返回、Me 链接、手机标签与透明高亮及未拦截的缺包端点/Unlock 提示通过，0 pageerror。与 V5 受验产物相比仅少密文文件，其余 25 文件哈希一致；公开计数仍各 1，搜索 4 条。

初次沙箱单元测试因临时目录原子 rename 被 EPERM 阻止，保留 `.cache/phase4-final-test-sandbox-failure.log`；正常本机权限下原断言 42 项全通过，未改代码。临时发布探针最初误将本地预览地址当 canonical，已按实际配置修正为正式站地址并重跑通过，失败日志保留；不是修改产品 head 或放宽断言。

补跑旧空集合浏览器探针时确定性暴露与现有 Spotlight 契约冲突的默认选择假设，已按第 3.2 节及现有 spotlight.spec.ts 的同一行为修正测试，不修改运行逻辑。保留原失败日志/截图/trace；修正后 lint/typecheck/42 unit/build 再次退出 0，公开内容与全空浏览器探针各 1 通过。重新构建的 25 文件哈希与此前已做完整根/base/WebKit 验证的产物一致，不把相同产物的重复构建当作新功能验证。

最终产品源 `4f2d6b9007167d49bace3d08c85ba5095ea37e85` 经 [Actions 38738688217](https://github.com/hjk202/hjk202.github.io/actions/runs/38738688217) 全部 check/deploy 成功。云端对该源重跑全部既有门槛，上传并部署同一 dist，不重建；同源重复 push 检查 38738649410 取消，不减少手动发布验证。Pages artifact `11976255759`，digest `sha256:495ce267a61dd7b7439f7f5ad87e54db93087c54aeb666ef981af4ea89520563`。

实际下载归档、本地完整受验构建与线上 25 文件逐项哈希一致；8 公开路由及刷新/Home/返回、真实 404、四条搜索目标、Me GitHub、375px 标签间距/触摸反馈通过。未拦截实际网络的 `/vault/bundle.json` 返回 404，静默 Unlock 显示“尚未配置私人内容”，无口令表单/解锁状态/验收文字，关闭后可继续正常搜索/打开内容；全过程 pageerror 为 0。最终没有真实私人材料或默认口令，功能通过隔离非敏感测试验证；作者以后按第 5.5 节自行维护。

证据前缀 `.cache/phase4-final-`：lint/typecheck/test/build、root/base、webkit-mobile/webkit-private、session-webkit/session-chromium、verify-extension/verify-content/verify-design/verify-mobile/verify-vault-session、extension-browser/design-browser/content-browser/empty-browser、local-live.log/json、release-manifest.json、source-boundaries.json、release-run.json、release-jobs.json、release-artifact.json、artifact-comparison.json、live.log/json、live-home.png。148 个受保护文件哈希不变，应用源码/配置/作者内容未改；仅样本删除、一份测试契约修正及计划/简报状态更新。

所有 Done Criteria 满足，4.8 与 Phase 4 标 Done，Phase 1–4 完成；手机系统/浏览器版本未知、iOS 真机未测、未做独立安全审计等已知保护边界继续有效，不是遗留开发任务。最终状态/文档检查后保存 Git 记录并停止，Phase 5/6 未选择、未实施。

最终文档专项通过：23 处相对链接/锚点、4.8 全部完成项、阶段与简报状态、发布源/Actions/实际线上证据、148 个未变文件及仅文档的最终差异核对均通过，`git diff --check` 退出 0；证据 `.cache/phase4-final-completion-docs.json`。随后保存并推送完成记录，文档记录不改变受验产品/产物，不重复部署。

### 9.6 完整内容维护手册（2026-10-15，文档任务完成）

用户确认搭建告一段落，要求完整整理自己/AI 维护及未来写作前端所需资料。新增 [MAINTENANCE.md](./MAINTENANCE.md)，集中公开四模块全部字段、文章增删改/草稿/素材、私人 schema/资源/全量打包、CLI/库接口、备份恢复/口令边界、预览验证发布、AI 录入模板及未实现的本地作者工具接口参考。同步 AGENTS/README 与本文的文档职责及入口，保留此前 Phase 5 规划/延后改动；没有实施新功能或内容录入。

**Verification**：内联 Node 检查退出 0；四份文档结构/代码围栏、73 处相对链接/锚点、6 份内容示例及现有公开/私人模块校验、12 个 npm 命令、74 个接口属性和 59 处私人白名单字段核对通过。149 个非目标跟踪文件 SHA-256 与本任务开始时相同，`git diff --check` 退出 0。工程检查与页面 smoke 未运行（纯文档）；没有提交、推送或部署。Phase 1–4 Done，Phase 5/6 延后，当前无实施 milestone，交付后停止。

### 9.7 Studio 规划入档（2026-10-15，仅文档完成）

用户认可上一轮源码分析方案，明确仅将 Studio 架构/milestone 写入 PLAN 并同步 README/MAINTENANCE，保留已有未提交改动，不开始 M0、不提交或发布。本轮在 6.8 集中记录真实 Think 数据流、独立本地架构/目录、API、草稿/序列化、revision/Windows 文件边界、HTTP 保护、隔离 Astro 预览及 M0–M6 的 Scope/Non-goals/文件/接口/数据流/Done Criteria/Verification/风险/依赖。README 只同步入口与状态；MAINTENANCE 更新作者 DTO/操作语义，撤回已被方案替代的导出优先、完整草稿、save-upsert 建议，保留并明确隔离未选的发布/私人参考。

**文档 Verification**：通过终端 stdin 执行内联 Node 文档审计，退出 0；四份文档代码围栏配对、100 处实际相对链接/锚点有效（代码示例不作为链接），7 个 Studio 单元的必需规划字段齐全，5 项 Pending / 2 项 Deferred、19 项未勾选 Done Criteria 一致。`git diff --check` 退出 0。150 个非目标文件（含已有修改的 AGENTS.md、源码/配置/测试/内容）的 SHA-256 与本轮开始时一致；Git HEAD 未变、暂存区仍为空、没有 Studio 实现目录。证据为本轮工具输出与本节记录，没有新增验证脚本或工程文件。

本轮仅修改 PLAN/README/MAINTENANCE；AGENTS 原有修改及其余未提交工作保留，MAINTENANCE 仍为原先未跟踪文件，未暂存。工程 lint/typecheck/test/build/E2E 与页面 smoke **未运行**（纯文档、工程输入未变），历史通过不充当本轮结果。Phase 1–4 Done、Phase 5/6 延后不变；Studio M0 未开始、无实施项 In Progress。没有提交、推送或发布，文档交付后停止，等待另行指定实施单元。

### 9.8 Studio M0 Completion Record（2026-10-15，Done）

**授权/实际变更**：用户明确指定 M0，保留已有未提交工作，完成验证并同步文档后停止。新增 `studio/contracts/think.ts`、`studio/server/think/document.ts`、`validation.ts`、`studio/tsconfig.json`、非敏感注释/多行/HTML fixture 和 `tests/unit/studio-think-document.test.ts`。Think metadata 最小提取 identity/publication 纯字段诊断；保留网站草稿提前过滤、公开错误顺序、重复 slug、排序及 note 语义。增加 9 项 Studio unit 与 1 项 Think 回归；根 typecheck 接入 Studio 严格 NodeNext，既有 test glob 自动发现新增测试。显式声明现有锁定 `yaml:2.9.1` 为直接 devDependency，无新增包版本或既有依赖升级。

**纯函数合同**：validateThinkDocument 返回 canSave/publishReady/issues；parseThinkSource 返回 document/validation 或结构化错误；serializeThinkDocument 返回内存 Markdown 字符串，原文参数用于保留字节/注释。合法但不完整的草稿可保存，published 可省略；缺项 warning 与非法已给值 error 分开。坏/未知/不支持源不返回空替代；源日期按 Astro timestamp 规则要求引号，新建/修改的字符串安全引号化，未改日期的引号不随标题编辑重写。仅字符串处理，无目录扫描、原子写入、文件 CRUD、revision、HTTP、UI、预览或 AI/Agent 实现。

**实际命令与结果**（日志前缀 `.cache/studio-m0/`）：

| 命令 | 退出结果 / 证据 |
| --- | --- |
| `npm.cmd install --package-lock-only --ignore-scripts --offline --no-audit --no-fund` | 0；仅根 devDependencies 增加 YAML 声明，所有已有非根 lock entries 不变 |
| `npm.cmd run lint` | 0；`lint.log` |
| `npm.cmd run typecheck` | 0；Astro 130 文件零诊断 + Studio `tsc --noEmit -p studio/tsconfig.json`，`typecheck.log` |
| `npm.cmd run test` | 0（正常本机权限）；52/52，`test-native.log`，含 9 项 Studio/3 项 Think |
| `npm.cmd run build` | 0，含原 prebuild；9 HTML 页面、25 文件，`build.log` |
| `npm.cmd run build -- --base /personal-space/ --outDir .cache/studio-m0/base-dist` | 0；保留根 dist，`build-base.log` |
| `npx.cmd playwright install chromium webkit` | 0；浏览器安装至忽略的 `.cache/studio-m0/browsers`，`browser-install.log` |
| `npm.cmd run test:e2e -- tests/e2e/content.spec.ts` | 0；4/4 原内容用例，`content-root-final.log` |
| `node .cache/studio-m0/smoke.mjs` | 0；根/base × Chromium/WebKit 四组合，`smoke-final.log`、`smoke.json` |

浏览器命令在正常本机权限下使用进程级 `PLAYWRIGHT_BROWSERS_PATH=D:\hjk202\.cache\studio-m0\browsers`，未改项目配置/全局环境。真实静态网站 smoke 覆盖 Home→Think→文章、HTML 公式/正文/日期、刷新、返回、Spotlight 搜索“底层”、Home 返回、公开索引/count；四组合均 0 pageerror/0 failed request。截图为 `root-chromium-article.png`、`root-webkit-article.png`、`base-chromium-article.png`、`base-webkit-article.png`，已查看根 Chromium 截图。临时 smoke 使用既有 tests/serve.mjs，仅为验证，不是 Studio 服务。

**失败与修复/限制**：开发专项曾发现 YAML 新字段节点/日期形状字符串的类型变化，已使用显式 Scalar/字符串引号修复并用实际 `astro/markdown` 解析器交叉检查；额外文档标记明确拒绝。初次完整 unit 的既有 Vault 原子 rename 在沙箱临时目录报 EPERM，保留 `test.log`；正常权限下原断言 52 项通过。初次浏览器缺缓存、下载遇 TLS 瞬时错误，保留 `smoke.log`、`smoke-native.log`、`content-root-native.log` 与安装日志；下载器重试成功，未禁用 TLS 校验。临时 smoke 最初未等导航完成即断言 URL，保留 `smoke-navigation-wait-failure.log`，增加实际导航等待后同断言全部通过，未修改产品行为或削弱现有测试。

解析仅支持已声明的 YAML 子集；元数据编辑不承诺全 frontmatter 排版字节相同，原值/注释保留，无修改/仅改正文则精确保留。未运行全套默认 E2E、extension/design/mobile/Vault 专项和真机检查：本项无新 UI/资源/私人协议，仅运行上述相关浏览器与根/base smoke，不冒称完整发布候选验收。未触及作者内容或密文，未开始 M1。

**范围/收尾**：`scope-audit.json` 记录 146 个非目标文件 SHA-256 与本轮开始相同（含原有修改的 AGENTS.md、真实文章及其余工程文件），原网站 Phase 1–6 范围保持；所有既有非根 lock entries 不变，25 个公开产物无 Studio/fixture，新增源/测试仅上述六个文件。最终文档结构/链接/状态审计与 `git diff --check` 通过，证据 `final-audit.json`；HEAD 未变、暂存区为空，原先未跟踪的 MAINTENANCE 仍未暂存。M0 三项 Done Criteria 全满足并标 Done；M1–M4 Pending、M5/M6 Deferred，无实施项 In Progress。没有提交、推送或发布，完成 M0 后停止。

### 9.9 Studio M1 Completion Record（2026-10-15，Done）

**授权与实际变更**：用户明确指定只做 Think 文件 adapter 与安全 CRUD、验证和文档同步，保留已有未提交工作，不进入 M2，不提交/推送/发布。新增 `studio/server/think/files.ts`、`service.ts`、`tests/unit/studio-think-files.test.ts`、`tests/verify-studio-think.mjs`、`tests/studio/think-files.smoke.mjs`；扩充已有 `studio/contracts/think.ts` 的文件 DTO/错误码。只同步 PLAN/README/MAINTENANCE；没有修改 package/lock、M0 纯函数、访客网站代码、真实文章、密文或工作流。

**实际能力**：openThinkAuthoring 绑定可信仓库根和固定 Think 内容目录，提供六项非预览同步服务方法及 close。key 是文件名命名域哈希，revision 是原始字节哈希；列表无正文、坏源有诊断，单篇 read 不假造空文档。创建默认 draft/article，禁止重复 slug/文件与危险文件名；保存保留原名、状态和无修改字节，不支持改 slug。wx/flush 临时写入后校验 staged 字节及路径/目标身份，link 新建不覆盖、rename 替换、精确 unlink 删除；提交后清理失败单独标 cleanupPending。生命周期排他锁同时约束对象/进程，同步请求串行、重入拒绝；不自动抢陈旧锁，维护恢复见手册 9.3。单篇 16 MiB 为作者资源边界，validateThink 与实际写入均检查，不改网站字段/长度规则。

**实际命令与结果**（日志前缀 `.cache/studio-m1/`）：

| 命令 | 实际结果 / 证据 |
| --- | --- |
| `npm.cmd run lint` | 退出 0；`lint.log` |
| `npm.cmd run typecheck` | 退出 0；Astro 135 文件零诊断及 Studio 严格 NodeNext，`typecheck.log` |
| `npm.cmd run test` | 退出 0（正常本机权限）；67 项中 66 通过、0 失败、1 skipped，`test-native.log`；原 M0 与既有测试全部保留 |
| `npm.cmd run build` | 退出 0，含原 prebuild；9 HTML 页面、25 文件，`build.log` |
| `node --experimental-strip-types tests/verify-studio-think.mjs` | 退出 0；通过真实 adapter 执行 CRUD，7 次隔离 Astro 构建，`integration.log` / `integration-output.json` |
| `node tests/studio/think-files.smoke.mjs` | 退出 0；12 个状态/根-base/引擎组合全部通过，`smoke.log` / `smoke.json` |
| `npm.cmd run test:e2e -- tests/e2e/content.spec.ts` | 退出 0；正式根产物原有 4/4 内容浏览器用例，`content-root.log` |
| 内联 Node 范围/文档审计、`git diff --check` | 退出 0；`scope-audit.json` / `final-audit.json` 与工具输出 |

文件/集成/浏览器验证在正常本机权限下运行，浏览器复用进程级 `PLAYWRIGHT_BROWSERS_PATH=D:\hjk202\.cache\studio-m0\browsers`，没有更改全局环境/系统设置或下载新依赖。隔离场景为新建公开文章/note/未公开草稿 → 保存标题/正文/note → 取消公开文章并删除 note → 删除剩余隔离 Think 内容；count 从 3 到 1 再到 0，路由/公开索引对应增减，草稿 canary 不进入产物，共享图片保留。正式源码哈希始终不变，清空操作仅针对已核验位于 `.cache/studio-m1/integration-*` 的复制目录。

**浏览器行为与证据**：更新、隐藏/删除、全空三种状态 × 根 `/`/base `/personal-space/` × Chromium/WebKit 共 12 组合。核对 article 详情、note 首页内联、Markdown 图片实际请求/尺寸、更新正文、刷新/返回、Spotlight 搜索、Home/Compass 实际 count；隐藏/删除/草稿目标返回 404，全空首页仍可进入。所有组合 0 pageerror、0 failed request；截图名如 `updated-base-chromium.png`、`hidden-root-webkit.png`、`empty-base-chromium.png`，已查看更新页截图。测试只使用既有静态服务，不是新增 Studio HTTP 服务。

**安全/并发专项**：真实 NTFS ADS 不被枚举/读取、junction/hardlink/过大文件拒绝、目录在提交前被替换不跟随、不安全原文/重复 slug 可诊断、API 路径/编码/设备名/大小写/尾点空格负例、旧 revision/外部修改/同字节文件替换、并发 create/save/delete、第二实例/独立子进程锁、陈旧/被替换锁不抢占；部分写入/flush/rename/unlink 失败、最终新建竞争、临时内容篡改、提交后清理失败也有独立结果预期。正常失败保护旧文件，已提交后清理失败不伪装成未保存。

**支持限制与失败处理**：普通文件 symlink 的额外子测试实际尝试建链后被 Windows 账户 EPERM 阻止，明确 skipped/未运行；没有更改系统权限或用 mock 冒充真实建链。实际 junction（同样经 lstat/真实路径拒绝）及 hardlink 边界已验证，普通文件 symlink 在允许权限的环境仍会执行原断言。首次沙箱 hardlink/rename 受权限限制，保留 `targeted.log`；正常权限下通过。保留 `file-symlink-permission-failure.log` 和 `lint-initial-failure.log`；修正控制字符检测写法/URL 导入，无规则降级。目录替换的初次故障注入在 Windows 打开的临时文件尚未关闭时被系统拒绝，后调整为关闭后、提交检查前替换目录，保留原“不能跟随 junction/不能改外部文件”断言并通过；开发中增加 staged 身份/字节复验和 fd 异常关闭保护。

仍不承诺任意同权限外部进程在最终检查/替换窗口的原子 CAS、崩溃自动回收锁或断电持久性；无法安全清理时报告 cleanupPending，不删除身份不明的文件。未运行全套默认 E2E、发布/extension/design/mobile/Vault 专项或真机：本项没有新访客 UI/私人协议，仅执行上述相关浏览器与隔离根/base 集成，不冒充发布候选全矩阵。HTTP/认证/UI/预览没有实现，M2 未开始。

**收尾**：范围审计确认 155 个非目标文件 SHA-256 与本轮开始一致，包含已有修改的 AGENTS、原 M0 实现/测试、package/lock、真实文章及其余网站输入；原 Phase 1–6 范围未改。新增源/测试仅上述五个文件，公开 25 个文件无 Studio/fixture/锁，HEAD 未变、暂存区仍为空，MAINTENANCE 仍保留原先未跟踪状态。文档结构/链接/字段与状态一致，M1 三项 Done Criteria 满足并标 Done，M0 Done 保留，M2–M4 Pending、M5/M6 Deferred。按授权停止，没有提交、推送或发布。

### 9.10 Studio M2 Completion Record（2026-10-16，Done）

**授权与实际变更**：用户仅授权本地 HTTP API、验证与同步文档，保留已有未提交工作，不进入 M3，不提交/推送/发布。新增 `studio/contracts/http.ts`、`studio/server/{main,http,security}.ts`、`tests/unit/studio-http.test.ts`、`tests/studio/http.smoke.mjs` 六个文件；根 package 只新增 `studio` 启动脚本，另同步 PLAN/README/MAINTENANCE。未修改 lockfile、M0/M1 实现/测试、网站代码、正式内容、Vault 或发布工作流。

**实际能力**：原生 Node HTTP 封装 M1 六项服务，复用其 DTO/诊断、原子文件操作与原始 revision，不复制内容逻辑。固定 loopback，严格 Host/Origin/安全头去重、自定义 token、无 CORS；每次启动重新生成令牌。根页仅本机配对 JSON 数据节点（无可执行脚本/编辑器），不向日志、URL 或浏览器持久化存储交付凭据。非浏览器启动 handle/本机配对可独立调用，不能传任意路径/根/命令。JSON/UTF-8/envelope、请求/源限额和超时、并发上限、稳定状态码/错误，未完成请求关闭不提交。端口失败释放本次 lease，关闭可重复调用，仓库第二实例拒绝；预览路由未开放。

**实际命令与结果**（证据前缀 `.cache/studio-m2/`）：

| 命令 | 实际结果 / 证据 |
| --- | --- |
| `npm.cmd run lint` | 退出 0；`lint-complete.log` |
| `npm.cmd run typecheck` | 退出 0；Astro 141 文件零诊断 + Studio 严格 NodeNext；`typecheck-complete.log` |
| `npm.cmd run test` | 退出 0（正常本机权限）；76 项：75 通过、0 失败、1 skipped；9 个新增 M2 契约/安全/CLI 组全部通过，`test-complete.log` |
| `npm.cmd run build` | 退出 0，含原 prebuild；9 HTML 页面、25 文件，`build-complete.log` |
| `npm.cmd run build -- --base /personal-space/ --outDir .cache/studio-m2/base-dist` | 退出 0；独立 base 构建，不覆盖根 dist，`build-base.log` |
| `node --experimental-strip-types tests/studio/http.smoke.mjs` | 退出 0；Chromium/WebKit 本机配对、CRUD、冲突及跨站安全负例；`http-browser-final.log` / `http-browser.json` |
| `npm.cmd run test:e2e -- tests/e2e/content.spec.ts` | 退出 0；既有内容 4/4，`content-root.log` |
| `node .cache/studio-m2/site-smoke.mjs` | 退出 0；本轮根/base × Chromium/WebKit 四组合，`site-smoke.log` / `smoke.json` |
| 隔离复制仓库的真实 CLI / Windows PTY | 两次启动、Ctrl+C 释放锁、同端口重启；`console.json` 与工具输出。PowerShell PTY 因 Ctrl+C 报中断退出 1，如实记录；独立 CLI IPC 正常退出码 0 由 unit 断言 |
| 内联 Node 文档/范围审计，`git diff --check` | 退出 0；`scope-audit.json` / `final-audit.json`，160 个非目标文件哈希未变 |

本机文件/端口/子进程与浏览器测试在正常 Windows 权限下执行；浏览器复用进程级 `PLAYWRIGHT_BROWSERS_PATH=D:\hjk202\.cache\studio-m0\browsers`，未下载依赖、改全局设置或绕过 TLS。初次完整 unit 命令因自动审批超时未启动，按工具允许重试一次后实际执行；不是安全拒绝，也未把超时记成测试失败/通过。

**专项证据**：真实 HTTP draft/article/note 与过滤、无正文列表、validate 不写文件、重复 slug/旧 revision/外部编辑冲突、准确删除；全部内容路由缺 token 401，伪造/重复 Host-Origin-Fetch Metadata、Origin:null、token 重复及路径/编码/未知 envelope/query 被拒绝。坏 JSON/非法 UTF-8/媒体/压缩、声明长度与 chunked 超限、源 16 MiB 超限、两条慢正文占满并发后 503、15 秒正文超时、5 秒慢请求头、断开/关闭未完成正文均有独立预期。真实异常中注入路径/token/body canary 后响应仍无泄漏；不支持的 Expect/Upgrade 不产生功能入口，半开 Upgrade 客户端不能拖住 close。实际 CLI 在不同 cwd 从模块定位隔离仓库，启动/正文操作输出不含凭据/正文/内部路径；同仓库单实例、不同仓库端口占用、重复 close 和重启旧 token 失效均通过。

**浏览器与截图**：两引擎真实同源请求完成配对/新建/读取/修改/校验/删除，过期删除 409，未鉴权读取 401；没有 Cookie/localStorage/sessionStorage，截图 `pairing-chromium.png` / `pairing-webkit.png` 仅显示中性说明（已查看 Chromium 图）。不同站点 localhost 页尝试读取配对/草稿、携带 token 的自定义头读取/JSON 写入、no-cors 简单写入、HTML form CSRF、跨站顶层配对均拒绝，源字节不变。所有 pageerror 均记录并断言：正常配对/CRUD 及 Chromium 为 0；WebKit 对五次故意拒绝的跨源 fetch 报 **5 条预期 access control pageerror**，数量/目标逐条核对，不过滤、不宣称该负例组 0 pageerror；无意外错误。网站四组合均 0 pageerror/失败请求，覆盖 Home→Think→文章、HTML 公式/日期、刷新、返回、Spotlight 搜索与真实计数；图片证据如 `base-webkit-article.png`。

**开发失败与修复**：保留 `http-unit.log`、`http-targeted.log`、`test.log`、`lint.log`、`typecheck.log`、`http-browser.log`。初轮测试客户端未给 DELETE/GET 正文声明长度，触发协议解析失败；修正真实请求帧，服务也避免已处理连接再写第二个错误响应。首次 CLI 的 Node fetch 带 mode:cors、无 site/dest，被配对判定误拒；为可信无浏览器元数据客户端修正分支，并重验浏览器跨源仍拒绝。修正浏览器 callback globals 声明、测试 header union 类型和过时属性提示。WebKit 跨源负例的 pageerror 按真实预期保留/断言；没有弱化任何网站测试、安全要求或屏蔽异常。

**限制与停点**：仍继承 M1 对普通文件 symlink 建链 EPERM 的 1 个 skipped、同权限外部进程最终 CAS 竞争/断电与陈旧锁人工恢复限制；真实 junction/hardlink/ADS 回归保留并通过。HTTP 会话不是账号隔离，其他本机程序能主动配对；没有外网监听/远程服务。超时约束接收与 socket，不是同步文件操作的抢占式执行期限。未运行全套默认 E2E、发布/extension/design/mobile/Vault 专项或真机，不冒充完整发布验收；本轮未重跑 M1 七次 CRUD 构建矩阵（M1 原代码未变，历史证据保留），已运行上述 HTTP 专项及实际网站根/base smoke。

**范围收尾**：164 个初始文件中的 160 个非目标文件哈希保持（含已有修改的 AGENTS、M0/M1、package-lock、真实作者源），package 除启动脚本外等同基线，网站架构/Phase 1–6 约定及历史完成记录保留。新增源/测试仅上述六个文件，25 个公开产物无 Studio/配对/token/fixture，HEAD 未变、暂存区仍为空、原先未跟踪文件不被暂存。M2 三项 Done Criteria 满足，M0–M2 Done、M3/M4 Pending、M5/M6 Deferred，无实施项 In Progress；保留全部已有未提交工作，未开始 M3，未提交、推送或发布，完成后停止。

### 9.11 Studio M3 Completion Record（2026-10-16，Done）

**授权与实际变更**：用户仅授权基础 PC Web Editor、对应验证与同步文档，保留已有未提交改动，不进入 M4，不提交/推送/发布。新增 `studio/web/{index.html,main.ts,api.ts,styles.css,env.d.ts}`、`studio/vite.config.ts`、`studio/server/web.ts`、`tests/unit/studio-web.test.ts`、`tests/studio/playwright.config.ts`、`tests/studio/editor/editor.spec.ts` 十个文件。修改 `studio/server/{http,main}.ts` 的受限 UI 接点，Studio tsconfig 纳入 Web/配置/浏览器测试，package 增加独立构建/验证命令，显式声明已有 Vite 8.3.4；M2 CLI unit 只补三份非敏感静态 fixture，使 unit 不依赖预先构建 Web。同步 PLAN/README/MAINTENANCE；M0/M1、六项内容 HTTP 路由/认证、网站输入与作者内容保持。

**交付行为**：左侧列表/状态筛选/新建/刷新，右侧 metadata 与 Markdown textarea、显式校验/保存/删除确认、文件名/revision 与源/候选状态。保留已有字段省略/无修改字节，不渲染源 HTML，不改已有 slug；新建先只在内存，默认 draft/article、不填日期。普通失败保留缓冲，旧 revision/源消失/会话失效阻止覆盖与重试，无法确认落盘时先人工核对。切换/新建/重新读取有丢弃确认，刷新/关闭有 beforeunload；只刷新列表不动编辑缓冲。读取/list 序号、输入版本及保存快照保护乱序响应，保存过程中继续输入仍保持未保存状态。

`npm.cmd run studio` 先 `studio:build` 再启动原生同源服务，根页交付凭据后在客户端移除节点，token 与正文仅在内存。Vite 不启动 dev server/WebSocket、不输出到网站 dist，不从 public 复制资产。后端只在可信启动时读固定三份普通构建文件（拒绝链接/不安全真实路径/过大/缺失），内存中映射两个静态 URL；不提供目录兜底。根页 CSP 只放行本机脚本/样式/连接，无内联脚本执行；API-only 启动保持 M2 兼容且不需要 Web。没有预览实现、AI、Agent/MCP、其他模块编辑、Git 操作或发布端点。

**实际命令与结果**（证据前缀 `.cache/studio-m3/`）：

| 命令 | 实际结果 / 证据 |
| --- | --- |
| `npm.cmd install --package-lock-only --ignore-scripts --offline --no-audit --no-fund` | 退出 0；仅根增加 Vite 直接声明，438 个非根 lock 条目完全不变，无新增版本/升级；`lock-audit.json` |
| `npm.cmd run studio:build` | 退出 0；三个固定文件仅 `.cache/studio/web/`，无 sourcemap，`web-build.log` 及后续 studio:test 构建日志 |
| `npm.cmd run lint` | 退出 0；`lint-release.log` |
| `npm.cmd run typecheck` | 退出 0；Astro 149 文件零错误/警告/提示，Studio 严格 NodeNext 含新 Web/配置/测试；`typecheck-release.log` |
| `npm.cmd run test` | 退出 0；78 项：77 通过、0 失败、1 个继承的普通文件 symlink 权限 skipped；两项新增受限静态服务/失败启动负例通过，`test-initial.log` |
| `npm.cmd run build` | 退出 0，含原 prebuild；9 HTML 页面、25 文件，`build.log` |
| `npm.cmd run build -- --base /personal-space/ --outDir .cache/studio-m3/base-dist` | 退出 0；独立 base 产物，`build-base.log` |
| `npm.cmd run studio:test` | 退出 0；13 通过、0 失败、1 skipped（WebKit 无 CDP IME 接口）；两个引擎完整实际 UI，`editor-release.log` |
| `node --experimental-strip-types tests/studio/http.smoke.mjs` | 退出 0；原 API-only 双引擎配对/CRUD/CSRF 回归，`http-regression.log`；该脚本按原实现写 M2 缓存，本轮 JSON 另复制到 `http-browser-regression.json` |
| `npm.cmd run test:e2e -- tests/e2e/content.spec.ts` | 退出 0；原内容 4/4，`content-root.log` |
| `node .cache/studio-m3/site-smoke.mjs` | 退出 0；网站根/base × Chromium/WebKit 四组合，`site-smoke.log` / `smoke.json` |
| 隔离仓库 `npm.cmd run studio -- --port 4778`，真实 Windows PTY/浏览器 | 自动构建、编辑器读取非敏感源、配对节点移除、0 pageerror；Ctrl+C 清锁，Windows batch 提示后输入 Y，PTY 中断退出 1 如实记录；`cli-browser.json` / `cli-editor.png` 与工具输出 |
| 内联 Node 范围/依赖/文档审计、`git diff --check` | 退出 0；`scope-audit.json` / `lock-audit.json` / `final-audit.json` |

浏览器/文件/端口/子进程验证使用正常 Windows 权限，复用进程级 `PLAYWRIGHT_BROWSERS_PATH=D:\hjk202\.cache\studio-m0\browsers`，未更改全局环境/系统权限或下载新版本。测试只写已核验的 `.cache/studio-m3/{unit,browser,console}-*` 隔离目录；公开作者源与既有未提交源码用哈希保护。没有 trace/HAR，避免落盘 token/正文；仅非敏感样本截图。

**浏览器契约证据**：空态 → 新建不落盘 → 草稿校验/保存 → 无效日期拒绝且缓冲保留 → 公开 note → 过滤 → 删除取消/确认；文件名与 slug 不同的原文件无修改字节、仅正文/注释/省略字段保留，未知字段源只读且不可空文档覆盖。切换/新建/重新读取取消、刷新列表不丢稿、刷新/关闭标签的真实 beforeunload 取消、Ctrl+S 保存均通过。两标签旧版本及外部追加触发 409，不写坏源，重新读取必须确认丢弃；故障注入文件失败、服务断开、服务重启导致旧会话无效均保留缓冲，不自动配对/重试，列表发现会话失效也禁用写入。

主动延迟 read/list/validate/PUT 响应，核对后选文档/新筛选/新输入/保存期间继续编辑不会被迟到数据覆盖，旧报告不套到新版本，保存基线只覆盖提交快照。Markdown 中 HTML/事件属性始终为 textarea 文本，未执行、无远程请求；配对节点移除，无 Cookie/localStorage/sessionStorage。编辑器所有实际页面的 pageerror 全量断言为 0；M2 跨源负例中的 5 条预期 WebKit access-control pageerror 另保留并完整核对，不过滤。源字节、删除目标和公开状态由独立文件/实际 Astro frontmatter 解析交叉验证。

**IME、截图与支持限度**：Windows Chromium 通过 CDP `Input.imeSetComposition` / `Input.insertText` 实际执行浏览器组合输入，组合期间按钮禁用、Ctrl+S 不写入，提交后 Enter/键盘保存正确。WebKit 无此接口，该子项明确 skipped，不用手工派发 DOM 事件冒充真实组合输入；其中文字段、CRUD、快捷键与关闭保护通过。未验证 Windows 各输入法候选窗或真人输入体验，不冒称用户验收。截图位于 `test-results/editor-empty-list-…-{chromium,webkit}/editor.png` 与 `cli-editor.png`，已查看 Chromium 编辑页；所有内容为隔离样本。网站四组合均 0 pageerror/失败请求，覆盖真实 Think/公式/日期/刷新/返回/Spotlight/Home/count。

**失败与修复**：保留 `types-initial.log`、`typecheck-beforeunload-hint.log`、`editor-initial.log`、`editor-second.log`、`editor-third.log`。修正严格类型下 web 的显式类型与 Vite CSS 声明；用现代 preventDefault 移除 beforeunload 过时属性，并重验两引擎关闭/刷新保护。实际测试发现 select 包裹标签的名称含选项，补明确可访问名称。早期 fixture 先放坏源导致 M1 正确阻止整目录写入，调整为先验证正常操作再加入坏源，未放宽目录规则。测试改用实际 Astro 解析核对带引号 kind，而非把某一种 YAML 排版当契约；验证实际禁用的输入控件，不误把 fieldset 当可编辑控件。延迟响应探针先完成 route 再卸载，刷新对话框等待实际关闭后才验证关页，解决测试自身时序；初次整轮已中断定位，后续完整通过。临时 CLI 探针最初未等待异步读取，改为实际条件等待后通过。无测试删除、安全降级、异常过滤或 M1 语义变化。

**收尾与未运行项**：161 个非目标文件哈希不变，包含已有修改的 AGENTS、M0/M1、内容模型、真实 Think 与其余网站输入；package 只改指定 Studio 脚本/直接 Vite，438 个既有非根依赖条目不变。网站架构/Phase 1–6 约定和历史完成记录保持，根 dist 25 文件无 Studio/配对/fixture，Web bundle 不含 fs/loader/作者内容；新增十文件/修改九个既有文件均在本项范围，HEAD 未变、暂存区为空，原未跟踪文件仍未暂存。未运行发布/完整默认 E2E、mobile/design/extension/Vault 专项和真人输入法验收，未重做 M1 七构建矩阵；本项仅执行上列相关检查，不冒称完整发布/首版验收。M3 三项 Done Criteria 满足，M0–M3 Done、M4 Pending、M5/M6 Deferred，无实施项 In Progress。保留已有未提交改动，未开始 M4，未提交、推送或发布，完成后停止。


### 9.12 Studio M4 Completion Record（2026-10-16，Done）

**授权与实际变更**：用户只授权隔离预览、首版验收和同步文档，保留已有未提交工作，不进入 M5/M6，不提交/推送/发布。新增 `studio/contracts/preview.ts`、`studio/server/think/{preview.ts,preview-html.ts,preview-build.mjs}`、`tests/unit/studio-preview.test.ts`、`tests/studio/editor/preview.spec.ts` 六文件。修改既有错误联合类型、HTTP/启动说明、Web API/按钮/面板/取消与失效处理，测试配置输出改到 M4 缓存；原 HTTP 测试只调整已开放 preview 的路由预期/API-only 文案。package/lock 只显式声明已经安装的 `@astrojs/markdown-satteri@0.4.3`、`ultrahtml@1.7.0`、`entities@4.5.0`，没有版本升级或新增依赖实体。同步 PLAN/README/MAINTENANCE；M0/M1 实现、文件 CRUD/认证规则、网站源码和真实作者内容保持。

**交付与最小调整**：复用 M1 校验与文件身份，独立异步预览服务接受 `{document,key?}`，完整候选在受控副本中临时 published:true；真实 Astro 构建后重建静态文章 HTML，保留模板 CSS/scoped 属性、公式、代码及受限本地图片。成功返回 `{html,fingerprint,blockedResources,cleanupPending}`，不再需要最初设想的预览资源 URL/通配路由；HTML 和 data 图片自包含，避免增加目录静态服务和过期资源存储。前端用无权限 sandbox srcdoc 展示，不隐式保存；修改/保存/切换/删除使旧预览失效，取消/断线/超时/关闭停止构建并清理自有 job。没有实时预览、通用任务队列、素材上传、MDX、其他模块/Vault 编辑、AI、Agent/MCP 或 Git/发布功能。

**实际命令与结果**（除特别说明外，证据前缀 `.cache/studio-m4/`）：

| 命令 | 实际结果 / 证据 |
| --- | --- |
| `npm.cmd install --package-lock-only --ignore-scripts --offline --no-audit --no-fund` | 退出 0；三项已有版本直接声明，438 个非根 lock 条目逐项保持，`lock-audit.json` |
| `npm.cmd run lint` | 退出 0，零 warning；`lint-complete.log` |
| `npm.cmd run typecheck` | 退出 0；Astro 155 文件零错误/警告/提示，Studio 严格 NodeNext 含新增源/测试；`typecheck-complete.log` |
| `npm.cmd run test` | 退出 0；82 项，81 通过、0 失败、1 个继承的普通文件 symlink 权限 skipped；四组 M4 单元全部通过；`test-complete.log` |
| `npm.cmd run build` | 退出 0，保留原 prebuild；9 HTML 页/25 文件；`build-complete.log` |
| `npm.cmd run build -- --base /personal-space/ --outDir .cache/studio-m4/base-dist` | 退出 0；9 HTML 页的独立 base 产物；`build-base.log` |
| `npm.cmd run studio:test` | 退出 0，独立 Web build 和双引擎 UI；23 通过、0 失败、1 skipped（WebKit 无 CDP IME），新增 M4 十项全部通过；`studio-browser.log` / 最终 `studio-release.log` |
| `npm.cmd run studio:test -- --grep 'unsaved candidate'` | 退出 0，补充真实 Article max-width/scoped 样式及滚入视口的截图；根/base × 两引擎 4/4；`preview-visual.log`、`test-results/preview-*/{article-preview,preview}.png` |
| `node --experimental-strip-types tests/studio/http.smoke.mjs` | 退出 0，API-only 双引擎配对/CRUD/CSRF 回归；`http-smoke.log`；原脚本写 M2 缓存，本轮 JSON 复制到 `http-browser.json` |
| `npm.cmd run test:e2e` | 退出 0，既有网站完整默认 Chromium 回归 75/75，包含内容、导航/搜索、响应式、Vault 非敏感隔离 fixture；`site-e2e.log`、根 `test-results/` |
| `node .cache/studio-m4/site-smoke.mjs` | 退出 0，复用 M3 探针仅替换缓存前缀；根/base × Chromium/WebKit 四组合，0 pageerror/失败请求；`site-smoke.log` / `smoke.json` / `*-article.png` |
| `node .cache/studio-m4/audit.mjs`、`git diff --check` | 退出 0；165 个非目标文件、六个新增文件白名单、依赖、文档与产物边界；`scope-audit.json` / `lock-audit.json` / `final-audit.json` |

浏览器/HTTP/原子文件/子进程验证使用正常 Windows 权限；复用进程级 `PLAYWRIGHT_BROWSERS_PATH=D:\hjk202\.cache\studio-m0\browsers`，未修改全局系统设置、下载新版本或使用真实私人源/口令。Studio 测试无 trace/HAR，截图仅非敏感隔离样本。首次预览与根/base 网站构建均是实际 Astro，未用伪渲染代替；只有“迟到响应”单项按目的主动延迟固定非敏感响应。

**首版浏览器链路**：原 M3 空列表→新建/草稿保存→校验→公开 note→确认删除、注释/省略字段/无修改字节、两标签/外部编辑冲突、断线/会话失效、关闭保护及乱序响应均回归通过；真实 Chromium IME 组合输入仍通过。M4 在 fixture 把真实文章仅在副本中改为 draft，再输入未保存正文；预览真实公式/中文长文/代码转义/本地 SVG，源字节、draft 状态与未保存标记不变。分别以根 article / base note 显式保存后真实公开构建，实际浏览器打开 Compass→Think 列表/详情→刷新→返回→Spotlight→Home，核对 count/search；note 首页含候选正文。取消公开→再次构建后 count/search 为 0、详情真实 404、列表空态；精确删除→再次构建仍空、共享图片保留。两种 base、两个引擎四组合均通过。

**安全、失败和恢复**：真实 Markdown 加入 script/事件属性/iframe/form/远程 img/link/CSS URL，受控文章中无可执行或可导航入口；sandbox 无同源能力，父页 DOM/凭据不可读，父页探针未被修改。HTTP tripwire 实测浏览器及构建期请求均为 0；可信 fixture 允许远程优化图片后，仍在构建 fetch/TCP 层被拒绝为 PREVIEW_RESOURCE_BLOCKED；本地 Markdown 图片越界同样拒绝。新 HTTP 单元另验证 preview 的 401、额外路径/查询 400、不完整候选 422，拒绝时不创建预览目录/源。输出投影单元以实际存在的外部图片验证编码斜杠、Windows 反斜杠/盘符不被读取，CSS import 拒绝，过大结果使用 PREVIEW_TOO_LARGE。

单元实测 1ms 子进程超时、并发拒绝、关闭；浏览器实测超时 504→重启→取消→故意构建失败→修复后成功。每步检查自有 job 清空、源不变；编辑后旧 frame 清除，主动延迟的旧结果不回写新缓冲。全部 Studio 正常/负例页面的 pageerror 全量断言为 0，不过滤；旧 M2 跨源负例仍保留并完整核对 WebKit 五条预期 access-control pageerror，正常配对为 0。根 dist 在预览期间的 25 文件 SHA-256 未变，记录 `dist-before-preview.json` / `dist-preview-audit.json`。

**视觉与支持限度**：已查看实际 Chromium iframe 截图，真实文章标题/正文/样式可读，代码/公式/本地图片由浏览器断言交叉验证。初次 fullPage 截图中，视口之外 iframe 未被绘制；补为先滚入视口并单独截取 iframe，四组合和真实 scoped CSS 断言均通过，不以空白图当证据。最终截图在 `test-results/preview-*/article-preview.png`；网站截图与四组合结果见 `smoke.json`。WebKit IME CDP 子项沿用明确 skipped，不模拟 DOM 事件冒充实际输入法；未验证真人 Windows 输入法候选窗体验，不宣称用户验收。

**构建/清理限度**：构建最长 90 秒、一个任务无队列；复制/预检另有文件数/尺寸限制，不承诺整次操作硬实时中止。Node permission 的 JS 文件读写限制、图片预检、禁网 hook 与 CSP/sandbox 针对可信当前项目及普通 Think Markdown 分层保护；Astro/Vite 所需 native addons/worker 仍有官方权限限制，**不是恶意 JS/配置/依赖的 OS 沙箱**（依据见 6.8.5）。不得接收外部 MDX、任意配置/命令或宣传完整恶意代码隔离。图片不能越出临时 src/public，public 仅复制图片，不分发密文/脚本/map；复杂 SVG/远程资源/网站交互不承诺还原。正常成功/失败/取消/超时的自有 job 实测清理；身份检查/权限失败返回 cleanupPending，不擅删未知或被替换目录，强杀遗留需按手册人工核对。未声称故障注入验证每种 Windows 清理权限失败，也不保证任意同权限恶意进程替换目录的绝对隔离。

**失败修复记录**：保留初始 lint/类型诊断、`permission-probe*.log`、`preview-browser-initial.log`。按实际 Astro API 改用字符串 outDir/cacheDir；关闭遥测、把用户配置/临时目录限制在 job，并以派生 workspace sentinel 避免 Vite 向上扫描，不改根 workspace。兼容现有 native addon/worker 后真实构建成功，同时保留并说明权限限制。修复 URL 类型/ESLint、finally 控制流和 Windows 盘符/相对路径边界；补保留真实 ModuleShell scoped 属性。初次双引擎安全测试因 a 定位器匹配“返回 Think”和探针两项而 strict-mode 失败，改为断言所有 `a[href]` 数量为 0，未降低安全目标，完整回归通过。审计脚本最初把手册 Markdown 示例当真实链接，按 Markdown 语义排除围栏/行内代码后再检查真实链接；未删除手册示例或跳过真实链接。

收尾视觉检查另发现全量转义 CSS 的 `<` 会破坏 Astro 优化后的 `width<=...` 媒体查询，改为只转义潜在闭合 style 标签的序列。新增单元断言保留真实媒体查询文本、四组合浏览器断言真实 CSSMediaRule 可用；修复后重新运行 lint/typecheck/unit/build 和完整 Studio 双引擎验收，最终日志使用上表 complete/release 文件。

**收尾**：180 个初始源码/文档中的 165 个非目标文件哈希保持，含原有 AGENTS、内容模型/M0/M1、真实作者文章和其余网站输入；15 个既有目标文件与六个新增文件均限 M4。438 个非根依赖条目不变，公开 25 文件无 Studio/候选/配对数据，Web bundle 不含 fs/loader/作者正文，历史 Studio 完成记录逐字保留。文档相对链接/围栏/状态和 Git 空白检查通过，HEAD 未变、暂存区仍为空，原先未跟踪文件仍未暂存。没有运行发布/推送、真人输入法/其他 OS/移动端 Studio 验收；未重跑旧 M1 七构建矩阵及非默认 extension/design 专项，M4 用真实 UI+四组合独立构建覆盖要求的首版链路，不冒称这些未运行项。M4 三项 Done Criteria 满足，**M0–M4 Done、首版本地验收完成，M5/M6 Deferred，无实施项 In Progress**。保留所有已有未提交工作，未进入 M5/M6，未提交、推送或发布，按授权停止。


### 9.13 Studio M5 Implementation / Verification Record（2026-10-16，In Progress）

**授权/范围**：本轮用户只授权 AI 文本建议及其验证/文档，随后明确选择阿里云百炼 DeepSeek V4.1 Flash；按官方文档核实模型 ID 为 `deepseek-v4.1-flash`，不擅自选其他模型或服务。M0–M4 Done 保留，不进入 M6、不提交/推送/发布。已保存 186 个初始文件哈希与 HEAD/index 状态，保护已有未提交工作。当前缺少本机 Key/Base URL；实现与确定性验证完成，**真实调用待验，M5 不标 Done**。

**实际文件**：新增 `studio/contracts/ai.ts`、`studio/server/ai/{config,suggest}.ts`、`tests/unit/studio-ai.test.ts`、`tests/studio/editor/ai.spec.ts`、`tests/studio/ai.live.mjs` 六文件。修改十个既有目标：PLAN/README/MAINTENANCE、Think 错误联合、HTTP AI 接点/该接口独立接收限额/关闭等待、Web API/index/main/styles、Studio 测试输出目录。未修改 package/lock、网站源码/真实文章、M0/M1/预览实现、旧测试断言、构建/部署配置，没有 SDK、Provider/workflow/MCP/Agent 或其他模块编辑。

**交付行为**：单一百炼后端接受严格 `{operation,input}`，只向官方 workspace HTTPS 端点发送固定编辑指令和明确输入；五个 operation 是 polish/rewrite/summarize/generateTitle/generateSummary。AI 服务不导入文件系统/Authoring service，不能 CRUD、发布或变更 published。GET /suggest 仅报告模型与可用状态；POST /suggest 同样需要本机 token/Host/Origin，拒绝 path/key/document/revision/模型/Key/端点覆盖。无 Cookie/CORS/任意代理/重定向/工具/对话记录，固定关闭思考与流式、4096 输出 token、单实例一个请求、60 秒超时，无队列或自动重试。

前端明确展示发送的当前正文，只读快照不是第二套可编辑正文；不发送 metadata/文件名/revision/其他文章。结果以只读 textarea 文本显示，不执行 HTML；点击采纳才替换正文或 title/summary 缓冲，之后按原校验/expectedRevision 显式保存。丢弃、编辑/换操作/切换/保存清理旧建议；请求取消、迟到响应和失败均保留原文。无配置时禁用 AI 请求，CRUD/校验/预览仍正常。模型鉴权失败映射 AI_AUTH_FAILED/502，不误当本机 UNAUTHORIZED/401 锁编辑器。

**实际命令与结果**（证据前缀 `.cache/studio-m5/`）：

| 命令 | 实际结果 / 证据 |
| --- | --- |
| `npm.cmd run lint` | 退出 0，零 warning；`lint-final.log` |
| `npm.cmd run typecheck` | 退出 0；Astro 161 文件零错误/警告/提示，Studio NodeNext 纳入全部新契约/后端/Web/测试；`typecheck-final.log` |
| `npm.cmd run test` | 退出 0；89 项，88 通过、0 失败、1 项继承的普通文件 symlink 权限 skipped；新增七组 AI 单元全部通过，`test-final.log` |
| `npm.cmd run build` | 退出 0，保留 prebuild；9 HTML 页/25 文件，`build-final.log` |
| `npm.cmd run build -- --base /personal-space/ --outDir .cache/studio-m5/base-dist` | 退出 0；独立 base 产物，`build-base.log` |
| `npm.cmd run studio:test` | 退出 0，独立 Web build + Windows Chromium/WebKit；34 项中 33 通过，1 项继承 WebKit 无 CDP IME skipped；新增 AI 十项全部通过，编辑/预览旧用例均保持；`studio-browser.log` |
| `npm.cmd run studio:test -- ai.spec.ts --output .cache/studio-m5/ai-final-results` | 退出 0；最终非法文本保护后 AI 10/10，两引擎 0 pageerror；`ai-browser-final.log` |
| 进程内非敏感 Key/Base URL canary 下 `npm.cmd run studio:build` | 退出 0；构建后还原环境，bundle/HTML/日志无 canary 或后端环境配置，`web-env-canary.log` / `audit.json` |
| `node .cache/studio-m5/site-smoke.mjs` | 退出 0；复用原探针仅改缓存前缀，网站根/base × 两引擎四组合，0 pageerror/失败请求；`site-smoke.log` / `smoke.json` / `*-article.png` |
| `node --experimental-strip-types tests/studio/http.smoke.mjs` | 退出 0；API-only 配对/CRUD/CSRF 双引擎回归，原脚本写 M2 缓存，复制当次证据到 `http-browser.json`；`http-smoke.log` |
| `node --experimental-strip-types tests/studio/ai.live.mjs` | **退出 1：AI_NOT_CONFIGURED**；无 Key/Base URL，前置检查失败，未调用真实服务；`live-unconfigured.log` / `live.json` 的 operations 为空、complete:false，不能记通过 |
| `node .cache/studio-m5/audit.mjs`、`git diff --check` | 退出 0；六个新增文件/十个目标白名单、176 个非目标哈希、package/lock、历史记录、链接/围栏、公开产物与 Web bundle/日志边界，`audit.json` |

工具使用正常 Windows 权限，浏览器沿用进程级 `PLAYWRIGHT_BROWSERS_PATH=D:\hjk202\.cache\studio-m0\browsers`，无新下载/权限降级。全部内容/配置 fixture 明确非敏感，仅在核验的 `.cache/studio-m5/{unit,browser}-*` 内写入并安全清理；真实作者源不参与 AI 请求。Studio 无 trace/HAR，截图仅非敏感样本。Key presence 检查仅返回是否配置，不读取显示环境值；真实 Key 从未提供或记录。官方模型/协议依据见 6.8 M5，未引用非官方接口推测。

**确定性契约证据**：配置仅接受选定官方 workspace HTTPS/path，拒绝 HTTP/欺骗域/URL 凭据/查询/错误 Key 字符；缺少/非法配置不发请求。输入严格 operation/input，保留中文/Markdown/空白，拒绝未知字段/路径/覆盖模型/Key、空文/不合法 Unicode/控制符/32 KiB 超限。实际本机 HTTP 上游逐项核对 Authorization 只在后端、消息只有固定 system+所选 input、无工具/额外 context、五次显式请求各一次。空/坏 JSON、UTF-8/文本损坏、截断、工具、空结果、Key 回显、结果/JSON 超限，401/403/429/500、真实 socket 超时/取消/关闭/并发拒绝均有稳定错误，不反射原始响应、输入或 Key，不自动重试。结果上限 32 KiB，原始响应/请求 envelope 各限 128 KiB。

**浏览器行为证据**：五种操作分别请求→展示未采纳→人工采纳→字段/未保存标记变化；每次返回/采纳前后源字节不变，published:false 保持，最终显式校验/保存才写入；之后外部追加源触发 REVISION_CONFLICT，AI 缓冲保留、外部版本未覆盖。丢弃/换操作/修改标题使旧建议失效，HTML/script/image 输出仅为文本、未执行、无浏览器远程请求。上游鉴权/限流/截断/超时保留输入且普通保存仍可用；取消与主动延迟已经完成的响应不回写新输入；无配置时 AI 禁用但保存照常。全部 AI/常规 Studio 页 pageerror 全量断言为 0，无过滤；M2 跨源负例仍完整核对五条 WebKit 预期 access-control pageerror，正常页面无错。已查看 Chromium 实际采纳页截图；`test-results/ai-*/ai-editor.png` / `ai-final-results/ai-*/ai-editor.png` 与 `ai-browser-boundaries` 附件记录双引擎行为/请求边界。

**未完成的真实验证与下一步**：当前运行环境的 `DASHSCOPE_API_KEY` / `DASHSCOPE_BASE_URL` 均未配置，不能通过现有源或猜测得到作者业务空间/凭据。用户随后明确选择稍后配置，本轮只完成实现及模拟验证，真实调用待验、M5 不标 Done。安全隐藏输入与五次非敏感实测命令已准备在 MAINTENANCE 9.3.4；作者只需本机运行，无需向聊天提供 Key。应取得实际 `live.json` 五项成功/complete:true，结合本轮已通过的浏览器交互/网络/产物证据更新 M5 验收状态；不是用当前 complete:false 文件或模拟上游签收。模型可用地域/权限、费用、内容外发及生成质量仍需实际账户/结果核对；提示词不保证不编造，必须人工采纳。此处保留 PLAN 原“获准的实际模型调用”Verification，不为本轮进度修改验收条件。

**限制/收尾**：本轮未运行真实百炼服务、真实文章外发、真实模型质量/费用验收、真人输入法/移动端 Studio/其他 OS、完整默认网站 75 项/其他非默认专项或发布；原 M4 完整验收记录保留，未将上轮结果冒充本轮。本轮先修复 live mjs 的 Buffer 显式导入 lint 问题（`lint-second.log`），没有删测试/吞异常/弱化规则；再补非法模型文本拒绝并重跑相关门槛/AI 交互。176 个非目标文件 SHA-256 不变，含既有 AGENTS、M0/M1/预览实现、真实 Think/所有网站输入和旧测试；package/lock 与全部 438 个依赖条目原样保留。根/base 公开产物无 Studio/AI fixture/凭据，Web bundle 不含后端/模型端点/Key/文件逻辑/作者正文，日志无非敏感 Key canary。历史 M0–M4 完成记录原样保留，HEAD 未变、暂存区仍为空，原未跟踪文件仍未暂存。**M5 In Progress（实现/本地模拟验证完成，真实调用待配置验收），M6 Deferred**；保留已有工作，不提交、推送或发布，当前停在真实验收前。

### 9.14 Studio M6 Completion Record（2026-10-16，Done）

**授权/状态**：用户明确指定 M6 Agent adapter、该项验证与文档，M5 继续真实调用待验；随后选定轻量 Node/JSON stdio，调用原 HTTP、不新增 MCP 或依赖。本轮仅 M6 从 In Progress 实施并在全部标准满足后标 Done；M0–M4 保持 Done，M5 记 Awaiting Verification、不标 Done。M6 不依赖 M5，没有执行真实模型调用或把模拟结果当真实验收。

**实际变更**：新增 `studio/adapters/agent/client.ts` / `main.ts`，严格五项操作 listThink/readThink/createDraft/validateThink/saveThink，经同一 HTTP/Think 服务调用；默认只读、可信启动 `--allow-write` 才开写权限，新建禁止公开，保存保留 published 值/省略状态及完整候选/expectedRevision。stdout 只返回 JSON-lines，token 只在内存与 HTTP 头，拒绝远程 origin/重定向、任意路径/额外字段/未来操作。128 个请求 id、24 MiB 单行/响应、64 KiB 配对与 20 秒超时有界；重复 id 不执行、写后失联标未知结果且不重试。新增 `tests/unit/studio-agent.test.ts` / `tests/studio/editor/agent.spec.ts`，只修改 `studio/tsconfig.json` 的 adapters 类型检查范围；PLAN/README/MAINTENANCE 同步状态、协议、操作与恢复说明。网站、原 HTTP/文件/AI/UI 实现、package/lock 均未改。

证据统一放在忽略的 `.cache/studio-m6/`，本轮实际运行：

| 命令 | 实际结果 / 证据 |
| --- | --- |
| `npm.cmd run lint` | 最终退出 0；`lint-verified.log` |
| `npm.cmd run typecheck` | 最终退出 0，Astro 165 files、0 error/warning/hint，Studio 严格 tsc 通过；`typecheck-complete.log` |
| `npm.cmd run test` | 最终退出 0，96 tests 中 95 passed、0 failed、1 既有普通文件 symlink Windows EPERM skipped；新增 Agent 七项全通过；`unit-verified.log` |
| `node --experimental-strip-types --test tests/unit/studio-agent.test.ts` | 本机实际 7/7，真实子进程/stdin/stdout 与 API-only 服务器，无 UI；`agent-tests-native.log`、`protocol-evidence.json`；最终完整 unit 再覆盖全部 Agent 测试 |
| `npm.cmd run build` | 最终退出 0，包含原 prebuild 公开/Vault 边界校验，根 dist 25 文件；`build-verified.log` |
| `npm.cmd run build -- --base /personal-space/ --outDir .cache/studio-m6/base-dist` | 退出 0，隔离子路径构建，不覆盖根 dist；`base-build.log` |
| `npm.cmd run studio:test -- --output .cache/studio-m6/test-results` | 退出 0，独立 Web build 后 Chromium/WebKit 合计 35 passed、1 既有 WebKit CDP IME skipped；新增 Agent/Web 两项通过；`studio-browser.log`、`test-results/` |
| `npm.cmd run test:e2e` | 退出 0，完整默认网站 75/75；`site-e2e.log` |
| `node .cache/studio-m6/site-smoke.mjs` | 退出 0，根/base×Chromium/WebKit 四组合，公开 Think 导航/公式/日期/刷新/返回/搜索/count 全通过，0 pageerror/失败请求；`smoke.json`、四张文章截图 |
| `node --experimental-strip-types tests/studio/http.smoke.mjs` | 退出 0，API-only 配对/CRUD/CSRF/跨源拒绝两引擎通过；WebKit 5 条预期 CORS pageerror 全量保留并核对，正常页无错；`http-smoke.log`、复制当次 `http-browser.json` |
| `node .cache/studio-m6/audit.mjs`、`git diff --check` | 最终退出 0；188 个非目标文件哈希、四个新增/四个目标修改白名单、package/lock、历史记录、相对链接/围栏、公开产物/Web bundle、HEAD/空暂存区核对；`audit.json`、`diff-check.log` |

测试使用获准的 Windows 本机权限运行 loopback、文件与浏览器/子进程；浏览器沿用进程级 `PLAYWRIGHT_BROWSERS_PATH=D:\hjk202\.cache\studio-m0\browsers`，无下载/依赖升级。只有明确非敏感 fixture 写入经过核对的 `.cache/studio-m6/{agent,browser}-*` 并按路径检查清理，不修改真实文章。Studio 无 trace/HAR，协议证据只记录布尔行为，不存 token/正文。读取响应中的正文属于所选 Agent 的协议数据，不作为日志持久化。

**协议/写入证据**：实际 Node stdio 子进程执行五项操作（含只读模式拒绝 create/save），API-only 服务没有 Web 目录/浏览器需求。createDraft 默认 false/article，不完整草稿可保存；重复 id、不同 id 重复 slug、published:true、伪造写授权均明确拒绝。读到的 key/revision 不能替换为路径，未知字段/坏 JSON/坏 UTF-8/非法类型/缺 revision/force/delete/patch/AI 均返回固定错误；坏 slug/frontmatter 字段仍由原校验返回 VALIDATION_FAILED，原文不变。已有非 slug 文件名、注释、published 省略及 true 保持；旧版本/外部修改不覆盖，已公开文章完整规则仍校验。超大输入丢到下个换行后恢复，id 上限/重复/已关闭状态、非法 loopback URL、重定向/坏配对/超时均验证。

本机代理将真实 PUT 提交后丢弃响应，adapter 返回 AGENT_WRITE_OUTCOME_UNKNOWN；磁盘只提交一次、同 id 不重发，随后 read 能核对当前 revision。另一场景在 adapter read 与实际 PUT 之间追加外部修改，原 HTTP/文件服务返回 REVISION_CONFLICT，保留外部字节；adapter 没有另一套写入实现或绕过最终检查。

**浏览器证据**：Agent 保存后 Web 的旧 revision 被拒，输入缓冲 `WEB_UNSAVED_BUFFER` 保留；作者明确重新读取后 Web 保存，再用 Agent 旧 revision 保存也被拒。两引擎均保持原文件名、published:false、注释与实际已保存正文，0 pageerror、0 外部浏览器请求。`test-results/agent-*/agent-web-conflict.png` 已保存，已实际查看 Chromium 截图；`agent-web-boundaries` 附件记录双向冲突。原编辑/隔离预览/模拟 AI 回归全通过，未降低或过滤任何错误断言。

**失败处理与限制**：初次受限沙箱无法完成 loopback，Agent 七项失败；改用获准的本机执行后原七项全通过。修复新增测试的未用 import、输出关闭回调的 TypeScript 返回类型推断问题，再运行实际 lint/typecheck/完整 unit/build 门槛；临时审计脚本的正则转义错误已修复后重跑。未删测试、吞失败或修改原规则。两个 skipped 均为此前明确的平台能力限制，未当通过。MCP/厂商工具自动发现、实际模型 Agent 任务、M5 真实百炼、真人输入法、其他 OS/移动端 Studio、非默认 extension 等独立专项及发布未运行/不适用。当前交付为实际选定的 Node/JSON 协议客户端，未声称已接入具体 Agent 产品。

**范围/停点**：192 个初始文件中的 188 个非目标文件 SHA-256 完全不变，包含已有 AGENTS、M0–M5 源码/测试、真实 Think/网站输入、package/lock；原 M0–M5 历史完成记录逐字保留。新增四文件、修改四既有文件仅限上列范围，公开 25 文件无 Studio/Agent/fixture，Web bundle 无 Agent 后端/文件逻辑，HEAD 未变、暂存区仍为空。M6 两项 Done Criteria 与全部 Verification 满足，标 Done；Studio 路线不整体标完成，因为 **M5 Awaiting Verification（真实调用待验）**。保留全部已有未提交改动，未提交、推送或发布，按本轮授权停止。

<a id="studio-m5-acceptance"></a>
### 9.15 Studio M5 最终验收记录（2026-10-17，Done）

**授权与范围**：作者已在本机配置 Key 并运行实测，明确授权检查结果、完成 M5 剩余验收及同步文档，保留已有未提交改动，不提交/推送/发布。M5 从 Awaiting Verification 恢复 In Progress，全部标准满足后标 Done；M0–M4/M6 Done 不变。本轮没有产品实现或依赖修改，仅修改 PLAN/README/MAINTENANCE，验收脚本/截图/日志放忽略的 `.cache/studio-m5-acceptance/`。原 M0–M6 完成记录按当时事实原样保留。

**作者真实五项记录**：读取并严格核对 `.cache/studio-m5/live.json`，记录时间 `2026-10-17T05:08:45.404Z`（纽约 2026-10-17 01:08:45）；service 为阿里云百炼、model 为 deepseek-v4.1-flash、simulated:false、complete:true，五项顺序/唯一性与当前 AI_OPERATIONS 一致。polish/rewrite/summarize/generateTitle/generateSummary 均 ok:true，输出分别 141/138/114/39/45 UTF-8 bytes，均非空且未超过 32 KiB。只含既定字段，不含 Key/端点/输入/原始响应，原样复制为本轮 live.json；原记录未覆盖，没有重复这五次付费调用。SHA-256 为 `e557b5afa4985cc25bab683d5a587effacd1bce17a1fa31fc5ee53e933cda22f`；生成它的 `tests/studio/ai.live.mjs` 与 M6 基线相同，当前脚本哈希 `c9ab40998f55d4f7978524c55e45e86819b1aced3722b543871f55db3a6b5599`。核对结果见 `live-check.json`，不是模拟结果或把历史 AI_NOT_CONFIGURED 当成功。

**真实 UI 验收**：先只读查询作者现有 `127.0.0.1:4322` 服务，确认 available:true、model 匹配、issue:null，不读取该服务的进程环境或 Key，不重启/关闭该服务。独立 Chromium context 新建仅内存草稿，以脚本内固定非敏感正文作一次真实 polish：输入/输出各 138 bytes，浏览器请求严格只有 operation/input，不发送 metadata/文件/其他文章。请求返回前后原缓冲保持，作者式点击采纳后才替换缓冲，published:false 保持、未保存标记存在；校验返回可保存/尚未公开就绪，更换操作使旧建议失效。页面无 API Authorization 头、无百炼直连/外部浏览器请求、无 pageerror、无 Cookie/localStorage/sessionStorage。期间仅 POST suggest/validate，没有 create/save/delete/preview/Git/deploy；Think 源文件哈希始终相同，关闭独立 context 后丢弃测试缓冲。`live-ui.json` / `live-ui.log` 仅记字节数、布尔结果、固定 method/path，不记录凭据/请求头或原始响应。

已实际查看 `live-ui-after-adopt.png`：本样本文字通顺、含义保持，未新增个人经历；`live-ui-before-adopt.png` 保留采纳前只读建议/原缓冲。截图仅含非敏感测试正文及原列表中已公开文章标题，不含 Key/会话令牌。这是额外一次真实调用，五项脚本结果和 UI 结果分开记录；不宣称所有未来生成事实、费用、质量或云端策略均已验收。

**实际命令与结果**（均本轮执行；Windows npm.cmd，浏览器沿用进程级 `PLAYWRIGHT_BROWSERS_PATH=D:\hjk202\.cache\studio-m0\browsers`）：

| 命令 / 检查 | 实际结果与证据 |
| --- | --- |
| 严格核对作者既有 live.json 与 verifier | 退出 0，五项真实成功，原样保留；`live-check.json`、`live.json` |
| `node .cache/studio-m5-acceptance/live-ui.mjs` | 退出 0，真实 Chromium 一次润色/人工式采纳/校验/旧建议失效，源未写、0 pageerror/外部浏览器请求；`live-ui.json`、两张截图 |
| `npm.cmd run lint` | 退出 0；`lint.log` |
| `npm.cmd run typecheck` | 退出 0，Astro 165 files、0 error/warning/hint，Studio tsc 通过；`typecheck.log` |
| `npm.cmd run test` | 退出 0，96 tests 中 95 passed、0 failed、1 继承的普通文件 symlink Windows EPERM skipped；`unit.log` |
| `npm.cmd run build` | 退出 0，原 prebuild 公开/Vault 边界检查保留；根 dist 25 文件；`build.log` |
| `npm.cmd run build -- --base /personal-space/ --outDir .cache/studio-m5-acceptance/base-dist` | 退出 0，隔离 base 构建；`base-build.log` |
| `npm.cmd run studio:test -- ai.spec.ts --output .cache/studio-m5-acceptance/ai-results` | 退出 0，独立 Web build、Chromium/WebKit 共 10/10，0 pageerror/浏览器外部请求；`ai-browser.log`、`ai-results/` 的截图与 ai-browser-boundaries 附件 |
| `npm.cmd run test:e2e` | 退出 0，完整默认网站 75/75，2.8 分钟；`site-e2e.log` |
| `node .cache/studio-m5-acceptance/site-smoke.mjs` | 退出 0，根/base×Chromium/WebKit 四组合，公开 Think 导航/公式/日期/刷新/返回/搜索/count 通过，0 pageerror/失败请求；`smoke.json`、四张截图 |
| `node .cache/studio-m5-acceptance/audit.mjs`、`git diff --check` | 退出 0；193 个非目标文件、源/依赖/历史/产物/链接/HEAD/index 与真实记录核对，只有三份文档修改；`audit.json`、`diff-check.log` |

**确定性边界复验**：当前 unit 保留百炼配置、五项严格输入/响应、大小/UTF-8/截断/工具/空值/Key canary、鉴权/限流/超时/关闭/并发/取消负例。双引擎 AI 十项验证五种建议均不先改原缓冲，采纳后才改正文/title/summary、published 不变，文件到显式原保存接口才写；随后 external revision 冲突保留输入和外部版本。HTML/script/img 建议仅为文本，丢弃/改操作/编辑/迟到响应不会覆盖新输入；鉴权/限流/截断/超时/取消均保留原文，无配置仍可普通保存。所有这些上游均明确为本机模拟，未混写为真实百炼请求。

**限制与停点**：M5 验收针对接口与边界正确性，作者仍需逐次核对建议事实/文风与服务费用。Key 只在作者已配置的后端进程中，验收不提供持久凭据或让新终端自动配置；未向聊天/源码/日志/浏览器写入 Key。未运行其他 OS/移动端 Studio、真人输入法、完整 Studio 36 项/非默认 extension 专项或发布，不把历史结果冒充本轮；相关 M4/M6 既有验收与源码保持。原服务保持运行，作者原浏览器/缓冲未操作。196 个初始文件中 193 个非目标文件 SHA-256 不变（含已有 AGENTS、全部 M0–M6 实现/测试、真实作者源、package/lock），无新增工程文件；M0–M6 历史记录逐字保留，公开 25 文件与 Web bundle 无 Studio 后端/凭据/测试内容。仅三份文档更新当前状态/操作/证据，HEAD 未变、暂存区仍为空。M5 两项 Done Criteria 与全部 Verification 满足、标 Done，Studio M0–M6 全部完成；保留全部已有未提交工作，未提交、推送或发布，按本轮授权停止。


### 9.16 Studio v0.1 润色优化（2026-10-17，Done）

按本轮授权只改 polish 提示词与原样响应反馈：修正病句、减少重复、改善衔接，同时保留事实/个人语气；服务合同不变。Web 使用请求时正文快照精确比较，polish 原样返回显示“本次未产生修改”、无可采纳建议；不 trim，空白差异仍可采纳。两引擎新增两项全部通过，已有 AI 十项原样通过；源字节与已保存标志在原样结果时不变，截图 `.cache/studio-v0/ai-results/ai-identical-*/ai-no-changes.png` 已实际查看。

sunshine.md 经作者明确同意原样纳入，当前 published:true、kind:note，公开 Think 由一变二，Me 真实平均为 1.33。更新实际站点的精确公开/私人累计计数、路由/标题及正确标题区域断言，没有改文章或过滤错误。固定单篇内容的隔离测试先在受检副本中排除其他文章，避免日常文章影响 fixture 契约；正式源哈希保持。

公共命令已运行：lint/typecheck 退出 0，unit 95 passed/1 既有 Windows symlink 权限 skipped，build（含 prebuild）退出 0；AI 双引擎 12/12；完整网站 E2E 最终 75/75。初次 E2E 73 passed/2 failed，是旧 h1 全局选择器在新增随记/导航中匹配多个标题，改为具体公开文章/私人详情区域后重跑全套通过，不是隐藏或跳过失败。证据 `.cache/studio-v0/ai-{lint,typecheck,unit,build,browser,site-e2e-final}.log`、`ai-scope.json`；针对最终测试选择器修改再运行 lint/typecheck 均退出 0（ai-lint-final.log / ai-typecheck-final.log），本项完成。

新提示词的请求内容由实际本机 HTTP 上游测试核对，真实模型复验安排在 v0.2 新进程安全读取已保存凭据之后，不能用仍加载旧代码的进程冒充。此处不保证每次润色都有修改或质量提升，不新增 provider/重试/自动保存。原作者文章、AGENTS、package/lock 与其余模块实现不变；全部当前标准满足，v0.1 Done，进入已授权 v0.2；真实新进程润色仍是 v0.2 必需集成检查。


### 9.17 Studio v0.2 Windows 本机启动（2026-10-17，Done）

**实际交付**：新增 studio/windows 的安全配置、DPAPI 私有管道读取、后台进程与固定命名管道 status/stop、打开/停止/安装快捷方式脚本，以及 Windows 非敏感集成测试。package 仅新增 studio:configure/open/stop，Studio tsc 包含 windows；原 main 启动后向可信父进程发送 ready，不包含 token。没有新增依赖或 HTTP/Agent 能力。密文固定保存在仓库外当前用户 LocalAppData，明文仅在配置/可信启动及后端子进程内存，不进入参数、日志、Git、浏览器或构建环境；预览继续使用原最小环境。缺配置可编辑，坏配置失败，不自动清锁或强杀。

作者在本机隐藏输入窗口录入 Key，并明确确认已保存 Key、保存缓冲且停止旧终端服务；没有从旧进程读取凭据。实际安装并双击桌面 Personal Space Studio，服务就绪；重复打开复用原 PID。双击 Stop 后桌面状态、启动锁、作者锁均清除，再双击打开取得新 PID，AI 状态为后端已配置、没有再次输入。实际启动脚本使用进程级 RemoteSigned，不修改系统/用户策略；保留传统 npm.cmd run studio / Ctrl+C 路径。后台服务测试后留在可用状态。

**新提示词真实集成**：新后台进程从已保存密文加载配置，独立 Chromium 以固定非敏感病句/重复表达作一次真实百炼 polish；输入 336、输出 276 UTF-8 bytes，重复措辞被删除、句子和衔接更自然，未增加事实。只在明确采纳后进入内存草稿，再校验；published:false 不变，两篇原文章字节不变。0 pageerror、0 外部浏览器请求、0 浏览器 Authorization、无浏览器持久化；只 POST suggest/validate，没有保存/删除。截图 live-desktop-after.png 已实际查看；真实调用不是模拟上游。生成结果仍须逐次人工核对，不保证每次修改或质量提升。

证据统一在忽略的 .cache/studio-v0/：

| 实际命令 / 行为 | 结果与证据 |
| --- | --- |
| npm.cmd run lint / typecheck | 最终退出 0；lint-v0-final.log / typecheck-v0-final.log，168 files、0 error/warning/hint，Studio 严格 tsc 通过 |
| npm.cmd run test | 退出 0，100 tests 中 99 passed、1 既有 Windows 普通文件 symlink EPERM skipped；windows-unit-full.log |
| node --experimental-strip-types --test tests/unit/studio-windows.test.ts | 最终 4/4；DPAPI 跨进程读取、原子更新、无明文、坏密文/硬链拒绝、无配置、后台启停重启与 COM 快捷目标；调整最终等待时限后 windows-unit-recheck-v0-final.log 再次 4/4 |
| npm.cmd run build / 隔离 base build | 均退出 0，含原 prebuild，根 10 HTML 页、26 文件；windows-build.log / base-build.log |
| npm.cmd run studio:test -- --output .cache/studio-v0/windows-studio-results | 退出 0，37 passed、1 既有 WebKit 无 CDP IME skipped；windows-studio-browser.log，原 CRUD/冲突/预览/AI/Agent 两引擎回归 |
| npm.cmd run test:e2e | 退出 0，完整默认网站 75/75；windows-site-e2e.log |
| site-smoke.mjs / tests/studio/http.smoke.mjs | 根/base×双引擎四组合公开两篇文章导航/公式/搜索/刷新/count 通过、0 pageerror/失败请求；smoke.json；原 API-only 双引擎通过，WebKit 5 条预期 CORS pageerror 全量保留，http-browser.json |
| live-desktop.mjs / desktop-restart.mjs | 退出 0，live-desktop.json / desktop-restart.json；真实新版润色与桌面重复打开、停止清锁、重开免输入通过，截图只含非敏感 fixture |
| audit.mjs / git diff --check | 退出 0；197 个原文件中 172 个非目标文件哈希保持，包括 AGENTS、真实作者源、package-lock 与原 M0–M6 历史记录；十个新增文件均在目标范围，公开产物/Web bundle/日志与 Git 候选无凭据/Studio 泄漏，audit.json |

**失败与限制**：初次 Windows 测试暴露默认 Restricted、父 PowerShell 7 模块路径影响 5.1 自动加载、File.Replace 的 null 字符串绑定三个问题；分别以进程级 RemoteSigned、明确导入当前 host 内置模块、NullString.Value 最小修复，不改系统权限、不弱化测试。只有既有 symlink/IME 平台子项跳过，均没有当作通过；DPAPI 与四项新增 Windows 测试实际通过。当前用户/机器之外的迁移、真人候选窗、恶意同用户程序隔离、自动开机常驻均不承诺。Key 过期需作者本机更新；异常强杀遗留按手册核对恢复。v0.2 全部标准满足，标 Done；进入已授权 v0.3 的审阅/原发布专项、提交推送及正式部署，尚未冒称上线。


### 9.18 Studio v0.3 基线提交与正式部署（2026-10-17，Done）

授权纳入当前全部已完成 Studio M0–M6、v0.1/v0.2、维护文档与作者确认的 sunshine.md；不改历史 v0 标签、不上传本地密文配置。当前 75 个修改/新增文件已审阅，Git 候选共 207 文件，无凭据/缓存/快捷方式；原作者源与 AGENTS 保持本轮起始字节。原 M0–M6、v0.1/v0.2 验收记录保留，Phase 5/6 未开始。

**本地发布前验证**：本候选公共 lint/typecheck/unit/root build、网站根 75/75、Studio 37 passed/1 既有平台 skipped、真实新提示词与快捷方式证据见 9.17（随后仅改文档，没有改工程输入）。本单元额外实际执行隔离 base build 与完整 E2E 75/75、WebKit mobile 16/16、WebKit private 29/29；extension/content/design/mobile/session 原发布专项均退出 0，4–7 模块双引擎移动测量及第五私人 adapter/会话两引擎各 3 项通过；扩展/设计/内容/全空浏览器分别 1/5/1/1 通过。受影响 verify-studio-think.mjs 隔离 CRUD/六次根/base 构建与 think-files.smoke.mjs 的 12 组 stage/engine 均退出 0、0 pageerror/失败请求。原 release/Vault 边界检查退出 0，根 10 HTML 页、26 文件，无密文/Studio/源码/fixture；提交后会重新记录准确源 SHA，不把提交前 HEAD 当候选产品源。

证据为 .cache/studio-v0/release-{base-e2e-final,webkit-mobile,webkit-private-final,extension,content,design,mobile,session-build,session-chromium,session-webkit,extension-browser,design-browser,content-browser,empty-browser,think-files,think-smoke,boundary,vault-boundary}.log，以及 audit.json / diff-check-warnings.log。初次并行 base 71 passed/4 failed、WebKit private 24 passed/5 failed，均为共享默认 test-results 导致 browserContext.close/API dispose 的 trace 文件 ENOENT；修正的是本机命令的独立 --output 目录，保留全部断言/trace/原失败日志后完整重跑分别 75/75、29/29，没有修改产品或测试来绕过失败。

暂存后完整 git diff --cached --check 另报 sunshine.md:21 的 trailing whitespace，确认为原文两个空格的 Markdown 显式换行，作者已要求原样保留。文章原始哈希保持；只对该文用命令级 core.whitespace=-blank-at-eol 验证其余空白规则，其余全部文件仍执行严格 --check，不修改仓库配置/正文，也不把原命令退出 2 写成通过。

**首次提交/部署**：75 个文件精确提交为 968f31363f0c7fba59658a218c371d2ed000a630 并普通推送 main。正式 workflow_dispatch 为 [39010209782](https://github.com/hjk202/hjk202.github.io/actions/runs/39010209782)，原全部 check 与 deploy 均 success；重复 push 检查 39010207919 主动请求取消、最终 cancelled，不把取消当验证通过，完整手动发布原样运行所有步骤。实际 github-pages artifact 12092307930，ZIP digest sha256:bd833e92ae8ed59d773b3b9b64f32476bba8b20e262a96125df14ab03eb2ceb6，下载校验 digest 后安全解包。26 文件的本地/下载产物/线上 SHA-256 全相同；普通无版本参数的 search-index.json 也匹配，Think count 2。证据 run-39010209782.json、artifact.json、local-manifest.json、release-comparison.json；没有上传 Studio、Key 或验收密文。

**首次线上验收发现（修复前）**：真实 Chromium 九个正常路径、404、两篇文章导航/搜索/刷新/公式、未配置私人入口均通过，0 pageerror/失败请求。Windows WebKit 路径与操作都能完成，但快速点击文章/Home 稳定产生两条 access-control pageerror；online-smoke-third.log / online-smoke-diagnostic.log、online-webkit-diagnostic.json 保留全部错误，没有过滤后签收。前两次 smoke 还分别暴露脚本未等待异步搜索结果、误向未配置时应隐藏的 Vault 表单填值，按已有契约修正脚本后，真实 WebKit 错误仍存在，不混淆为这些脚本问题或云端失败。

src/shell/vault/runtime.ts 的公开链接标 data-astro-reload，goTo 在锁定态用 location.assign；现有 ClientRouter 又默认启用悬停预取。独立浏览器诊断对照中，同一组快速导航启用预取产生 3 条 pageerror/3 次 low-priority fetch；仅在测试 context 给链接加 data-astro-prefetch=false 后，导航正常、0 预取/0 pageerror。prefetch-diagnostic.json 明确 diagnosticOnly，不是网站已修复或正式验收。Astro [官方 Prefetch 配置](https://docs.astro.build/en/guides/prefetch/#using-with-view-transitions)支持 prefetch:false；[Playwright #43120](https://github.com/microsoft/playwright/issues/43120)亦记录文档替换期同源请求的类似 WebKit 现象，仅作机制参考，不据此过滤实际错误。

**补充授权/实施边界**：作者于 2026-10-17 明确批准最小修复并重新验收、部署。开始修复时 v0.3 保持 In Progress，仅增加 astro.config.mjs 的 prefetch:false、公开悬停/快速导航行为回归与必要文档，原全部发布门槛及线上双引擎 0 pageerror 标准保持；不改导航/Vault 协议或 UI，不升级依赖，不进入 Phase 5/6。全部验证、实际再部署/产物比对与线上通过后才创建 studio-v0 并标 Done。原网站及 Key/两篇原文保护，桌面服务保持。新增证据放 .cache/studio-v0-prefetch/，初始 207 文件/原有 PLAN、README 未提交改动已快照。


**补充修复本地结果（2026-10-17）**：公开运行仅 astro.config.mjs 增加 prefetch:false（附解释注释），tests/e2e/acceptance.spec.ts 增加实际悬停与快速点击的网络/导航/pageerror 回归。对真实旧下载产物运行新 WebKit 用例，明确因悬停提前请求 /think/ 而失败（control-old-artifact.log，预期负对照，不当成功）；修复后根/base 完整 E2E 各 76/76，WebKit 根/base 新回归各 1/1、mobile 16/16、private 29/29，所有错误原样断言。

本轮重新实际运行 lint/typecheck/test/build，均退出 0；Astro 168 files 零诊断，Studio tsc 通过，100 tests 中 99 passed/1 既有 Windows 普通文件 symlink 权限 skipped，根 10 HTML 页/26 文件。完整 Studio 双引擎 37 passed/1 既有 WebKit 无 CDP IME skipped，预览使用新配置但原 CRUD/AI/Agent 及隔离边界保持。原 extension/content/design/mobile/session 发布专项全部退出 0，第五私人会话两引擎各 3/3；公开产物/Vault 边界检查通过。除配置、该回归与三份文档外，其余 202 文件 SHA-256 完全不变，包括作者两篇正文、AGENTS、Studio 全部实现、package/lock 与已完成验收历史。

证据统一 .cache/studio-v0-prefetch/：lint.log/typecheck.log/unit.log/build.log/base-build.log/root-e2e.log/base-e2e.log/root-webkit-regression.log/base-webkit-regression.log/webkit-mobile.log/webkit-private.log/studio-browser.log、extension/content/design/mobile/session-{build,chromium,webkit}.log、release-boundary.log/vault-boundary.log/audit.json。既有 .cache/studio-v0/ 首次发布/错误/诊断证据保留。以上本地记录停在重新提交/发布前；实际最终结果见下文，不把本地修复或诊断对照当线上通过。


**最终再部署与验收（2026-10-17）**：最小修复及既有文档状态同步精确提交为 224eea0884eaed4673f89c6c919e5b5a0c38b4e7，普通推送 main；没有强推、移动历史标签或改作者文章。正式 [workflow_dispatch 39012527756](https://github.com/hjk202/hjk202.github.io/actions/runs/39012527756) 对同一 SHA 执行原全部 lint/typecheck/unit/root build/root E2E/WebKit/mobile/private/session/extension/content/design/base/release/Vault 门槛，check 与 deploy 均 success；上传/部署消费同一受检 dist，不在 deploy 重建。重复 push 检查 39012526368 仅去重取消，不当验证通过。

真实 github-pages artifact 12093443075，ZIP digest `sha256:54f65ad08a9d11f471567eb8a7e4e7249eab29d64d5a64d89697fc3d8a018694`；下载校验 ZIP digest 后，在受检缓存目录安全解包，拒绝越界/链接/特殊成员。26 个文件的本地受验构建、下载产物、线上 SHA-256 全相同，local-manifest.json 准确记录发布源 224eea0884eaed4673f89c6c919e5b5a0c38b4e7。没有 Studio 服务/Key/缓存/源码/测试文字或验收密文进入 Pages。

原线上 smoke 的同一快速点击路径在新站直接重跑，未注入 data-astro-prefetch、没有 mock/路由替换/关闭安全策略或过滤 pageerror。Chromium/WebKit 两引擎各九个正常页面、真实 404、Think 两篇文章、搜索/返回/刷新、公式与未配置私人入口全部通过，完整过程 0 pageerror、0 failed request。原 WebKit 访问控制错误消失，不以诊断对照替代实际验收。已保存并查看 online-*-sunshine.png；证据 online-smoke.json / online-smoke-final.log、两引擎 diagnostic.json、release-comparison.json、artifact.json / run-39012527756.json。旧错误与首次发布证据原样保留。

已创建并推送带注释标签 [studio-v0](https://github.com/hjk202/hjk202.github.io/tree/studio-v0)，准确指向实际发布源 224eea0884eaed4673f89c6c919e5b5a0c38b4e7，远端 peeled SHA 已核对；原 v0 仍为 5aa2ceffc1e622271b94137f726a19554b324a00，未覆盖。最后仅补记 PLAN/README/MAINTENANCE，网站工程输入不变，不为文档再次部署；生产源与标签身份仍使用上述受验 SHA。

最终范围/结构/链接/敏感边界审计通过：本轮 207 文件中 202 个非目标文件字节不变，含两篇作者源、AGENTS、Studio 全部实现、package/lock 与 M0–M6/v0.1/v0.2 已完成历史。Key 仍仅在作者本机 DPAPI 存储及可信进程内存；桌面服务正常可用。没有重复本轮未改动的真实付费 AI 调用，9.15/9.17 的真实证据保留，完整 Studio/AI 模拟与后端单测已重新通过。

限制如实保留：1 个既有 Windows 普通文件 symlink 权限子项、1 个既有 WebKit CDP IME 子项跳过，均没有当作通过；DPAPI/快捷方式原生测试与本次 WebKit 导航实际通过。未新增真人输入法候选窗/手机/其他 OS Studio 验收，不改变既有 Phase 4 作者反馈，不承诺 AI 质量或同用户恶意进程隔离。v0.3 全部当前标准满足、标 Done；M0–M6 与 v0.1/v0.2 Done 保持，Studio v0 基线收尾完成，Phase 5/6 未开始，完成本轮授权后停止。

<a id="notes-n1"></a>
### 9.19 N1 — 随记列表预览（2026-10-17，Done）

**授权 / Scope**：用户明确要求随记只展示前几行、点击查看余文；作为独立小单元执行。Think 公开列表从完整正文改为最多四行的正文纯文字预览，标题及“阅读全文”进入既有详情。私人列表本来仅展示摘要/链接，保持；不改变文章内容、数据字段、计数/搜索、Studio、其他模块，不开启 Phase 5/6。用户随后明确授权测试通过后提交/推送/部署，完成线上验证后停止，等待作者检查。

**文件 / 方案**：Think Index/background、构建期 note-preview.server、相关单元/浏览器测试，必要 PLAN/MAINTENANCE/README。复用已有 HTML parser 提取可读文字、去除脚本/样式，最多 400 Unicode 字符；CSS 四行省略，原生详情链接支持键盘，无新增客户端脚本或依赖。

**Done Criteria**：
- [x] 列表预览最多四行，没有整篇正文或隐藏交互元素；长随记不撑页面，短随记正常。
- [x] 标题/阅读全文可点、键盘 Enter 可用，完整详情及返回/刷新/搜索/计数保持。
- [x] 作者原文、其他模块/Studio/Vault 不改；根/base、桌面/窄屏、明暗与 Chromium/WebKit 检查通过。
- [x] 提交/推送准确候选，完整 Actions check/deploy 成功，同产物线上核对与随记 smoke 通过。

**Verification**：lint、typecheck、test、build；根路径完整 E2E；base 随记/Think 导航与相关回归；WebKit 随记/窄屏 smoke；相关 Studio note 公开预览与 design fixture 回归；页面 pageerror/失败请求为 0，截图检查。按追加授权完成完整发布门槛、实际 Actions、产物/线上比对与双引擎线上 smoke 后标 Done；手机由作者之后检查，不冒充本轮真机验证。

**本地记录**：lint/typecheck（170 文件 0 诊断，含 Studio tsc）/build（10 HTML 页）退出 0，unit 101 passed / 1 既有 Windows symlink skipped；根/base E2E 各 77 passed，WebKit Think/导航/私人相关 7 passed，WebKit mobile 16 passed，design fixture 5 passed，Studio 相关公开预览/保存/隐藏/删除 × 两种 base × 两引擎 4 passed。320/375/1280px、明暗、四行实测/44px 入口/键盘与点击/全文结尾/返回刷新通过，已查看手机宽度截图。证据 `.cache/n1-*.log`、`.cache/n1-*-results/`；完整发布专项记录随后补齐。

初次类型/构建发现 Astro 7 `compiledContent()` 返回 Promise，已在构建期 await 后重跑通过；无修改业务契约。首轮 sandbox 中既有网络/硬链接检查被 EACCES/EPERM 拒绝，获工具权限后原测试完整通过；mobile 脚本首轮未设置已安装浏览器目录，按实际 `PLAYWRIGHT_BROWSERS_PATH` 重跑，不改测试规则或安装依赖掩盖失败。原失败日志保留可用部分，未把失败写成通过。

**完整发布专项**：WebKit private 29 passed、真实第五私人 adapter/session Chromium/WebKit 各 3 passed，既有 extension/content/design/mobile 隔离构建与 4–7 模块两引擎移动测量、release/Vault 边界均退出 0；正式产物未配置密文，不包含 Studio、作者源或 fixture。10 个获准文件精确提交为 `2a8ff37da0c2ad322e155eedd2a6ee09fa8f74e3` 并普通推送；原文、依赖、Core/Shell/Studio 实现与 AGENTS 保持不变。

**实际发布 / 线上 Verification**：[手动 Actions 39016722251](https://github.com/hjk202/hjk202.github.io/actions/runs/39016722251) 对该 SHA 执行全部原有检查，check/deploy 均 success；重复 push 检查 39016709506 仅取消去重，不替代或跳过手动运行。实际 github-pages artifact `12094799425`，ZIP digest `sha256:6c902e4c716e0a0c8a6b660bdf415bde23f1266244d87ff04d4ec3855d1c8aca`，下载摘要校验及安全解包通过。受测本地 dist / 实际下载产物 / 线上 **26 文件逐项 SHA-256 相同**。

真实线上 Chromium/WebKit 各检查 9 个正常路由及 404；320/375/1280px 明暗下预览最多四行且内容实际溢出被收起、无隐藏链接/媒体/标题，阅读全文键盘 Enter 与点击进入完整末段，返回/刷新/Spotlight/文章公式正常，未配置私人入口仍正确。两引擎均 0 pageerror、0 failed request，已查看线上手机宽度截图。证据 `.cache/n1-release/` 中 run/dispatch/artifact/local-manifest/release-comparison/online-smoke/scope-check JSON 与截图；本地证据见 `.cache/n1-*.log` 和对应 results。

N1 全部 Done Criteria/Verification 满足、标 Done；手机真人检查留给作者，本轮不冒充 OPPO 复验。最终仅更新完成记录/简报，文档检查后保存 Git，不为纯文档重复部署或移动 studio-v0/v0 标签；Phase 5/6 不启动，完成后停止。

<a id="docs-organization"></a>
### 9.20 文档入口与编辑器目录视图整理（2026-10-17，文档任务完成）

**授权与范围**：按作者要求保留一个 Git 和现有目录，精简 README、理顺四份文档的入口与职责，并在编辑器中隐藏生成目录。开始时 Git 工作区干净；不搬迁源码、拆仓库、清理缓存或调整测试/构建/发布行为，不启动产品 milestone。

**实际修改**：README 集中目录总览、常用命令、当前状态与待检查项；PLAN 2.2 明确仓库边界并保留既有全部验收记录；MAINTENANCE 保留字段/操作/接口，将重复交付日志改为 PLAN 入口；AGENTS 仅补充文档分工说明，不改执行规则。新增 `.vscode/settings.json`，仅以 `files.exclude` 隐藏根 `node_modules/`、`.astro/`、`.cache/`、`dist/`、`test-results/`、`playwright-report/` 六个生成目录，不删除磁盘文件、不改 Git 忽略或额外的搜索/监听配置。

**验证**：实际运行 `node .cache/doc-organization/verify.mjs`，退出 0；四份文档代码围栏闭合、133 处相对链接/锚点有效，README 六个 npm script 入口与 package.json 一致。README UTF-8 篇幅比开始时缩减约 39%；六项隐藏配置的 JSON 结构与既有 Git 忽略目录一致，根与 studio 的 Git 顶层相同。205 个非目标跟踪文件 SHA-256 原样保持；PLAN 原有完整完成记录、MAINTENANCE 第 2–10 节操作正文和 AGENTS 执行规则字节对应内容保持。仅四份文档修改及一个新增编辑器配置；`git diff --check` 退出 0。证据为 `.cache/doc-organization/baseline.json` / `verification.json`。初次链接检查器将行内代码中的教学图片路径误判为导航链接，修正代码区分后重跑通过，未删除示例或修改产品来绕过检查。

**限制与停点**：工程 lint/typecheck/test/build、页面 smoke 未运行，本轮未改工程输入；编辑器设置仅适用于支持 VS Code 工作区配置的编辑器，未直接验收实际文件树。N1 手机反馈仍待作者，既有阶段状态及发布源不变；未提交、推送或发布，完成后停止。

<a id="docs-release"></a>
### 9.21 文档整理的测试、提交与发布（2026-10-17，Done）

**追加授权**：作者要求“测试后提交并发布”。仅提交已整理的四份文档与 `.vscode/settings.json`；保留一个 Git、现有网站/Studio 目录、文章和凭据。验证候选后普通推送 main，手动运行原完整 Pages 工作流，下载受检产物并核对本地/线上文件与双引擎页面。不修改产品功能、不移动历史标签，不以旧发布结果替代本次验收。

**启动时的 Verification / 停点**：执行文档审计、lint/typecheck/test/build、网站根/base E2E、WebKit/mobile/private、Studio 回归、原隔离与发布边界检查；全部通过后提交、推送和部署。记录实际结果、失败/跳过、源 SHA、Actions 与产物身份，再完成线上验收。N1 作者手机反馈仍待，不冒充真机检查；开始时尚未提交或发布。

**本地验证（提交前）**：实际运行 `.cache/doc-release/run.mjs` 中各项检查，全部退出 0，逐项原始命令、退出码与日志位于同目录的 `{task}.json` / `{task}.log`。lint/typecheck（170 files 零诊断，含 Studio tsc）/unit/build、隔离 base build 通过；unit 为 101 passed / 1 既有 Windows 普通文件 symlink 权限 skipped，真实 junction/hardlink 另有执行。网站根/base 完整 E2E 各 77 passed，WebKit mobile 16 passed、private 29 passed；Studio 独立 build 及双引擎 37 passed / 1 既有 WebKit CDP IME skipped。未删除测试、过滤真实 pageerror 或弱化断言。

原 extension/content/design/mobile/session 隔离专项与 release/Vault 边界均通过；4–7 模块双引擎移动布局、第五私人 adapter/session 两引擎各 3 passed。205 个非目标跟踪文件保持，文章、凭据、依赖及运行代码未改；文档审计和 `git diff --check` 通过。26 个本地公开文件与此前 N1 受验产物逐项哈希相同，见 `unchanged-site.json`；这不替代本次云端与线上验收。编辑器实际文件树、N1 作者手机反馈未在本轮验收；以上仍停于提交/发布前。

**实际提交 / 云端发布**：五个获准文件精确提交为 `dcc5d826631935d20ef8378056c46617bb8e3513` 并普通推送 main；[手动工作流 39019825142](https://github.com/hjk202/hjk202.github.io/actions/runs/39019825142) 对同一 SHA 执行原全部检查，check 与 deploy 均 success。重复 push 检查 39019820547 只取消去重，不替代手动完整验收。上传/部署消费同一受检 dist，没有在 deploy 重建；未移动历史标签。

实际 github-pages artifact `12096238478`，ZIP digest `sha256:1f1ef4752315988377031853bed0ebb73098f1eea3f9b88b5b7e3a94c0762796`；下载摘要核对及拒绝越界/链接/特殊成员的安全解包通过。本地受验 dist、实际下载产物、线上 **26 文件逐项 SHA-256 相同**；源身份由 dispatch / local-manifest / release-comparison 核对，不把部署成功或原 N1 相同字节单独当作本次验收。

**线上 smoke**：真实 Chromium/WebKit 各验证九个正常路由和真实 404，Think 四行预览/全文、320/375/1280px 明暗、键盘与点击、返回/刷新、Spotlight、公式和未配置私人入口均通过；两引擎各 0 pageerror、0 failed request，截图已查看。证据为 `.cache/doc-release/` 的 run/dispatch/artifact/local-manifest/release-comparison/online-smoke JSON、原始日志与截图。

**收尾与限制**：编辑器实际文件树和 N1 作者手机反馈未在本轮验收，原两项 Windows/WebKit 平台跳过未当作通过；未改文章、Studio、依赖或发布流程。仅补记本段及 README/MAINTENANCE 的发布入口；最终文档审计退出 0，135 处相对链接/锚点有效、205 个非目标文件保持，`git diff --check` 通过，另存记录提交。工程输入与已发布源仍为上述受验版本，不为完成记录再次部署。Phase 5/6 不启动，完成后停止。
