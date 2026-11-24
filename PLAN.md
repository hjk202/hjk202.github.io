# Personal Space · 需求、设计与实施计划

更新：2026-11-12。本文是产品需求、目标架构、风格设计、分阶段实施及验收状态的 **source of truth**；执行守则见 [AGENTS.md](./AGENTS.md)，所有者简报见 [README.md](./README.md)，完整内容维护与未来写作接口参考见 [MAINTENANCE.md](./MAINTENANCE.md)。

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
- [Studio M7–M15：App 使用方式与内容管理扩展](#studio-next-plan)
- [Studio M16.1–M23：启动、工作台与资料录入审核](#studio-authoring-plan)
- [Studio 写作体验升级](#studio-writing-workbench)、[Markdown 写作闭环](#studio-think-writing)、[Think 快速预览和时间](#studio-think-preview-time)与[Think 稳定化](#studio-think-stability)
- [验证流程](#verification)
- [发布与回退](#release)
- [完成记录与风险](#records)

<a id="current-state"></a>
## 1. 当前状态与授权停点

| 项目 | 现状 |
| --- | --- |
| 本次任务 | 2026-10-31 当前主线至 M23 已实现/自动验证，实际 App/性能、新 AI 及真实发布统一待验。保留已有改动，不控制桌面、不实际提交/推送/发布 |
| 已完成 | **Phase 1–4 全部 Done**；公开设计 D1–D8 与内室 V1–V5 完成 |
| 当前 milestone | M16.3 Auto verified / Awaiting unified acceptance。M19.1 Auto verified / Awaiting unified acceptance。M19.2 Auto verified / Awaiting unified acceptance。M20 Auto verified / Awaiting real AI and unified acceptance。M23 Auto verified / Awaiting real publication and unified acceptance。M17 Done，M18 Awaiting author acceptance（原生待验，不标 Done）。M16.2、M21/M22 Deferred，旧专项待验不变 |
| 最近已核验线上产品源 | `dcc5d826631935d20ef8378056c46617bb8e3513`（26 文件三方哈希一致，线上 Chromium/WebKit 无 pageerror/失败请求；公开内容与 N1 相同） |
| 最近发布 | [Actions 39019825142](https://github.com/hjk202/hjk202.github.io/actions/runs/39019825142)，完整 check/deploy 成功；该次整理文档与编辑器视图后，线上全站验证通过；本轮 M8 未发布 |
| 访问地址 | [正式网站](https://hjk202.github.io/)；[随记预览验收入口](https://hjk202.github.io/think/?v=2a8ff37) |
| 私人数据状态 | 本地/产物/线上均无验收密文，真实 Vault 未配置；私人功能完整，入口显示未配置提示 |
| 后续阶段 | Phase 5 按用户决定延后，方案保留为储备；Phase 6 仍延后，均不影响当前可用状态 |
| Studio | 现有能力与待验状态见 [6.10](#studio-next-plan)；新路线见 [6.11](#studio-authoring-plan)，M16.1/M17 Done、M18 原生待验；新主线及延期范围见 6.11，不重启网站 Phase 5/6 |

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

以上是 M0–M4 的首版边界，不回写其完成历史。用户现已认可 [M7–M15 扩展规划](#studio-next-plan)：仅在未来对应单元获准实施时增加 Windows 薄窗口、其他公开模块和私人编辑；Electron/Tauri/PWA、云服务、自动 Git/部署等仍不进入新路线。本轮认可与入档不构成实施授权。

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

序列化保留正文、未改字段及注释；无修改保存保持原始字节，显示默认值不等于补写源字段。日期写为带引号字符串，不用字符串拼接生成可执行 TS/JS/MDX。新文档默认 published:false、显式 kind；Web 新建默认本机当天日期且可修改，API/Agent 不擅自补日期，旧文章不补写；正文不自动 trim、润色或格式化。

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

<a id="studio-next-plan"></a>
### 6.10 Studio M7–M15 — App 使用方式与内容管理扩展（批量实施，最终统一人工验收）

**授权与状态**：2026-10-17 路线规划入档，记录见 [9.22](#studio-next-planning-record)。M7 经作者真实双击反馈于 2026-10-18 标 **Done**；随后作者单独授权 M8。M8 已实现 App 与协同关闭；作者于 2026-10-23 对日常手动清单反馈“ok了”，专项缺口仍为 **Awaiting unified acceptance**。2026-10-23 作者补充授权单个启动图标、默认可编辑日期、正式 AI 配置排查修复及验证/文档；不再控制桌面，实际 App 操作仍待作者反馈。M9–M15 现已由作者于 2026-10-23 明确批量授权，按下面的自动验证门槛顺序实施。保留全部已有未提交改动，不提交/推送/发布；M0–M6、v0、N1 历史及已发布源保持，不重启网站 Phase 5/6。

#### 6.10.1 现状、目标与架构

作者反馈桌面启动/停止入口不可用并已删除。M7 实测复现：原 host/API 均已退出，相关三份会话/锁文件仍在，命名管道不通；旧 open/stop 均退出 1、DESKTOP_UNAVAILABLE。现已按严格归属条件恢复退出残留并重建入口；自动验证与真实目标调用通过，作者已确认真实双击启停、重复启动、重开及 AI 配置保留。证据见 [9.23](#studio-m7-record)，不把旧 v0 验收当作本次通过。

| 代码证据 | 当前行为 / 规划影响 |
| --- | --- |
| [Open.ps1](./studio/windows/Open.ps1)、[app.ts](./studio/windows/app.ts)、[desktop](./studio/desktop/PersonalSpaceStudio.csproj) | 快捷目标保持，Launcher 改为 App 单实例启动/激活；WinForms/WebView2 只承载原 Web，生成物留在忽略缓存 |
| [desktop.ts](./studio/windows/desktop.ts)、[main.ts](./studio/server/main.ts) | 后台 host/HTTP 子进程以认证管道及 IPC 协作；M7 增加退出残留核对、等待真实停机、宿主丢失时自有 API 关闭、输入/产物哈希匹配复用 Web；不接管手动终端服务 |
| [web/main.ts](./studio/web/main.ts)、[web/desktop.ts](./studio/web/desktop.ts) | App 有限退出消息处理保存/放弃/取消及进行中操作；独立浏览器仍只用 beforeunload，不借标签页卸载停止服务 |
| [HTTP](./studio/server/http.ts)、[契约](./studio/contracts/think.ts) | 四个公开模块各有自有 DTO、校验与固定源 adapter；AI/现有 stdio Agent 仍仅 Think；私人端点尚未实施 |
| [Keep](./src/modules/keep/data.ts)、[Me](./src/modules/me/data.ts)、[Build](./src/modules/build/data.ts) | 内容是各自受模型包装的 TypeScript 数据表达式，不是 Markdown，不能照搬 Think 文件 serializer |
| [Vault operations](./scripts/vault/operations.mjs)、各模块 vault.schema/server/client | 已有完整加密、校验和展示；真实源仍由作者在仓库外维护，缺的是作者管理界面，不是重做加密协议 |

目标仍是一个 Git、现有根 Astro 网站与 `studio/`，不搬到 website/、不拆仓库、不建数据库。新增 App 只负责窗口和生命周期，业务与文件操作仍在各自服务/adapter：

```text
桌面 Studio 图标 → Windows 薄窗口 → 现有 Web 界面
                                      ↓ 同源 HTTP
终端 / 现有 Agent adapter ───────→ Authoring API → 各模块自己的服务/文件 adapter
                                                   ↓
                                        原 Markdown / 各模块 data.ts

未来私人模式：可信本机选择密文主文件 → 内存解密/完整包校验/模块编辑/受控预览
                                      ↓ 重新加密
                           受限密文文件 adapter → 仓库外主文件
                                      ↓ M15 显式交付
                            固定 public/vault/bundle.json
```

M8 采用 **WinForms + WebView2 最小 Windows 宿主**，复用现有 Web/API；这是对首版“无桌面原生 App”的有限扩展，不引入 Electron/Tauri/PWA。宿主目标 net8.0-windows/x64，SDK 8.0.404 / latestPatch、WebView2 包精确 1.0.4258.31 并锁定还原；需 .NET 8 Desktop Runtime 和 WebView2 Evergreen Runtime，装有 Edge 不代替检测。窗口先处理缓冲，再等待自有 API 清理，不靠 unload 请求承诺退出。依据：[微软 Runtime 分发](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)、[FormClosing](https://learn.microsoft.com/en-us/dotnet/api/system.windows.forms.form.formclosing)、[WebView2 安全建议](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/security)。实际验证与待验边界见 [9.24](#studio-m8-record)。

日常默认一个图标：双击启动，重复点击激活已有窗口；“退出 Studio”和窗口 X 走同一协同关闭流程。未保存时提供保存并退出/放弃并退出/取消；保存失败或结果未确认时不清空缓冲、不自动重试。预览/AI 可取消，进行中写入须先确认结果；正常退出后停止本次 App 拥有的服务并释放锁。保留备用停止方式；不默认托盘常驻或开机启动。

服务归属必须明确：App 只自动停止自己启动并确认身份的实例；终端启动的已有服务不被默默接管或杀死。Agent 仍可使用独立 HTTP 模式，退出 stdio 不停止服务；App 所有的 API 在窗口退出后会结束，活动 Agent 请求须有明确中断/写入结果未知语义，不能把断线当回滚。不得按进程名批量结束 node.exe，不新增远程 shutdown/通用 shell 端点。

#### 6.10.2 Source of truth、接口与安全边界

- **公开内容**：Think 继续维护 `src/modules/think/content/*.md`；Keep/Me/Build 继续维护各自 data.ts。Web/窗口不直接读写源文件；业务接口不接收任意路径、源码执行指令或终端命令。仅复用现有模型、校验、错误 envelope 形状、认证和 revision 原则，不建立 UniversalContent，也不让其他模块依赖 Think DTO。
- **TS 维护**：只用 AST 识别当前受支持的 `publicBookmarks([...])`、`publicProfile({...或null})`、`publicProjects([...])` 数据表达式；不得 eval/import 不可信候选或正则覆盖整文件。无法安全识别/保留的结构或注释应阻断并给出诊断，不改成空集合。无修改往返保持字节，编辑只触及受管理表达式，其他 imports/外围代码保持；未编辑字段、草稿、条目和数组顺序保持。不可只读公开过滤后的结果再保存，否则会丢草稿。
- **冲突与写入**：三份 data.ts 分别以完整源文件原始字节计算 revision，保存/删除/清空带 expectedRevision；同文件不同条目也要冲突，不做强制覆盖或隐式合并。各模块独立验证候选全体、重复 slug/分类/关联，先校验后受限原子替换。公开状态、保存、Git 与部署分开，已有 slug 首版保持；不迁移为 JSON/数据库以绕过 AST。
- **公开预览**：逐模块复用其真实 Astro 模板，在受限派生副本构建并投影为禁脚本预览；不能把其他模型伪装为 Think，不能为预览先保存源或改 published。仅按实际重复最小复用预览设施，不预建通用编译/插件框架。私人正文永不进入此构建、public 或 `.cache/studio/`。
- **私人源**：M12 先以非敏感样本评估仓库外加密主文件作为唯一作者源，内存解密编辑，保存重新加密；网站 bundle 是派生交付物。若采用，作者须在本机确认旧外部 JSON 的迁移及备份，不并行维护两份可编辑原本；M12 通过前现有仓库外 JSON/CLI 流程不变。文件选择通过可信本机入口生成受限句柄，密文文件 adapter 绑定该文件并验证 revision，不向网页/Agent 开放任意文件路径。
- **私人会话**：复用现有 Vault 协议、KDF/AES 参数、随机盐/IV/AAD、限额、模块 schema 和关联校验。口令与明文只在受控本机编辑内存，不进入后台 HTTP API、宿主通用消息、聊天、源码、Git、public、缓存、CI、参数、环境、日志或浏览器持久化；加密文件 adapter 仅接收密文。Vault 口令不沿用 AI Key 的 DPAPI 记住机制；真实资料不用于代理验收。默认不接 AI/Agent，不能从当前 Think 写权限推导私人或新模块权限。
- **完整包与交付**：始终保留未编辑模块、稳定 id、资产与关联；只编辑一篇不能覆盖整包。锁定/退出/取消清理 DOM、Blob、预览与引用；不承诺同用户恶意程序/操作系统内存取证隔离。正式包替换先在本机内存完成全模块/资产/Build 关联校验，再加密；后端密文结构校验不能冒充明文业务校验。M15 的显式密文替换仍不等于 Git 提交或网站发布。

`studio/desktop/` 是 M8 的薄宿主，`studio/windows/` 管启动/凭据/进程协作，`studio/contracts/desktop.ts` 定义有限退出消息。`studio/server/{keep,me,build}/` 与各自契约/面板由 M9–M11 分别接入；M12–M15 的纯内存核心位于 `studio/private/`，密文文件/交付 adapter 位于 `studio/server/private/`。不把作者业务放进 src/core、不建立插件注册表。Node 共用根 package/lock，宿主有独立 csproj/packages.lock.json；宿主、NuGet、profile 与构建收据只在 `.cache/studio/`，不进入 dist/public。

#### 6.10.3 顺序、状态与共同验收

| 单元 | 状态 | 交付目标 | 依赖 / 下一边界 |
| --- | --- | --- | --- |
| [M7](#studio-m7) | Done | 恢复可靠启停、快捷入口和启动诊断 | 自动验证与作者桌面验收通过；M8 须另行授权 |
| [M8](#studio-m8) | Awaiting unified acceptance | 单图标 Windows App 与协同退出 | 日常手动操作作者确认；原生专项保留最终验收 |
| [M9](#studio-m9) | Auto verified / Awaiting unified acceptance | Keep 公开编辑器 | M8、原作者 API/预览；下一项 M10 |
| [M10](#studio-m10) | Auto verified / Awaiting unified acceptance | Me 公开编辑器 | M9；下一项 M11 |
| [M11](#studio-m11) | Auto verified / Awaiting unified acceptance | Build 公开编辑器 | M10；下一项 M12 |
| [M12](#studio-m12) | Auto verified / Awaiting unified acceptance | 私人安全设计与隔离原型 | M11；安全与唯一源自动门槛已通过 |
| [M13](#studio-m13) | Auto verified / Awaiting unified acceptance | 私人 Think 编辑器 | M12；自动门槛已通过，下一项 M14.1 |
| [M14.1](#studio-m14-1) | Auto verified / Awaiting unified acceptance | 私人 Keep | M13；自动门槛已通过，下一项 M14.2 |
| [M14.2](#studio-m14-2) | Auto verified / Awaiting unified acceptance | 私人 Me | M14.1；自动门槛已通过，下一项 M14.3 |
| [M14.3](#studio-m14-3) | Auto verified / Awaiting unified acceptance | 私人 Build | M14.2；自动门槛已通过，下一项 M15 |
| [M15](#studio-m15) | Auto verified / Awaiting unified acceptance | 密文交付与整体验收 | 自动门槛已通过，人工清单待反馈；停止，不自动发布 |

M14 是三个独立实施单元，不能一次默认完成全部。以上是交付顺序，服务本身仍不依赖某个窗口/UI；若要调整顺序、技术方案或源格式，先明确新授权，不修改计划绕过前置失败。

**共同 Verification（下称 G）**：每个实现单元实际运行 `npm.cmd run lint`、`typecheck`、`test`、`build`，及受影响 Studio 浏览器交互/网站 smoke；涉及路由、加载、预览或发布输入时复验根/base 和对应 Chromium/WebKit 行为。逐项记录命令/退出码、失败处理、截图与源哈希保护，不过滤真实 pageerror、不用构建替代交互。原发布全门槛只在另获发布授权时执行，不把本路线当上线许可。窗口与启停须真实 Windows 桌面操作，口令/加密只用非敏感隔离 fixture；用户反馈、工具或平台条件未满足的验收项保持待验，不写 Done。本次批量授权下，每项自动与安全验证通过、证据入档后继续下一个已授权单元；真实 App 人工项目统一最后验收，不将待验项标 Done。安全原型若出现未解决技术阻断，不进入依赖阶段。

**共同 Non-goals**：无新数据库、云/远程/多端/手机、账号协作、Electron/Tauri/PWA、MCP、素材上传/自动清理、自动 Git/部署；不重构公开网站、不搬目录、不改变公开/私人展示协议、不升级无关依赖。公开模块不引入私人编辑，私人模块不开放 AI/Agent 或新增资产编辑器；M12 可识别风险，不可为通过原型降低安全参数。

<a id="studio-m7"></a>
#### 6.10.4 M7 — 可靠启停与故障恢复（Done）

**实施授权（2026-10-17）**：作者明确指定仅实施 M7、重建可用桌面快捷入口、完成本项验证并同步文档；保留此前未提交的三份规划文档，不进入 M8，不提交、推送或发布。后续 Pending 单元不因本条获得授权，已完成的规划记录保留为历史。

- **Goal / Scope**：先复现实际桌面失败，核对真实桌面位置、快捷目标、Node/依赖、冷启动构建、就绪/超时、端口与锁状态；修复启动/停止/错误提示并恢复可用快捷入口。正常重开复用匹配源码/锁文件的已构建界面，缺失/过期才做固定构建或给出明确更新步骤，不盲目复用旧 UI。
- **Non-goals**：除共同排除项外，不做 App 窗口、其他内容模块、自动抢锁/批量清缓存、强杀进程、自动安装系统依赖；不改 AI 配置格式或索取现有 Key。
- **Files**：`studio/windows/{Open,Stop,Install-Shortcuts,Launcher}.ps1`、desktop.ts、desktop-state.ts、web-build.ts；`studio/server/main.ts` 仅增加可信父 IPC 断开时关闭自有服务；`tests/unit/studio-windows.test.ts`、非敏感集成验证与三份文档。不改网站/作者模型、根依赖、local.ts 凭据格式，不创建 desktop/。
- **接口 / 数据流**：明确可信启动控制的 status/stop、实例归属、就绪和脱敏失败分类，沿用命名管道/IPC，不新增内容 HTTP shutdown。图标 → 启动检查/必要构建 → 本次 host/API 就绪 → 浏览器；备用停止 → 身份核对 → 正常 close/释放本实例锁。
- **Done Criteria**：实际失败已复现并有证据或明确诊断结论，快捷入口可重建且不覆盖别人的图标；首次/重复启动、停止/重开可用，保存的 AI 配置保持；端口被占/依赖缺失/旧会话能解释和恢复。只有确认旧实例身份及已退出后才处理其残留，不凭 PID 或文件存在强删。
- **Verification**：G；真实桌面双击和备用停止、连续启停、路径含空格/中文、原终端服务共存、占端口/活锁/已退出残留/坏状态/构建失败/缺依赖；分别记录冷/热启动和构建次数。检查锁释放、原文/凭据不变、日志不含正文/token/Key。
- **风险 / 下一边界**：快捷入口修复不等于 App 已实现，普通标签页关闭仍不负责停服务；PID 重用、并发启动和更新中断不能误伤别的实例。通过后仅为 M8 提供可独立验证的可信启动/停止/状态能力。

**验收完成与停点（2026-10-18）**：实现、自动检查与真实快捷目标调用通过后，作者补充确认手动双击启动、重复启动、停止、重开正常，AI 配置保留；M7 的 Done Criteria 与 Verification 已满足，标 Done。此前桌面自动化超时由作者实际操作反馈补齐，不冒称代理完成了双击。完整记录见 [9.23](#studio-m7-record)；不进入 M8，不提交、推送或发布。

<a id="studio-m8"></a>
#### 6.10.5 M8 — Windows App 窗口与协同关闭（Awaiting unified acceptance）

**实施授权（2026-10-18）**：作者明确指定仅 M8 的 Windows App 窗口与协同关闭、验证和文档；保留 M7 与其他已有未提交工作，不进入 M9，不提交、推送或发布。前置 M7 Done；本机已发现 .NET SDK 8.0.404 与 WebView2 Runtime，具体构建/运行和作者反馈须实际验收后记录，不能仅以安装目录存在标 Done。

**补充授权（2026-10-23，当前 In Progress）**：作者明确要求一起优化三点：桌面只保留一个启动图标（正常 X/菜单退出停止自有后台，备用停止仅保留命令）；新文章默认本机当天日期且可修改、已有源不补写日期；排查正式 App 的 AI 配置加载，修复入口差异并显示可操作诊断。只做这三项与验证/文档，不控制桌面，不进入 M9，不提交、推送或发布。此条取代本项“保留备用停止桌面入口”的旧展示约定，不删除底层安全停止能力。

**入口外观补充（2026-10-23）**：作者报告仍看到启动/Stop 两个图标并要求可爱的蓝发二次元形象；本项内核对项目快捷文件、生成原创透明 PNG/多尺寸 ICO，用于启动快捷方式、exe 与窗口，不改公开网站图标。不控制桌面、不强清图标缓存；不存在或无法证实归属的桌面对象不强删，实际显示由作者确认。

- **Goal / Scope**：最小 WebView2 宿主承载现有 Web，单图标/单实例/重复激活；窗口 X 与显式退出统一处理未保存内容、进行中写入、预览/AI 取消及本实例服务关闭。桌面只保留启动图标，备用停止保留命令行；新文章默认本机日期且可修改，启动条件、AI 状态和缺 Runtime/SDK 有清晰说明。
- **Non-goals**：不重写 UI/API，不做托盘常驻、开机自启、商店/MSIX/更新平台、跨平台框架或业务文件读写桥；不默认接管终端启动的服务。
- **Files**：`studio/desktop/` 宿主与锁文件；`studio/windows/{app,app-build,desktop,local}.ts`、Launcher.ps1、Install-Shortcuts.ps1；`studio/server/main.ts` 启动配置；`studio/contracts/desktop.ts`、`studio/web/{desktop,main}.ts`、index.html 与退出样式；`tests/{unit,studio}` 中的生命周期、桥契约与浏览器用例，`.gitignore` 及三份文档。
- **接口 / 数据流**：宿主 → 原 M7 控制能力 → API → Web；只增加有限的退出请求/取消/就绪状态消息，业务仍走原 HTTP。消息限定受信任顶层 Studio origin 与已知类型，预览/任意导航不能访问 native 能力；不公开 fs/shell/路径/token。宿主关闭先保留窗口等待 Web 处理，再等待自有服务清理；父窗口异常退出的子进程处理须实测。
- **AI 启动边界（2026-10-23 修复）**：Node host 构建后向 API 的私有 Node IPC 发送严格 `studio:start` 与指定的 localCredentialStore；API 直接调用既有 DPAPI 读取，再创建 AI 服务。Key 不经 fork 环境，也不进入 native 协议；测试不指定存储时保留显式环境含义、不自动读取真实存储。坏消息/坏配置或启动中父进程失联均失败并清理自有服务；HTTP/Agent 接口不变。
- **Done Criteria**：双击正常打开无终端窗口，重复激活不启第二服务；取消退出保持全部缓冲与服务，保存失败不丢文；放弃/保存并退出均正常释放本实例端口/锁。窗口不加载任意外站，App 退出不误停手动服务；活动 Agent 断线不被解释为保存回滚。
- **Verification**：G，加锁定宿主项目的实际 build/测试（命令随 M8 项目配置确定）；真实 WebView2 桌面操作、作者本机使用确认；X/菜单退出/未保存取消/保存失败或响应未知/AI与预览运行中退出、重复启动、宿主/子进程异常、重开与中文输入。复验原 CSP/token/CSRF/sandbox、桥越权/外部导航、AI 配置保留。未实测窗口或未取得对应反馈时保持待验。
- **风险 / 下一边界**：新增 Windows 构建链和 Runtime 条件，不预设当前环境已就绪；崩溃不承诺内存草稿恢复，不能以强杀代替正常关闭。M8 交付本机 App，下一项 M9 只增加 Keep，不改变服务与 UI 解耦。

**当前验收停点（2026-10-23）**：三项补充、图标与此前两次启动定位尝试保留在 [9.25](#studio-m8-refine-record)–[9.28](#studio-m8-known-folder-record)。现已用实际双击诊断与文件句柄证明：同路径的文件 IO 被 Codex 打包应用隔离存储重定向，Known Folder 仅统一路径不足以解决。已一次性复用原 DPAPI 密文；作者正常重开后的正式 App 后台 available:true，真实非敏感润色返回 200，见 [9.29](#studio-m8-credential-recovery-record)。M8 改为 Awaiting unified acceptance，AI 加载恢复不替代其余 native 验收；此前主进程异常后的最终取消/退出未签收，历史保留在 [9.24](#studio-m8-record)。不再控制桌面，原剩余 native 专项仍按 [手动清单](./MAINTENANCE.md#studio-m8-manual) 等待对应反馈；不进入 M9。

<a id="studio-m9"></a>
#### 6.10.6 M9 — Keep 公开编辑器（Auto verified / Awaiting unified acceptance）

- **Goal / Scope**：列表/新建/读写/确认删除、类别/来源链接/说明/kind/公开状态、模块校验与隔离预览；从原始 AST 读取包含草稿的完整集合，数组顺序保留。
- **Non-goals**：不抓取来源网页、图标/缩略图或新增排序系统，不做 Me/Build/私人编辑，不迁移 data.ts、不改已有 slug。
- **Files**：未来 contracts/keep.ts、server/keep/、Web Keep 面板与测试；复用 [bookmarks.ts](./src/modules/keep/bookmarks.ts)、原 Keep 页面/样式；生产 data.ts 只由未来作者明确保存时修改，验收用副本。
- **接口 / 数据流**：规划 `/api/authoring/v1/keep` 下 list/read/create/save/delete/validate/preview，使用 Bookmark 自有 DTO、受限 key 与完整文件 revision；具体请求结构在该项实施时锁定，不改 Think 契约。表单 → Keep API/AST adapter → 原 data.ts；预览候选 → 派生副本 → 原 Keep Astro → 受控投影。
- **Done Criteria**：字段/分类一致性/http(s) URL/重复 slug/草稿诊断正确；编辑与预览不丢原条目、草稿或未知于当前面板的已支持字段，不读公开过滤结果后覆盖源。坏/不支持 AST 拒绝写入，旧 revision 阻断整文件保存，未保存预览不改源/根 dist。
- **Verification**：G；AST 正反例、注释与无修改字节往返、多条目/草稿保留、同文件不同条目冲突/删除/原子失败/路径越权；双引擎表单/取消/预览/断线，网站根/base 分类、详情、外链、搜索与计数。
- **风险 / 下一边界**：TS 为可执行源码，受支持字面量范围须明确，不为兼容动态表达式执行代码；整文件冲突需要重读核对。到 M10 才增加 Profile，重复的安全代码仅按实际需要最小复用。

<a id="studio-m10"></a>
#### 6.10.7 M10 — Me 公开编辑器（Auto verified / Awaiting unified acceptance）

- **Goal / Scope**：编辑唯一 Profile 的姓名、介绍、段落、链接与公开状态，明确确认清空为 null，校验和隔离预览；保持单例而非文章列表。
- **Non-goals**：不引入第二份 Profile、slug、多人资料或私人 Me，不改变 Me 的真实资料 count 与 Compass 平均规则。
- **Files**：未来 contracts/me.ts、server/me/、Web Me 面板及测试；复用 [profile.ts](./src/modules/me/profile.ts)、原 Me 页面；仍以 me/data.ts 为唯一公开源。
- **接口 / 数据流**：规划 `/api/authoring/v1/me` 的 readProfile/saveProfile/clearProfile/validateProfile/previewProfile；clear/save 必带完整文件 expectedRevision，null 与取消公开分开。单例表单 → 自有 DTO/AST adapter → 原 source；预览只改派生候选。
- **Done Criteria**：已支持字段完整保留，null/草稿/公开与确认清空各有独立语义；无隐式创建/删除，错类型/链接和旧 revision 阻断；保存后原网站/搜索/计数保持契约。
- **Verification**：G；单例空态、null 往返、字段/链接负例、文件冲突/原子失败与 AST 保护；双引擎编辑/放弃/清空确认/隔离预览，根/base Me、Spotlight 和 Compass smoke。
- **风险 / 下一边界**：不能套用文章 CRUD 导致空资料被自动补造；复用 M9 的已证明读写设施但不引入通用内容模型。下一项 M11 单独处理 Build 嵌套字段。

<a id="studio-m11"></a>
#### 6.10.8 M11 — Build 公开编辑器（Auto verified / Awaiting unified acceptance）

- **Goal / Scope**：项目基本字段、sections、代码段、关键词/链接、status、milestones、updates、issues 的分步表单和完整往返；列表/新建/保存/确认删除、校验与真实隔离预览。
- **Non-goals**：不改项目数据格式、既有 slug 或公共模型，不增加仓库抓取/自动成果生成/进度百分比，不编辑私人补充记录。
- **Files**：未来 contracts/build.ts、server/build/、Web Build 面板及测试；复用 [projects.ts](./src/modules/build/projects.ts) 和 Build 页面/样式，输入仍为 build/data.ts。
- **接口 / 数据流**：规划 `/api/authoring/v1/build` 的 list/read/create/save/delete/validate/preview，Project DTO 与整文件 revision；复杂表单 → 全量候选校验/AST adapter → 原 source，派生预览使用原模块布局，不把 sections 转成另一套 Markdown 正文。
- **Done Criteria**：嵌套已支持字段、代码换行、稳定顺序与未编辑记录保留，更新日期/状态/问题规则正确；冲突不覆盖。已有公开项目删除须考虑私人 supplements.publicSlug：如正式 Vault 存在而无法核对关联，应明确阻断待作者本机核对，不偷偷解密或假称安全。
- **Verification**：G；嵌套/省略/空数组/代码/日期/状态/链接/AST 正反例、不同项目整文件冲突、完整保留及原子失败；双引擎分步编辑/预览/删除；根/base 项目导航、更新排序/隐藏空区块、搜索/计数；关联未知时的阻断使用非敏感 fixture。
- **风险 / 下一边界**：复杂表单最易丢未显示字段；密文存在不能证明无私人关联。到此三个公开模块分别可用且 Think 回归保持，再单独授权 M12，不能顺手实现私人解密。

<a id="studio-m12"></a>
#### 6.10.9 M12 — 私人安全设计与隔离原型（Auto verified / Awaiting unified acceptance）

- **Goal / Scope**：用非敏感完整包明确加密主文件唯一源、旧 JSON 迁移选择、可信文件句柄/密文原子保存与 revision、内存解密/校验/预览、锁定/退出和交付边界；小原型验证可行性，不提供真实私人编辑器。
- **Non-goals**：不读取/导入用户真实私人文件或口令、不自动迁移资料，不在 HTTP/Agent/AI 暴露私人能力；不更改加密协议、降低参数、持久化口令或发明新密码算法。
- **Files**：拟定最小私人纯契约/内存核心、可信密文 adapter 和非敏感 tests/fixtures，具体目录由本项结论锁定；复用 src/core/vault 纯密码代码、各模块 vault.schema/client 及必要公开 Build 关联快照，不把 Node operations.mjs 导入 Web。
- **接口 / 数据流**：候选边界为受限密文 open/read/save(expectedRevision)、本地纯 validatePrivatePayload/encrypt/decrypt/lock；名称与传输在本项锁定，不能先塞通用 HTTP API。受信任选择 → 密文 → 本机内存解密/完整业务校验 → 重新加密 → 同一仓库外文件；后台与宿主文件 adapter 只接密文/受限句柄。
- **Done Criteria**：源/迁移/备份方案明确，未证明的安全点列出阻断；Node/browser 协议互通，全模块/资产/Build 关联校验可用，完整包保留；非敏感 canary 不出现在缓存/日志/网络/构建/持久化/宿主通用消息。错误与锁定不带明文，口令不持久化；无法满足则不进入 M13。
- **Verification**：G；非敏感测试包的错误口令、篡改/KDF/限额/schema/资产/关联负例、文件句柄越权/冲突/写失败、锁定/退出/迟到异步结果、WebView2 桥与用户数据目录/缓存排查；在本机内存重验候选，不能只检验 envelope。将 Runtime/OS 限制和不承诺本机恶意程序隔离写清。
- **风险 / 下一边界**：加密保存和发布副本容易被误当两份可编辑原本；纯模块 schema 不等于所有关系校验。通过后输出稳定的内存完整包与密文存储边界给 M13，现有 JSON/CLI 维护在显式迁移前仍有效。

**本项锁定的原型边界（2026-10-23）**：私人完整 payload 只留在 Studio 私人内存会话；沿用四个 vault.schema、全包资产与最新公开 Build 关联校验，校验不把归一化结果覆盖未编辑原数据。复用原 Web Crypto，不持久化口令。仓库外密文主文件是唯一作者源，正式 bundle 仅交付副本。旧 JSON 不自动迁移：作者继续在仓库外使用既有 CLI 完成加密，验证后显式选择该密文作为主文件，并保留加密备份；本路线不增加明文导入或持久化接口，也不让 JSON 与密文同时成为可编辑源。文件由可信本机选择器授权为一个受限句柄，前端只拿句柄，不传路径；backend 仅读写结构合法密文，整文件 revision、受限原子替换与旧密文备份。独立 HTTP/Agent/AI 默认没有文件选择和私人明文能力。原型先用非敏感数据验证原生选择/桥边界、Node/browser 互通及 WebView2 内存/缓存行为；不提供真实私人内容编辑，不降低参数。


<a id="studio-m13"></a>
#### 6.10.10 M13 — 私人 Think 编辑器（Auto verified / Awaiting unified acceptance）

- **Goal / Scope**：在已验证私人会话中打开/创建完整包，管理私人 Think 的列表、新建、编辑、确认删除、模块校验、受控预览和加密主文件保存；保留其他模块与资产。
- **Non-goals**：不编辑其他私人模块或资产，不导入真实资料作为验收，不接 AI/Agent，不替换正式网站 bundle，不通过公开 Astro 预览或添加 published/公开 slug。
- **Files**：按 M12 确定的私人内存核心/存储边界、Web 私人 Think 面板与隔离测试，复用 Think vault.schema/client/受控渲染；不修改公开 Markdown 模型。
- **接口 / 数据流**：解密后的完整 payload 持于私人会话，私人 Think adapter 用原稳定 id 产生候选；校验全包及资产 → 内存预览 / 重新加密 → 带 expectedRevision 保存仓库外主文件。正文/口令不走原 Think HTTP；无单条目覆盖整包接口。
- **Done Criteria**：只改目标条目，其他模块/id/资产原样保留；坏源拒绝、旧密文 revision 冲突、保存失败保留内存候选；锁定/退出清理预览及引用，取消退出不丢内容。公开源/根 dist/正式 bundle 不变。
- **Verification**：G；私人与公开 Think DTO 混用负例、非敏感完整包增改删/读回、拒绝 published/公开草稿字段、其他模块/资产保留、迟到解密/预览、锁定/关闭、磁盘/网络/日志 canary；真实 Windows App 交互与 Node/browser 加密互通，不以 mock 加密签收。
- **风险 / 下一边界**：私人正文语法沿用受控规则，不能假定等同公开 Markdown/HTML；退出或崩溃不承诺草稿恢复。只在本项全通过后授权 M14.1，不顺带做正式密文交付。

#### 6.10.11 M14 — 其他私人模块（分三个独立单元）

<a id="studio-m14-1"></a>
##### M14.1 — 私人 Keep（Auto verified / Awaiting unified acceptance）

- **Goal / Scope / Non-goals**：仅新增私人收藏的模块表单/增改删、校验和受控预览；复用 M13 完整包会话，不改公开 Keep、私人其他模块或资产，不接 AI/Agent/发布。
- **Files / 接口 / 数据流**：M12 确定的私人 Keep adapter、Web 面板/测试；复用 keep/vault.schema.ts 与 vault.client.ts 的自有模型/id。私人收藏候选 → 全包校验/内存预览 → 原加密保存能力，不走公开 Bookmark/TS 文件 API。
- **Done Criteria / Verification**：G；原字段/类别/URL/稳定 id 及非法输入覆盖，增改删与锁定/退出实际交互通过，整包未编辑模块/资产与密文 revision 冲突验证，公开源/正式包不变。
- **风险 / 下一边界**：不能把公开 Bookmark DTO 当私人记录而增加 published/slug；验证通过只进入另获授权的 M14.2，共享层只复用已存在的私人会话。

<a id="studio-m14-2"></a>
##### M14.2 — 私人 Me（Auto verified / Awaiting unified acceptance）

- **Goal / Scope / Non-goals**：仅编辑既有私人 Me 模型的 paragraphs/links 及其受控预览；保留公开 Me，不制造 name/description 或第二份公开 Profile，不实现私人 Build/新资产或其他扩展。
- **Files / 接口 / 数据流**：私人 Me adapter、Web 面板/测试，复用 me/vault.schema.ts 与 vault.client.ts；模块候选 → 完整 payload 校验 → 内存预览/重新加密保存，不直接写 me/data.ts。
- **Done Criteria / Verification**：G；真实支持的字段、空态/取消/确认清空/非法值、锁定/退出及冲突通过；其他模块、id/资产与公开输入不变，不用公开 Profile 的 null/published 语义覆盖私人模型。
- **风险 / 下一边界**：私人介绍与公开资料字段不必相同，不能靠同名自动合并或迁移；通过后再授权 M14.3。

<a id="studio-m14-3"></a>
##### M14.3 — 私人 Build（Auto verified / Awaiting unified acceptance）

- **Goal / Scope / Non-goals**：仅支持现有私人独立 projects 与公开项目 supplements、嵌套记录及受控预览；不新增公共项目/改公开 slug，不编辑资产，不自动公开私人补充。
- **Files / 接口 / 数据流**：私人 Build adapter、Web 面板/测试，复用 build/vault.schema.ts、vault.client.ts 及 server 关联规则的安全共享部分；候选 + 当前公开 Build 只读快照 → 完整关联校验 → 内存预览/重新加密保存。
- **Done Criteria / Verification**：G；两类记录、稳定 id、嵌套字段/状态/日期、重复/缺失 publicSlug 与资产负例；公开项目在编辑中变化时重验关联，不用过期快照签收；其他模块、公开源和正式包保持，锁定/退出/冲突通过。
- **风险 / 下一边界**：schema 通过不代表补充目标仍存在，公开文件 revision 变化须使相关校验失效；三个 M14 子项全部通过后才可授权 M15。

**原模型核对**：build/vault.schema.ts 与 vault.server.ts 允许不同 id 的多条 supplements 关联同一个 publicSlug；本项沿用该规则，不增加 publicSlug 唯一限制。重复校验覆盖项目/补充的 id 冲突、合法同目标记录保留、目标缺失与编辑中公开源变化，不用公开项目 DTO 覆盖私人模型。

<a id="studio-m15"></a>
#### 6.10.12 M15 — 密文交付与整体验收（Auto verified / Awaiting unified acceptance）

- **Goal / Scope**：区分加密主文件保存、密文候选导出、正式 bundle 显式替换；提供备份、候选身份/版本检查及恢复路径；完成 App、公开/私人编辑与现有网站兼容的整体验收。
- **Non-goals**：不新增自动 Git commit/push/deploy、GitHub 凭据、通用发布 adapter、真实资料录入、云备份/同步或任意输出路径。测试可以验证发布候选，但不构成实际网站发布许可。
- **Files**：按 M12 锁定的受限密文交付能力/私有 Web 会话与确认界面、集成测试及手册；复用现有 envelope/crypto/backup/restore 思路，唯一仓库目标为固定 public/vault/bundle.json。真实正式包只在未来作者明确选择交付时修改，验收仍用隔离 fixture。
- **接口 / 数据流**：完整候选在作者本机内存重验模块/资产及最新公开关联 → 重新加密 → 仓库外候选/备份 → 显式确认及目标 expectedRevision → 固定正式 bundle 原子替换。后端只处理密文、限额/身份/结构，不接口令或假称已复验明文；主文件与交付副本不能双向编辑。Git/部署仍由作者按既有流程另行授权。
- **Done Criteria**：源版本/关联变化使候选失效；用户能区分保存与交付，取消/写失败保留旧包，显式恢复可验证；全部四模块与资产兼容原网站解锁/搜索/计数/锁定，公开内容保持完整；从点击图标到退出的操作闭环通过，所需作者本机反馈齐全。
- **Verification**：G；完整包两端互通、导出/确认/取消/备份/恢复/冲突/失败、受限路径/密文版本与关联负例；隔离网站根/base×两引擎四模块公开/私人、导航/后台/锁定/数据清理，App 正常/异常退出复验。使用现有 release/Vault 边界验证候选无明文、凭据、Studio 或测试文字；未获发布授权不执行 Git/Actions。
- **风险 / 下一边界**：替换正式 bundle 已形成待发布改动，须清楚显示但不能自动上线；旧加密备份仍用旧口令，不能承诺远程销毁旧版本。M7–M15 全部必需项与真实验收满足后才能宣布本路线完成，到此停止，无下一自动实施项。

**实现边界**：`PrivateDelivery` 只协调仓库外新候选、主文件目录中的旧正式包密文备份与固定 bundle，复用 `CipherFiles` 的 SHA-256、文件身份、受限路径和原子写入。可信启动注入 `createPrivateDelivery`，native export 选择不替换主文件句柄；HTTP 仅新增 status/export/replace，契约见[维护手册](./MAINTENANCE.md#studio-private-delivery)。浏览器先重验完整包、当前主文件口令/内容与公开关联，再重新加密；后台只核验密文结构及各文件/关联版本。候选能力只在当前会话有效，修改或锁定需重新导出。旧正式密文备份在仓库外，不污染 public；结果未知禁止自动重试，可只读 SHA 核对。跨文件检查不承诺同权限外部进程的 OS 事务隔离。

**验收发现的最小兼容修复**：完整 WebKit 回归暴露既有 Compass SVG 的 Tab 可达性与 movementX/Y 为零的问题；仅补显式 tabindex 和坐标变化判断，保持现有导航/统计/返回清理契约。Spotlight 动画测试在页面内记录真实 CSS 动画中点，保留模态与结束焦点断言，避免测试端往返耗时错过完整关闭动画；产品动画时限保持。失败证据、修复后复验及唯一网站源码改动集中记入 M15 收尾记录，不重构网站或扩大为新功能。

**当前批量授权（2026-10-23）**：作者明确要求 M9–M15 连续实施，并确认“同意，人工验收最后统一进行”。M14 三子项仍分别实现与验证；每阶段自动门槛及安全验证通过后继续，不因人工待验停住下一项，也不将未验收项标 Done。M8 日常清单收到“ok了”反馈，原生专项仍待最终统一验收；最多一个实施单元 In Progress。仅使用非敏感隔离数据，不导入真实私人资料，不操作桌面，不提交、推送或发布；各项技术风险若无法满足则记录具体阻断。

<a id="studio-authoring-plan"></a>
### 6.11 Studio — 日常启动优先、Think/Build 自动录入审核与一键发布（批量实施，最终统一人工验收）

**当前批量授权（2026-10-31）**：作者明确要求继续后续计划至 M23、完成后一次性人工验收。按现有主线 M16.3 → M19.1 → M19.2 → M20 → M23 分项实施，每项自动验证通过后继续；真实 App、性能、远程 AI 与真实发布的必需反馈单列待验，不标 Done，不再以人工反馈串行阻塞本批已授权的下一项。作者已明确确认 M21/M22 保持延期，不在本批恢复。保留已有工作，不控制桌面，不实际提交、推送或发布；实现发布能力不等于获准对真实仓库执行发布。
M18 的实现和自动验证保持，其状态从 In Progress 归为 **Awaiting author acceptance**，只记录原生选择器/协同关闭待作者反馈，不标 Done，也不因新主线取消验收；它移出公开录入发布的串行前置。共享启停、凭据、关闭和安全回归仍是新主线的必需门槛。M16.2 的失败数值、原目标与 Deferred 状态保留；新启动架构不能用改名或改计时口径把原目标写成已达标。

此前规划依据见 [9.48](#studio-focus-plan-record)。M16.3 已实现准备/运行分离，自动验证见 [9.49](#studio-m16-3-record)，真实 App/性能待统一验收；录入和发布按本批范围逐项实施，不将计划按钮冒充交付。

以下为此前授权/验收背景，不代表当前执行顺序；当前主线与状态以 6.11.6 为准。

**授权与停点（2026-10-30）**：作者认可本节方案，明确本轮仅整理 PLAN 并同步 README、MAINTENANCE，不开始实现，不控制桌面，不提交、推送或发布。以下目录、接口、界面和流程均为目标设计，不代表已经存在。顺序、依赖和 Pending 不构成实施授权；后续须明确指定单元或批量范围。作者“功能上似乎没什么问题”的反馈不替代原专项验收，M8 与 M9–M15 的既有状态、范围及 9.1–9.38 历史保持。

**M16.1 实施授权（2026-10-30）**：作者单独授权启动基线与反馈及验证/文档；不进入 M16.2、不控制桌面、不提交/推送/发布。上段是规划入档时的历史停点；其余单元没有实施授权。原先等待真实基线及目标的停点见 9.40–9.41；本轮收尾按下述确认执行，不将隔离后端样本冒充真实窗口指标。

**手动基线确认（2026-10-30）**：在 manual 目录核实 6 份独立有效普通冷启后，作者明确选择“就这六次就够了吧”，据此将本机工程基线样本数由原计划至少 10 次改为 6 次，不要求补测，也不凑足十次。作者已确认启动、重复激活、关闭重开、AI 配置正常。诊断完成时刻与人工正常反馈共同作为验收依据，未收集双击到可见/可编辑的秒表数值，也未收集真实首次准备/源码更新/激活耗时；这些未测值不纳入基线或性能结论，不冒称真实首次准备已计时。M16.1 已收尾，[记录](#studio-m16-1-acceptance)保留统计、原条件调整及限制，9.40–9.42 历史不回写。

**M16.2 已有实施与验收（2026-10-30）**：作者此前单独授权优化启动关键路径；实现/自动验证见 9.43，随后六次正式 App 检查见[9.44](#studio-m16-2-manual-review)。普通编辑已延迟 Markdown/AST 重依赖，安全/凭据/退出合同保持；实测 editor-ready p50 2261ms 未达 1844ms，其余三项门槛通过。作者现决定余项以后再做、继续下一阶段，当前记 Deferred，保留目标及失败证据、不标 Done；不再要求重复测同一版。M17 的本轮授权与依赖例外见下方，不沿用旧验收停点阻塞已明确获准的下一项。

#### 6.11.1 目标与真实源码依据

产品主线收敛为 **文章/项目的审核发布助手**：快速打开 → 放入一份文字或 Markdown/项目报告 → 自动整理并填写 Think/Build 字段 → 本人核对事实、补缺项和预览 → 保存草稿/修订，或一次精确批准后发布。日常以自动录入为主，原手动表单作为精调与备用入口；不要求作者日常逐字段从头录入。没有依据的贡献、成果、日期不自动补造。

保持一个 Git、现有目录、Windows 薄宿主、本机 Authoring API 和真实内容源。复用已实现的 service、校验、序列化、冲突、预览与文件保护。主线不迁移前端框架、不另建 CMS，不开启网站 Phase 5/6。录入审核是自动录入流程的入口。发布能力见 M23 实际合同，工作区当前入口与布局见[写作体验升级](#studio-writing-workbench)。

| 已核对的代码 | 对规划的约束 |
| --- | --- |
| `studio/windows/desktop.ts`、`app.ts` | 当前宿主准备、Web 准备、后端和凭据依次就绪后才显示 App；首次可见和首屏可编辑是两个指标 |
| `studio/windows/app-build.ts`、`web-build.ts` | 已有指纹缓存，不是每次重编译；命中时仍做 SDK 探测、源及产物校验，失效才 restore/build 或 Vite build |
| `studio/windows/local.ts`、`studio/server/main.ts` | 定位存储与读取配置分别调用 PowerShell，当前在 API 启动前读取 AI 配置；分段包含导入/IPC 等成本，不能视为纯 DPAPI 耗时，减少开销仍须保留后端凭据隔离 |
| `studio/server/http.ts`、`source-preview.ts`、`source-expression.ts` | 预览服务对象仍保留原生命周期；M16.2 将 Markdown 编译器延至首次合法预览、TypeScript AST 延至首次 data.ts 解析。普通打开不执行整站 Astro build；模块 SourceFiles 原有部分惰性创建未冒称为新优化 |
| `studio/web/private.ts`、`workbench.ts`、`styles.css` | M17/M18 已统一面板并将资料库本机保存与网站更新分开；选择前锁定，隐藏仅保留非敏感选择事务，写入未知需核对。此能力保留，原生验收未齐，不继续扩展 |
| `studio/contracts/think.ts`、`build.ts`、`src/modules/build/projects.ts` | 已有 ThinkDocument 与 Project；项目已有章节、代码、阶段、进展、问题，无须 UniversalContent |
| `studio/server/build/service.ts` | Build 草稿也做完整业务校验，revision 覆盖整份 data.ts；不完整提案不能先写入源文件 |
| `studio/contracts/ai.ts`、`studio/server/ai/suggest.ts` | 现有五种 Think 文本建议输入/输出各 32 KiB、输出最多 4096 tokens，不具备项目字段提取能力 |
| `studio/adapters/agent/client.ts`、`.github/workflows/deploy.yml` | 现 Agent 默认只读、写入仅 Think 且保护 published；push 只检查，正式部署需 workflow_dispatch |

#### 6.11.2 目标架构与目录边界

```text
更新准备（开发/更新时） → 校验并准备兼容的宿主 / Web / backend 版本 → 就绪产物与收据
日常启动               → 验证就绪产物 → 尽早显示窗口 / 本机 Authoring API

拟定主入口：导入材料 / 待审核 → Think 或 Build 专属候选 → 本人审核
              ↑                  ↑                        ├─ 保存草稿/修订 → 原模块 service
         文字 / UTF-8 MD      确定性解析或百炼整理           └─ 审核并发布 → M23 固定发布协调
                                                                  ↓
                                                       真实 Markdown / data.ts
                                                                  ↓
                                                       固定 Git / 受检 Pages 产物

现有手动编辑：精调与备用入口，继续调用相同模块 service
Keep / Me / 私人资料库：现有次级工具保留，私人不进入上述公开流程
Pi Skill / DOCX 等：主线完成后另行授权的输入适配，不阻塞首版发布
```

- **源与客户端**：Markdown、各模块 data.ts 继续为公开 source of truth；仓库外加密主文件继续是私人作者源。UI 不直接操作文件系统；Web、以后 Agent/其他客户端均复用 Authoring API，不把业务写死在表单或 Skill，不建立正文同步镜像。
- **提案是审核对象**：共同 envelope 只复用 id、来源、诊断、状态和版本等流程字段；ThinkProposal 与 BuildProposal 各持模块专属候选，完整验证后才成为合法 ThinkDocument / Project。未完成候选可缺项，但不得伪装为合法源 DTO；不建立 UniversalContent、通用工作流或插件框架。
- **实际位置**：M16.3 在 studio/windows/ 增加 prepare/prepared/run/runtime-build，复用 studio/desktop/ 薄宿主和派生缓存。M19.1/19.2 增加 studio/contracts/proposal.ts、studio/server/intake/ 和 Web intake。M20 扩展现 studio/server/ai/organize.ts。M23 增加 studio/server/publish/、contracts/publish.ts、web/publish.ts、scripts/release/record.mjs 及固定 workflow 接点。M21 的 studio/skills/personal-space-intake/、薄 Agent 客户端和 M22 的文档提取器保持延期，不预建占位目录或按钮。
- **保留职责**：模块 service/validation/序列化/原子写入/预览继续复用，提案不自行重写 Markdown/data.ts。Node 仍共用根 package/lock，Studio 不进入访客网站 runtime、public 或 Pages 产物；就绪版本也是可重建程序产物，不是内容源或数据库。
- **输入与审核**：首版只接一份文字或 UTF-8 MD/项目报告、一个 Think/Build 目标。类型识别可以给建议，实际类型/已有目标由本人确认；不按标题自动覆盖。M19 先打通确定性结构化报告与审核，普通材料在 M20 才可显式自动整理。Keep/Me 不扩录入/AI/Agent 权限。新建“保存草稿”固定 draft，已有修订保留 published；发布态变化只在 M23 的明确最终批准中展示和处理。
- **私人边界**：私人不进公开收件箱、远程 AI、Pi/Agent 或公开预览构建，不纳入本轮 M23 发布自动化。现加密参数、全包保留、锁定、备份与 M18 待验保持。拟公开材料也可能含未发布信息，远程整理前展示本份选中材料与发送范围；点击对应“自动整理”动作才发送，不逐字段重复询问、不默认外传。

#### 6.11.3 日常启动与默认工作台

**当前实测依据**：此前六次 native/Web 缓存命中的宿主内 editor-ready p50 为 2261ms，原 1844ms 目标未达，见 9.44。作者本次反馈后读取的最新诊断为 updated-or-recovery，native/Web 都 changed：宿主准备 4637ms、Web 准备 1204ms、backend-start→api-ready 2591ms、API→编辑器握手 1200ms，另有起始 21ms，宿主总计 9653ms。此为一份源码变化后的重建记录，不能当普通冷启分布，也未包含 PowerShell 启动器和先前导入等双击全链路成本；固定副本见本轮文档记录。现有证据指向重建及串行准备，未证明功能数量是主因。

**M16.3 已实现架构，真实性能待验**：把“准备更新”和“日常运行”分开。准备端在明确开发/更新动作中检查源码、锁定依赖及 SDK，构建并验证兼容的一套宿主/Web/backend 与依赖身份，成功后才供下一次启动使用。日常端只消费完整就绪版本、校验实际产物/身份和单实例归属，不在打开路径执行 dotnet SDK 探测、restore/build、Vite/npm 或全源码指纹遍历，不依赖 NuGet 网络。缺失/损坏/版本不匹配时明确提示需准备及失败原因，不静默运行半套新旧混合版本，不在每次双击中隐藏编译。

保留既有安全和可信启动边界，不仅信 mtime 或删 hash/链接/所有权检查。准备失败不能替换此前完整有效版本；若沿用旧版必须显示其版本及待更新事实，不能让当前新后端搭配旧 Web。更新与运行共用既有启动/实例归属协调，不强停窗口、不覆盖运行中缓冲；只在明确完成准备后、正常重开时切换。原单桌面图标、重复激活、窗口 X/菜单协同关闭与停止自有后台保持，不以退出后常驻来提速。

窗口应在 API/AI 等准备完成前尽早显示真实状态，编辑就绪只在列表和输入确实可用后确认；不靠早发 ready 报快。AI 自动读取原 Known Folder/DPAPI 存储，按实际依赖与 API/窗口准备解耦，准备中/失败/未配置分别显示，不要求重录 Key，也不将 Key 交给窗口。预览、私人及次级编辑能力按需初始化，使用时仍运行原完整校验；锁定与安全清理不能延迟。

**工作台主线**：保留 M17 的系统中文字体、浅色中性背景、低饱和蓝色操作、统一焦点/错误与 PC 缩放布局。M19.1 首先增加真正可用的文章导入与待审核入口；M19.2 再增加项目。主要视图展示材料、候选、来源/缺项和预览，原表单为精调；已有 Keep/Me/私人入口放次级工具而非删除。M20 增加显式自动整理，M23 到位才出现发布及准确状态，不提前放未实现的设置/导入/发布占位，不改访客 Home/Compass/Spotlight。

M18 的资料库/网站更新向导只保留现实现与待验清单，技术详情和三种密文身份不合并；不为主线引入记住口令、私人 AI、Agent 或自动部署。它不阻塞公开主线，但共享生命周期、安全及已有未验风险在受影响实现中必须回归。

#### 6.11.4 资料、提案、事实与审核合同（已实现，实际 App 待统一验收）

1. 选择文章/项目，粘贴文字或明确选择 UTF-8 Markdown；结构化报告确定性识别，普通材料到 M20 才可显式请求百炼整理。不会默默再调用一次模型。材料中的代码、链接、仓库说明及提示词都只是数据，不执行、不授予工具/路径/发布权限。
2. 形成模块候选、缺项、警告与逐字段来源依据。报告需区分项目功能、本人贡献、已完成、计划及未知事项；代码存在不证明本人完成，个人经历、成果、日期、性能数字无依据就待确认。引用材料片段/段落位置，Git 来源按可得的文件及提交标识，不让模型凭空制造出处。
3. 审核页并列材料/成稿/字段，可进入原模块表单精调、校验和预览。未知字段、错误结构、缺失资产或关联、超出限额不能以默认空值或虚构内容补齐；不静默截断。每阶段明确材料/条目/存储/并发与模型输出限额。
4. 本机公开提案收件箱放仓库外应用数据位置，固定受控目录、逐条 JSON 与原子写入/版本检查，无数据库。记录本份已选材料、hash、候选、来源诊断、明确目标和源版本，不含 Key/token、其他文章或私人资料；不会自动扫描整仓库。损坏条目拒绝而不替换空提案。明确展示其为本机拟公开资料存储，提供丢弃/容量管理，不能把普通缓存清理当收件箱清理。
5. 批准绑定 `proposalId + proposalRevision + candidateHash + target + expectedSourceRevision`。提案版本是受保存记录内容约束的版本，不靠 mtime；候选 hash 由服务端固定序列化快照产生；源 revision 沿用原始文件字节 SHA-256。候选、来源材料、目标或源发生变化，原批准失效；模型迟到结果不能改写已审核候选。新建目标仍须在真实提交边界重验不存在/slug 唯一。
6. 本人点“批准并保存草稿／修订”才走原 service。新内容固定 draft；已有内容明确更新时保留原 published，不隐式取消公开或上线。Build 继续整文件 revision 和其他条目保留；Think 保留文件身份/未改字段。结果未知先核对源和回执，不盲重试。
7. 应用成功即清除收件箱中的候选正文/原材料，或仅留不可编辑的 hash/源 revision 回执；此后编辑重新读真正内容源，不把收件箱当第二份可编辑正文。失败保留待审条目并准确报告，不能因传输失败声称源未写入。

“保存草稿/修订”与 M23 的“审核并发布”是可选分支，不能把前者变成用户必须先点击的一道额外手续。后者可从已审核提案或真实内容源准备精确发布候选：复用原模块规则、在隔离候选中体现明确的 published:true 及源差异，最终批准绑定提案版本/hash、源版本、精确补丁与 Git 目标。才执行获批范围的源码落地与发布。未获发布批准时，原 apply 的新建 draft/既有状态保护保持，AI 或 Skill 不获得 apply/publish 权限。prepare/execute 合同已在 M23 锁定，见下一节。本批只实现/隔离验证，没有真实发布。

| 已实现 API（前缀 `/api/authoring/v1`） | 职责与约束 |
| --- | --- |
| `POST /intake/think`、`POST /intake/build` | 接收 {material,format,target?}，确定性生成模块专属提案，不调用 AI。显式整理使用各模块 /organize |
| `GET /proposals/:id` | 读取提案/诊断/版本，无源文件写入 |
| `PUT /proposals/:id` | 带 expectedProposalRevision，仅编辑待审对象，不隐式应用或改变 published |
| `POST /proposals/:id/apply` | 核对精确批准及原模块当前校验/源版本后保存，返回源 revision 与应用回执，不提交或部署 |

另有 GET /proposals 列表、DELETE /proposals/:id（expectedProposalRevision）、POST /intake/think/organize 与 /intake/build/organize。DTO 以 contracts/proposal.ts 和 intake/service.ts 为准。不提供通用 path、shell、任意 URL 下载端点。沿用 loopback、同源/Host/token、限额/错误不泄露正文的保护。未完成提案可以存储，不能绕过原模块保存校验。

#### 6.11.5 首版一键发布与延期输入适配

**M23 前移到 M20 之后**，首版仅覆盖公开 Think/Build，由现有文字/Markdown 入口即可完成闭环，不依赖 Pi、DOCX/PDF、Keep/Me 或私人交付的新增能力。这里的“一键”是本人一次最终确认授权精确范围后，程序自动完成固定步骤，不表示跳过审核、校验、Git 保护或部署核验。

当前提供“批准并保存草稿/修订”和“审核并发布到网站…”两种动作。后者在一次明确的最终确认内编排固定校验/构建/提交/推送/手动 workflow，底层职责继续分开，不每步重复问同一已批准操作。该单元的实施授权不等于实际提交/推送/发布许可，本轮仍无这些许可。具体要求：

- 批准精确 diff、目标仓库/分支、内容与源版本，变化即失效；不 git add -A，不按整份 Build data.ts 白名单混入无关修改。保护既有 dirty/index；从确认基线生成仅含获批补丁的隔离候选，无法分离则阻止，不自动 stash/reset/强推/提交 Studio 开发工作。
- 对同一冻结候选做规定检查，固定获批提交；现 workflow 需增加期望 SHA 守卫，不能仅凭点击时 main 的值或发布后发现错 SHA。沿用 check 后部署同一 artifact，不重建，不把 GitHub 权限放进浏览器或复用 AI Key。
- “已保存／待发布／部署中／已上线”分别显示；published:true 仅表示构建纳入。“已上线”需核对 run、获批 SHA、产物与线上结果，不能只靠源字段或 push 成功。发布回执只存运行/版本元数据，不另存正文。
- 失败显示具体已完成边界，例如“源码已保存，部署未完成”；提交、推送、dispatch、部署的未知结果先查 Git/run，不盲重试、不假称整体回滚。首版不增加私人/Keep/Me 自动发布；既有私人密文交付继续手动、独立于此主线。未来若另获授权纳入私人发布，也只能使用本人已批准的正式密文，不能从提案或私人内存取明文。

**M23 实现锁定**：一次只处理一个公开 Think/Build。prepare 接收已保存提案 {proposalId,expectedProposalRevision} 或真实源 {module,key,expectedSourceRevision}，生成两份只读差异（远端 main 与本机落地）及 bindingHash。批准绑定提案/hash、整份源 revision、精确树、远端 main、本机 HEAD/index 和固定目标。后续变化重新准备，不按标题覆盖，不提供原始路径/命令。

隔离 clone 仅是派生检查目录，不是另维护一个仓库。提交始终以最新远端 main 为父，只改目标内容。Build 专用 serializeEntry 保留非目标条目全部原始字节/注释，原通用 CRUD 序列化不变。本机原分支 HEAD/index 不移动，源通过原 service 保存，后续发布继续基于远端，不自动合并开发工作。当前检出分支与远端可能因此不同步，后续维护时另行审查合并。

固定执行顺序为隔离精确提交 → 规定检查与资源守卫 → 原源保存 → GitHub Git Data 上传相同 blob/tree/commit（逐一核对对象 SHA）→ GraphQL updateRefs(beforeOid=获批基线,afterOid=受检提交,force:false) 原子快进 → 唯一 studio_request+expected_sha dispatch → run/同产物/线上哈希及 Chromium/WebKit 核验。固定 github.com API 使用本机 gh 的既有认证，只留后端（依据 [GitHub CLI](https://cli.github.com/manual/gh_api) 与 [RefUpdate](https://docs.github.com/en/graphql/reference/git#refupdate) 官方合同）。百炼 Key 不交给 Git/构建/窗口。工作流先核对 expected_sha=GITHUB_SHA，部署前再次核对 check 输出和远端 main，部署仍消费同一 check 的 artifact，不重建。

| M23 HTTP（同一前缀） | 职责 |
| --- | --- |
| GET /publish。GET /publish/:id | 本机元数据回执列表/状态，不返回正文 |
| POST /publish/prepare | 上述两类引用，返回精确差异、绑定、执行条件。无源写入或远端变更 |
| POST /publish/:id/execute | {bindingHash,approvePublication:true}，一次最终批准。202 后轮询状态，重复执行拒绝 |
| POST /publish/:id/reconcile。/verify | 空对象。只查询外部边界或重做既有产物/线上核验，不重新上传/dispatch |
| POST /publish/:id/close | {expectedStatusRevision,acknowledgeUnverified:true}，本人核对后结束未验记录，不撤销副作用、不称上线 |
| DELETE /publish/:id | {expectedStatusRevision}，只删已结束元数据，不删内容或远端提交 |

元数据位于仓库外 Known Folder/publications/仓库身份，复用固定普通文件/原子 CAS 存储（最多64份、总16MiB、单份384KiB），含 hash、版本、边界、run/artifact，不另存正文。isolated candidate 位于 .cache/studio/publication-work/UUID。成功后仅清理已核对归属/身份的自有目录，失败/未知保留证据。不能把清缓存当清收件箱。产物上限512文件、128MiB总量、32MiB单文件，显示差异共1MiB。ZIP/tar 在受限内存中验证 CRC/校验和/普通路径，不解压链接或任意路径。

发布回执独立记录源码、提交、推送和调度边界。调度确认后可继续写作或关闭；重开仅读取原 GitHub 运行及线上结果。SHA、批准范围与失败恢复按[最终收尾记录](#studio-think-v1-completed)。

**真实启用前置仍待验**：远端须另获提交/发布许可安装本版 guarded workflow 与 record.mjs。当前远端缺少时 prepare 仍可审阅，但 canExecute=false/REMOTE_WORKFLOW_NOT_READY。真实 gh 权限、Actions 同产物、CDN 文件与实际 App 最终发布未在本批执行，不把隔离模拟称真实上线。失败后“核对外部状态”“重新核对产物与线上”不会重复发布。

**延期且不作为发布前置：M21 / M22**。以下保留原边界，均无本轮实施/安装许可；主线验收完成后是否启动由作者另行决定。

作者已确认使用 Pi Coding Agent。Skill 只负责读取获准项目材料、输出标准可读 MD/结构化报告或调用提案客户端；App 已开时投递同一收件箱，未开时导出文件供下次导入，不自行启动 App 或另起常驻服务。结构化报告可使用带格式版本/目标类型的受控 JSON 块，真正内容仍对应模块 DTO，不导入可执行代码。Skill 源可含 SKILL.md、脚本、参考格式，安装到 Pi/其他 Agent 是后续明确授权动作；App 不做任意 Skill 执行器，不嵌入 Pi、不增加 MCP。依据：[Pi Skills](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md)、[Agent Skills 格式](https://agentskills.io/specification)。

新的客户端默认只提交/读取/修改提案，不沿用 M6 的 `--allow-write`，不暴露 apply、删除源、私人与发布。Skill 工具白名单是防误操作策略，不能隔离已有 shell/仓库写权限的 Agent；现完整会话配对不是多租户授权系统，不能承诺任意 Agent 绝对无法绕过。若需要硬隔离，另规划 OS 权限及后端能力隔离，不借本轮引入账号/OAuth/通用权限框架。Pi 的模型和凭据由其自身配置，Studio 百炼 Key 不复制到 Skill、浏览器或报告。

M22 先支持受控 DOCX 可见文字/表格提取；需要时再支持有文本层的 PDF，扫描 OCR、复杂图表/图片理解、附件迁移暂不纳入首版。明确选文件并通过受限字节或原生句柄处理，不接任意路径；ZIP/XML、尺寸/解压、外部引用与嵌入对象须有负例，不能调用 Office 宏/脚本。丢失语义或不支持内容显示诊断并供本人核对。GitHub 资料第一轮由 Pi/其他已授权 Agent 整理；App 内直接全仓库抓取、私有 GitHub 凭据/OAuth、任意 URL 抓取另行规划。

#### 6.11.6 顺序、状态与共同验收

**本批主线顺序**：M16.3 → M19.1 → M19.2 → M20 → M23。作者已授权逐项实现、统一人工验收；数值编号不改变依赖，真实发布仍未授权。

| 顺序 / 单元 | 状态 | 交付目标 | 依赖 / 停点 |
| --- | --- | --- | --- |
| 1 · [M16.3](#studio-m16-3) | Auto verified / Awaiting unified acceptance | 日常运行与更新准备分离 | 自动验证通过、真实性能/App 待验；已有 M7/M8/M17 能力及共享安全/关闭回归，M18 原生专项不作串行阻塞 |
| 2 · [M19.1](#studio-m19-1) | Auto verified / Awaiting unified acceptance | Think 录入与审核主入口 | M16.3；先无 AI 打通结构化 MD/文字、收件箱与审核保存 |
| 3 · [M19.2](#studio-m19-2) | Auto verified / Awaiting unified acceptance | Build 项目录入与审核 | M19.1；项目模型独立，不以文章模型冒充 |
| 4 · [M20](#studio-m20) | Auto verified / Awaiting real AI and unified acceptance | 自动整理并填写文章/项目 | M19.1/19.2；复用百炼，补缺项/来源核对，不自动写源或发布 |
| 5 · [M23](#studio-m23) | Auto verified / Awaiting real publication and unified acceptance | 审核后一次批准的公开发布 | M20 及主线必需验收。无 M21/M22 前置，真实提交/推送/发布仍需明确范围 |

| 既有 / 延期单元 | 状态 | 保留事实与后续边界 |
| --- | --- | --- |
| [M16.1](#studio-m16-1) | Done | 六次普通冷启基线及限制保留 |
| [M16.2](#studio-m16-2) | Deferred | 主性能目标未达及原 1844ms 目标保留，不以 M16.3 命名代替验收 |
| [M17](#studio-m17) | Done | 工作台实际 App 布局/缩放/中文编辑/取消关闭已验收，见 9.46 |
| [M18](#studio-m18) | Awaiting author acceptance | 实现/自动验证完成，原生选择器与协同关闭待验，见 9.47；只移出主线，不标 Done、不继续扩展 |
| [M21](#studio-m21) | Deferred | Pi Skill 与薄提案客户端；以后另行授权，不阻塞 App 文字/MD 主线 |
| [M22](#studio-m22) | Deferred | DOCX/文本 PDF 等输入适配；以后另行授权，不阻塞 M23 |

**其他功能暂不扩展**：Keep/Me、私人资料库、私人网站更新维持当前可用接口和原待验状态；不删除、不重写为新模型，也不为本次主线增加其 AI/Agent/导入/自动发布。维护安全和修复直接影响主线的回归，不等于另开其功能阶段。

**共同 Verification（下称 H）**：每个获准实现单元运行本项目 lint/typecheck/test/build、受影响 Studio 浏览器交互及页面 smoke；涉及网站/预览/输出时跑对应根/base、Chromium/WebKit 与 release/Vault 边界。保留所有真实 pageerror、失败和平台限制。自动使用非敏感隔离 fixture；不控制桌面，真实首显/选择器/原生关闭由作者操作并记录。旧未验项若实际涉及当前共享路径，须补对应证据，不以本次排序抹去，也不把无关私人专项强加为公开导入发布的前置。必需反馈或检查缺失不能标 Done；本批人工统一收尾依据本轮新授权，不沿用 M9–M15 旧许可。首版主线验收不等于延期功能或整个 Studio 全部完成。

**共同 Non-goals**：不引入数据库 CMS、账号/云同步/远程服务、Electron/Tauri/PWA、新前端框架迁移、通用任务/Agent/Provider/插件框架或 MCP；不搬网站目录/更改源模型，不编辑真实私人材料、不开放私人 AI/Agent、不自动批准/无确认提交发布。原 M7–M15 与 9.1–9.47 的历史不回写。M23 仅为未来公开 Think/Build 的受批准发布范围；本批已有主线实施许可，没有真实 Git 或部署许可。

<a id="studio-m16-1"></a>
#### M16.1 — 启动基线与反馈（Done）

- **Goal**：区分四类启动，找出真实瓶颈并让等待可见。
- **Scope / Non-goals**：分段计时、缓存命中/重建原因、首次可见/首屏可编辑及失败阶段；不先改关键路径、减校验、重录 Key 或承诺秒数。
- **Files**：`studio/windows/{app,desktop,app-build,web-build,local}.ts`、薄宿主必要计时接点、相应测试；文档与隔离证据。
- **接口 / 数据流**：可信内部阶段事件/计时 → 固定非敏感诊断和启动反馈；无新业务 API，日志不含正文、Key、token、私人位置或原始异常。
- **Done Criteria（本轮作者确认调整）**：四类记录可区分；本机普通冷启采用作者确认的 6 次独立样本（原计划至少 10 次），给出 p50/最慢值；首次准备/更新与普通样本分开，未实际计时明确记未测、不混算。作者确认启动及编辑正常，宿主 window-visible/editor-ready 与真实首显/可编辑含义保持区分，未收集的秒表数值不捏造；确定 M16.2 目标，不以无窗口测试冒充首显。调整依据及完成证据见[收尾记录](#studio-m16-1-acceptance)。
- **Verification**：H；有/无缓存、单实例激活、更新、失败和取消 fixture，诊断敏感内容负例；作者手动启动计时。
- **风险 / 下一边界**：测量开销及机器状态影响结果，保留环境/样本条件；完成基线后才按测量实施 M16.2。

<a id="studio-m16-2"></a>
#### M16.2 — 启动关键路径优化（Deferred，按作者决定延后余项）

作者本轮接受当前启动性能，剩余 417ms 主指标差距留待以后明确恢复；以下目标不降低，原功能/安全验证保留。本轮不继续优化凭据或启动流程，允许 M17 先行。

- **Goal**：达到 M16.1 确定的目标，降低日常打开成本。
- **确定的优化目标**：同机、同条件、同版本计时定义、无源码变化，至少 6 次独立普通冷启。宿主入口到 editor-ready 的 nearest-rank p50 从 2459ms 降至 **≤1844ms**（至少降低 25%，向下取整），最慢 **≤2498ms**；宿主内 window-visible 不退步，p50 **≤1947ms**、最慢 **≤2011ms**。逐次先算区间再统计，不将各区间 p50 相加；不将 editor-ready 冒充真实正文已全部可编辑。若改计时起点/握手定义，应补可比基线，不能靠早发 ready 达标。双击到首显/可编辑若另测则另列，不与宿主内时间混算。激活路径不重建、不新增后端，退出后不常驻；有效缓存不 restore/build/访问 NuGet。此为本机小样本工程目标，不是其他机器或首次安装 SLA。
- **排查顺序与实现现状**：先前将 Markdown/AST 延至实际使用，保持原验证与同步解析合同；六次正式 App 复测后，backend-start→api-ready p50 从 1385ms 降至 1249ms，实际整段收益小于纯依赖导入的隔离收益，不能将后者等同 App 提速。当前 native-check→web-check p50 180ms、web-check→backend-start p50 57ms，不为小段盲改顺序。credential-location→credentials p50 631ms、credentials→api-ready p50 587ms，需进一步细分模块导入、Known Folder 定位和凭据读取。local.ts 的定位与读取分别启动 PowerShell，是下一项最小排查候选，但已有阶段存在重叠，不能据此断言这些值全是 PowerShell/DPAPI 纯耗时或相加 p50。任何后续改动仍须保留 Known Folder/DPAPI/文件身份校验及后端独占凭据，不缓存或传给窗口明文 Key。本轮只核对记录，未修改凭据协议或继续实现；主目标仍差 417ms，不标 Done。
- **Scope / Non-goals**：预览/AST 等依赖按实际需要延迟，安全协调宿主/Web 准备，区分一次性准备与打开、复用已有窗口快路径；不去掉 hash/文件身份/锁检查，不常驻后台，不降低凭据隔离。
- **Files**：`studio/windows/`、`studio/server/{main,http,source-preview,source-expression}.ts`、Think 预览接点及测试；按瓶颈最小调整。
- **接口 / 数据流**：有限 boot/ready/error/cancel 生命周期 → 独立拥有的产物/收据 → API → 可用窗口；真实业务 API 不变，构建仍不接 Key，后端自行读取原保存配置。
- **Done Criteria**：同机同条件指标达标；有效缓存普通打开不 restore/build/访问 NuGet，C# 与 Web 依赖各自正确失效，普通内容编辑不触发编辑器重建；故障恢复与协同退出保持。
- **Verification**：H；M16.1 同口径对比，损坏收据/篡改产物/链接/并发启动/取消/失败清理负例，原 AI 配置加载与单实例回归，作者实际打开。
- **风险 / 下一边界**：延迟加载把成本移到首次预览，需单独显示该状态；早显窗口不能错报服务可用。通过后进入 M17，不混入改版。

<a id="studio-m16-3"></a>
#### M16.3 — 日常运行与更新准备分离（Auto verified / Awaiting unified acceptance）

**本轮实施授权（2026-10-31）**：作者明确指定只实施 M16.3、完成验证及文档；不进入 M19.1，不控制桌面、不提交/推送/发布。下段是此前只规划的历史停点。本轮已保存修改前代码/文档和启动诊断；真实当前版本的六次普通启动基线尚未提供，不以 M16.2 历史数据或无窗口测试代替。

**本批停点调整**：作者确认尚无当前版本六次优化前基线，本轮先实现和自动验证，真实性能保留待验；随后明确授权继续主线、最后统一人工验收。M16.2 原目标和未达结论不变，不以无窗口结果代替真实性能。

2026-11-12 调整首次启动入口。缺少运行包时，双击图标会自动执行锁定准备，成功后打开 Studio。有效运行包直接复用。运行包损坏、依赖不兼容或开发更新时，可从 `studio:prepare` 显式重建。NuGet 包源或漏洞数据不可访问时，启动器和手动命令会显示 `NUGET_SOURCE_UNAVAILABLE`。

本次在受限网络复现了 `NU1900`，恢复 NuGet 访问后完成本机准备，版本为 `152cb12b55c2`。直接读取该运行包验证了复用。`npm.cmd run lint`、`npm.cmd run typecheck`、`npm.cmd test`、`npm.cmd run build`、`npm.cmd run studio:build` 均通过。单元测试 209 通过、1 跳过，启动浏览器回归在 Chromium 和 WebKit 共 6 项通过。实际双击打开原生窗口和启动耗时留待人工验收。

同日收到双击仍失败的反馈。旧运行包的真实子进程复现先报 `INVALID_COMMAND`，再报 `APP_START_TIMEOUT`。打包后两个命令行入口共享 `import.meta.url`，旧入口先消费了 App 的启动消息。现在旧入口只在独立执行 `desktop.ts` 时注册。另修复 Windows PowerShell 5.1 替换启动诊断文件时的空参数问题。本机当前运行包为 `8da211add141`。验证覆盖打包后的启动消息、隔离环境下的后台就绪与关闭，以及 Windows PowerShell 连续两次刷新诊断。Lint、类型检查、网站构建均通过，单元测试 210 通过、1 跳过，Chromium 和 WebKit 启动回归共 6 项通过。真实桌面双击仍待确认。

- **Goal**：日常双击尽快得到真实可用反馈和编辑能力，文章/项目编辑无需承担开发构建流程。
- **Scope**：明确本地准备入口 `npm.cmd run studio:prepare`、完整兼容产物/版本收据、日常运行入口；宿主/Web/backend 与依赖身份一致。窗口尽早显示，AI 原配置读取与窗口/API 准备按需解耦，区分准备中/未配置/失败；预览/私人/次级工具延迟到实际使用。既有启动器/进程重复开销先实测后最小减少，不改变单实例和协同退出。
- **Non-goals**：不做安装器、联网自动更新、多版本管理框架、常驻服务、框架迁移、录入/发布功能或私人扩展；不删产物/文件身份/链接/锁/Known Folder/DPAPI 校验，不以重配 Key、提前 ready 或弱化密文参数提速。
- **Files**：studio/windows/{Open,Launcher}.ps1、studio/windows/{app,desktop,app-build,web-build,local,startup}.ts、studio/desktop/ 必要宿主状态接点、studio/server/{main,http}.ts 与确需的 AI 就绪接点、studio/web/main.ts 的初始化/就绪显示、相关契约及 tests/unit/studio-{windows,desktop,startup}.test.ts、Studio 关闭/启动浏览器测试；package.json 仅在需要明确准备命令时最小增加。沿用派生缓存，具体收据文件在实施时锁定，不预建框架、不重做工作台。
- **接口 / 数据流**：准备动作 → 校验/构建完整版本 → 原子确认就绪收据；日常图标 → 校验就绪产物与实例 → 窗口/本机 API → 编辑可用，AI/预览就绪另报状态。构建不接 Key；凭据只在本机后端读取，不到窗口/日志/命令参数。缺失或坏版本明确提示准备，失败保留旧完整产物且不混载，更新切换不强关活动窗口或丢缓冲。
- **Done Criteria**：有效已准备版本启动不执行 SDK 探测、restore/build、Vite/npm、全源码遍历或 NuGet 请求；更新准备失败/中断不暴露半套版本，来源/锁/产物不匹配能拒绝或明确安全回退。早显状态与真实编辑就绪分开，AI 状态不误报、原 Key 自动加载，首次按需使用和保存/锁定/关闭正常。保持原可比宿主指标：editor-ready p50 ≤1844ms/最慢 ≤2498ms，window-visible p50 ≤1947ms/最慢 ≤2011ms；不得把成本移到未计时的启动器外层满足数字。双击全链路另列，须较同版改动前的配对基线改善，不能仅优化宿主计时后声称体验改善。
- **Verification**：H；实施前固定当前版本准备/普通/激活基线；前后同机同条件各至少六份独立普通启动，保留原宿主计时、增加外层准备/进程阶段诊断，并由作者独立记录双击到可见/可编辑。首次准备/源码更新与普通样本单列，不混算 9653ms 更新记录和历史 2261ms p50。断网且无 SDK 的有效产物启动、未准备/坏收据/篡改/链接/新旧版本混载/准备中断/并发激活/活动窗口更新/故障恢复负例，原 AI 加载、首次 Think/Build 预览、私人锁定与协同关闭回归；缺失实际 App 反馈不能标 Done。本轮不要求作者现在测新样本。
- **风险 / 下一边界**：只显窗口不代表可编辑，不以隐藏准备成本或旧版假成功达标；版本分离不能让新 backend 读取旧 UI 合同。本批自动验证通过后按新授权进入 M19.1；真实 App 与性能仍待统一验收，不标 Done。

<a id="studio-m17"></a>
#### M17 — 统一 Studio 工作台 UI（Done）

**本轮授权与依赖例外（2026-10-30）**：在已告知 M16.2 六次实测主目标未达后，作者明确表示“先这样吧，这个没那么重要，以后再说，继续下一阶段吧”，据此将该余项记 Deferred，保留原目标与失败记录，接受当前启动性能作为 M17 基础，不标 M16.2 Done。仅实施顺序中紧接的 M17，不进入 M18、不控制桌面、不提交/推送/发布。

- **Goal**：四个公开/私人模块有一致且清楚的日常编辑体验。
- **Scope / Non-goals**：外壳、空间/模块导航、列表/编辑/预览/属性分区、操作层级、设计样式；不改内容合同、文件 CRUD、私人锁定或访客网站，不提前显示未实现提案/发布入口。
- **Files**：`studio/web/{index.html,styles.css,main.ts}`、各模块面板及实际需要的轻量视图控件、编辑器测试。
- **接口 / 数据流**：视图组合/状态展示 → 既有 Web API/ExitEditor；不把内容操作搬进公共 UI 控件，不要求框架迁移。
- **Done Criteria**：常用与危险操作分层、保存/错误/禁用/未保存状态一致；1280×720/1440×900、125%–150% 缩放可用，正文/长表单/预览不被遮挡；键盘、焦点与中文输入保护保持。
- **Verification**：H；四公开/四私人面板两引擎 smoke，切换/关闭/取消/保存失败回归，非敏感截图与作者实际 App 检查。
- **风险 / 下一边界**：不能因 DOM 重排丢掉隐藏面板缓冲、事件解绑或可访问名称；通过后 M18 才重排私人业务流程。

<a id="studio-m18"></a>
#### M18 — 私人资料库与网站更新向导（Awaiting author acceptance）

**本次排序调整**：实现与自动验证保留，原生选择器/协同关闭待验，不标 Done、不继续扩展。由 In Progress 归为独立待验项，为公开主线保留唯一实施单元；M19.1 改依赖 M16.3，不再将本项的私人专项作为串行前置，受影响共享安全仍须回归。

**本轮授权（2026-10-31）**：作者确认 M17 正式 App 的新布局、缩放、中文编辑和取消关闭正常，要求完成收尾后按本计划开始 M18。仅本项，不进入 M19.1；保留已有改动，不控制桌面、不提交/推送/发布。

- **Goal**：本机保存与网站交付可分别理解，日常界面不要求操作内部密文对象。
- **Scope / Non-goals**：统一术语、资料库打开/编辑/保存、校验/导出/确认的向导和详情；不合并三种密文身份，不记住口令、不忽略后台锁、不接 AI/Agent、不取消最后替换确认。
- **Files**：`studio/web/private.ts` 及必要的私人视图拆分、现私有契约/native 选择接点与测试；优先编排原能力，安全事务确有需要时最小扩展。
- **接口 / 数据流**：原选择句柄/全包校验/加密保存/候选导出/固定 bundle 替换 → 向导状态；分别呈现已保存、准备失败、替换未知，不把整个流程假称原子回滚。
- **Done Criteria**：只在本机使用可停在加密保存；网站交付正确检查最新源/关联与备份，详情可查版本；选择器隐藏/取消、锁定/迟到结果均不会恢复旧明文或误覆盖。
- **Verification**：H；创建/打开/保存/备份/恢复/取消、未知写结果、源/关联变化及整包保留负例，实际文件选择器与协同关闭由作者验收。
- **风险 / 下一边界**：选文件与明文 epoch 的相互影响仍需原生专项证明，不能只改 CSS；待验独立保留。公开提案改在 M16.3 通过后另行授权 M19.1，不依赖本项私人专项，但不能跳过受影响共享安全的回归。

<a id="studio-m19-1"></a>
#### M19.1 — Think 录入与审核主入口（Auto verified / Awaiting unified acceptance）

**依赖**：M16.3 自动验证已通过；按作者本批授权先继续实现，M16.3 真实性能/App 与本项人工反馈最后统一验收。不依赖 M18 的私人专项收尾。

- **Goal**：建立可日常使用的文章导入、审核、恢复及批准保存主入口，原手动表单成为精调/备用方式。
- **Scope / Non-goals**：受限 UTF-8 MD/文字和结构化报告、Think 专属候选、公开收件箱、来源/缺项、审核/预览/应用及可用的导入/待审核默认入口；单份材料单个目标，无模型调用、批量事务、私人或发布。未实现的 Build/发布入口不提供可用占位。
- **Files**：拟增 `studio/contracts/proposal.ts`、`studio/server/intake/` 的 Think/记录存储与 HTTP 接点、Web 录入/审核视图、测试；复用原 Think service。
- **接口 / 数据流**：本节 intake/think、proposals GET/PUT/apply → 版本化候选 → 本人精确批准 → 原 Think 校验/原子写入；现手动表单继续可用。
- **Done Criteria**：不完整候选可留待审且重启可恢复，应用才写真正源；新建为 draft，既有目标须显式选择并保留 published；源/候选变动废止批准，成功后不留下正文镜像，损坏/未知写入安全处理。
- **Verification**：H；中文/多行/代码、格式版本/未知字段/缺项、材料提示词不执行、重复 slug、源及提案冲突、审核后再改、重启恢复/应用清除/容量与断线负例。
- **风险 / 下一边界**：收件箱不能变成第二内容库或泄露未发布材料，路径不由客户端指定；通过后仅向 M19.2 开放同流程 envelope。

<a id="studio-m19-2"></a>
#### M19.2 — Build 项目录入与审核（Auto verified / Awaiting unified acceptance）

**依赖**：M19.1；与文章复用审核流程字段，项目业务 DTO/校验保持独立。

- **Goal**：完整项目报告可形成符合原模型的可审核项目档案。
- **Scope / Non-goals**：Project 专属章节、代码、阶段/进展/问题、来源与缺项，原审核页/模块表单联动；不转文章模型、不补造贡献/日期/成果、不放松 Build 草稿校验。
- **Files**：`studio/contracts/proposal.ts` 的 Build 分支、intake Build 解析、Web 项目审核、Build service 调用与测试；不改原项目源结构。
- **接口 / 数据流**：intake/build → Build 候选 → 完整校验/真实项目预览 → 批准后原 Build service；沿用整份 data.ts expectedRevision。
- **Done Criteria**：嵌套记录、可选省略、代码/顺序和其他条目保持；缺项停在提案，关联/状态/日期/slug 非法阻止应用；同文件别的条目变化也会冲突，既有公开状态不被暗改。
- **Verification**：H；完整/不完整报告、所有嵌套负例、重复 slug、其他条目保留、同文件修改、审核失效及真实 Astro root/base 预览。
- **风险 / 下一边界**：结构合法不证明个人经历真实，来源核对不可省略；通过后 M20 才调用模型，不把“可导入”写成“AI 已接入”。

<a id="studio-m20"></a>
#### M20 — 自动整理并填写文章/项目（Auto verified / Awaiting real AI and unified acceptance）

**依赖**：M19.1/19.2，完成后主线为 M23；不先实施 Pi 或文档适配。

- **Goal**：普通文章/项目材料可自动形成带来源诊断的模块候选，尽量填好现有字段，作者主要审核、补缺项与精调。
- **Scope / Non-goals**：复用现百炼后端配置，显式发送已选材料，结构化输出解析/模块校验、缺项/待确认信息；不替换润色合同，不扩多 Provider、任意工具/仓库抓取、私人或自动应用。
- **Files**：`studio/server/ai/` 的专属整理用例、intake/提案契约和 Web 请求/审核区及测试；仅按实际重复复用请求设施。
- **接口 / 数据流**：明确整理模式/发送快照 → 现模型 → 严格解析和来源诊断 → Think/Build 提案；保留无 AI 导入，Key 不到浏览器，不假定模型原生 JSON Schema 能力。
- **Done Criteria**：输入/输出/token 限额明确，超限/截断/坏结构可见且原材料保持；区分功能/本人贡献/计划，迟到输出不改新候选；本人审核前无源写入，原五种文本建议仍正常。
- **Verification**：H；确定性上游 fixture 覆盖提示注入/虚构字段/无依据/限流/截断/取消/乱序/非法结构；另用非敏感材料完成真实 Think/Build 整理与审核反馈，模拟不冒充接通。
- **风险 / 下一边界**：上下文/成本与事实质量须本人核对，大材料先外部整理而非静默截断；真实调用未验不能 Done。通过后进入另获授权的 M23；M21/M22 延后，不是发布前置。

<a id="studio-m23"></a>
#### M23 — Think 已完成真实发布，Build 保留原边界

**依赖**：M20 及 M16.3/M19.1/M19.2 的主线必需验收；不依赖 M21/M22、Keep/Me 或 M18 私人专项。共享关闭/安全和已有内容模型保护仍须验证。

- **Goal**：本人一次明确批准精确候选后，可完成保存、规定检查、提交/推送及固定 Pages 流程，并看见真实结果。
- **Scope / Non-goals**：仅公开 Think/Build 的审核快照、明确 published:true 变化、固定发布协调、候选/回执及受检 artifact；从已审核提案或真实内容源启动，与保存草稿为两条可选分支，一次最终批准后编排固定步骤。暂不增加私人密文/Keep/Me 自动发布、批量删除/取消公开、通用 shell/Git 工作流，不自动批准/全量暂存/强推，不把实施请求当实际发布授权。
- **Files**：新增 `studio/server/publish/`、发布契约/Web 最终审核与状态页、`.github/workflows/deploy.yml` 的期望 SHA 守卫及隔离测试。不重做网站部署架构。
- **接口 / 数据流**：快照和差异 → 一次确认 → 保留原工作区的精确增量提交 → GitHub 检查、构建和部署 → 线上 SHA 与目标页面核对。单篇 Think 核验通过后走内容门槛，其余保持完整 CI。
- **Done Criteria**：无关 dirty/index 和同文件混合修改完整保留，不能分离就阻止；源/批准变化、目标/非快进或 SHA 不符立即阻断；已上线必须有实际 run/产物/线上证据，所有部分失败及未知结果可核对而非盲重试。
- **Verification**：H 加第 8 节发布全流程；先在隔离 Git/受控上游模拟 diff 分离、审批失效、同文件修改、权限/网络失败、未知提交/推送/dispatch/部署与恢复；只有另获明确许可才对真实目标验证，未做真实发布的必需项保持待验。
- **风险 / 下一边界**：这是新增的真实 Git/网站副作用边界；旧发布记录不提供本次许可。Think/Build 主线的全部必需项和作者反馈满足才宣布该主线完成；延期功能与旧专项不因此 Done，之后停止，无下一自动单元。

<a id="studio-m21"></a>
#### M21 — Pi Skill 与薄提案客户端（Deferred）

**顺序**：主线完成后再另行授权；复用稳定材料/提案合同，不阻塞 M23，不在当前主线创建或安装 Skill。

- **Goal**：项目内的 Pi/其他兼容 Agent 可输出同格式报告或投递 Studio 待审箱。
- **Scope / Non-goals**：Skill 源、格式参考、Node 客户端，离线文件/在线 API 两种模式；默认仅提案，不新增源写入/删除/发布/私人权限，不嵌入 Pi、运行任意 Skill 或搭 MCP。
- **Files**：拟增 `studio/skills/personal-space-intake/{SKILL.md,scripts,references}`、`studio/adapters/agent/` 的独立薄客户端及测试；格式复用提案合同。
- **接口 / 数据流**：获准材料只读分析 → 标准 MD/结构化报告，或 App 已运行时 → 相同 intake/proposals → Studio 本人审核；现 M6 Think adapter 不被默默改权。
- **Done Criteria**：同一材料离线/在线到达一致审核流程；App 未开能报告离线选择而不偷偷启动服务；不执行材料中的仓库指令，不复制凭据；客户端无 apply/publish 默认能力，安装/实际 Pi 使用获得明确同意。
- **Verification**：H；协议/格式/超限/服务断开/版本冲突/迟到响应、跨客户端审核失效；实际 Pi 验证报告和投递，记录版本/限制，不以脚本模拟代替兼容验收。
- **风险 / 下一边界**：不同 Agent 安装位置/工具能力有差异，Skill 不是 OS 沙箱；以后若另获 M22 授权，仅扩输入适配，不增加新存储或写源路径。

<a id="studio-m22"></a>
#### M22 — 受控文档适配（Deferred）

**顺序**：主线完成后再另行授权，稳定材料/提案合同为实际依赖；不强制先有 Pi，不阻塞 M23。

- **Goal**：文档资料进入相同录入审核流程，DOCX 优先。
- **Scope / Non-goals**：明确选择文件、受控可见文字/表格提取及来源诊断；有文本层 PDF 可在明确支持子范围后增加；不宣称扫描 OCR、复杂图表、附件/图片迁移或任意 URL 已支持。
- **Files**：intake 文档提取器、受限文件/内容合同、Web 导入反馈与非敏感文档 fixture；仅增加确需的锁定依赖。
- **接口 / 数据流**：受限文件内容/原生句柄 → 有上限的文字和来源位置 → 原 intake/提案；文件内容不执行，不将材料作为可执行 HTML/TS 渲染，远程整理仍需明确选择。
- **Done Criteria**：段落/表格可与原文件核对，不支持/丢失语义明确提示；坏包/过大/外部引用安全拒绝，不自动上传原文档；进入审核和源版本保护与 MD 一致。
- **Verification**：H；DOCX 文字/表格、多语言/换行、恶意 ZIP/XML/解压上限/嵌入对象/外部链接、未知格式与取消；PDF 如纳入须另测文本提取与无文本提示；作者核对提取结果。
- **风险 / 下一边界**：文档布局不能等同可靠语义，不能把遗漏内容伪装成完整成稿；M23 已前移，不依赖本项；文档格式扩展独立验收。

<a id="studio-writing-workbench"></a>
### 6.12 Studio 写作体验升级 · 第一阶段（Done）

作者已认可分三阶段实施及 CodeMirror 6 选型，本轮授权第一阶段界面精简。默认进入 Think，合并导航，突出标题、正文、保存和网站预览。属性、AI、诊断和低频操作按需展开。Build、Keep、Me 继续使用专属表单，发布、待审和私人维护走独立入口。验收覆盖模块到达、错误可见、编辑缓冲、Astro 预览、发布确认和私人锁定。CodeMirror 与 Live Preview 留待后续单独实施。

本次实施证据见[验收记录](#studio-writing-workbench-record)。后续产品方向与 CodeMirror 6 源码编辑见[当前 Markdown 写作闭环](#studio-think-writing)。

<a id="studio-think-writing"></a>
### 6.13 Studio Markdown 写作闭环（Think，自动验证完成，原生 App 待作者核对）

默认工作台采用内容选择、Markdown 编辑、可选 AI 整理、Astro 预览、保存或发布。先贯通 Think 和原稿恢复，随后按作者停点再做 Build 和 Keep/Me。CodeMirror 6 只负责源码编辑。已有文章写回原 Markdown，未完成原稿使用本机公开待审存储。发布复用 M23 的精确审核和一次最终批准。私人模块从公开工作台隐藏，维护路径与安全测试继续保留。此节接续 6.12 的界面精简，当前默认入口以此节为准。

**验收**覆盖原文件字节与 YAML 注释保真、手工编辑、根路径和 base 下的真实 Astro 预览、原稿重启恢复、AI 核对和撤销、旧源版本冲突、协同关闭、明确批准和远端前置条件。两引擎浏览器回归并保留私人测试。操作见[工作台手册](./MAINTENANCE.md#studio-writing-workbench)，证据见[Think 写作验收](#studio-think-writing-record)。

<a id="studio-think-preview-time"></a>
### 6.14 Think 整理、快速预览与时间（Done）

在现有 Think 工作台上修复已复现的百炼候选解析故障，复用网站 Markdown 处理器提供快速隔离预览。记录可选 UTC 秒级文章时间，累计写作时长仅存本机。正式 Astro 构建、发布验证和私人功能沿用原边界。

验收使用实际百炼非敏感请求、无可见窗口的真实 WebView2、Chromium/WebKit、正式 Astro 和私人回归。验收明细见[本轮记录](#studio-think-preview-time-record)，操作见[写作手册](./MAINTENANCE.md#studio-writing-workbench)。

<a id="studio-think-stability"></a>
### 6.15 Think 稳定化与源码编辑辅助（In Progress）

核对 M23 发布前置条件，统一换行与公式渲染，接入可切换的 Gemini，保留候选核对机制。将快速预览定位到编辑源行，提供图片粘贴、拖放和代码围栏快捷键。真实提交、推送和部署另行授权。

本地编辑与浏览器验证见[本轮记录](#studio-think-stability-record)。Gemini 已在 Windows WebView2 用现有 Key 完成真实候选审核。Think 已完成真实发布，当前流程见 [Think v1.0 最终收尾](#studio-think-v1-completed)。

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
2. push/PR **只检查**。本版 workflow 手动输入完整 expected_sha 与 studio_request（人工填 manual、Studio 使用唯一 UUID），先守卫获批 SHA。在 main 通过 `workflow_dispatch` 手动触发 `Verify and publish Personal Space` 才发布。`.github/workflows/deploy.yml` 使用锁定 Node/npm、官方 Action 固定 SHA。
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

<a id="studio-next-planning-record"></a>
### 9.22 Studio M7–M15 规划入档（2026-10-17，文档任务完成）

**授权 / 实际变更**：作者认可 M7–M15 方案并明确本轮只改 PLAN、README、MAINTENANCE，不实现、不提交/推送/发布。开始时 Git 工作区干净；已记录 210 个跟踪文件及三份文档的基线。新增 6.10 的现状证据、App/服务归属、各模块原始 source/AST/整文件 revision、私人唯一源与加密边界、11 个独立单元（M14 拆三项）的 Goal/Scope/Non-goals/Files/接口/数据流/Done Criteria/Verification/风险及下一边界；全部 Pending。README 简述下一路线及桌面入口待诊断；MAINTENANCE 区分当前操作与未来能力，不重复维护实施状态表。

**Verification**：实际运行 `node .cache/studio-m7-m15-plan/verify.mjs`，退出 0；四份文档围栏闭合、170 处相对链接/锚点有效，11 个独立 Pending 单元的契约字段齐全，当前命令与 package.json 对应、手册 9.6/9.7/9.8 顺序正确。M0–M6 计划及原全部完成记录保持，手册示例与 README 真实目录图未变；207 个非目标跟踪文件 SHA-256 不变（含 AGENTS、编辑器配置、所有源码/测试与 package/lock），只有三份目标文档修改，无新增 Git 候选或暂存。HEAD 仍为 9fd8cc8，当前发布源/工作流记录保持；`git diff --check` 退出 0。证据在 `.cache/studio-m7-m15-plan/` 的 baseline.json / verification.json 及初始文档副本。

**停点 / 限制**：工程 lint/typecheck/test/build、浏览器/桌面 smoke 未运行（仅文档，未改工程输入）；桌面故障尚未复现，不冒称修复，N1 手机反馈仍待作者。既有发布与标签保持，M7 尚未开始，当前无实施项 In Progress；不创建产品代码/目录占位、快捷方式、依赖或密文，未提交、推送或发布，完成入档后停止。

<a id="studio-m7-record"></a>
### 9.23 Studio M7 — 可靠启停与恢复（2026-10-18，Done）

**授权与基线**：仅实施 M7、重建快捷入口、验证并同步文档；不进入 M8，不提交/推送/发布。HEAD `9fd8cc8bda5c903c0b897f23a63168764b62899b`，已有三份规划文档未提交；210 个跟踪文件哈希及初始文档副本保存在忽略的 `.cache/studio-m7/`。原 M0–M6/v0/N1 与全部完成历史保持。

**诊断**：旧 open/stop 均退出 1、DESKTOP_UNAVAILABLE；会话 API pid 18820 与 host pid 32132 均已退出，管道不可达，三份关联状态/锁仍在。见 initial-state.json / reproduction.json。Node 在桌面 PATH 中存在，不把 PATH 猜测当根因。

**实际变更**：desktop-state.ts 核对固定退出残留的归属、进程、管道、端口、普通单链接文件及目录身份，删除前重验身份/字节；未知来源、坏状态、活锁和占端口均拒绝。desktop.ts 等待 API 正常关闭、锁释放及 host 退出才确认停止，不复用已退出 API；API 异常退出未释放作者锁时保留关联状态，供 host 也退出后安全恢复。Windows 在进程退出后短暂 EADDRINUSE 的竞态已复现，open 最多额外等待 3 秒逐次重验，忙时不删证据。server/main.ts 仅增加可信 IPC 父进程断开时关闭自有 API。没有 HTTP shutdown、接管终端服务或强杀用户进程。

web-build.ts 对 Node 版本、Web/合同源码、Vite 配置、package/lock 和三项产物核对哈希，匹配复用，过期/缺失/普通坏收据才重建；构建失败不启动旧 UI，编译进程不继承 AI Key。新增共用 Launcher.ps1，隐藏窗口并显示固定错误码/处理建议；快捷方式安装先检查两个目标以保护同名外部入口，固定 Node 路径、失效再查 PATH。未改 AI 配置格式、作者模型、HTTP 内容接口、Web 产品界面、依赖或网站运行逻辑。

**验证与失败处理**：新增十项 M7 回归，覆盖退出残留/活锁/坏状态/替换/硬链接/junction、占端口、中文空格路径、并发启动/立即启停、构建计数与失效/失败/缺依赖/Key 隔离、独立终端保护、host/API 异常退出、外部快捷入口保护和缺 Node。原四项 Windows 测试保持。验证发现并修复启动就绪与停机回执竞态、空控制回复分类、Windows 端口释放、死 API 旧状态；测试副本的中文路径 fs.cpSync 失真改为显式复制并断言精确入口。未削弱负例或过滤 pageerror。故障两项在真实用户权限下连续五轮各 2/2 通过，见 loss-fixed-1.log 至 loss-fixed-5.log；初始失败证据保留。

实际命令由 `.cache/studio-m7/run.mjs` 调用固定本机 npm CLI（等价 npm.cmd 脚本），同名 `.log` / `.json` 保存命令和退出结果；清除 AI 凭据环境。需要链接/IPC 的最终单元验收在真实 Windows 用户权限下执行；沙箱曾出现 junction EPERM 与本机服务识别失败，不把这些限制或此前偶发成功当最终通过。

| 实际检查 | 最终结果 / 证据 |
| --- | --- |
| `npm.cmd run lint` / `npm.cmd run typecheck` | 退出 0；Astro 172 文件零诊断，Studio tsc 通过 |
| `npm.cmd run test` | 退出 0；112 tests，111 passed / 1 既有 Windows 普通文件 symlink 权限 skipped |
| `npm.cmd run build` / base 构建 | 退出 0；根 10 HTML / 26 文件；base `/personal-space/` 输出 `.cache/base-dist` |
| 根/base 完整 Chromium E2E | 各 77/77，退出 0；root-e2e / base-e2e 日志及结果目录 |
| WebKit mobile / private smoke | 16/16、29/29，退出 0；同名日志与结果目录 |
| `npm.cmd run studio:build` / Studio 双引擎 | 退出 0；37 passed / 1 既有 WebKit 无 CDP IME skipped，含 CRUD/冲突、AI 模拟及真实 Astro 预览；已实际查看 studio-results 的 WebKit editor.png 与 Chromium preview.png，编辑/预览无溢出或遮挡 |
| release / Vault 产物边界 | `node tests/verify-release.mjs`、`node --experimental-strip-types tests/verify-vault-release.mjs` 退出 0，公开产物无 Studio/测试/凭据 |
| 文档与范围审计 | verify.mjs：201 个非目标跟踪文件字节保持，原完成历史与 M8–M15 保持；链接/状态、HEAD/空暂存区检查通过 |

**真实本机入口调用**：已重建 `C:\Users\80631\Desktop\Personal Space Studio.lnk` 与 `Stop Personal Space Studio.lnk`。原真实退出残留已按条件恢复，首次实际冷启动退出 0、约 4.61 秒（live-cold.json）。读取快捷方式保存的目标/参数经 Windows Shell 调用，最终重复打开约 2.05 秒、停止约 1.94 秒、重开约 3.97 秒（live-targets.json）；重复打开同一 API pid，重开为新 pid，停止时三份状态/锁释放。Web 收据字节和 mtime 保持、无额外构建；隔离计数验证冷启动一次构建、重复打开/重开不重建。真实 AI 状态 available:true，原 DPAPI 密文哈希/大小保持，未重录 Key、未发送付费 AI 请求、未修改真实正文。最后保留 Studio 运行供作者确认。

**实施轮待验停点（现已闭合）**：文件资源管理器自动化返回“应用授权等待超时”，作者选择“由我最后手动双击验收”；当时 M7 保持 In Progress / Awaiting desktop acceptance，未将实际目标调用冒充桌面双击。现由下述作者真实反馈补齐。关闭普通标签页仍不停止服务，M8 未实施。

**实施轮限制（保留）**：两项既有平台 skip 不当通过；未验其他 OS、真人 IME 候选窗、App 或新手机反馈，实施轮未跑未受影响的 extension/content/design/session 发布专项、未发布。自动审批拒绝强制结束两个辅助 PID，未执行；旧沙箱 fixture 的认证正常关闭仍报 DESKTOP_UNAVAILABLE，当时保留现场，不用强杀代替安全退出，也未声称辅助清理完成；真实 4322 服务与作者源不受影响。实施轮仅更新 M7 代码/测试及三份文档，保留原未提交工作，未提交/推送/发布，停于作者验收。本轮不重查、清理这些辅助进程，不宣称旧 PID 仍存活或已清理。

**最终验收收尾（2026-10-18）**：作者明确反馈：“我手动双击测试了，启动、重复启动、停止和重开都正常，AI 配置也保留了。”证据来源为本次聊天中的作者本机实测反馈，记录在 `.cache/studio-m7-acceptance/manual-acceptance.json`；不是代理桌面自动化或模拟结果。已逐项核对上述工程、浏览器、原文保护、快捷目标与异常恢复记录，全部 M7 Done Criteria / Verification 满足，M7 从 In Progress 标 Done，无实施项 In Progress；M8–M15 保持 Pending，不因此获得实施授权。

本轮只改 PLAN/README/MAINTENANCE，核验原 `.cache/studio-m7/` 34 份证据文件的哈希及成功结果，原工程测试统计/平台 skip 保留。实际运行 `node .cache/studio-m7-acceptance/verify.mjs` 和 `git diff --check` 均退出 0：文档围栏/链接/状态一致，210 个非目标候选文件（含全部已有代码/测试及三个未跟踪 helper）字节保持，M8–M15 范围与此前完成历史保持，原证据未覆盖，HEAD 与空暂存区未变。证据在本轮 baseline.json / verification.json。未改工程输入，lint/typecheck/test/build 及浏览器/桌面自动化本轮未重跑；上表是实施轮真实结果，不冒称本轮重新执行。未操作本机服务、快捷方式、凭据、真实正文或付费 AI；全部已有未提交工作保留，不进入 M8，不提交、推送或发布，完成收尾后停止。

<a id="studio-m8-record"></a>
### 9.24 Studio M8 — Windows App 与协同关闭（2026-10-18 实现与检查；2026-10-23 文档核对，In Progress / Awaiting manual acceptance）

**授权与基线**：仅 M8 的 App、协同关闭、验证与文档，保留 M7 和其他未提交工作；不进入 M9，不提交/推送/发布。M8 开始时 HEAD `9fd8cc8bda5c903c0b897f23a63168764b62899b`、空暂存区，213 个候选文件的哈希/文档副本保存在忽略的 `.cache/studio-m8/baseline.json`。作者中断桌面操作后明确要求不再控制桌面；本次续轮只运行无窗口命令行检查并修改三份文档，228 个开始候选的基线在 `.cache/studio-m8-finish/baseline.json`。不将旧 M7 作者反馈复用为 M8 签收。

**实际实现（前续轮保留）**：新增 `studio/desktop/` WinForms/WebView2 薄宿主，SDK 8.0.404/latestPatch、net8.0-windows/x64、WebView2 包精确 `[1.0.4258.31]` 与 NuGet lock；未升级 npm 依赖。`app.ts` 管单实例/激活/私有 stdio，`app-build.ts` 核对宿主输入与产物、锁定构建及热复用；原 Launcher 的 open 改为 App，已有快捷目标沿用，Stop 保留。`desktop.ts` 增加认证 activate 与 App 生命周期钩子，继续只管理自有 API/lease，拒绝旧浏览器或独立终端实例接管。宿主不持有业务凭据，只拿固定本机 origin；内容仍走原 HTTP/Think adapter，无新业务端点或发布能力。

`contracts/desktop.ts` 与 `web/desktop.ts` 只处理 UUID 关联的准备退出/取消/就绪/关闭失败。X/菜单/备用停止统一处理缓冲，等待写入、校验和输入完成；保存失败或响应未知保留缓冲、不自动重试。取消退出保留 AI/预览，明确退出时取消；保存并退出先取消请求再走原保存。停机失败恢复可编辑状态。C# 只接受精确顶层 Studio URL/已知字段，拒绝外部顶层导航、新窗口、下载、权限与 host objects；预览沿用 CSP/sandbox。native 以 detached 启动、脱离 Node 的 Windows job，避免 Node 崩溃连带结束缓冲窗口。API 异常先保留窗口/归属，无法证明清理成功则留关联证据供 M7 严格恢复，不强杀或自动清缓存。Web、宿主、obj、NuGet/profile/构建收据均在忽略缓存，不进入公开产物。

**失败与修复**：初始 WinExe 控制台编码初始化抛错、同步 stdin 读取阻塞 UI，改为标准句柄 UTF-8 reader/writer 与后台读取/UI 线程派发；去掉包附带但未使用的 WPF reference 后构建 0 警告。完整 Studio 首次 51 通过/2 失败/1 跳过，暴露“停机失败后再次退出的取消按钮仍 disabled”；修复状态恢复后，专项 16/16、全套 53/54（1 既有跳过）通过，原失败日志保留为 studio-browser-first-failure.log。WebKit 私人专项首次 28/29、一次 30 秒超时，原样重跑 29/29；未改超时、过滤 pageerror 或弱化测试。真实故障验证发现 Node Windows job 会在 host 被结束时连带结束 native，增加 detached 窗口后确认 host/API 退出而窗口/草稿仍在。初始失败与修复过程保留，不把未完成的最终关闭补写为通过。

**2026-10-18 无窗口命令行验证**：证据在 `.cache/studio-m8-finish/`；run.mjs 通过实际 Node 安装中的 npm-cli 执行对应 npm.cmd 脚本，逐项 JSON 记录完整命令/退出码/日志，未打开 App、未读取真实凭据或发付费 AI 请求。2026-10-23 只核对这些已有结果与文档/范围，未重跑工程检查；下表区分两次执行。

| 实际命令 / 检查 | 结果与证据 |
| --- | --- |
| `npm.cmd run lint` / `typecheck` | 均退出 0；Astro 178 文件 0 errors/warnings/hints，另含 Studio tsc；lint/typecheck.json 与 log |
| `npm.cmd run test` | 退出 0；118 项，117 通过、0 失败、1 个既有普通文件 symlink 权限跳过；unit.json/log。包括 M8 有限消息、认证激活/取消停机、API 故障保留归属、拒绝接管、构建 Key 隔离/目录跳转/缺 SDK 与 M6 写入未知回归 |
| `npm.cmd run build` | 退出 0；10 页、26 文件，含 prebuild 公开/Vault 边界；build.json/log |
| `dotnet restore PersonalSpaceStudio.csproj --locked-mode --source https://api.nuget.org/v3/index.json` / `dotnet build PersonalSpaceStudio.csproj --no-restore --configuration Release`（cwd studio/desktop） | 均退出 0，SDK 8.0.404、0 警告/0 错误；native.mts、dotnet-*.json/log。锁文件未变，没有自动安装系统组件 |
| `dotnet restore` / `dotnet run --project tests/studio/desktop/ContractTests.csproj --no-restore --configuration Release`（project 使用绝对路径、同 SDK cwd） | 退出 0；精确 origin、额外/重复字段及 ID 边界检查通过；dotnet-contract*.json/log。纯契约，无窗口 |
| `ensureDesktopApp` 连续两次 | 成功；第二次收据字节/mtime 与 exe 哈希保持，native.json；只构建/复用，不运行 exe |
| `node --experimental-strip-types .cache/studio-m8-finish/agent-stop.mts` | 退出 0；真实隔离 HTTP + Agent + App 控制钩子（退出就绪为测试钩子，无 native），已提交写响应在停机后丢失，API 退出、锁释放、源保持、AGENT_WRITE_OUTCOME_UNKNOWN、重复 id 拒绝且只写一次；agent-stop.json |
| `node tests/verify-release.mjs` / `node --experimental-strip-types tests/verify-vault-release.mjs` | 均退出 0；26 公开产物无 Studio/宿主/正文 fixture/凭据，Vault 仍未配置；boundary/vault-boundary.json/log |
| 文档与范围核对（2026-10-23） | `node .cache/studio-m8-finish/verify.mjs` 与 `git diff --check` 退出 0；围栏/相对链接/状态、历史与未来单元、候选哈希、HEAD/空暂存区检查；结果在该目录及 `.cache/studio-m8-doc-final/verification.json` |

**此前同一 M8 的浏览器验证（本续轮未重跑）**：`.cache/studio-m8/run.mjs` 的 studio-build + studio-browser 对应 `npm.cmd run studio:test`：退出 0，Chromium/WebKit 共 54 项、53 通过/1 个既有 WebKit IME 协议不支持跳过；close-final.log 为关闭专项 16/16。使用真实 HTTP/文件/预览、测试页内有限 bridge；AI 退出用非敏感模拟请求，不能冒充真实 WebView2 或百炼退出验收。root/base 构建退出 0，网站根与 `/personal-space/` E2E 各 77/77，WebKit mobile 16/16、private 29/29，pageerror 断言保留。证据分别为 base-build/root-e2e/base-e2e/webkit-mobile/webkit-private.json/log、studio-browser.json/log。最终续轮未改任何工程输入；最后 detached 仅改 Node 窗口创建，未改已验浏览器/网站输入。本项未运行未受影响的 extension/content/design/session 发布专项，未发布。

**此前真实隔离 native 验收与当前缺口**：使用 `.cache/studio-m8/gui-*` 非敏感源和 4324 测试端口，未改真实文章或真实 Key。实际 WebView2 已验证中文文字录入、X/菜单同一对话框、取消保留、有效保存退出及源写回/锁释放/端口释放；空 slug 保存失败留窗口；备用停止可取消，重复打开激活同一实例；API 故障后缓冲与控制仍在、重复启动不创建第二 API，明确放弃后可按严格证据重开；窗口进程故障后 API/锁清理。命令/固定故障结果在 gui-*.log、native-fault-{api,window,supervisor}.json，真实界面证据为此前工具会话观察，不虚构截图文件。故障注入只针对新建夹具并核对认证、CIM 命令行、父子进程与固定目录；生产代码没有强杀能力。

最后一次 host 故障修复确认 API/host 已退出、native 仍显示“本机服务连接已中断”与新建草稿；其 X 后最终取消/放弃流程被作者物理 Esc 中断，**未完成**。此后按作者要求不再控制桌面，也不强行关闭可能留下的测试窗口。正式桌面入口的 M8 双击/激活、重开后的真实 AI 配置保留、真实 App 内 AI/预览运行中退出、失联最终关闭、原生导航/桥来源完整运行时负例仍待对应反馈/隔离验收；纯 C# 边界与双引擎模拟不能替代这些项。缺 Runtime 的真实机器场景未测试，未卸载系统组件来造故障；缺 SDK 的隔离负例已通过。人工中文录入不冒充完整真人 IME 候选窗验证。

**保护与停点**：相对 M8 初始 213 个候选，9 个目标文件改变、204 个非目标保持；新增 15 个 M8 源/测试/项目文件，原 M7 的三个未跟踪 helper 保留。相对无窗口收尾开始的 228 个候选，只改 PLAN/README/MAINTENANCE，其余 225 个保持，包含前轮全部工程改动；2026-10-23 的独立基线在 `.cache/studio-m8-doc-final/`，同样只改三份文档。原 9.1–9.23 完成记录、M9–M15 需求/状态与网站/真实内容/package/lock 保持，HEAD 未变、暂存区为空。本次文档核对未调用桌面、工程测试、构建或本机服务/快捷方式/凭据，未清理旧辅助进程；表中工程检查为 2026-10-18 的实际结果。手动步骤集中在 [MAINTENANCE](./MAINTENANCE.md#studio-m8-manual)，M8 保持 **In Progress / Awaiting manual acceptance**，全部必需验收满足后才可收尾为 Done。未进入 M9，未提交、推送或发布，本轮完成文档核对后停止，等待作者反馈。


<a id="studio-m8-refine-record"></a>
### 9.25 Studio M8 补充优化 — 单图标、默认日期与 AI 配置（2026-10-23，自动验证完成；M8 仍待手动验收）

**授权/范围**：作者明确要求一起优化以上三点、完成验证和文档，不控制桌面，保留已有改动，不进入 M9，不提交、推送或发布。开始时 228 个候选文件、HEAD `9fd8cc8bda5c903c0b897f23a63168764b62899b` 与空暂存区；基线与三份文档副本在忽略的 `.cache/studio-m8-refine/`。M7 及此前 M8 实现保持，新增授权只调整 M8 单元，不启动未来模块。

**实际修改**：Install-Shortcuts.ps1 只安装 Personal Space Studio，普通文件/描述/仓库/固定 PowerShell 目标/完整参数均核对后才移除本项目旧 Stop 图标，删除前再次核对字节；同名外部、硬链接/跳转或变化拒绝。已通过该脚本更新真实桌面的快捷文件，随后只读核对 launchExists:true、legacyStopExists:false、pointsToOpen:true、repositoryMatches:true、shortcutsInvoked:false（shortcut.json）。未点击图标、打开 App 或控制窗口；停止脚本/npm 命令保留为排错手段。正常 X/菜单依然走既有保存/放弃/取消与自有 API 停机流程，不改为强杀或无条件关闭。

Web 新建时用本机日期各分量生成 YYYY-MM-DD，避免 UTC 跨日偏差；字段仍可改/清空，只在点新建时赋值。旧文章读取/无修改保存不补日期，API/Agent 候选规则不变。AI 状态移到顶部，不用先选文章即可查看，并说明缺配置/坏配置及正文为空时的操作条件。localAuthoringEnvironment 复用现有私有 DPAPI 读取，desktop.ts 保持构建先于解密；Windows 终端 main.ts 在无百炼环境配置、且非父 IPC 子进程时复用同一存储，显式环境保留优先权，不暗中混搭。桌面子进程缺配置不会意外读取真实 Key，坏存储明确报错，直接 startStudioHttp/HTTP 模型保持不变。没有新配置格式、Key 迁移、前端凭据或 Provider 框架。

**AI 排查结论**：本机已有存储可解密且字节保持；正确 App 后台配置加载未复现失败，不能断言作者当时错误一定来自某个入口。已确认并修复“终端启动只读环境、不会复用本机保存配置”的入口差异；直接运行 native exe 不能独立启动后台，隔离服务故意无真实凭据，手册与状态提示已澄清。真实验收调用同一 startDesktopHost → main.ts → HTTP/AI 链，在非敏感空内容夹具两次启动自动 available:true，并作一次 polish，返回 HTTP 200 / ok:true；原文与模型输出均未记录。ai-live.json 仅留布尔、状态码和固定错误码；源目录未创建文章，原 DPAPI 密文字节保持、自有 API/锁均清理。此为真实后端调用，不冒充 native 中点击按钮。

**实际验证**：run.mjs 经固定 npm CLI 执行对应 npm.cmd 脚本，JSON/log 保存命令与退出；浏览器为无界面 Playwright，未控制桌面。首次类型检查发现新增测试环境对象少了 NodeJS.ProcessEnv 声明（4 errors），修正后重跑，初次失败证据保留为 typecheck-first-failure.log；未弱化规则或删测试。其余结果：

| 命令 / 专项 | 结果（证据均在 .cache/studio-m8-refine/） |
| --- | --- |
| `npm.cmd run lint` / `typecheck` | 均退出 0；178 Astro 文件 0 errors/warnings/hints，Studio tsc 通过；同名 json/log |
| `npm.cmd run test` | 退出 0；119 tests：118 pass、0 fail、1 个既有普通文件 symlink 权限 skipped。覆盖单图标及旧停止迁移、外部快捷保护；Windows 终端无环境读 DPAPI/显式环境优先/坏配置安全失败；保留全部 M8 正常/异常停机与防接管回归 |
| `npm.cmd run studio:build` + 双引擎完整 Studio 测试（等价 studio:test） | 退出 0；58 项，57 pass、1 个既有 WebKit IME 协议 skipped，pageerror 断言保留。新增 LA/Tokyo 两时区跨 UTC 日期、可编辑保存、跨日重新新建、旧源省略日期字节保持，四个浏览器用例均通过；原关闭专项与真实 Astro 根/base 预览保持 |
| `npm.cmd run build` / base `/personal-space/` 构建 | 均退出 0；根 10 页/26 文件，base 输出 .cache/base-dist；含原 prebuild 边界 |
| `node tests/verify-release.mjs` / `node --experimental-strip-types tests/verify-vault-release.mjs` | 退出 0；公开产物无 Studio、宿主、测试或凭据，Vault 仍未配置 |
| SDK 8.0.404 锁定 restore / Release build / .NET ContractTests | 均退出 0，0 warnings/errors；native.mts 与 dotnet-*.json/log；原项目/lock 未改，热收据/产物保持，未运行 exe |
| 同一 App 后台加载链 + 真实非敏感百炼 polish | 两次自动加载配置、一次 HTTP 200，原密文与源保持，原文/响应/Key 不落日志；ai-live.json |
| 实际快捷文件迁移与只读复核 | Install-Shortcuts.ps1 / shortcut-check.ps1 均退出 0，真实桌面仅保留本项目启动入口；shortcut.json。不是点击/窗口验收 |
| `node .cache/studio-m8-refine/verify.mjs` / `git diff --check` | 退出 0；相对链接/围栏/状态、历史/未来计划、范围哈希、HEAD/空暂存区通过；verification.json |

**文档/保护/停点**：只改 11 个已存在目标：三份文档、server/main.ts、web/main.ts 与 index.html、windows/local.ts/desktop.ts/Install-Shortcuts.ps1、两份现有 Windows/编辑器测试；其余 217 个候选字节保持，没有新增 Git 候选。既有所有未提交代码和未跟踪 helper 保留，网站/真实文章/package/lock/宿主项目未改，原 9.1–9.24 历史与 M9–M15 Scope/状态保持。未启动真实 App，未操作已有服务/缓冲或旧辅助进程；只关闭自己的无窗口隔离后台。网站未受改动，未重跑未受影响的全站 E2E/发布专项；根/base 构建、边界及 Studio 预览回归为本轮实跑，不沿用为本轮全站交互通过。

自动验证与三项补充实现已完成；M8 仍 In Progress / Awaiting manual acceptance，原 native 未完成项未被取消。请作者先保存并退出旧窗口，再双击唯一图标：确认新建日期默认当天且能修改、顶部 AI 已配置并能对测试正文请求建议、X 后选择保存/放弃会关闭后台且重开不重录 Key；取消仍保留窗口/内容。完整步骤见 [MAINTENANCE](./MAINTENANCE.md#studio-m8-manual)。不控制桌面、不进入 M9、不提交/推送/发布，完成后停止。


<a id="studio-m8-icon-record"></a>
### 9.26 Studio M8 入口图标 — 蓝发二次元头像（2026-10-23，文件/构建验证完成；实际桌面显示待作者确认）

**授权与基线**：作者报告仍有 Personal Space Studio 与 Stop Personal Space Studio、图标没有内容，要求可爱的蓝发二次元形象。沿用不控制桌面、保留已有工作、不进入 M9、不提交/推送/发布的边界，只补 M8 本机图标与入口核对。开始时 228 个候选与原 HEAD/空暂存区，哈希及文档副本在忽略的 `.cache/studio-m8-icon/`。

**入口核对**：只读检查用户桌面、公共桌面、注册表桌面位置及已存在的 OneDrive 桌面位置，最终含隐藏文件扫描，只找到 `C:\Users\80631\Desktop\Personal Space Studio.lnk`；未找到 Stop 快捷文件或同名脚本。首次工具会话显示启动图标仍引用 shell32.dll,70，未用角色图。作者随后确认旧 Stop 删除提示找不到内容，并表示可能为以前残留、不影响使用。这与不存在文件的显示残留相符，但未控制桌面确认原因，不声称已消除屏幕上的第二图标，不强删不存在/未知对象、不重启 Explorer 或清图标缓存。最终文件记录为 desktop-final.json，正文/任意其他桌面文件未输出；辅助非快捷文件扫描先遇 Windows PowerShell 5.1 的 UTF-8 无 BOM 字符解析问题，改为 ASCII Unicode 正则后完成，不改用户设置。

**实际资产与引用**：使用内置 image_gen.imagegen（无另配 Key），生成原创蓝发 Q 版二次元透明头像；原 PNG 不改字节，复制到 `studio/desktop/assets/studio-blue-hair.png`。确定性导出 ICO 七种尺寸 16/24/32/48/64/128/256，保存 `studio-blue-hair.ico`，完整最终提示词与方式记在 `studio-blue-hair.prompt.txt`。已查看生成结果并确认蓝发/可爱头像、无文字水印；PNG 原 alpha 保留。Install-Shortcuts.ps1 改用项目 ICO 的绝对路径，缺文件明确 STUDIO_ICON_MISSING；csproj 嵌入 ApplicationIcon，Form 从自身 exe 提取同一图标。未改网站 favicon、Web 编辑行为、文章、AI/文件/API 或依赖。

**真实快捷文件更新**：安装器退出 0；只更新本项目启动 .lnk 的图标引用，不调用快捷方式。最终 iconLocation 为 `D:\hjk202\studio\desktop\assets\studio-blue-hair.ico,0`，普通文件/描述/仓库归属正确，磁盘仍只有一个本项目启动入口，shortcutsInvoked:false。旧 Stop 的屏幕状态留给作者手动刷新核对，不拿磁盘检查冒充视觉验收。编译使用隔离输出 `.cache/studio-m8-icon/native-app/`，不覆盖可能正在运行的旧 exe；正式入口下次正常退出再启动会按输入哈希重建/载入新窗口图标，无须重录 AI Key。

**验证**：run.mjs 的对应 npm.cmd 脚本均退出 0：lint、typecheck（178 文件零错误/警告/提示）、test（119 项：118 pass / 1 个既有 symlink 权限 skipped）、build（含 prebuild，10 页/26 文件），及 release/Vault 产物边界检查。现有单图标/安全迁移测试扩展为校验真实 ICO 引用和全部尺寸；原测试/负例保留，未新增镜像实现的无效测试。命令、退出与日志在同名 json/log；SDK 8.0.404 locked restore、隔离 Release build、.NET ContractTests 均退出 0、0 warnings/errors，native.json 验证七种 PNG frame 字节全部嵌入新 exe，nativeApplicationLaunched:false、existingAppOutputOverwritten:false。

verify-artwork.ps1 退出 0，逐个解码 ICO 内的原始 PNG frame，核对真实尺寸、非空蓝色像素、透明像素及原 PNG 哈希，artwork.json 记录结果。初次用 System.Drawing.Icon(256).ToBitmap 检查时，该旧接口实际选择 128 尺寸，导致按 256 像素面积判断失败；诊断尺寸后改为直接检查各目录项的 PNG，不放宽非空/蓝色/alpha 标准。全部七帧与原 PNG 均通过。未启动任何 App 或浏览器、未复跑未改动的 Studio/网站交互；此前 57/58 Studio 结果仅为历史，native/桌面视觉按作者约束待验，不冒称本轮点击通过。

**文档与保护**：`node .cache/studio-m8-icon/verify.mjs`、`git diff --check` 退出 0；链接/围栏/状态、资源哈希、实际图标引用、全部检查退出结果、HEAD/空暂存区核对通过。只修改三份文档、安装器、宿主 csproj/Form 和现有 Windows 测试七个候选，新增上述三份图标资产；其余 221 个原候选字节保持。原 9.1–9.25 历史、M9–M15 Scope/状态、全部网站/作者源/配置/lock 和此前未提交工作保持，未查看或更改真实 Key。图像与构建资产都留在 Studio，不进入公开 dist。M8 仍 In Progress / Awaiting manual acceptance；只需作者核对蓝发快捷图标和下次重开后的窗口图标，其他未完成 native 项不因本轮生成图像被签收。不控制桌面，不进入 M9，不提交/推送/发布，完成本项后停止。

---
<a id="studio-m8-ai-loading-record"></a>
### 9.27 Studio M8 正式 App AI 配置修复（2026-10-23，自动验证完成；正式窗口重开待核对）

**授权与诊断**：作者确认从蓝发桌面图标打开仍显示 AI_NOT_CONFIGURED，要求继续排查修复、不控制桌面、不重配 Key。只读核对正在运行的正式 app.ts host → main.ts：同一 Windows 用户、正确仓库/入口、正常 LOCALAPPDATA，保存文件存在且可经既有 DPAPI helper 读取，但 API 的两个百炼环境变量均缺失，认证状态接口确实返回 available:false / AI_NOT_CONFIGURED。没有读取或输出环境变量的凭据值。临时目录重定向假设已排除；不能把原因归给作者用了错误入口或 Key 没有保存。为何该次启动未带上环境配置尚无充分证据，不将推测写成确定结论。旧逻辑的具体缺口是 IPC 子进程完全信赖父环境、不读取本地保存配置，随后把缺失状态固定在 AI 服务中；9.25 的直接 startDesktopHost 验证没有覆盖完整 App 入口，这一限制在此补正，原历史保留。

**最小修复**：desktop.ts 完成构建后，fork 不携带明文百炼配置，改经私有 Node IPC 的严格 `studio:start` 消息指定存储；main.ts 在 API 后端直接复用 localAuthoringEnvironment / readLocalCredential，读取原 DPAPI 文件，再初始化 AI。新协议只接指定字段与绝对存储路径，不属于 HTTP/Agent/native 能力，不改变凭据格式/位置、模型、提示词或公共业务接口。无存储测试不隐式读取真实 Key，普通 Windows 终端保留显式环境优先规则。坏配置错误传回启动器；畸形启动消息、启动器在读取期间断开都不留下 API/作者锁。Web 缺配置提示改为说明“当前后台未加载”，已保存时先保存、正常退出重开，仍失败保留密文排查，不再暗示必须改用入口或重复录入。

**验证（证据在忽略的 `.cache/studio-m8-ai-loading/`）**：

| 命令 / 专项 | 实际结果 |
| --- | --- |
| `npm.cmd run lint` / `npm.cmd run typecheck` | 最终均退出 0；178 文件，0 errors/warnings/hints |
| `npm.cmd run test` | 最终退出 0；121 tests：120 pass、0 fail、1 个既有普通文件 symlink 权限 skipped。新增缺失 API 环境仍读取指定 DPAPI 的真实 HTTP 回归、私有消息负例/启动器失联与锁清理；CLI 测试适配私有启动消息 |
| `npm.cmd run build` / `npm.cmd run studio:build` | 均退出 0；网站 10 页，Studio Web 独立缓存，未发布 |
| `node .cache/studio-m8-ai-loading/run.mjs studio-browser` | 退出 0；Chromium/WebKit 共 58 项，57 pass、1 个既有 WebKit IME 协议不支持 skipped，含原编辑、AI、Agent、关闭、根/base 隔离预览与 pageerror 断言；完整浏览器运行用提示文案更新前的 Web 产物 |
| 最终 Web 重建后 `playwright test --config tests/studio/playwright.config.ts ai.spec.ts` | 退出 0；两引擎 12/12，通过新缺配置提示、不重配建议、未配置时普通保存/校验、AI 结果与取消等交互；studio-ai.json/log |
| `node --experimental-strip-types .cache/studio-m8-ai-loading/full-launch.mts` | 最终退出 0；正式 Open.ps1 → app.ts open → detached app.ts host → main.ts，使用无界面 WinExe 代替 native 窗口、夹具 Vite 编译器与空内容目录。两次重开均 available:true，API 入口主动清除百炼环境也能加载原保存配置；一条非敏感实际 polish 返回 200 / ok:true，源与密文字节保持，自有实例正常退出；full-launch.json。不冒充 WebView2 点击验收 |
| `node tests/verify-release.mjs` / `node --experimental-strip-types tests/verify-vault-release.mjs` | 均退出 0；公开产物无 Studio/宿主/测试/凭据，Vault 仍未配置 |
| `node --experimental-strip-types .cache/studio-m8-ai-loading/secret-audit.mts` | 退出 0；仅在内存比对保存的 Key，547 个仓库候选/本轮验证文件/公开产物中未发现其明文，输出只有布尔与数量；secret-audit.json |
| `node .cache/studio-m8-ai-loading/verify.mjs` / `git diff --check` | 退出 0；范围哈希、相对链接/锚点、围栏/状态、原历史与 M9–M15、HEAD/空暂存区保持；verification.json |

新缺失环境回归先在旧代码上实际失败（available:false），修复后通过。首次全套 unit 的既有终端用例误用正式 4322，与作者保持打开的 App 冲突；改为夹具已分配端口后通过，没有停止正式服务。新私有消息负例最初用 null，运行时可测但 Node Serializable 类型不接受，改为数组负例后类型检查与全部断言通过；初次失败日志保留，不删除/弱化负例。未改 C# 宿主、图标、网站源/路由及构建配置，本轮未重跑 .NET 项目与整站根/base E2E，不冒称本轮验证；已有 native 未完成项仍保持待验。

**保护与停点**：开始时 231 个候选、原 HEAD 与空暂存区，基线/文档副本保存在上述目录。本轮只改三份文档、main.ts、desktop.ts、Web AI 提示及三份既有测试共 9 个候选，其余 222 个字节保持，无新增产品文件；真实文章/配置密文、快捷方式和全部既有未提交工作保留。未控制桌面，未激活/关闭/重启作者的正式窗口。最后只读核对仍为原 API 进程、旧 AI 状态，不能把隔离验证当成旧窗口已更新；已请作者保存并正常退出，再从蓝发图标重开，随后核对新后台状态与原 Key 复用，无须重录。M8 保持 **In Progress / Awaiting manual acceptance**，M9–M15 Pending；不提交、推送或发布。

---
<a id="studio-m8-known-folder-record"></a>
### 9.28 Studio M8 默认凭据目录与正式入口复核（2026-10-23，自动验证通过；正式重开核对进行中）

**实际反馈与纠正**：作者保存并重开后，新正式 API 仍返回 AI_NOT_CONFIGURED，窗口也显示同样错误。只读检查确认入口/用户正确、文件 ACL 正常、没有 Node 加载器/编译缓存环境选项。临时启动诊断仅记录布尔与固定状态，实际得到 hasStore:true / defaultStore:true / storeExists:false / state:missing，说明尚未进入解密。正常用户目录的原保存文件仍可读取。9.27 从外部环境块作出的“排除目录重定向”结论过早，不代表 Node 实际定位结果；仅换私有启动传递并未解决正式故障，不能标验收通过。诊断与原失败状态保存在忽略的 `.cache/studio-m8-ai-loading/reopen/`。

**本次修复**：Credentials.ps1 的 Get-StudioStorePath 改用当前用户 FOLDERID_LocalAppData 与 SHGetKnownFolderPath / KF_FLAG_NO_PACKAGE_REDIRECTION，保留 Windows 配置的目录位置、不依赖启动环境 LOCALAPPDATA。Node localStorePath 经既有私有 PowerShell helper 的仅解析模式复用同一函数；Configure 读写两端共用定位，不硬编码账户、不扫描其他位置、不移动/重写原密文、不要求重录 Key。现有 IPC、HTTP、Agent、模型和提示词保持。依据：[微软 Known Folder API](https://learn.microsoft.com/en-us/windows/win32/api/shlobj_core/nf-shlobj_core-shgetknownfolderpath)、[目录标志](https://learn.microsoft.com/en-us/windows/win32/api/shlobj_core/ne-shlobj_core-known_folder_flag)。

**自动验证**：同一受重定向环境中，旧环境拼接位置无文件、Known Folder 位置存在（pathsDiffer:true）；原 Key 只读可加载。已有终端集成测试改为“Windows 固定存储与启动环境不一致”的非敏感夹具：旧代码实际失败，新定位通过，并保留显式环境优先、坏配置失败、原文/密文保持和隔离端口断言。当前 lint、typecheck、test、build、studio:build 均退出 0；178 文件零诊断，121 tests / 120 pass / 1 个既有 symlink 权限 skipped，网站 10 页。Chromium/WebKit AI smoke 12/12；release/Vault 公开产物边界均退出 0。命令与退出在本目录 run.mjs、同名 json/log；未改 Web/网站交互，不把上一轮完整 Studio/网站 E2E 当本轮重跑。

完整 Open.ps1 → app.ts open → host → main.ts 的无窗口夹具额外使用真实锁定 .NET 构建与真实 Vite 编译，两次重开均 available:true，原密文和空内容保持，自有实例正常停止，未发送新模型请求；faithful-launch.json。原生显示仍由作者操作，不把替代窗口当真实 WebView2 点击。

**入口反馈**：作者随后报告 Windows 桌面蓝发入口不见。只读核对磁盘原 Personal Space Studio.lnk 仍为普通可见文件，目标、Open.ps1 和 ICO 均存在；先备份到本轮证据目录，再用原安全安装器重新保存同一个入口，退出 0。没有调用快捷方式、打开/操作窗口、重启 Explorer 或清图标缓存，不声称已解释视觉消失原因；作者已再次打开窗口供诊断。备用仍可用 npm.cmd run studio:open，同一入口且不重录 Key。

**保护与当前停点**：`node .cache/studio-m8-ai-loading/reopen/verify.mjs`、`git diff --check` 退出 0，197 个相对链接/锚点及状态/历史一致；相对本续轮 231 个候选，仅三份文档、local.ts、两份现有 PowerShell helper、Windows 测试及 main.ts 临时诊断共 8 个改变，其余 223 个字节保持，无新增产品文件。HEAD 不变、暂存区为空；本轮 291 个候选/验证文件/公开产物的内存比对无 Key 明文（secret-audit.json），未重配凭据。作者已获告知本次目录修复须正常退出重开，尚待正式新后台结果；临时无敏感值诊断将在定位确认后移除。M8 保持 In Progress，原 native 未验项及 M9–M15 状态不变。真实文章/Key 与既有未提交工作保留；不控制桌面，不提交、推送或发布。

---
<a id="studio-m8-credential-recovery-record"></a>
### 9.29 Studio M8 正式 App 原凭据恢复（2026-10-23，实际后台与百炼请求通过；M8 其余 native 仍待验）

**根因与纠正**：9.28 的 Known Folder 修复后，作者再次重开仍缺配置；不能把隔离启动成功当作正式恢复。作者按要求重复双击一次，临时只读探针证明真实双击与命令行的存储路径哈希、main/local 源码哈希完全一致，但前者连父目录都不存在、stat:ENOENT，后者能读取文件。进一步通过 GetFinalPathNameByHandle 证明，命令行可见的原文件物理上位于 Codex 包的 LocalCache/Local，属于 Windows 打包应用的 AppData 文件虚拟化。Known Folder 的路径标志不关闭文件 IO 虚拟化；同账户、相同逻辑路径和正常 ACL 均不足以证明文件视图相同。依据：[微软打包应用 AppData 行为](https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-behind-the-scenes)。证据集中在忽略的 `.cache/studio-m8-ai-loading/runtime-path/`，不记录 Key、会话 token 或凭据正文。

**恢复与最小改动**：使用一次性脚本，只从已确认的 Codex 隔离存储复制原 DPAPI 密文字节到正式桌面启动环境的用户 Studio 目录；不扫描其他凭据、不解密迁移、不覆盖已有目标、不删除原件。限制普通文件/尺寸/schema，拒绝 reparse 祖先，以独占临时文件写入、Flush 后 Move 且禁止覆盖。作者保存、正常退出并从蓝发图标手动重开；入口在该环境完成复制，receipt 为 CIPHERTEXT_COPIED。随后移除 Open.ps1 的一次性 hook、临时 diagnose.ts 及 main.ts 的启动诊断，Open.ps1 恢复开始时原字节，产品不长期依赖 Codex 包目录。Credentials.ps1 仅补充注释，明确 Known Folder 与 IO 虚拟化的区别；原私有 IPC / DPAPI 读取能力保留。README 与 MAINTENANCE 同步实际状态，并注明首次/更换 Key 应在普通 Windows 终端配置；作者这次无需重配。

**实际正式 App 验证**：作者确认“已保存、退出并重开，窗口保持打开”。只从命令行读取该正式实例，API PID 34264、app:true，认证状态 HTTP 200 / available:true / issue:null；对非敏感测试句调用 polish，返回 HTTP 200、ok:true、非空建议。共两次请求；第一次检查器误用 data.text 而不是既有契约 value.text，纠正检查器后第二次非空断言通过，未因此修改产品契约。未读取或修改真实文章、未自动采纳建议，未操作或关闭窗口。formal-check.json 只保留固定状态与布尔，不保存请求/建议正文或凭据。原隔离密文恢复前后 SHA-256 一致，physical-store*.json；加密配置始终留在仓库外。

**本轮验证**：run.mjs 对应实际 npm 脚本 lint、typecheck、test、build、studio:build 全部退出 0；178 文件零诊断，121 tests / 120 pass / 1 个既有普通文件 symlink 权限 skipped，网站构建 10 页。Chromium/WebKit AI smoke 12/12（隔离内容与模拟上游），release 与 Vault 公开产物边界检查均退出 0。一次性复制的非敏感 fixture 覆盖字节保持、原件保留、目标不覆盖、坏文件/缺源/目录跳转拒绝；普通沙箱不能创建 junction，按审批使用隔离目录重跑后全部通过，不降低拒绝标准。命令、退出与证据为同目录 json/log；本轮未改宿主/C#、Web 或网站页面逻辑，不重跑无关 native build、全站根/base 或完整 Studio E2E，不把此前结果冒充本轮实测。

**保护与停点**：本轮基线为 231 个候选、原 HEAD 与空暂存区。范围核对仅三份文档、main.ts 的诊断移除与 Credentials.ps1 注释共 5 个候选改变，其他 226 个字节保持，无新增产品文件；原 9.1–9.28 历史与 M9–M15 计划不变。verify.mjs、secret-audit.mts 与 git diff --check 验证范围/链接/状态、原密文哈希与无 Key 明文；记录在同目录 verification.json / secret-audit.json。正式 App AI 加载与真实请求本次已确认，其他 native 手动操作仍按维护手册等待对应反馈，M8 保持 In Progress。未控制桌面、未要求重录 Key，真实内容及已有未提交工作保留；不进入 M9，不提交、推送或发布。

---
<a id="studio-batch-m9-record"></a>
### 9.30 批量授权与 M9 Keep（2026-10-23，Auto verified / Awaiting unified acceptance）

**授权与状态**：作者对 M8 日常清单反馈“ok了”，随后要求后续全部完成再汇报，并明确确认 M9–M15 批量实施、最后统一人工验收。原生桥/导航与失联最终交互等缺口仍保留待验，不虚构已通过。此授权取代本路线逐项等待人工确认的停点；各实施单元仍独立完成自动与安全验证才继续，技术阻断不得跳过，不导入真实私人资料、不控制桌面、不提交/推送/发布。基线 231 个候选、原 HEAD 与空暂存区，在 .cache/studio-batch/baseline.json；保留全部 M7/M8 未提交工作。

**M9 实际交付**：Keep 自有 Bookmark 契约/校验/服务、严格字面量 AST parser、固定 data.ts 文件 adapter、认证 HTTP CRUD/校验/真实隔离 Astro 预览与 PC 表单。整文件 revision，既有 slug 不改，无修改字节保持，编辑只替换受管理表达式，外围代码/注释保持；不支持的表达式/无法保留的内部注释阻断写入。draft、段落换行、可选字段、数组顺序和其他条目保留。只抽取已有结果 envelope，未建立通用内容模型。Think/Keep 内存缓冲分别保留，协同退出显式保存两者；冲突、断线与结果未知保留缓冲且不盲重试。新增 Keep 写入锁的正常关闭和严格异常恢复，仅清理与已确认死亡 API 对应的固定锁，外来/孤立锁拒绝处理。作者 API 的路径和请求详见维护手册 9.3.6，现有 Think AI/Agent 权限不扩大。

**实际验证**：lint/typecheck/test/build/studio:build 均退出 0；187 文件零诊断，127 tests / 126 pass / 1 个既有 symlink 权限 skip。Keep 双引擎 10/10，包含完整表单 CRUD/删除取消、草稿/段落保留、整文件冲突、写入已完成但响应丢失、两模块取消/保存退出，以及根/base 原 Astro 惰性预览、sandbox 与源/dist 不变。通过 adapter 在非敏感网站副本新建/取消公开/删除至全空，根/base 共六次实际构建，分类/详情/外链/搜索/计数通过。网站 Chromium 根/base 各 3/3，WebKit 根/base 各 2/2；release 与 Vault 公开产物边界检查均退出 0。证据为 .cache/studio-batch/m9 下 run.mjs、同名 json/log、site-check.json 和测试结果目录，不含真实私人内容或 Key。

**失败与复验**：首次新单测清理顺序错误，改为先关闭夹具服务再删目录；初次全单测发现旧启动夹具漏复制新增纯校验依赖，仅补对应源码后全套通过。首次完整 Studio 回归为 63 pass / 2 fail / 1 skip，原因是原 Think 标签定位匹配到隐藏 Keep 同名字段；定位限定 Think 表单后该文件双引擎 17 pass / 1 个既有 WebKit IME skip，其余原已通过用例保留，未过滤异常或弱化断言。后续并行构建与浏览器共享产物时，出现一次 Keep 初始脚本未加载、一次网站重载 Not found；停止并行修改产物后原样串行复验，Keep 10/10 与网站对应 smoke 全通过，不更改超时。网站专项检查器最初把搜索索引误当已带 base，已按既有逻辑 URL 契约纠正，并保留 HTML 根/base 链接独立断言。

**保护与边界**：M9 改动仅 Studio、必要测试与三份文档；真实 src/public、package/lock、工作流及已有其他改动保持。命令行/浏览器 fixture 通过不替代真实 App 人工确认；M9 不标 Done，正式 App 的 Keep 保存/预览/退出由最后统一人工验收覆盖。M8 原专项继续保留；M10–M15 仅按已获授权及逐阶段自动门槛推进。范围/历史/链接与 HEAD/空暂存区证据为本目录 audit.json。

---
<a id="studio-batch-m10-record"></a>
### 9.31 M10 Me 单例资料（2026-10-23，Auto verified / Awaiting unified acceptance）

**范围与实际变更**：M9 自动/安全验证与范围审计通过后，依批量授权实施 M10。新增独立 Profile 契约、单例 service、严格字段/链接校验、HTTP read/save/clear/validate/preview 与 Me 表单；复用实际已有 AST、固定文件/revision/原子写入与原模板预览设施。仅按两模块真实重复提取同源传输和段落/链接 DOM 控件，不建立通用内容模型。空源保持 null，不补造资料；新建需显式点击且默认 draft。save 拒绝 null，clear 单独确认并检查整文件 revision；取消公开保留原对象。可选字段、段落换行、链接顺序及表达式外围字节保留。退出处理覆盖多个模块缓冲，增加 Me 锁严格归属恢复，仍不清理孤立/外来锁；HTTP/Agent 不接收任意路径，AI/现有 stdio 权限仍仅 Think。手册 9.3.7 锁定实际接口和操作。

**验证与证据**：.cache/studio-batch/m10 下对应 npm 脚本 lint/typecheck/test/build/studio:build 全部退出 0；194 文件零诊断，最终单测 131 项 / 130 pass / 1 个既有 symlink 权限 skip。Me 双引擎 8/8（单例编辑、可选字段、清空取消/null、新建不造数据、冲突与坏链接、根/base 真 Astro 惰性预览与 sandbox/源不变）；Keep 回归 10/10、原退出专项 16/16。Me adapter 在非敏感网站副本实际保存公开/draft/null，根/base 六次构建，原空态、真实 count、搜索与链接符合既有规则，不改 Me Compass 平均逻辑。Chromium 根/base smoke 各 3/3，WebKit 对应全模块/Keep smoke 各 2/2；release/Vault 公开产物边界均退出 0。最后补入的 Me 锁恢复负例单独引发一次完整 lint/typecheck/test 重跑，最终版全部通过；本轮无产品或测试失败被过滤。run.mjs 与同名 json/log、site-check.json 保存实际命令/退出；不声称本轮重跑完整全站/Studio 套件或实际点击原生窗口。

**保护与下一边界**：本项基线为 M9 checkpoint（240 候选），三份初始文档在本目录；范围审计保存 audit.json 与下一项 checkpoint.json。仅本项 Studio/必要测试和三份文档变化，真实网站/正文/public/package/lock 与此前工作保持，历史记录完整保留，HEAD/空暂存区不变。不导入真实私人资料、不控制桌面、不提交/推送/发布。Me 的真实 App 操作留待最后统一人工验收，不标 Done；自动门槛通过后才进入已授权的 M11。

---
<a id="studio-batch-m11-record"></a>
### 9.32 M11 Build 公开项目（2026-10-23，Auto verified / Awaiting unified acceptance）

**实际变更**：M10 自动/安全验证与审计通过后按批量授权实施 M11。新增 Project 自有契约/服务、完整嵌套结构与原模型校验、固定源 AST/revision/原子 CRUD、HTTP/真实 Astro 隔离预览与五步 PC 表单。sections/代码/关键词/链接/status/milestones/updates/issues 完整维护，不转成另一套正文；省略、空数组、记录顺序与其他项目保留，不执行候选 TS，不改已有 slug。客户端只用项目 DTO，无路径/源码/命令或私人权限。正式 Vault 存在时，删除或取消公开的父项目返回 PRIVATE_REFERENCES_UNKNOWN，保留源并明确原因；不解密、不假称已核对。原预览投影增加 header/footer/nav 惰性语义标签以保留真实项目封面，脚本/属性过滤与 CSP 不变。扩展 Build 锁的严格退出/恢复，不清理外来或孤立锁。手册 9.3.8 记录实际字段/操作/API，README 与当前架构表同步四个公开模块。

**验证**：本目录 .cache/studio-batch/m11/run.mjs 对应 lint/typecheck/test/build/studio:build 全退出 0；200 文件零诊断，139 tests / 138 pass / 1 个既有 symlink 权限 skip。Build 双引擎 8/8：分步编辑、嵌套代码和记录保留、新建/删除取消/draft、整文件冲突、正式 Vault 存在时关联阻断、根/base 真模板预览/sandbox/源与 dist 不变。Me 8/8、Keep 10/10、退出回归 16/16。Build adapter 在独立非敏感网站副本执行公开新建/取消公开/删除至全空，六次根/base 实际构建，详情/链接/搜索/计数/代码换行/更新降序/隐藏空区块通过；site-check.json。网站 Chromium/WebKit × 根/base 的 Build/Keep/Me/全模块 smoke 各 4/4，另有 Build 单项复验；release/Vault 产物边界均退出 0。同名 json/log 保存命令、结果及证据，未控制真实 App 窗口或运行真实私人资料。

**失败处理与限制**：首次增量 tsc 的记录泛型推断遗漏可选字段，改为原 Project 成员类型后通过。第一次 Build 浏览器为 6 pass / 2 fail，实际原因是阶段状态 select 的隐式标签混入选项文本；给控件补准确 aria-label，保留原断言/超时，完整重跑 8/8。另补 Node 直接调用稀疏关键词数组的拒绝负例，避免序列化为 null 后损坏源；最终四项门槛已重跑。API/表单自动通过不替代真实 App 人工验收，M11 不标 Done。未引入私人编辑、模型抓取、排序系统、数据库、Git/发布能力。

**范围与下一阶段**：本项基线为 M10 checkpoint（247 候选），文档副本保存在本目录；audit.json 验证仅 15 个既有目标改变、新增 6 个本项文件，232 个原候选字节保持，真实 src/public/package/lock 与历史保留，HEAD/空暂存区不变。M8 专项与 M9–M11 人工项目留待统一验收；自动与安全门槛通过后才进入已授权 M12，须先证明私人边界，不把公开模块的模式直接套用私人数据。不提交、推送或发布。

<a id="studio-batch-m12-record"></a>
### 9.33 批量 M12 私人隔离原型（2026-10-23，Auto verified / Awaiting unified acceptance）

**实际边界**：新增 studio/private 的完整包校验、挥发会话和固定错误，以及 server/private 的密文文件 adapter。复用原 PBKDF2 600000/AES-GCM/AAD/限额与四个模块 schema；全包资产和最新公开 Build 关联校验，保留原字段/省略/顺序，不用归一化结果覆盖未编辑模块。局部表单候选只暂留内存，预览/加密前重验完整包；lock 使迟到解密/加密失效，口令不存于会话。确定仓库外密文主文件为唯一作者源，网站 bundle 为派生交付物；旧 JSON 继续由作者在本机用既有 CLI 加密/验证后显式转用，保留密文备份，不自动迁移或增加明文导入接口。

**可信选择与存储**：原生选择器仅接受精确顶层来源、严格 operation/nonce；路径仅 native → launcher → backend 私有通道，浏览器仅得随机 handle，没有任意路径 HTTP 接口。一次绑定一个仓库外 JSON，链接/硬链接/重定向目录/ADS/设备名/错误 envelope 拒绝；整文件 revision、独占临时文件/fsync/原子替换、旧密文 revision 命名备份、失败保留旧源和 cleanupPending。独立 API/Agent 没有选择能力；本项未提供私人 HTTP 读写或编辑 UI。App 构建/启动环境移除外部 WEBVIEW2_ 覆盖；只允许本服务拥有的 Blob 图片，连接仍同源。

**自动验证**：证据在 .cache/studio-batch/m12/。npm.cmd run lint、typecheck、test、build 与 studio:build 全部退出 0；最终类型检查 210 文件、0 errors/warnings/hints，完整测试 146 项、145 通过、1 项既有 symlink 跳过。覆盖整包/字段/资产/关联、真实密码互通、错误口令、锁定迟到结果、路径/句柄/旧版本/备份/原子失败及可信 IPC 选择。初次受限权限测试发生 junction/文件替换 EPERM，保留 unit-sandbox 日志，未弱化检查；核对命令后仅结束该次滞留测试进程，具备所需权限下完整重跑通过，未接触正式 App。新增原型脚本 URL 显式导入的 lint 问题修复后重跑通过。

**实际浏览器与原生原型**：可复现入口 tests/studio/private/playwright.config.ts 自动构建纯测试 bundle；Chromium/WebKit 8/8，包括 Node→browser 解密、只修改目标、browser→Node 解密整包比对、错误字段/迟到结果和 Blob 图片 CSP。原生项目 locked restore/build、无窗口契约测试退出 0、0 warnings/errors；独立 tests/studio/private/runtime/RuntimeProbe.csproj 使用实际 WebView2、相同 Boundary 过滤器和独占 InPrivate 环境，无 Show/Activate/选择器或桌面控制。内存加解密/图片加载/锁定、非可信 frame 请求拒绝及外部导航阻断通过；正常释放浏览器后、未预清理目录，扫描 121 个 profile 文件，UTF-8/UTF-16 canary 均不存在，local/session stores 为空。runtime-probe.json / runtime-cache-audit.json 保存布尔证据。首次原型误用 Blob fetch，CSP 拒绝；改用真实预览所需的图片加载并仅增加 img-src blob:，随后通过，connect-src 未放宽。

**回归与限制**：双引擎退出协同 16/16，网站四模块 root smoke 4/4，release/Vault 边界退出 0。正常运行/锁定/退出的 canary 检查不承诺 OS 内存取证、崩溃转储、本机恶意程序隔离或 JavaScript 字符串物理清零。真实文件选择器、App 隐私/关闭交互留到统一人工验收，不标 Done。真实 src/public/package/lock 与既有改动保持，历史/范围/HEAD/空暂存区检查见 audit.json / checkpoint.json；未读取真实私人源/口令或 Key，不控制桌面，不提交/推送/发布。M12 技术安全门槛通过后才进入已授权 M13。

<a id="studio-batch-m13-record"></a>
### 9.34 批量 M13 私人 Think（2026-10-23，Auto verified / Awaiting unified acceptance）

**实际变更**：正式 App 增加独立私人面板、可信选择/解锁/新建完整包、私人 Think 列表/字段/确认删除、全包校验、原受控客户端预览与仓库外加密保存。沿用稳定 opaque id、私人 date/kind/body，不套用公开 slug/published。预览不运行 Astro，HTML 为文字，资产只用内存 Blob，链接不导航；整包未编辑字段、其他记录/模块/资产保持。浏览器口令对话框输入即清理，不传后台、不记住；锁定、离开私人模块、隐藏后台、十分钟闲置及获准关闭清除会话/DOM/Blob，取消退出保留缓冲。迟到结果受 epoch/version 限制，发送后错误/未知结果禁止盲重试。主文件消失拒绝静默空包重建。

**后台边界**：仅可信启动注入 CipherFiles，原生选择仍是唯一绑定入口。新 /api/studio-private/public-build 与 files/{handle} 只传公开关联快照、密文/句柄/revision；拒绝任意 path/password/payload，受原 Host/Origin/Token/尺寸/并发限制。保存先校验当前公开 Build revision，最终原子替换前再次检查；不解密，也不冒称 backend 已校验明文。没有私人 AI/Agent 或正式 bundle 替换能力。补充可编码/8MiB 内存候选约束与最终依赖守卫。复用现有网站客户端需 bundler 解析，因此仅将 Studio Web 严格类型检查拆到独立 tsconfig，并追加 package 的 typecheck 命令；Node/backend 保持 NodeNext，网站源码、依赖及 lockfile 不改。App Web 构建指纹增加实际复用的私人核心/schema/渲染/CSS 依赖，相关文件变化会可靠重建。

**自动与浏览器证据**：.cache/studio-batch/m13/ 下 lint/typecheck/unit/build/studio-build 全退出 0；215 文件、0 errors/warnings/hints；149 项单元测试、148 通过、1 项既有跳过。私人 Chromium/WebKit 22/22：完整包 CRUD/真实 Node 解密比对/可修改当天日期、实际 Blob 图片、HTML 不执行、未编辑收藏/介绍/项目/资产保留、错误/冲突/源消失、公开源变化使旧候选失效、未知写结果、迟到读取、锁定/退出取消与保存。所有应用请求检查无本次随机 canary/口令/私人测试文字上传，无外网，local/session stores 空；诊断关闭 DOM snapshot/trace/screenshot，断言未弱化。第一轮删除测试暴露旧“保存成功”状态残留，已在新增/删除/保存开始时修正，并重跑通过。早期错误上下文仅含已公开的非敏感测试源代码字面量，未含随机 canary；测试口令现改为运行时随机，避免源片段复制测试凭据。

**原生与回归**：tests/studio/private/runtime 增加可选实际编辑界面模式；独立隐藏 WebView2 使用实际 bundle、原 Boundary/资源过滤、独占 InPrivate profile 和可信测试 handle，运行新建/受控预览/输入口令/真实 HTTP 密文保存/重解锁/锁定。无 Show/Activate/选择器或桌面控制；正常释放后、未清理目录前扫描 122 个文件，UTF-8/UTF-16 canary 不存在，外部导航/非可信 frame 桥拒绝。runtime-build.json、runtime-probe.json、runtime-cache-audit.json 为证据；不代替真正 App 人工交互或 OS 内存取证。原退出协同 16/16，公开 Think 17 通过/1 项既有 WebKit IME 跳过、Keep 10/10、Me 8/8、Build 8/8，网站四模块 smoke 4/4，release/Vault 边界退出 0。

**范围与停点**：基线 M12 checkpoint（266 候选），历史/链接/文件范围/HEAD/空暂存区见 audit.json 与 checkpoint.json。真实 src/public、文章和 lockfile 保持；package 仅上述检查脚本变化。M13 不标 Done，真实选择器/中文输入/App 最小化和关闭仍留到统一人工验收。未读取真实私人源/口令或 Key，不控制桌面，不提交/推送/发布；通过本项自动安全门槛后进入已授权 M14.1。

<a id="studio-batch-m14-1-record"></a>
### 9.35 批量 M14.1 私人 Keep（2026-10-23，Auto verified / Awaiting unified acceptance）

**实际变更**：独立私人 Bookmark 类型/新建 helper 与 Keep 字段面板，复用原 schema/受控客户端和完整包会话。私人 Think/Keep 切换只改变视图，候选保留同一完整包；收藏 id 不可改，新建分类生成 32 位 id，可选分类/类型仅显式增删，不注入公开 slug/published。说明段落/换行/顺序和其余模块/资产保持，来源链接与同分类 id 的名称一致性由原 schema 校验；内存预览链接不导航。保存/版本/关闭/密文边界不新增接口。提取两份真实浏览器测试共用的非敏感 fixture；增加 App 构建指纹中的 Keep 真实渲染依赖。

**必要修复**：段落控件原 label 含删除按钮文字，双引擎精确可访问名称测试失败；增加明确 aria-label，并重跑受影响公开 Me/Build 和私人表单，不放松 locator。私人动态输入统一关闭自动填充/拼写检查；补齐解锁完成时启动十分钟闲置计时、锁定清除计时器，以及新增记录超过包限额时保留原候选并显示固定错误。同步总览表里落后的 M12/M13 状态，保持与各自既有记录一致，不拔高人工状态。

**验证**：.cache/studio-batch/m14-1/ 下 lint/typecheck/unit/build/studio-build 均退出 0；220 文件、0 errors/warnings/hints，150 项单元测试、149 通过/1 项既有跳过。完整私人双引擎 30/30，覆盖字段/稳定 id/完整包保留/实际 Blob 图片、非法 URL/分类、分类增删、段落、创建删除、退出取消/冲突/锁定及快进时钟十分钟闲置；未编辑 Think/Me/Build/资产整包解密比对通过。旧私人工具回归保持，应用请求不含本次口令/canary/私人测试文字，持久化 stores 为空；关闭后隔离作者源仅有原 Build data.ts，无私人内容写入网站。初次 4 项可访问标签超时记录保存在 private-browser-first-failure.log，修复后重建并全套通过。退出协同 16/16、公开 Me 8/8、Build 8/8，release/Vault 边界退出 0。

**保护与下一项**：基线 M13 checkpoint（273 候选），范围/历史/链接/HEAD/空暂存区见 audit.json 与 checkpoint.json；仅 Studio、必要测试与三份文档改变，真实 src/public/package/lock 和其他既有改动保持。App 实际选择/私人 Keep 输入与退出留待统一人工验收，不标 Done；通过本项自动门槛后才进入 M14.2。不读取真实私人资料或 Key，不控制桌面，不提交/推送/发布。

<a id="studio-batch-m14-2-record"></a>
### 9.36 批量 M14.2 私人 Me（2026-10-23，Auto verified / Awaiting unified acceptance）

**实际变更**：独立私人 Profile 类型与段落/链接字段面板，接入原完整包会话；仅 paragraphs/可选 links，不引入公开 name/description/published/null。不存在的私人 Me 保持缺省，显式新建仅创建空 paragraphs；编辑未触碰 links 时保留省略，提供明确省略操作，确认清空只删除私人 Me 模块候选。取消不丢缓冲，其他模块/id/资产保持；加密保存仍写同一仓库外主文件，不新增 HTTP/AI/Agent 能力。Me 原受控客户端在 Studio 的当前挂载路径中预览，不改变网站路由，空内容不补造；链接不导航。App 指纹增加实际 Me 渲染/CSS 依赖。

**验证**：.cache/studio-batch/m14-2/ 的 lint/typecheck/unit/build/studio-build 均退出 0；224 文件、0 errors/warnings/hints，151 项单元测试、150 通过/1 项既有跳过。完整私人双引擎 36/36，涵盖段落/换行/链接增删/省略、空态/清空取消与确认、无公开字段补造、非法链接、冲突、退出取消、锁定、整包 Node 解密比对与既有 Think/Keep 回归；应用网络无本次口令/canary/私人测试文字，local/session stores 为空，fixture 网站源无私人新增文件。原退出协同 16/16，release/Vault 边界退出 0。没有用模拟密码替换真实 Web Crypto；原生 App 选择/输入/清空与协同关闭由最终统一人工验收覆盖。

**保护与下一边界**：基线 M14.1 checkpoint（278 候选），范围/历史/链接/HEAD/空暂存区核对见 audit.json 与 checkpoint.json。仅本项 Studio/必要测试和文档变化，真实 src/public/package/lock 及其他已有工作保持；不标 Done。自动门槛通过后才进入 M14.3，不提前实现密文交付。不读取真实私人资料或 Key，不控制桌面，不提交/推送/发布。

<a id="studio-batch-m14-3-record"></a>
### 9.37 批量 M14.3 私人 Build（2026-10-23，Auto verified / Awaiting unified acceptance）

**实际变更**：独立私人 Project/Supplement 原始类型与新建 helper，保留原 schema 允许的省略字段，接入完整包会话的独立项目/公开项目私人补充列表、增改删、校验与原受控客户端预览。支持章节/代码、关键词/链接/状态、阶段/进展/问题，补充不注入独立项目专有字段。只按真实重复复用现有 Build 嵌套 DOM 控件：参数仅为真实共享的章节/记录结构和控件前缀，顶层公开/私人模型仍分离，没有通用内容模型。未修改源网站 schema/client/data，新增 App 构建指纹依赖确保真实 Build 渲染更新时重建。

**原契约与关联**：核对原 vault.schema/server，允许不同 id 的多条补充关联同一 publicSlug，保留该行为；重复项目/补充 id 拒绝。校验/预览/加密每次读取最新已公开目标，缺失父项目阻断；输入口令后公开 revision 改变，在最终落盘前拒绝，不把密文结构校验说成 backend 业务校验。完整包其他条目/模块/资产与未触碰可选字段/数组/代码换行保持，未增加资产编辑、AI/Agent 或正式包替换。

**验证**：.cache/studio-batch/m14-3/ 的 lint/typecheck/unit/build/studio-build 均退出 0；228 文件、0 errors/warnings/hints，153 项单元测试、152 通过/1 项既有跳过。完整私人双引擎 44/44：嵌套代码/阶段/进展/问题往返、新建删除、原始省略与整包保留、两类记录/稳定 id、重复 id/合法同父补充、公开目标缺失/编辑中变化、错误字段/日期/状态/资产、退出取消/冲突/锁定，真实 Web Crypto 与 Node 解密比较通过。网络无本次口令/canary/私人测试文字，stores 为空，隔离作者源没有私人新增文件；公开 Build 回归 8/8、退出协同 16/16，release/Vault 边界退出 0。

**保护与下一项**：基线 M14.2 checkpoint（282 候选），范围/历史/链接/HEAD/空暂存区见 audit.json 与 checkpoint.json；真实 src/public/package/lock 与其他原工作保持。M14 三子项均自动验证完成，真实 App 操作统一待验，不标 Done；通过门槛后按批量授权进入 M15。不读取真实私人资料或 Key，不控制桌面，不提交/推送/发布。

<a id="studio-batch-m15-record"></a>
### 9.38 批量 M15 密文交付与统一验收准备（2026-10-23 实现，2026-10-29 验证收尾，Auto verified / Awaiting unified acceptance）

**实际交付**：新增 `studio/server/private/delivery.ts`，复用受限密文 adapter 管理三个独立角色：仓库外加密主文件是唯一作者源、仓库外新候选是派生交付副本、仓库内只允许固定 `public/vault/bundle.json`。原生增加有限 export 选择消息，不替换主文件句柄；仅可信启动注入交付能力，独立 CLI/Agent 不获得任意路径或私人权限。HTTP 新增认证的 status/export/replace，只接密文、随机句柄和版本，拒绝口令/明文/path/多余字段。后台不解密、不把 envelope 校验冒充业务校验。

**网站兼容最小修复**：完整 WebKit 回归发现原 Compass SVG 链接缺少显式 tabindex，真实鼠标移动的 movementX/Y 始终为零，导致键盘导航和返回后的悬停失效。用隔离无窗口探针记录真实 Tab/坐标行为后，仅在 Compass.astro 增加 tabindex=0、按 clientX/Y 变化识别真实移动，沿用原导航/计数/清理规则，不改变布局/模型。Spotlight 的 220ms 关闭动画可能早于测试端两次 RAF 往返采样结束，测试改为在页面内观察关闭、定位真实 CSSAnimation 中点并立即继续动画，保留实际模态/透明度/背景动画/结束与焦点断言；没有改产品动画或延长关闭时限。

**安全与恢复**：前端必须先保存完整主文件，重验四模块/资产和最新公开 Build 关联，以当前口令解密核对已保存主文件，再重新加密导出新候选。候选关联主文件 revision、公开源 revision、目标 expectedRevision 和当前编辑版本；修改/锁定/换源后重新导出。最终替换前重复核对文件身份及版本，原子写入前再检查关联；不提供 force 或自动重试。旧正式包原始密文字节先备份至仓库外主文件同目录 `.studio-delivery-backup-<sha>.json`，不把备份放进 public。未知响应保持不确定状态，可只读 SHA 确认，不重复提交已消费候选。恢复通过显式选择旧密文备份的新副本、完整校验、重新导出及确认完成，不直接覆盖作者源。主文件保存、候选导出、本地 bundle 替换与 Git/上线始终分开；操作和恢复路径见[维护手册](./MAINTENANCE.md#studio-private-delivery)。

**自动验证**：本轮运行器通过 Node 调用本机 npm CLI / Playwright CLI；对应 npm 命令与完整参数、退出码分别在 `.cache/studio-batch/m15/*.json`，日志在同名 `.log`。下表为实际结果，不代表正式网站发布验收或真实 App 人工反馈。

| 实际命令 / 验证 | 结果与证据 |
| --- | --- |
| `npm.cmd run lint`、`npm.cmd run typecheck` | 退出 0；235 文件零诊断，Studio NodeNext / Web Bundler 严格检查均通过；lint/typecheck.log |
| `npm.cmd run test` | 退出 0；165 项、164 通过、1 项既有普通文件 symlink 权限跳过；unit.log。包含交付备份/恢复、四类 stale、原子失败/最终依赖守卫、路径/junction/hardlink/坏备份/明文结构/认证负例、初始化失败清锁、真实 Node IPC export 不替换 master cap |
| `npm.cmd run build`、`npm.cmd run build -- --base /personal-space/ --outDir .cache/base-dist`、`npm.cmd run studio:build` | 全退出 0；网站 prebuild 未跳过，网站与 Studio 产物分离；build/base-build/studio-build.log |
| 原 Studio Chromium/WebKit 全套（`tests/studio/playwright.config.ts`）与受影响预览复验 | 83 通过、1 项既有跳过；Agent/AI 建议模拟、四公开模块、真实 Astro 隔离预览、IME 与关闭协同；studio-browser.log；网站兼容修复后 Build 实际 Astro 预览双引擎 8/8，studio-project.log |
| 私人 Chromium/WebKit 全套（`tests/studio/private/playwright.config.ts`） | 54 通过；四模块完整包保留/校验/预览/保存、资产/HTML、锁定/闲置/后台/退出、导出/取消/冲突/未知写结果/错误口令等；private-browser.log |
| 原网站完整 root/base × Chromium/WebKit | root-e2e 77 通过；base-e2e 77 通过；webkit-root-full 77 通过；webkit-base-full 77 通过；root-e2e/base-e2e/webkit-root-full/webkit-base-full.log，公开导航与既有 Vault/清理测试保持 |
| 实际交付密文的隔离网站 root/base × 两引擎 | 8/8；delivery-site.log / delivery-site-artifacts.json。通过真实 adapter 交付后构建，Node 解密整包一致，实际网站四模块/PNG Blob/搜索/真实计数与 Me 平均/公开项目补充/锁定清理通过，无私人 head/上传/外网；产物无明文、口令或 Studio 测试文字，该隔离构建过程未改真实 src/public |
| `node tests/verify-release.mjs`、`node --experimental-strip-types tests/verify-vault-release.mjs` | 退出 0；boundary/vault-boundary.log。仅本地检查，不运行 Actions、不发布 |
| Windows 宿主 locked restore/build、有限消息契约、隐藏运行时 probe | 2026-10-23 退出 0；dotnet-restore/build/contract.json、runtime-build/probe/cache-audit.json。实际生产 Boundary/InPrivate WebView2、四私人面板预览/加密保存/重解锁/密文交付、外部导航和非可信 frame 拒绝；窗口从未显示/激活，未打开选择器。正常释放后、未先清理目录，122 profile 文件 UTF-8/UTF-16 canary 不存在，应用 stores 空。该编辑器探针未声称覆盖资产编辑；Blob 图片由既有 M12 原型和本轮浏览器/真实网站测试覆盖 |
| `node .cache/studio-batch/m15/audit.mjs`、`git diff --check` | 退出 0；audit.json / checkpoint.json，文档链接/状态/历史、源哈希/文件范围、HEAD/空暂存区核对通过 |

**失败处理**：保留 studio-browser-first-failure.log/json 与 studio-results-first-failure/。2026-10-23 全套的两项 Chromium Build 隔离预览在仍构建时触发默认 30 秒外层测试截止，但原断言允许 90 秒；2026-10-29 对 Build/Keep/Me 的真实预览组明确 120 秒外层预算，使既有 90 秒断言可执行。未改产品超时、安全规则、预览内容/源保持断言，没有过滤 pageerror、删除用例或重试掩盖失败；重跑全套结果如表。WebKit root/base 各 3 项原失败、截图/trace 均留在 webkit-*-full-first-failure.log/json 与对应 *-results-first-failure/；原失败用例定向 Chromium/WebKit 复验与修复后完整 root/base 两引擎复验见表。后续完整 WebKit 暴露两项导航时序：click 后未等真实目标 load 就 goBack，以及还原后 SVG hit-test 帧尚未稳定即连续 tap；保留 webkit-root-full-navigation-failure.log/json 与对应 trace。测试补显式目标 load 与还原后的两帧等待，原 URL/触控/返回断言保持，不吞导航取消、不用自动重试；两用例独立重复三次 6/6，webkit-navigation-repeat.log，随后重跑完整矩阵。M12 的旧沙箱 EPERM 记录见 9.33；M15 的 delivery-site-config-failure.log 仍保留，修正隔离测试服务 cwd 后原断言通过，不改网站运行逻辑。

**保护与停点**：相对 M14.3 checkpoint 的 286 候选，仅本项三份文档、交付接点及必要测试共 27 个既有候选改变，新增 7 文件；其余 259 个字节保持。网站仅 Compass.astro 的上述兼容修复，全部真实作者内容、public、其他网站源码、package/lock、AGENTS 和此前未提交工作保持。9.1–9.37 历史保持，未暂存；HEAD 仍为 `9fd8cc8bda5c903c0b897f23a63168764b62899b`。本仓库没有写入测试正式 bundle，没有读取真实私人资料、口令或 AI Key，没有控制桌面、提交、推送或发布。各阶段自动/安全门槛通过，M9–M15 均为 **Auto verified / Awaiting unified acceptance**，M8 原生专项继续待验；不是整条路线 Done。唯一剩余验收入口是[统一人工步骤](./MAINTENANCE.md#studio-batch-manual)，收到实际反馈后再核对状态；正常无窗口/cache 检查不承诺 OS 内存取证、崩溃转储或字符串物理清零。到此停止，不开始新的实现或上线。

<a id="studio-authoring-planning-record"></a>
### 9.39 Studio M16.1–M23 规划入档（2026-10-30，文档任务完成）

**授权与实际变更**：作者认可上一轮只读评估，明确本轮只整理架构与阶段计划，不实施、不控制桌面、不提交/推送/发布。新增第 6.11 节，记录现有启动/私人 UI/AI/Agent/发布源码依据、同仓库及 API 边界、启动测量与优化、工作台风格、私人向导、模块专属提案/公开收件箱/事实来源和精确批准、Pi 离线/在线客户端、受控文档及固定发布协调。M16.1/16.2、M17、M18、M19.1/19.2、M20、M21、M22、M23 共 10 个独立单元均含 Goal、Scope、Non-goals、Files、接口/数据流、Done Criteria、Verification、风险及下一边界，全部 Pending；首个候选为 M16.1，未获实施授权。README 只同步入口和进度，MAINTENANCE 增加尚未实现的使用蓝图，并将旧通用 Git/job 参考收敛至已认可的 M23 边界，不另立需求来源。

**Verification**：运行忽略目录内的文档审计 verify.mjs 与 git diff --check，退出 0；四份文档围栏/相对链接及锚点、10 项规划字段与 Pending 状态、已实现/规划区分、前项依赖及授权停点核对通过。原 6.10 与 9.1–9.38 完成历史完整保留；M8 原生专项与 M9–M15 统一人工待验不拔高，不重启网站 Phase 5/6。证据位于 .cache/studio-m16-planning/docs-nFAJCj/ 的 baseline.json、verify.mjs、verification.json，统计以该 JSON 为准。

**改动范围与停点**：293 个初始 Git 候选中仅 PLAN/README/MAINTENANCE 三份文档改变，其余 290 个 SHA-256 不变，含 AGENTS、网站/Studio/测试/作者内容、package/lock、图标与已有未提交代码；候选集合无增删，HEAD 仍为 9fd8cc8bda5c903c0b897f23a63168764b62899b，暂存区保持为空。核对辅助证据仅在忽略的 .cache 内，未创建未来模块/Skill/接口/按钮。工程 lint/typecheck/test/build、性能测量、浏览器/原生 smoke 与真实 AI 调用未运行（纯文档且工程输入未变），不借用历史通过冒称本轮重跑。没有启动或停止 App、读取实际凭据/私人源、安装 Skill、控制桌面、提交、推送或发布。完成文档后停止，等待新的明确实施指令。

<a id="studio-m16-1-record"></a>
### 9.40 Studio M16.1 启动基线与反馈（2026-10-30，In Progress / Awaiting manual baseline）

**实际变更**：新增 studio/windows/startup.ts，只接固定阶段和缓存原因，记录 runId、outcome、相对单调时间到固定 startup-latest.json；使用原安全目录/文件身份/原子替换能力，不覆盖链接或坏目标，诊断失败只给固定提示，不影响服务授权。宿主/Web 检查各报告命中/缺失/变化/坏 JSON，宿主 restore 与 build 分段；启动器记录凭据定位/后端/API 及原生窗口/WebView2/编辑器握手，重复激活单列。C# 原有窗口显示初始化/载入文字并发出仅 type 的观察消息，未改变先准备后显示窗口、缓存校验、启动顺序、退出或密钥读取方式。未加业务 API，未进入 M16.2。

**计时边界与证据**：相对时间起点为 host 或 opener 的函数入口，不含先前 PowerShell/静态模块加载；原生阶段以父进程收到通知计，不能冒充屏幕首显或真实可编辑。scenario 由缓存观察推断，不宣称判定系统首次安装。每次只保留最新诊断，留存方法和真实 10 次普通冷启步骤见[维护手册](./MAINTENANCE.md#studio-startup-baseline)。本机 10 次隔离后端启停的 p50（nearest-rank）1245ms、最慢1709ms，构建关闭、无可见窗口、无真实凭据；只证明采集/启停链路，不是正式 App 冷启动基线，不能用来选 M16.2 目标。原数据在 .cache/studio-m16-1/fixture-baseline.json。

**Verification**：日志与退出元数据在 .cache/studio-m16-1/。npm lint/typecheck（237 文件零诊断，Node/Web 严格检查）、test（167 项，166 通过、1 个既有权限跳过）、网站 build、studio:build 均退出 0；Studio Chromium/WebKit 83 通过/1 个既有 WebKit IME 跳过，网站四模块 root smoke 4/4，release/Vault 边界退出 0。隔离 dotnet locked restore/build 与纯消息契约退出 0，不启动正式 App、不覆盖生产宿主产物。最终 lint/types 与启动诊断定向负例复核通过；缓存标签/非法数据不入报告、硬链接报告不覆盖及十次隔离启动已测。新增测试没有访问真实配置、原生窗口或桌面。

**失败处理**：typecheck-first-failure.log 保留新增 IPC 对象属性缩窄遗漏，增加精确字段和类型守卫后通过。unit-first-failure.log 保留父进程断开时诊断 send 触发 EPIPE 的实际失败；观察消息使用回调承接管道错误，保留原有断线权限/清锁处理与原测试断言，重跑全套通过，不吞业务错误。

**范围与停点**：基线 293 个候选，修改 10 个既有候选（3 文档、6 个启动/宿主接点、原 Windows 测试），新增诊断模块与定向测试 2 文件，其余 283 个字节保持。具体 SHA/链接/历史/HEAD 与空暂存区核对见 scope-audit.json；真实 src/public、内容、package/lock、AGENTS 和其他既有改动保持。未优化关键路径、常驻后台、减少校验或重录 Key；没有控制桌面、提交、推送或发布。作者尚未完成真实 App 首显/可编辑与至少 10 次冷启、更新/激活反馈，以及下一项性能目标确认，M16.1 保持 In Progress，不标 Done；M16.2–M23 仍 Pending。到此停止，等待手动基线，不自动进入下一项。

<a id="studio-m16-1-manual-review"></a>
### 9.41 Studio M16.1 手动反馈核对与 M16.2 目标候选（2026-10-30）

**作者反馈与核对范围**：作者明确确认已完成手动启动测试并留存诊断，启动、重复激活、关闭重开和 AI 配置正常，以上功能反馈记通过；不外推至原 M8 专项或 M9–M15 全部人工验收。只读检查仓库相关诊断名称及约定目录，未找到 .cache/studio-m16-1/manual/，仅找到最新 startup-latest.json 一条真实 ready/cold 样本，宿主/Web 缓存均 hit。已请求其余记录保存位置和另记全链路计时的位置，不认定作者未测试，不访问私人源或实际凭据，不操作 App 或桌面。

**可核实耗时**：本条为 host-monotonic-ms，window-visible 1885ms、editor-ready 2284ms；native-check→web-check 174ms，web-check→backend-start 63ms，backend-start→api-ready 1400ms，api-ready→window-start 14ms，window-start→window-visible 217ms，window-visible→editor-ready 399ms，另有宿主入口到 native-check 的 17ms。后端区间包含并发加载/定位与凭据读取、API 初始化，不能称为单项解密耗时。此计时不含先前 PowerShell/模块导入，不冒充双击到首显或真正可编辑。单条样本不出具十次 p50/最慢值；旧 fixture-baseline 仍只表示无窗口隔离后端，不能混算。白名单验证后的原样本及数值汇总保存在 .cache/studio-m16-1/review-YZH6hk/observed-cold.json、summary.json。

**M16.2 目标与状态**：6.11 中提出同机同口径十次冷启 p50 降低至少 25%、最慢不退步的候选，绝对秒数及可行性待完整样本核对、作者确认。优先细分后端 1400ms 区间，按测量决定是否延迟预览/AST 依赖；不减少身份/hash/锁校验，不常驻后台，不重录 Key，不提前把空窗称作编辑就绪。本轮只完成证据核对与目标建议，未改 M16.2 实现或标 In Progress。

**Verification 与停点**：本轮仅改 PLAN/README/MAINTENANCE；文档围栏/链接/锚点、状态、历史保留和范围通过 review-YZH6hk/verify.mjs 及 git diff --check 核对，证据 verification.json。295 个 Git 候选中 3 文档变化、其余 292 个哈希不变，HEAD 不变、暂存区保持为空；上轮 9.40 的工程验证结果保留，本轮工程输入未改，不重新宣称运行 lint/typecheck/test/build 或浏览器/原生验证。缺少可访问的至少 10 条真实冷启及全链路计时/首次准备记录、最终目标确认，M16.1 仍 In Progress，不能标 Done；M16.2–M23 Pending。未控制桌面、提交、推送或发布，等待记录位置后继续核对，不用文档修改绕过前置验收。

<a id="studio-m16-1-acceptance"></a>
### 9.42 Studio M16.1 六次真实冷启基线与收尾（2026-10-30，Done）

**授权、条件调整与人工反馈**：本轮作者要求检查记录、完成 M16.1 并确定 M16.2 目标。检查发现六份文件后明确告知不足原十次，作者回复“就这六次就够了吧”；据此采用六次作为本机工程基线，修改当前 Done Criteria 并保留原十次要求的历史记录，不伪造、复制或补算样本。本轮确认的验收口径为六次真实普通冷启统计、现有分类/失败隔离验证与作者正常使用反馈；首次准备/源码更新的真实耗时及双击全链路秒表值未采集，明确保留为数据限制，不再作为本轮需要补做的计时项。作者先前确认启动、重复激活、关闭重开和 AI 配置正常，仅据此收尾本项，不将其他 M8/M9–M15 专项标完成。

**样本检查与统计口径**：manual 中六份文件均通过固定字段、阶段顺序、单调非负整数时间、独立 runId、ready/cold、native/Web 两项 hit 检查；无 restore/build 阶段。最新 startup-latest 与最后一份同 runId，未重复计数；9.41 旧单样本及无窗口 fixture 十次均排除。p50 延续 nearest-rank，六次按升序取第 3 项；各区间先逐次作差再统计，不把区间 p50 相加。原文件不改动，核对副本、来源 SHA、完整逐次结果与汇总见 .cache/studio-m16-1/acceptance-yXxqCT/ 的 baseline.json、cold-*.json、summary.json。

| 本轮样本（按文件名时间排序） | window-visible（ms） | editor-ready（ms） |
| --- | ---: | ---: |
| 064108-632 | 1696 | 2072 |
| 064119-530 | 1947 | 2459 |
| 064129-332 | 1999 | 2477 |
| 064138-596 | 1910 | 2378 |
| 064148-174 | 2003 | 2498 |
| 064157-520 | 2011 | 2474 |

| 指标（宿主内计时） | p50（ms） | 最慢（ms） |
| --- | ---: | ---: |
| 宿主入口 → 窗口可见通知 | 1947 | 2011 |
| 宿主入口 → 编辑器握手完成 | 2459 | 2498 |
| 后端开始 → API 就绪 | 1385 | 1512 |
| 宿主检查 → Web 检查 | 169 | 189 |
| Web 检查 → 后端开始 | 56 | 68 |
| 窗口 spawn → 可见通知 | 257 | 330 |
| 可见通知 → 编辑器握手 | 468 | 512 |

**结论与限制**：普通缓存命中并不重建，主要候选瓶颈是后端开始到 API 就绪。该区间同时涉及静态依赖加载、Known Folder 定位及凭据解密/服务初始化，阶段有重叠，当前不能精确归因于某个函数或单独把百炼/DPAPI 当作原因。clock 为 host-monotonic-ms，排除 PowerShell/早期模块导入，通知含 IPC 调度；window-visible 不是屏幕测量，editor-ready 不是全部列表加载或正文实际可输入的精确时间。作者正常使用反馈与诊断互相补充，不生成不存在的秒表数据；未测真实首次准备、更新或激活延迟。六次仅用于同机短期工程对比，不推断长期分布、更高分位或首次安装 SLA。分类能力由原隔离 fixture 与手动普通冷启/激活反馈共同覆盖，不声称本轮量过四类真实场景耗时。

**确定 M16.2 目标**：同机同条件至少六次独立 ready/cold、原计时定义不变，editor-ready p50 ≤1844ms（2459×0.75 向下取整）、最慢 ≤2498ms；window-visible p50 ≤1947ms、最慢 ≤2011ms。先细分后端区间再做按需延迟依赖等最小优化，不提前发 ready、不降低 hash/身份/锁/DPAPI 校验，不常驻后台、不重录 Key；有效缓存不 restore/build/访问 NuGet，激活不新增后端，首次预览的转移成本另外验证。计时口径若需改变，应建立可比的新旧基线而非直接宣称达标。目标已确定，本轮没有实施 M16.2。

**Verification、范围与停点**：运行 node .cache/studio-m16-1/accept-records.mjs（退出 0），完成六份报告与去重统计；运行 acceptance-yXxqCT/verify.mjs 及 git diff --check（退出 0），检查四文档围栏/链接/锚点、Done/Pending 状态、既有路线/历史、统计及文件范围，证据 verification.json。源与测试对上次 review 基线哈希未变，复核 9.40 的 13 项退出元数据均为 0，包括 lint/types/test/build、Studio 构建及浏览器、网站 smoke、边界、原生构建/契约和启动定向测试；这是复核此前实际运行证据，本轮未重新运行工程/浏览器/原生检查。本轮只改三文档，295 个 Git 候选中其余 292 个 SHA 保持，六份手动样本字节保持，HEAD 与空暂存区不变。按本轮确认口径 M16.1 Done，M16.2–M23 全部 Pending，没有实施项 In Progress；未控制桌面、启动或停止 App、读取实际 Key/私人源、提交、推送或发布。到此停止，不自动优化或进入 M17。

<a id="studio-m16-2-record"></a>
### 9.43 Studio M16.2 启动关键路径优化（2026-10-30，In Progress / Awaiting manual App verification）

**实际变更与边界**：只修改三个后端接点：Think 和 Keep/Me/Build 预览服务保留原轻量对象与关闭生命周期，将 Markdown 编译器改为在合法预览作业内动态加载，加载/初始化后重查取消和关闭；既有图片资源检查仍先于 Astro 原生构建。source-expression 只将 TypeScript 编译器延迟到第一次实际 data.ts 解析，用固定 createRequire 和 Node 模块缓存，保留同步 AST 白名单/序列化合同，不执行源模块、不减少校验。未修改宿主/Web 构建器、启动顺序、单实例/关闭、Known Folder/DPAPI 或 AI 调用，不并行启动构建；SDK/指纹/身份/锁校验及所有计时起点、窗口/编辑器握手含义未变。首次预览/模块读取承担延迟成本，原等待/取消界面继续有效，没有进入 M17。

**实测证据与限制**：.cache/studio-m16-2/probe-imports.mjs 在改动前后各六个新进程只导入 HTTP 模块，不开 API、不读凭据、不显示窗口；import-before.json 的 p50 1049ms/最慢 1096ms，import-after.json 为 371ms/381ms（p50 减少 678ms，约 64.6%）。另以改动前副本和当前代码、独立隔离目录及显式非敏感 DPAPI canary，交替各六次测 backend-start→api-ready；关闭构建、不显示原生窗口、不测 Known Folder 定位、每次确认测试 AI 配置可用后停止自有 API。公共检查完成后复核得到旧版 p50 2006ms/最慢 2613ms，新版 1328ms/1720ms，见 backend-compare.json；首次与公共检查并发时的 2141ms→1508ms 对照另存 backend-compare-concurrent.json，不丢弃慢样本。两种测量均为隔离诊断，不与 M16.1 正式 App 六次混算，不证明正式 App 已达到 1844ms 目标，也不将移至首次预览的成本隐藏为整体消失。

**新增/加强的验证**：startup-loading 定向七例用独立进程观测实际模块加载，验证配对、Think 列表、未授权预览均不加载编译器，首次 Keep 读取才加载 AST；Think/通用预览初次加载期间的取消、关闭、依赖失败保留源、返回固定错误并清理 staging，原始异常不回传。浏览器继续实际构建四模块预览与资源隔离、取消/超时/构建失败。Windows 缓存测试补文章/C# 改动不触发 Web 重建、硬链接拒绝和产物篡改；旧启动回归不再每次覆盖 M16.1 历史 fixture-baseline。隔离 native-cache.mjs 真实运行锁定 restore/build，共八项检查：首次准备、缓存命中、Web/内容改动保持 native 命中、C# 改动/坏产物/坏收据重建、硬链接产物拒绝；没有运行生成的 App 或覆盖正式产物。

| 实际命令 / 检查 | 结果及证据（.cache/studio-m16-2/） |
| --- | --- |
| run.mjs lint、typecheck、unit（同名 package 脚本，实际 Node/npm CLI 参数见 JSON） | 均退出 0；238 文件零诊断，174 项中 173 通过、1 个既有权限跳过；补充缓存断言后再次通过，lint/typecheck/unit.json 和日志 |
| run.mjs build、studio-build、base-build | 均退出 0；网站根/base 与 Studio Web 构建；对应 JSON/日志 |
| run.mjs studio-browser | 退出 0；Chromium/WebKit 共 83 通过、1 个既有 WebKit IME 跳过，覆盖真实 Astro 预览根/base；studio-browser.json/log |
| run.mjs root-smoke、base-smoke、boundary、vault-boundary | 均退出 0；四模块根/base smoke 各 4/4，release/Vault 产物边界通过；对应 JSON/日志 |
| run.mjs startup-loading | 退出 0；7/7 定向负例，startup-loading.json/log |
| node probe-imports.mjs before/after、node backend-compare.mjs | 均退出 0；每组各六次，导入与 API 两种口径分开，三个性能 JSON；无正式 App 计时 |
| node --experimental-strip-types native-cache.mjs | 退出 0；8 项，native-cache.json，nativeApplicationLaunched=false |
| node audit.mjs、git diff --check | 退出 0；链接/状态/历史/来源 SHA/范围与旧手动样本核对，verification.json |

**工具限制与人工停点**：首次在默认沙箱运行定向 HTTP 测试时，自有 loopback 连接返回 EACCES，另六个取消/清理用例通过；在获准访问隔离本机端口的执行环境重跑后 7/7，并通过完整门槛，没有改变测试断言或过滤 pageerror。未启动/停止真实 App、控制桌面、读取真实 Key/私人源或调用真实百炼。必须由作者按[复测步骤](./MAINTENANCE.md#studio-startup-optimization)正常重开，保存至少六份新 ready/cold，并反馈 AI 配置、首次模块/预览、激活与关闭表现；再核对 editor-ready p50≤1844ms/最慢≤2498ms、window-visible p50≤1947ms/最慢≤2011ms。真实目标未验前保持 In Progress，不能继承 M16.1 的功能反馈标 Done。

**范围与状态**：初始 295 个 Git 候选中修改 7 个（3 文档、3 个后端接点、原 Windows 测试），新增 1 个定向测试，其余 288 个 SHA 保持；原六份手动样本字节保持，M16.1 历史数值文件未被回归测试覆盖。src/public、真实内容、package/lock、图标、所有 Windows/原生运行代码及其他既有改动保持；M7–M15 合同及 9.1–9.42 历史保留。HEAD 与空暂存区不变，M16.1 Done、M16.2 In Progress、M17–M23 Pending；未提交、推送或发布，到此停止等待手动复测，不进入 M17。

<a id="studio-m16-2-manual-review"></a>
### 9.44 Studio M16.2 六次正式 App 复测核对（2026-10-30，主性能目标未达）

**本轮范围与真实反馈**：作者提供新六次启动诊断，明确确认 AI 配置、首次预览、关闭重开正常。本轮完成记录检查、基线比较及文档同步，未改启动实现、未启动/停止 App、未操作桌面或读取真实 Key/私人源；这次功能反馈记通过，不外推为所有私人/原生专项已验收。检查 manual 中六份报告均为独立 runId、ready/cold、native/Web 两项 hit，阶段字段/顺序及时间单调有效，没有 restore/build；与 M16.1 六个 runId 也不重复。两批均为原 host-monotonic-ms 起点和相同阶段定义，未加入旧单样本、隔离结果或最新文件副本凑数。

| M16.2 文件名时间部分（原文件顺序） | window-visible（ms） | editor-ready（ms） |
| --- | ---: | ---: |
| 072805-350 | 1712 | 2175 |
| 072820-995 | 1813 | 2261 |
| 072829-974 | 1844 | 2307 |
| 072838-226 | 1773 | 2258 |
| 072847-770 | 1868 | 2339 |
| 072856-779 | 1882 | 2400 |

| 性能门槛 | M16.1 基线（ms） | 本批 M16.2（ms） | 固定目标（ms） | 结果 |
| --- | ---: | ---: | ---: | --- |
| editor-ready p50 | 2459 | 2261 | ≤1844 | **未通过，仍差 417ms** |
| editor-ready 最慢 | 2498 | 2400 | ≤2498 | 通过 |
| window-visible p50 | 1947 | 1813 | ≤1947 | 通过 |
| window-visible 最慢 | 2011 | 1882 | ≤2011 | 通过 |

**统计与结论**：每批六次独立普通冷启，p50 延续 nearest-rank、升序第 3 项；主指标改善 (2459−2261)/2459≈8.052%，约 8.1%，未达到至少 25%。不能以首显或最慢值改善、功能正常、此前纯依赖导入节约 678ms 或隔离 API 对照替代这项失败；不修改目标，不标 Done。这里是宿主入口到通知/握手，排除 PowerShell 启动器及先前模块导入，不冒称双击到真正可见/可输入的全链路秒表数据。小样本仅作本机前后工程对比，不出具更高分位或跨机承诺。

**剩余排查候选**：逐次先相减再统计，backend-start→api-ready p50 1385→1249ms；credential-location→credentials 为 774→631ms，credentials→api-ready 为 598→587ms；这些 p50 不能相加，第一段含父进程同步定位、后台静态加载及 IPC 等重叠开销。源码 local.ts 的 localStorePath 运行一次 PowerShell 定位 Known Folder，desktop.ts 将所得固定存储位置经私有 IPC 送入 main.ts，readLocalCredential 再启动 PowerShell 读取/解密；可优先补这些实际步骤的独立计时，评估减少重复进程启动成本。此为代码与数据共同指向的候选，尚非函数级归因或已获验证的修复；不缓存明文 Key、不改用环境目录替代 Known Folder、不减少 DPAPI/身份/链接/路径检查，不将凭据搬入窗口。当前需要进一步 M16.2 优化，不要求作者重复测同一版，也不进入 M17；本轮未实施上述候选方案。

**Verification 与证据**：运行 node .cache/studio-m16-2/review-manual.mjs，退出 0，完成两批十二份报告的白名单/去重/时间和旧样本 SHA 核对；自有 manual-review-8MJHER/ 中 baseline.json 保存本轮开始的代码/文档/样本哈希，before/after 为诊断副本，summary.json 保存逐次值、分段统计及四项布尔结果，passed=false。脚本退出 0 表示数据检查完成，不表示性能验收通过。运行该目录 verify.mjs 与 git diff --check，退出 0；四份文档围栏/链接/锚点、固定目标未降低、当前状态/历史及范围通过 verification.json 核对。9.43 工程门槛的十三项退出元数据复核为 0；本轮工程输入未修改，未重新运行 lint/typecheck/test/build、浏览器或原生检查，不宣称重跑。

**范围和停点**：296 个 Git 候选中仅 PLAN/README/MAINTENANCE 三份文档改变，其余 293 个 SHA 不变；十二份原手动文件字节保持，9.1–9.43 历史及 M7–M15 合同不回写，HEAD 与空暂存区保持。已完成本批验收核对，结果是主性能门槛未过，M16.2 仍 In Progress（不再是等待本批人工反馈），M16.1 Done、M17–M23 Pending。未控制桌面、提交、推送或发布；收尾停止，不借本次记录检查启动新的实现或下一阶段。

<a id="studio-m17-record"></a>
### 9.45 Studio M17 统一工作台 UI（2026-10-30，In Progress / Awaiting author App review）

**授权与依赖例外**：收到 M16.2 主性能目标未达的反馈后，作者明确决定“先这样吧，这个没那么重要，以后再说，继续下一阶段吧”，随后要求“继续进行”。据此接受当前启动版本，将 417ms 主目标差距留为 Deferred，保留原目标和 9.44 失败证据，不标 Done；本轮只实施顺序中紧接的 M17，M18 及以后未获实施授权。没有继续测启动或改凭据流程，没有借状态变更把未达目标冒称通过。

**实际变更**：index.html/main.ts/styles.css 提供浅色本机工作台、顶部公开/私人空间切换、公开模块导航、当前位置与 AI 状态；宽窗口 Think 正文/属性分列，可用容器较窄时纵向显示。常用操作和导航可随长文滚动保持可达，删除/重新读取为次级操作，源文件状态/文件名/revision 收在可展开详情。新增 workbench.ts 只做视图组合，将原四个模块的现有 DOM 控件移入同一外壳，Keep/Build 使用列表/编辑分区，Me 保留单例表单，私人有同样容器、模块选择/列表/编辑/内存预览区域；不克隆候选或表单、不替换监听器。通用状态标识仅读原 dirty/unsettled/uncertain 布尔值，不存正文/凭据；观察的只是原非敏感状态节点，不新增缓存/遥测。M18 的私人资料库术语、网站更新向导未实施，原密文主文件/候选/bundle 操作合同与标签保持。

**接口/安全边界**：未改服务端、模型/DTO、文件 CRUD/预览/AI/Agent API、原生窗口或密钥存储。私人控件仍位于原受控 fieldset 内，锁定/离开/隐藏仍清理原表单、列表和预览，不将明文复制到新状态条、存储、AI 或日志。公开切换沿用原业务入口与私人 leave 守卫；顶部“公开”委托最近公开模块的原入口。源文件仍唯一 source of truth；未增加未来待审核/设置/统一导入/发布占位入口，不改访客导航或网站 CSS，不迁移框架、不加依赖。

| 实际验证 | 结果与证据（.cache/studio-m17/） |
| --- | --- |
| run.mjs lint/typecheck/unit（实际 package 脚本及 Node/npm CLI 参数见 JSON） | 全部退出 0；241 文件零诊断，174 项中 173 通过、1 个既有权限跳过；对应 JSON/log |
| run.mjs build/studio-build/base-build | 网站根/base 和 Studio Web 均退出 0；对应 JSON/log |
| run.mjs studio-browser | 退出 0；Chromium/WebKit 85 通过、1 个既有 WebKit IME 跳过，覆盖四公开 CRUD/失败/冲突/输入法、原 Astro 根/base 预览及安全/取消负例；studio-browser.json/log |
| run.mjs private-browser | 退出 0；四私人编辑/保存/预览/锁定/交付及迟到结果等共 56 通过，两个引擎；private-browser.json/log |
| run.mjs root-smoke/base-smoke/boundary/vault-boundary | 均退出 0；网站四模块根/base 各 4/4，公开及 Vault 产物边界通过；对应 JSON/log |
| 最终导航定位 CSS 修正后的 studio-build、workbench/private-workbench、studio-think-editor/studio-close | 全部退出 0；八面板布局定向 2+2，Think 编辑 17 通过/1 个既有 IME 跳过，协同关闭 16/16。最后仅调整非敏感截图 fixture 后 lint/types/workbench 再通过，无新增真实 AI 请求 |
| 本地截图目视检查 | 已查看 workbench-chromium.png、workbench-webkit.png；仅非敏感公开样本，AI 用本地 canary 配置显示正常状态，不发送建议请求；私人截图/trace 关闭 |
| node audit.mjs、git diff --check | 退出 0；文档围栏/链接/锚点、唯一实施项、目标/历史/十二份原样本、SHA 范围、HEAD/暂存区核对见 verification.json |

**失败处理与验证限制**：新增私人布局测试初次漏点 Me 的原“私人介绍”列表项，表单为空断言失败；按实际用户路径补选列表后两引擎通过，未改业务或弱化断言，原日志 private-workbench-first-failure.log 保留。布局测试覆盖 1280×720/1440×900 与 1/1.25/1.5 CSS zoom、八面板控件可达、无横向溢出、Think 缓冲跨模块保留和键盘保存、四私人锁定清理。CSS zoom 与无头浏览器不冒充真实 Windows 缩放或原生 WebView2；实际 App 外观、缩放和使用体验仍待作者检查，不能借自动通过标 Done。截图使用明确的非敏感 fixture，不读取实际 Key/私人资料，不控制桌面。

**范围与收尾**：初始 296 个 Git 候选中仅修改 6 个（3 文档及 index/main/styles），新增视图组合模块和两份布局测试共 3 文件，当前 299 个候选；其余 290 个 SHA 保持，含所有服务端/业务模块、原生/启动/凭据/Agent 代码、src/public/内容、package/lock 和其他既有改动。M7–M15 合同及 9.1–9.44 历史完整保留，十二份旧启动样本字节不变，原启动性能目标不降低，HEAD 与空暂存区保持。本轮没有启动/停止真实 App、安装入口、提交、推送或发布。M16.2 Deferred、M17 In Progress（实现和自动验证完成，Awaiting author App review）、M18–M23 Pending；按[维护手册检查](./MAINTENANCE.md#studio-workbench)反馈后再核对本项，不自动进入 M18，也不要求重测启动。


<a id="studio-m17-acceptance"></a>
### 9.46 Studio M17 正式 App 验收收尾（2026-10-31，Done）

作者明确反馈：“我已重开 App 检查，新布局、缩放、中文编辑和取消关闭都正常。”据此补齐 9.45 中实际 App 外观/缩放/操作的必需待验项；原 lint/typecheck/test/build、两引擎公开/私人交互、根/base smoke 和边界结果从 .cache/studio-m17/verification.json 及对应退出记录复核，均为 0。本次收尾只更新三文档，不将反馈外推为旧 M8 原生专项或 M9–M15 全部人工验收，不重写原失败/限制记录，不要求重新配置 Key 或重复启动测量。M17 Done，M16.2 性能余项 Deferred；随后按本次明确授权开始 M18，后续项未获实施授权。


<a id="studio-m18-record"></a>
### 9.47 Studio M18 私人资料库与网站更新向导（2026-10-31，In Progress / Awaiting author native review）

**授权与前置**：作者确认 M17 正式 App 的布局、缩放、中文编辑、取消关闭正常，已按 9.46 完成本项验收；同次明确授权 M18。仅本机私人编辑与网站更新向导，不进入 M19.1，不操作桌面、不提交/推送/发布。M16.2 性能余项仍 Deferred，原目标和失败证据保留。

**实际变更与接口边界**：private.ts 将日常入口改为私人资料库，保存后明确可结束本机使用；网站更新默认折叠，经选择新位置、校验生成更新文件、最终确认更新本地网站三步进行。生成和替换各自显示结果，不宣称全流程原子回滚；版本/hash/备份角色放可展开详情，最后替换对话框保留。styles.css 仅增加向导进度与详情样式；workbench.ts 接收不携带正文的本地视图状态事件，避免取消口令或完成生成后保存标识停在进行中，结果不确定时明确显示“操作结果待核对”。PrivateFilePicker.cs 只同步选择器标题/文件类型名称，不改选取和路径安全规则。现有 HTTP DTO、backend、加密协议/参数、完整包校验、revision、备份、原子文件写入与发布边界不变，无新路径/明文/口令接口，无 AI/Agent 私人能力。

**选择与锁定**：打开、新建、选择更新位置前先锁定；未保存编辑换源仍需明确放弃，更新选择必须先保存。文件选择事务只含随机 requestId/mode/句柄，与明文 epoch 分离；隐藏照常清除全部私人缓冲、口令、预览和 Blob，只允许当前选择继续返回非敏感句柄。隐藏或退出处理中不自动解锁；返回可见 App 后重新读已保存资料库并验证口令，不恢复旧明文。取消选择/口令保持锁定，主动锁定/pagehide/明确离开取消选择身份，伪造、重复或迟到结果均不能重开会话。已发出的资料库/更新文件/网站密文写入在后台锁定后保留结果待核对标识，迟到成功不抹去该标识或恢复明文。网站替换结果未知时阻断换候选绕过，继续只读核对；生成文件未知须核对并显式选择新位置，不覆盖旧文件。

**实际验证**：命令由 node .cache/studio-m18/run.mjs 调用真实项目脚本/Playwright，完整 Node/npm CLI argv、退出码和日志分别保存在同目录 JSON/log；native.mjs 记录 dotnet 参数。最终以下均退出 0。

| 验证 | 结果与证据（.cache/studio-m18/） |
| --- | --- |
| lint、typecheck、unit、build、studio-build | 项目脚本全部 0；242 文件零诊断；174 测试中 173 通过、1 个既有权限跳过；网站根与 Studio 构建通过。最终收尾再次运行 lint/types/studio-build，视图状态最后修正后另跑两份受影响文件 final-lint |
| studio-browser | Chromium/WebKit 85 通过、1 个既有 WebKit IME 跳过；四公开模块 CRUD、AI 模拟、缓冲/冲突/取消、根/base 原模板预览 |
| private-final | 两引擎 78 通过：原四私人编辑/预览/加密保存/备份/错误/冲突/整包保留，加上本机保存独立、向导可取消、150% CSS zoom、选择器隐藏后可见重认证、主动锁定/迟到/伪造结果、协同关闭取消、备份副本重新打开。正文/口令无上传，私人截图与 trace 关闭 |
| private-delivery-final、workbench、studio-close | 10 / 2 / 16 通过；最后构建后工作台及协同关闭再次定向核对。网站未知写入不能换更新位置绕过的断言保留 |
| root-smoke/base-smoke、webkit-root-smoke/webkit-base-smoke | Chromium 根/base 各 4/4，WebKit 根/base 各 4/4 通过；base-build 退出 0 |
| delivery-build / delivery-site | 原密文交付在隔离源构建根/base 网站，两浏览器 8 项通过；四模块解锁、公开隐藏与路径关联均按原契约，未改真实 bundle |
| boundary、vault-boundary | 公开发布及 Vault 产物边界均 0，无 Studio/测试明文/凭据混入网站产物 |
| native-restore/build/contract | 锁定依赖与漏洞检查保持，隔离输出编译通过；原生消息/句柄/来源/资源边界检查通过。未启动真实 App、未打开原生选择器，未覆盖正在使用的宿主产物 |
| audit.mjs / git diff --check | 文档链接/锚点/围栏、状态、历史、范围、样本及 Git 核对见 verification.json |

**失败与限制**：首次受限网络的浏览器无法访问隔离 loopback（独立诊断为 ERR_NETWORK_ACCESS_DENIED），未到功能断言；中止受限运行，并在放行测试访问后重跑。第一次原生 restore 因 NuGet 漏洞数据网络不可达报 NU1900，放行元数据后锁定还原/编译/契约测试通过，没有关闭审计。环境失败记录 environment-failures.json，初始运行共享日志的混合证据另留 private-browser-initial-mixed.log；最终使用独立 private-final.log，不能把前者当干净的通过日志。原生 runtime/EditorScript.cs 已同步新步骤，但本轮未执行该 WebView2 原型。CSS zoom、无头浏览器及非 UI 契约不替代真实 WebView2、Windows 文件选择器、切换后台和关闭；维护手册列出非敏感手动步骤，收到反馈前本项保持 In Progress，不标 Done。

**范围与停点**：初始 299 个 Git 候选中修改 10 个既有文件（3 文档、3 Web 文件、原生选择器、2 个私人测试/fixture 与原生测试脚本），新增 1 个私人浏览器测试；其余 289 个 SHA 保持，当前 300 个候选。所有后端/契约/crypto、Windows 启动/凭据/Agent、真实 src/public、package/lock、原旧改动保持；9.1–9.45 历史及 M7–M15 路线保留，十二份手动启动样本保持。HEAD 和原空暂存区未变，没有真实私人口令/Key 读取、真实 App 启停或入口安装。M17 Done、M18 In Progress（实现/自动验证完成，实际选择器与关闭待验），M19.1–M23 Pending；不进入下一项、不提交、推送或发布。


<a id="studio-focus-plan-record"></a>
### 9.48 Studio 主线收敛与顺序调整（2026-10-31，文档完成，无新实施授权）

**授权与实际变更**：作者明确要求只调整 PLAN 架构和 milestone 顺序、同步 README/MAINTENANCE，优先日常启动、文章/项目自动录入审核与一键发布，其他功能暂不扩展。保留原编号，新增 Pending 的 M16.3（日常运行与更新准备分离），主线改为 M16.3 → M19.1 → M19.2 → M20 → M23，全部 Pending。M23 在 M20 后交付公开 Think/Build 的精确批准发布，不依赖延期的 M21 Pi Skill/M22 文档适配，也不扩大为私人/Keep/Me 自动发布。原手动表单作精调/备用，次级工具维持已有能力，不删除实现，不预建按钮/目录/接口。

**架构与事实依据**：核对 app.ts/desktop.ts 的先准备服务再创建窗口，app-build.ts/web-build.ts 的 SDK/源码/产物指纹及失效构建，local.ts/main.ts 的配置读取前置，以及实际 deploy.yml 的 push 检查/手动发布和同产物约定。保存最新只含阶段元数据的诊断副本 .cache/studio-focus-plan/observed-startup.json 与 startup-summary.json：一份 updated-or-recovery/native-Web changed 的宿主计时 9653ms，分段 4637/1204/2591/1200ms 加起始 21ms；只作源码更新重建证据，不混入旧六次普通启动 p50 2261ms，也不冒称双击全链路。M16.3 规划准备/运行分离、兼容的宿主/Web/backend 就绪版本、失败与混载保护、窗口早显与 AI 准备状态分离；现 Known Folder/DPAPI、文件/产物身份、锁、单实例及协同关闭合同不降低。没有实现新的启动路径，也不承诺当前版本已提速。

**审核/发布与状态**：来源、模块专属候选、原 service/校验/冲突及 source of truth 保持；保存草稿和审核并发布为可选分支，后者在未来 M23 一次精确批准后自动执行固定检查/源码落地/提交/推送/部署并核验 SHA/run/产物。不能将无关 dirty/index 或同文件其他条目带入发布，不能由模型/材料取得批准权。本轮不启动 M16.3 或恢复 M16.2；M16.2 原完整合同、目标及失败记录保留。M18 从 In Progress 归为 Awaiting author acceptance，含义只是不再串行阻塞公开主线，原生选择器/协同关闭仍待验，不标 Done。M16.1/M17 Done、旧 M8/M9–M15 未验状态保持；公开主线涉及的共享安全仍须补实测，不将无关私人专项作形式依赖。

**Verification 与范围**：运行 node .cache/studio-focus-plan/prepare.mjs 保存本轮三文档副本、300 个 Git 候选 SHA、HEAD/原空暂存区及当前诊断；运行 update.mjs、sync.mjs 完成文档调整，再执行 node .cache/studio-focus-plan/audit.mjs 与 git diff --check，均退出 0。audit 核对四文档的围栏/本地链接/锚点、主线顺序和五个 Pending、两项 Done/三项 Deferred/一项 Awaiting author acceptance、阶段字段覆盖、发布及私人边界、历史与 SHA；结果 verification.json。9.1–9.47 原记录、M7–M15 路线、M16.1/M16.2/M17 合同及十二份旧手动启动诊断保持。仅 PLAN/README/MAINTENANCE 改变，其余 297 个候选 SHA 不变，没有新增 Git 候选；代码、测试、内容、原生入口/图标、凭据逻辑、package/lock、发布 workflow 和已有未提交改动保持。HEAD/暂存区不变。

**限制与停点**：本轮工程输入未变，未运行 lint/typecheck/test/build、浏览器、App、真实 AI 或部署检查，不将旧工程结果写成本轮通过。不控制桌面，不启动/停止 App、不读取实际 Key/私人口令或真实私人材料，不提交、推送或发布。规划整理完成后停止，首个待另行明确授权的实现项为 M16.3，路线排序不构成该项或后续实现授权。


<a id="studio-m16-3-record"></a>
### 9.49 Studio M16.3 日常运行与更新准备分离（2026-10-31，Auto verified / Awaiting unified acceptance）

**实际变更**：增加固定 `studio:prepare`，在启动锁下准备并验证一套 native/Web/Node 后端快照，成功后原子切换 current 收据；失败保留原完整版本。桌面稳定引导仅激活已有窗口或读取完整快照，核对包锁/运行环境/仓库身份与所有程序资产，不执行源码遍历、SDK/restore/build/Vite 或 NuGet 网络。源码更新后需显式准备，不热换活动窗口。宿主先显示带短版本号的窗口，再接收同版 API 地址；编辑 ready 绑定首次列表成功，不提前报可编辑。后台异步用原 Known Folder/DPAPI 读取配置，区分读取中、未配置、坏配置与读取失败；次级面板首次使用才建立，退出/私人锁定仍受原合同约束。构建不读 Key，无真实私人材料或正文镜像。

**自动验证**：`.cache/studio-m16-3/` 保留命令、日志及退出 JSON。lint、typecheck（248 文件、0 诊断）、test（179 项、178 通过、1 原平台 skip）、build、Studio build 全部退出 0；Studio Chromium/WebKit、私人两引擎、根/base 两引擎 smoke、release/Vault 边界均退出 0。无窗口 .NET locked restore/Release build/消息契约退出 0。冻结版本测试覆盖准备中断不切指针、产物/链接/依赖变化拒绝、源码更新不混载、活动启动锁、真正源目录写入、窗口协议/协同关闭、AI 异步失败/取消；隔离集成使用真实编译宿主产物但不启动它，合成 DPAPI 配置自动加载、Think/Build 首次 Astro 预览及内容根写入通过（integration.json）。曾因测试预览省略已有 key 导致重复 slug，补正确测试请求后通过；未放松产品验证。最终源检查与范围核对继续记在本目录。

**限制与批准调整**：没有操作桌面、读取实际 Key、实际 AI 调用、真实 App 首显/关闭或六次性能对照。本轮作者确认先完成实现/模拟验证，真实性能待验，随后授权整个主线最后统一人工验收；因此 M16.3 不标 Done，也不冒称原 1844ms 等目标已达。首次准备、更新准备、日常启动三种耗时分列；新增启动器 stopwatch 仅从脚本开始到 Node 启动完成，不包含 PowerShell 进程创建，不能与宿主相加冒充双击全链路。旧六次/十二份历史记录与失败目标保持；无提交、推送或发布。


<a id="studio-m19-1-record"></a>
### 9.50 Studio M19.1 Think 录入与审核（2026-10-31，Auto verified / Awaiting unified acceptance）

**实际变更**：新增 module-specific ThinkCandidate/提案/精确批准合同，受限文字、UTF-8 Markdown/frontmatter 和 v1 JSON/围栏报告的确定性解析。API 增加 intake/think、proposals 列表/读取/修改/删除/apply；复用原同源/Token/限额/错误及 Think service。生产收件箱懒定位至 Known Folder 下仓库身份隔离的仓库外目录，逐条普通 JSON、身份/链接检查、原子版本写入，最多 64 条/单记录 384 KiB/总 16 MiB，材料 64 KiB；不扫正文目录之外材料、不执行报告命令。候选可不完整；原目标须显式选择，首次导入补入该源未提供字段以便审核，原公开状态由后端保护。修改后候选 hash/提案版本变化；源变化/重复 slug 阻止应用。应用先写 intent，成功后仅留无正文回执；未知结果禁止盲重试，读取可在源精确匹配时收尾回执。

Web 默认进入录入/待审核，支持文件选择、材料/来源查看、文章字段与正文精调、原预览接口、恢复/容量丢弃、明确批准及协同关闭保存材料至待审箱；手动 Think/其他模块保留，#think 是明确进入原手动编辑的页面片段，不含凭据。首次 ready 等默认入口读取尝试与原首次列表，非提前报可编辑。原编辑测试只改为明确选择手动入口，原行为断言保持。

**Verification**：`.cache/studio-m19-1/` 的 lint/typecheck/test/build/Studio build/intake 退出 JSON 均 0；类型 256 文件零诊断，单元 183 项/182 通过/1 原 skip；录入 Chromium/WebKit 共 6 通过，实际覆盖重启恢复、中文/代码、材料脚本仅文字、批准取消、更新后列表、超限、未导入材料协同保存退出。单元覆盖源码/提案冲突、未知字段/格式/路径、重复 slug、配额/硬链接、响应未知不重写、回执无正文及 HTTP 认证。首次普通沙箱缺少回环/硬链接权限时失败，按正常本机测试权限原断言通过；曾发现旧 canary 清理先于子进程真正退出，补等待其 exit 后通过；浏览器发现应用后 Think 列表未刷新，修复切回刷新后六项通过，未过滤 pageerror 或弱化断言。

**状态与限制**：原真实内容、凭据、私人工具/Agent 权限保持。未调用模型、未实际打开 App 或控制桌面，人工最后统一验收，不标 Done；按本批授权继续 M19.2。真实启动性能仍待验，M16.2 原失败目标和旧专项保留；没有提交、推送或发布。


<a id="studio-m19-2-record"></a>
### 9.51 Studio M19.2 Build 项目录入与审核（2026-10-31，Auto verified / Awaiting unified acceptance）

**实际变更**：增加 BuildCandidate 与 BuildProposal 分支和严格的模块报告/部分嵌套结构解析，不建立通用内容模型。intake/build 与相同待审流程复用过程字段；合法完整项目才调用原 Build service，仍整份 data.ts revision，其他条目、顺序、可选字段、代码和原 published 保护不变。新建项目的提案在创建时绑定整文件源版本，新建固定 draft。纯文字/MD 先作为项目章节待补字段；结构化报告可完整填入原项目 DTO。Web 增加明确模块选择，项目精调复用原 projectFields 控件，缺少的记录字段只显示空白/待确认，不默默补成个人事实；原字段控件只增加缺值安全显示，正常已有表单行为不变。

**Verification**：`.cache/studio-m19-2/` lint/typecheck/test/build/Studio build/intake/intakeBuild 退出记录均 0；259 文件零诊断，186 单元（185 通过、1 原 skip）；Think 六项两引擎回归通过，Build 两引擎根/base 真实 Astro 预览及 draft 应用共 4 项通过。单元覆盖完整/不完整嵌套、无效状态/日期/链接/未知字段、整文件变化、原条目保留、公开状态及审核失效。初始预览失败是隔离 fixture 的目录过滤前缀错误，误删 content.server.ts；用独立非敏感诊断副本确认后将过滤限定为 content 目录边界，产品权限/校验/异常处理保持，修正后四个实际预览通过。

**边界与停点**：没有模型调用、真实源写入、实际 App 操作或 Git 发布；实际 App 人工统一待验，不标 Done。按本批授权进入 M20，M21/M22 依作者确认维持 Deferred；旧专项与真实启动性能待验保持。


<a id="studio-m20-record"></a>
### 9.52 Studio M20 显式 AI 自动整理（2026-10-31，Auto verified / Awaiting real AI and unified acceptance）

**实际变更**：复用原百炼配置、单请求/取消/超时及受限响应处理，保留原五种 Think 文本建议和提示词。增加 Think/Build 专属整理提示与严格 JSON 候选/来源/unknowns 解析，不假定模型原生 JSON Schema；不添加 Provider/工具/工作流框架。输入/输出各 32 KiB、最多 4096 输出 tokens、60 秒、无重试；较大的 64 KiB 本机材料仍可确定性导入，AI 超限明确拒绝，不截断。模型只能建议候选，不能传 published、路径、权限或额外字段。逐字引用必须存在于选中材料、字段路径必须对应候选；缺依据标 unconfirmed，计划/贡献/日期等列本人待确认，引用不当事实证明。人工改一字段只改该字段来源标记，未改字段引用保留，既有源字段单独标 source。来源/待确认也受候选 hash/批准约束。

新增 POST intake/think/organize 与 intake/build/organize，源版本先检查，后端只发送已选材料和模块指令，返回后重验源，取消/关闭不应用迟到输出。Web 明示发送范围，提供显式整理/取消与配置状态，编辑材料即使旧请求失效；输出只是待审，不自动写源。审核页与新材料页区分，原无 AI 导入可独立使用。

**Verification**：`.cache/studio-m20/` 的 lint/typecheck/test/build/Studio build/intake/intakeBuild/organize 均退出 0；262 文件零诊断，190 单元（189 通过、1 原 skip）；Think 六项、Build 根/base 实际预览四项、整理六项 Chromium/WebKit 通过。确定性上游覆盖精确材料发送、独立项目 DTO、计划状态/无依据诊断、伪造引用/多余字段/发布态/坏结构拒绝、限流/截断/超限不发送、不重试、共享 AI 并发、取消/迟到不覆盖新材料、来源编辑保持及无自动源写入。真实 Key 不在浏览器，测试仅用非敏感 canary；无实际模型接通/质量验收声明。

**限制与下一项**：按作者最后统一人工验收的授权，真实百炼 Think/Build 整理与 App 操作留待手动，M20 不标 Done；M5 既有真实验收不外推成新整理通过。下一项 M23 已获本批实现许可，仅实现能力和隔离发布验证，没有本仓库真实提交/推送/发布许可。M21/M22 Deferred、旧专项及启动性能待验不变。


<a id="studio-m23-record"></a>
### 9.53 Studio M23 精确审核发布与本批收尾（2026-11-09 核对入档，Auto verified / Awaiting real publication and unified acceptance）

**实际变更**：增加固定 Think/Build 发布契约、prepare/execute/status 与只读核对/结束回执 API、Web 最终差异与状态页、单任务发布协调和仓库外无正文回执。录入页可直接准备发布，保存草稿不是必需前步。已落地提案清除隐藏候选缓冲并改为真实源引用。Think 复用原校验/读写/序列化投影。Build 增加只替换单条 AST 范围的专用发布投影与保存，保留全部非目标字节/注释，原 CRUD 严格序列化不变。未更改网站源模型、访客界面或真实内容。

隔离 clone 以远端 main 为父，准确绑定提案、候选、整源 revision、两份 diff、目标树、远端与本机 HEAD/index。变化后旧批准拒绝。只上传已核对 SHA 的 blob/tree/commit，使用原子 beforeOid/afterOid、force:false 前移固定 GitHub main，不移动本机分支/暂存区、不全量提交开发工作。固定检查器核对 Node/npm、锁定依赖与浏览器，跑完整项目门槛。源码经原 service 落地后才上传并以 expected_sha/唯一 studio_request dispatch。workflow 在 checkout 前及部署前核对期望/check/远端 SHA，继续部署同一受检 artifact。record.mjs 生成源 SHA 与 dist 哈希目录，不含 Studio 程序/凭据。

最终核验要求唯一正确 run、artifact identity/digest、受限 ZIP/tar 解析、与本机目录相同的文件集合、线上 release-manifest 和每一文件哈希、真实无头 Chromium/WebKit 页面/404/Spotlight。任何不符不称上线。持久化 source/commit/push/dispatch 真实边界，部分失败/未知不自动重放。重启仅读回执，核对/重新验产物不上传或 dispatch。发布进行中协同关闭拒绝并保留窗口。宿主失联在受限当前阶段之后停止下一阶段。补齐 frozen runtime 的固定 helper 和后端独占 GitHub 认证环境。成功只清理核对归属的派生候选，失败证据保留。

**实际 Verification（均退出0）**：

| 检查 | 结果 / 证据 |
| --- | --- |
| npm.cmd run lint / typecheck / test / build、studio:build | 根检查零诊断。单元210项（209通过、1原 Windows symlink 权限 skip，真实 junction/hardlink 负例仍运行）。根build9 HTML页。对应 json/log |
| Studio 完整 Chromium/WebKit | 111通过、1原 WebKit IME 协议 skip。含录入、Build 根/base实际 Astro、AI模拟/取消/迟到、原编辑CRUD冲突、发布取消/直接提案及关闭。studio-browser.log |
| 私人共享安全回归，两引擎 | 78通过。原加密主文件/四模块/预览/内存清理、备份交付与M18向导不因本批破坏。private-browser.log |
| 网站根/base完整 + WebKit | 根77、base77。WebKit移动16、私人29、根/base内容smoke各4/4。真实第五私人会话两引擎3/3 |
| extension/content/design/mobile、release/Vault boundary | 全部0。独立构建不写正式源。对应log/json |
| 固定发布检查器干净副本全流程 | node studio/server/publish/verify.mjs 在独立冻结候选运行：npm ci、锁定浏览器、lint/types/test/build、根/WebKit/真实私人会话/base及边界、record与再验全部0。fixed-checker.log/json。只有该合成副本本地提交，没有真实远端上传 |
| 发布专项目录/网关/失败验证 | 精确同文件分离、dirty/index/HEAD保持、提案/源/index/HEAD/远端变化拒绝。检查失败/推送或dispatch丢响应/run不符/产物不符/失联。重启只读恢复、坏回执拒绝。ZIP/tar traversal/链接/CRC/尺寸、对象SHA/CAS及线上错误均负例通过。unit.log及studio-publish*.test.ts |
| Windows薄宿主与正式编译运行链（无窗口） | locked restore、Release build、C# contract均0。integration.json核对真实编译包、Think/Build首次Astro预览、合成DPAPI自动加载、真实隔离源写入，未启动原生App/读取真实Key |
| 视觉、文档及范围 | 新录入/发布两引擎截图人工查看，visual.json=0。文档链接/状态/历史/字节范围/旧样本与Git审计见verification.json。git diff --check=0 |

**失败与修复保留**：首次完整Studio发现双标签旧测试的第二页未指定Think而停在新默认录入页，两引擎超时。修正第二页入口，所有冲突/保留缓冲断言不变，重跑完整套件通过，原失败日志/截图在studio-browser-initial.*、studio-initial-results。首次干净固定检查器发现新增API单元用到了预构建Web：API测试改为不载入Web，浏览器测试继续用实际构建。再冻结隔离副本并重跑整个固定检查器通过，失败证据fixed-checker-initial.*及fixed-unit-diagnostic.log保留。不删除检查、不吞pageerror、不以局部成功盖过全量失败。

**范围与统一待验**：本批以M16.3开始的300候选为基线，修改42个既有候选、新增36文件，其余258个SHA保持。源码src/public、真实内容、package-lock、AGENTS、图标及无关旧改动保持。原9.1–9.48和十二份启动手测诊断字节保持。M17旧截图在保存本批回归副本后恢复。HEAD仍9fd8cc8bda5c903c0b897f23a63168764b62899b，暂存区保持原空状态。未控制桌面、实际启动/停止App、读取真实Key/私人资料、真实模型调用、对本仓库提交/推送/发布。M16.3、M19.1、M19.2自动验证完成，M20真实AI与M23实际发布必需反馈未补齐。本批全部保留待统一人工验收，不标Done。M21/M22 Deferred、M16.2旧目标/失败与M18/旧专项待验不变。

**启用与停点**：操作集中在[维护手册统一清单](./MAINTENANCE.md#studio-mainline-manual)，记录准备/日常耗时、App/两模块录入/预览与真实百炼整理。无需重配旧Key。远端须另获提交/发布许可安装本版workflow守卫与record脚本，当前缺失时canExecute=false。真实GitHub权限/同产物/线上全过程仍待授权，不把本批模拟称线上已可用。到M23实现与自动验证收尾停止，不恢复延期功能或擅自发布。

<a id="studio-writing-workbench-record"></a>
### 9.54 Studio 界面精简验收（2026-11-12）

默认进入 Think，顶栏只显示一个工作区切换入口。编辑区把保存状态、网站预览、标题和正文放在主要位置。新建或属性校验出错时展开属性，AI 建议由作者展开后操作。Build 保留项目分步编辑，Keep 以链接和说明为主，Me 以个人介绍为主。待审保留目标和批准流程，材料来源可展开。发布差异与最终确认保留，回执维护单独折叠。私人模块及锁定、备份、恢复继续从私人资料库访问。

接口、模型、真实内容、依赖及发布机制保持原样。发布和 AI 浏览器用例使用隔离仓库及模拟传输，私人用例使用非敏感隔离密文。首次回归发现点击文章前收起列表筛选会提前移动列表，改为点击处理结束后收起；只读源的原防覆盖断言在两个引擎通过复测。

| 检查 | 结果 |
| --- | --- |
| `npm.cmd run lint`、`npm.cmd run typecheck`、`npm.cmd test`、`npm.cmd run build`、`npm.cmd run studio:build` | 全部退出 0。单元 210 项通过，Windows 普通文件符号链接因权限跳过 1 项。 |
| `npx.cmd playwright test --config tests/studio/playwright.config.ts`，分别运行 Chromium 和 WebKit | Chromium 56 项通过，WebKit 55 项通过。WebKit 跳过 Chromium 专用的 IME 协议用例。覆盖属性校验展开、键盘导航、跨模块编辑缓冲、根路径与 base 下的 Astro 预览、待审和发布确认。 |
| `npx.cmd playwright test --config tests/studio/private/playwright.config.ts` | 两引擎共 78 项通过。最终构建额外复跑私人切换、锁定、备份恢复及工作区共 6 项通过。 |
| 访客网站 smoke 和范围检查 | Chromium/WebKit 各 2 项通过，覆盖模块和公开产物边界。文档锚点、差异检查、Git HEAD/暂存区及范围核对通过。 |

验证日志和非敏感截图保存在 `.cache/studio-workbench-simplification/`。Windows 运行包 `101f1c88b39e` 通过 `npm.cmd run studio:prepare` 准备，清单校验及三个 Web 产物的逐字节核对通过。原生 App 窗口未启动，真实 Windows/WebView2 外观可在作者下次重开时核对。工作区已有改动保留，未提交、推送或发布。

<a id="studio-think-writing-record"></a>
### 9.55 Think Markdown 写作闭环验收（2026-11-12）

默认入口换为 CodeMirror 6 源码工作台，选文、编辑/预览、AI 整理、刷新、保存和发布构成日常界面。元数据可从编辑器开头展开，现有 Think API 与原文件序列化继续处理正式保存。新建不完整原稿在原待审箱使用受限写作记录，保留原有提案的读取和恢复。AI 整理先返回候选供比较，应用和撤销都只改变编辑缓冲。发布使用已有 M23 准备、最终批准、进度及只读核对。私人维护通过 Ctrl+Shift+M 进入，正式宿主移除冗余退出菜单，窗口 X 沿用协同关闭。

| 检查 | 结果 |
| --- | --- |
| `npm.cmd run lint`、`npm.cmd run typecheck`、`npm.cmd test`、`npm.cmd run build`、`npm.cmd run studio:build` | 退出 0。单元 210 项通过，1 项 Windows 文件符号链接用例因权限跳过。新增依赖 23 个锁定条目，原锁定依赖保持。Vite 报主包约 771 kB，未测原生启动耗时。 |
| Studio 公开浏览器配置 | Chromium 61 项通过，WebKit 60 项通过，1 项 Chromium 专用 IME 协议跳过。新 Think 覆盖旧文手改、实际 Astro 根/base 预览、BOM/注释/混合换行保真、原稿重启、AI 审核撤销和版本冲突。 |
| 最终 Think 定向复核 | 两引擎维护快捷键和 AI 共 4 项通过，部署响应丢失与只读核对共 2 项通过。未就绪凭据、取消确认、隔离发布与不会重放也有浏览器断言。首轮 AI fixture 因响应缺少协议字段未通过，补全模拟响应后重跑通过。 |
| 私人浏览器和访客网站 | 私人模块与安全回归 78 项通过，访客网站 smoke 4 项通过。 |
| Windows 包与契约 | 无窗口 C# 契约测试通过。运行包 `ae7c3fbba2f5` 已准备，三个 Web 文件与受测构建逐字节一致。真实 Windows App 外观、输入法和窗口 X 操作留待作者。 |

证据在 `.cache/studio-think-*.log` 和 `.cache/studio-think-writing/`。AI 与发布用模拟传输和隔离样本，正式 Git HEAD、暂存区和公开站点保持。Build、Keep、Me 的转换与 Live Preview 留在后续。本批在 Think 停止。

<a id="studio-think-preview-time-record"></a>
### 9.56 Think 整理、快速预览与时间验收（2026-11-12）

旧运行包 `ae7c3fbba2f5` 能从 Windows DPAPI 读取配置，启动状态由 AI_INITIALIZING 变为可用。百炼 HTTP 200 的候选为正文提供了多个真实引用，旧本地解析因重复字段返回 502 AI_INVALID_RESPONSE。Think 请求改用百炼 JSON 对象模式。解析逐条检查引用，保留每字段第一条有效引用，虚构引用仍拒绝。真实 WebView2 通过 CodeMirror 输入非敏感样本，实际百炼请求、候选展示、明确应用均通过，源码无写入，未操作作者的窗口。

CodeMirror 源码高亮启用 GFM。快速预览复用 Astro 7 的 Sätteri 默认处理与 Shiki，并共享 Think 正文 CSS。表格增加边框和横向滚动，保留现有 HTML 公式样式。无公开字段也能预览，返回编辑保留选区。隔离层阻止脚本、跳转和远程图片，只解析安全范围内的本机图片。LaTeX 与正式网站一致按字面显示，提示受限语法。完整 Astro 路径和 M23 保持。

同一非敏感样本的本机 API 端到端测量三次。完整 Astro 分别 10,076、9,427、8,983 ms。快速预览分别 492、8、6 ms。实际 WebView2 从触发预览到 iframe 加载约 612、72、75 ms。首个样本包含处理器懒加载。测量未计入 App 启动。

可选 `createdAt` / `updatedAt` 使用 UTC 秒级字符串。原 `date` 和站点日期排序保持，旧文不补猜创建时间。写作台在真实内容保存时才记录文章时间，直接发布使用被冻结的候选时间。写作时长用本机独立原子记录，按草稿 ID 和正式条目标识关联，文件名或 slug 单独变化可找回。

| 验证 | 实际结果 |
| --- | --- |
| `npm.cmd run lint`、`typecheck`、`test`、`build`、`studio:build` | 全部退出 0，单元 212 项通过，Windows 普通文件符号链接权限跳过 1 项。 |
| Studio Chromium / WebKit | 64 / 63 项通过，WebKit 跳过 Chromium 专用 IME 用例。覆盖原稿重启、时间戳与计时迁移、无损保存、正式预览根/base 和 M23。首次加速时钟用例发现请求超时丢计时批次，改为按原批次 ID 保留后复测通过。 |
| 私人与正式站点 | 私人两引擎共 78 项通过，访客内容和边界共 20 项通过。 |
| 真实 WebView2 和百炼 | 隔离无可见窗口验证通过。已记录加载、确认应用与源码未写入。作者的前台窗口可在正常重开后复核。 |

证据保存在 `.cache/studio-think-polish/`。Windows 包 `95a1a2151da2` 已准备并通过 Web 文件逐字节校验。真实百炼记录只保存布尔、耗时和固定错误码。测试发布使用隔离仓库与模拟传输。现有文章正文、私人源、Build/Keep/Me 模型、Git HEAD 和暂存区保持。

<a id="studio-think-stability-record"></a>
### 9.57 Think 稳定化与源码编辑辅助（2026-11-17）

两条实际 M23 回执都未开始写源、提交、推送或触发工作流。只读检查远端 `main` 的 `9fd8cc8`，缺少当前 SHA 守卫和产物脚本。本机命令环境找不到 `gh`，无法实测远端写入和 Actions 授权。在隔离副本通过真实网关准备合成差异，返回 HTTP 200、`canExecute=false`，同时提示 `REMOTE_WORKFLOW_NOT_READY` 与 `GITHUB_CLI_UNAVAILABLE`，回执四环节均为 `not-started`。准备页也区分登录与仓库访问或写入权限。保留原 SHA、对象和部署核对。图片仍须独立审核纳入远端基线，单篇发布保持单文件授权。真实工作流启用、提交和部署需另行授权。

普通正文软换行、Shiki 与 KaTeX 由网站及快速预览共用的 Sätteri 配置处理。快速预览的原生 MathML 存在字形差别，缺少独立源码位置的渲染块定位到邻近有位置的块。编辑切回保留焦点、选区、视口与撤销栈。图片和代码插入各自可撤销。图片上传验证字节类型、大小、尺寸和路径，正式预览和发布既有隔离机制继续生效。

Gemini `gemini-3.5-flash-lite` 用 `generateContent` 的 JSON Schema 约束候选，现有审核流程仍要求明确应用，正文默认保留。中文纠错回归覆盖口语、梗、术语、代码、公式和重复字。合成中文在隔离 WebView2 通过真实百炼整理与确认应用。本机 Gemini DPAPI 配置已读取，Google 模型元数据和生成请求均在建立连接时超时，未收到 HTTP 响应。最终包中的 WebView2 实测显示超时并保留编辑缓冲，Gemini 成功返回仍待验。

| 验证 | 实际结果 |
| --- | --- |
| `npm.cmd run lint`、`typecheck`、`test`、`build`、`studio:build` | 公共门槛通过。单元 216 项通过、1 项跳过；Gemini、隔离发布及准备包额外定向 25 项通过。 |
| Studio Chromium / WebKit | Think 写作与隔离 Astro 套件的其余 26 项通过。双引擎公式断言选择器修正后，公式、源码定位/插入撤销及发布确认定向复测 6 项通过。 |
| 私人与正式站点 | 合成私人资料双引擎 78 项通过。正式网站公开内容各 5 项通过，复测使用独立结果目录。 |
| Windows WebView2 | 已准备 `8f233abb300f`。隔离原生控件输入中文并加载预览，未显示或激活窗口。该样本预览 640、42、44 ms，包含首轮懒加载和 iframe 显示。 |

日志在 `.cache/think-stable-*`，原生脱敏证据在 `.cache/think-stable-native/`。现有文章正文、私人源和其他模块的业务模型保持。下一批 Build 可复用 CodeMirror、快速预览位置映射和人工候选审核，项目字段转换与附件的发布范围各自验证。本轮停在 Think。

<a id="studio-gemini-publish-readiness"></a>
### 9.58 Gemini 与 M23 发布准备核验（2026-11-17）

蓝发入口指向 `Open.ps1`，本机同一受信代理已在 Windows 用户环境可见。旧 Node 后端虽继承变量，`fetch` 缺少代理启用参数。旧链路曾发生连接超时，同版本 Node 加代理参数后，Gemini 模型查询、普通和结构化生成均返回 200。桌面后端现在按已有 HTTP(S) 代理启用 Node 代理，保留原 `NO_PROXY` 并补齐 loopback；启动脚本会补取旧 Explorer 环境缺失的用户代理和 PATH。没有更改系统代理策略或 TLS 校验，也未重配 Key。独立 CONNECT 监听证明外部请求经代理且本机请求直连，模拟旧环境的启动子进程能读到代理并找到 `gh`。

真实完整整理另复现过上游 HTTP 200、`STOP` 但本地返回 `AI_INVALID_RESPONSE`。两条引用文本均可在材料找到，字段路径均不符合合同。Gemini JSON Schema 现在明确列出允许的路径，指令同时要求引用只指向候选中已出现的字段。保留逐字引用核验。发布包 `67d0929f0f0c` 在隔离、无可见窗口的真实 Windows WebView2 通过非敏感中文写入、预览、Gemini 真实候选、人工确认和无源码写入检查。证据在 `.cache/studio-gemini-readiness/webview.json`。网络超时、鉴权、模型不可用、配额、暂时不可用和解析错误均有单独覆盖。

官方 WinGet 已安装 GitHub CLI 2.104.0，原有登录有效。认证只读检查确认仓库 `push/admin`、OAuth `repo`、Actions 已启用、`deploy.yml` active、Pages 使用 Actions 并允许 `main`。没有读取或输出令牌。OAuth 尚无 `workflow` scope，仅在使用该凭据安装工作流时补充。实际触发 Actions 写入需在获批后单独验证。生产网关准备复测返回 HTTP 200、`canExecute=false`，只剩 `REMOTE_WORKFLOW_NOT_READY`，源码、提交、推送、调度均未开始。

远端 `main` `9fd8cc8` 的最小补丁只包含 `.github/workflows/deploy.yml` 和 `scripts/release/record.mjs`，保存在 `.cache/studio-release-review/m23-workflow-bootstrap.patch`。隔离仓库 `git apply --check`、8 个 Bash SHA 守卫正反例、锁文件干净安装、公开 Astro 构建、公开/私人产物边界及 27 文件产物散列通过。安装补丁只触发 push 检查，Pages 部署仍需单独 `workflow_dispatch`，且只部署同一已检产物。本地准备完成，补丁提交与推送、正式站点部署分别等候授权。

回归通过 `lint`、`typecheck`、`test`、`build`、`studio:build`。全量单测 217 通过、1 跳过，最终 AI/代理定向 11 项通过，Chromium/WebKit 真实浏览器的合成 AI 审核和隔离发布确认共 4 项通过。工作区现有改动、Think 编辑/保存/预览流程和其他功能保持。

<a id="studio-think-performance"></a>
### 9.59 Think 差异、预览与发布性能（2026-11-18）

- AI 审核中原文和拟应用文本使用只读 CodeMirror MergeView；左右共用滚动容器，插删用差异块及占位对齐，点有颜色的改动行定位该块。是否采用建议正文、应用确认及冲突约束保持原样。
- Think 日常预览继续走 `preview-fast`。工作台收到配对页面后后台预热同一 Sätteri 处理器；只保留当前正文的一个沙箱 iframe，正文变化重新渲染，刷新或切换文章丢弃缓存。预热和切换不保存源码，也不复制真实文章。`Server-Timing` 只含 Markdown 服务用时。
- M23 在新建隔离仓库只浅抓获批远端基线，不复制开发仓库历史；隔离 Git 使用提交中的行尾，锁定依赖用 `npm ci --prefer-offline`，仍按锁文件全量安装。发布确认、SHA、资源断网验证、root/base 构建、正式 CI、产物核对及失败恢复合同不变。远端两文件补丁已在上一轮单独授权下安装；普通 push CI `44088095292` 成功，Pages 跳过，本轮未改变远端。

同机 1280×900 不可见 Windows WebView2（同桌面后台启动代码，非作者正在使用的快捷方式窗口），同一非敏感输入：首轮点击到 iframe 文档可读取 284.5 → 24.7 ms；点击到请求 1.3 → 1.6 ms，HTTP 等响应头 273.1 → 11.9 ms，后端段 269.0 → 8.6 ms，JSON 已读到 DOM 挂载 1.8 → 2.1 ms，DOM 到 iframe `load` 6.8 → 7.5 ms。相同正文三次切换中位数 12.2 → 0.4 ms（DOM 恢复、无新 HTTP，不计屏幕绘制），编辑后的热预览中位数 11.9 → 12.4 ms。机器负载会影响样本；不将后台预热后的等待减少当成渲染器省掉了同样的 CPU 时间。

M23 隔离同树对照：本机克隆/抓取/检出 2.35 s，初始化/浅抓/检出 0.91 s（不含新增的隔离 Git 配置）；同缓存交错安装两次均值 65.44 → 55.88 s。内容投影 49 ms，独立断网资源守卫 9.59 s。 合成已保存稿对真实 GitHub main 只读准备单次 22.45 s，返回 `canExecute: true`；此前用另一份无效的原稿夹具被本机校验拦下，不计入成功用时。旧远端树在 Windows 隔离验证中的 lint 10.81 s、typecheck 44.10 s，单测 27.83 s 并失败（旧 Think 字节与预览断言）；因此不能以独立构建 12.06 s、产物记录约 0.32 s、公开/私人边界 0.54/0.32 s、正式散列合同 27 文件 41 ms 的通过替代完整候选检查。历史 GitHub 验证任务 9 分 21 秒，先前 Pages 记录从创建到成功 17 秒。没有执行真实 Git 上传、工作流调度、Pages 部署或新产物上线复核。Astro 7.3.8 的实验性增量生成要求静态路由显式 `cacheKey`；共享 catch-all 当前未提供，首页与索引也有跨条目依赖。未启用该实验选项，未复用上一次的 `dist`。

`lint`、`typecheck`、`test`（217 通过、1 跳过）、`build`、`studio:build` 通过。Studio 双引擎完整回归首跑 132 通过、1 跳过，新增差异用例修正后与缓存用例双引擎定向复测 4 通过；正式 Astro 内容和私人边界 smoke 两引擎各 6 通过。计时原始记录在 `.cache/studio-perf/`。M23 最后定向 19 项通过，原生 WebView2 候选显示与取消保留原稿通过；隐藏窗口不用于验证滚动像素，两引擎定向覆盖点击与对齐。当前蓝发窗口未操作，正式准备遇 `DESKTOP_BUSY`；可见窗口的滚动复核和真实发布均未验收。

### 9.60 Think AI 逐项审核与应用（2026-11-23）

Think 写作整理支持单独返回逐字定位的 `before/after`。旧回包没有逐项建议时可从正文候选展示差异；无法唯一定位、可能动到署名、引文、代码或诗句整体的修改不进入可勾选列表。缺乏可靠替换的事项只提示。文章字段逐项显示，缺少依据标为待确认。底部保留「应用选中修改」与「取消」，不能应用时说明原因。应用只更新编辑缓冲，可一次撤销。

以《你是人间的四月天》的隔离副本恢复「教务着变」，用包含「交舞着变」替换、漏改的整篇候选、署名删除及未确认摘要的模拟服务回包测试。真实 Windows WebView2 未显示个人窗口，通过按钮可见、选择性应用、取消及撤销。另一份多项输入通过只应用所选更改，两轮均未改写或新增源码，未将诗稿发给外部 AI。原生证据见 `.cache/studio-ai-review/native.json`，Chromium/WebKit 写作与整理 30 项通过。

<a id="studio-think-v1-freeze"></a>
### 9.61 Think v1.0 最终封版（2026-11-23）

没有 slug 或 slug 为空的新原稿可应用所选正文与字段。仅编辑缓冲使用容许缺 slug 的 YAML 读写；仍按严格合同校验正式源码、隔离正式预览和发布。原稿按保存写入本机待审存储；取消、撤销、评论和署名保护仍有效。既有正式文章的 slug 与公开状态不可通过此操作改写。

旧远端 `1c73252` 的 13 项定向测试在 Windows `core.autocrlf=true` 时 11 通过、2 失败；改为 false 时 13 通过。两项来自 LF 夹具在检出时被转成 CRLF，测试再构造 CRLF 得到重复回车。限定该夹具的 Git 行尾规则后，以 true 重新检出、旧代码原有断言 13 项全过。`PREVIEW_NOT_READY` 单独在旧隔离树加入原来的不合规测速文件后复现，干净基线不会触发；它是内容目录入口校验的正确拒绝。没有改变正式校验或削弱断言。

全量 lint、typecheck、正式 Astro 与 Studio 构建通过。单元 220 通过、1 跳过（Windows 普通文件 symlink 权限；junction、hardlink 仍验证）；Studio 两引擎 137 通过、1 跳过；正式站点 Chromium / WebKit 各 77，私人编辑 78、合成密文发布站点 8，Windows 桌面消息契约通过。原生 WebView2 的诗稿保护、取消、撤销、新原稿多项应用和只存本机通过，使用受控模拟回包；另以合成输入对已配置的 Gemini 真实生成并应用，通过；正式后端与原生快速预览和复用通过。不发送真实私人稿件。

建议范围以远端 `1c73252` 为基线，工作流与产物记录脚本已经在远端。精确清单见忽略目录 `.cache/think-final/release-scope.md`；包括 Think、共享 Studio 依赖、测试、依赖锁和维护文档。排除未确认诗稿、Compass 及相关站点测试改动、图标提示词、所有私人资料、凭据和生成文件。建议说明：`fix(studio): finalize Think v1.0 authoring and release checks`。未创建提交或标签，主工作区索引不变。

GitHub 只读预检确认有仓库写权限，Actions 启用，Pages 只允许 main；安装工作流的普通 push CI 成功且明确跳过 Pages。隔离合成文章的真实远端只读准备返回 `canExecute: true`，不证明远端写入或调度成功。真正的一键验收须先获批提交、推进远端 main 并等待该 SHA 的 CI；再获批用哪一篇具体内容公开发布，在 Studio 审核该篇差异，最终核对 workflow run、下载产物散列、发布清单的源码 SHA 和线上双引擎页面。本阶段保持待正式验收，不启动下一阶段。

完整 M23 Windows 发布门槛在不含上述排除项的隔离待审代码快照退出 0，包含锁定安装、根与子路径构建、浏览器、私人边界与发布清单。86 个发布文件（含清单，10 个 HTML）逐一核验；没有 Studio 程序、私人包或未确认诗稿。隔离仓没有生成新 Git SHA，清单所载旧基线 SHA 仅用于证明本地核验链路，不能作为正式 v1.0 的产物身份。结论：本地提交审核 Go，正式发布与阶段完成 No-Go，待授权及真实线上验收。

<a id="studio-think-v1-completed"></a>
### Think v1.0 最终收尾（2026-11-24，Completed）

实际文章提交 `c26154d531b4d15f502d3b32d0e92a0c907ddd6e` 经 [GitHub Actions](https://github.com/hjk202/hjk202.github.io/actions/runs/45339766843) 成功上线，87 个产物及线上文件散列核对一致。旧 Studio 在线上搜索关闭动画结束前读取可见状态，造成误报。本轮用同一运行的 Pages 成功状态、线上清单 SHA 和目标页面散列修复原回执，未重发文章。

日常单篇 Think 需通过精确文件范围、正文、公开状态及已审核资源校验。一次确认后隔离提交并以原子快进推送。GitHub 对已有受检基线执行一次依赖安装、内容复验、一次正式 Astro 构建、公开/私人边界和产物清单检查，随后部署同一产物。代码、依赖、工作流、其他内容及无法可靠核对的基线均使用完整门槛。移除多余的 Pages 配置 Action 与重复产物扫描。源码 SHA 守卫、内容范围和一次最终批准保持。

调度确认后 Studio 可继续写作和正常退出。重新进入时可从现有回执查询同一 GitHub 运行。浏览器交互无需参与文章的上线核验。失败或 CDN 尚未更新时保留已确认边界，通过只读复核恢复。已无远端差异的文章再次发布会被拦下。本轮验证覆盖两条检查路径、Git/内容保护、失败恢复、Windows 运行包和原回执恢复。新快路径的真实耗时留待下一次正常文章发布。Build 的后续改造独立安排。
