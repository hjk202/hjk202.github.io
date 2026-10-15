# Personal Space · 需求、设计与实施计划

更新：2026-10-15。本文是产品需求、目标架构、风格设计、分阶段实施及验收状态的 **source of truth**；执行守则见 [AGENTS.md](./AGENTS.md)，所有者简报见 [README.md](./README.md)。

本次按用户要求合并原需求书、设计稿、架构/内容/加密/维护/发布指南，只维护以上三份文档。保留已批准决定，删除重复说明与过期停点，不重新设计产品、不改变功能或扩大授权。旧文档及完整历史验证记录可从整理前提交 `6202827` 读取，例如 `git show 6202827:NEED.md`；不再以旧文档作为并行依据。

## 阅读索引

- [当前状态](#current-state)
- [产品与架构](#architecture)
- [模块接口与内容维护](#contracts)
- [公开与内室风格](#design)
- [私人协议、安全与维护](#vault)
- [Phase 路线与 milestone](#roadmap)
- [验证流程](#verification)
- [发布与回退](#release)
- [完成记录与风险](#records)

<a id="current-state"></a>
## 1. 当前状态与授权停点

| 项目 | 现状 |
| --- | --- |
| 本次任务 | 用户已确认手机检查无问题；完成 4.8 样本清理、最终验证/发布与 Git 保存，结束 Phase 4 后停止 |
| 已完成 | Phase 1–3；公开设计 D1–D8；Phase 4 的 4.1–4.7 与 4.8 内 V1–V5 修复 |
| 当前 milestone | **4.8 In Progress**；手机复验已通过，正在清理临时样本并完成无样本最终发布 |
| 最近已核验线上产品源 | `1f3ce49a9f824757e56a56b22302e2188b05e564` |
| 最近发布 | [Actions 38731022976](https://github.com/hjk202/hjk202.github.io/actions/runs/38731022976)，check/deploy 成功 |
| 访问地址 | [正式网站](https://hjk202.github.io/)；[本轮手机验收入口](https://hjk202.github.io/?v=1f3ce49) |
| 私人数据状态 | 本地已移除非敏感 `public/vault/bundle.json`；最终无样本产物已通过本地验证，待替换线上旧验收包 |
| 后续阶段 | Phase 5 未选择，Phase 6 延后；写进计划不等于授权实施 |

2026-10-15 用户澄清要求完成 Phase 4 及以前全部工作，并明确表示“我都检查过了，没有问题”。手机复验据此记通过；此前 Closed 是误解收尾意图的历史停点。本次继续原 4.8 范围，清理临时样本、复验并最终发布后标 Done、停止，不开始 Phase 5/6。

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

当前真实素材：Me 介绍与 GitHub 链接；Think《我为什么越来越喜欢从底层理解一个东西》（2026-10-13）；Build NEMU（2025.09–2026.02）；Keep Missing Semester。每模块公开 count 为 1，搜索四条，Me 平均 1；这是当前内容基线，不是永久数量断言。

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
| Think | 温暖写意的思想空间；首屏少量光谱/光学形体 → 文章主入口与真实随记 → 安静窄列正文 | 文章进入详情，随记可原地读；代码/公式优先可读，不做散乱拖拽、自动关联或梦幻动态壁纸 |
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

当前样本及公开口令 `phase4-nonsensitive-acceptance` **本来就允许任何人解密**，仅供功能验收，不用于真实资料。无真实材料时最终版本允许 Vault 未配置，必须清除验收包后再发布，不设置默认生产密码。

参考保留为方案依据，不表示本次文档整理重新核验了最新标准：[Web Crypto AES-GCM](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams)、[OWASP 口令派生](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)、[认证加密](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)、[输入校验](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)、[Astro 生命周期](https://docs.astro.build/en/guides/view-transitions/)。

### 5.5 作者本地维护操作

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
| Phase 4 | 加密/本地维护/内存解锁/模块私人适配/搜索/锁定/内室 | In Progress | 手机通过；完成 4.8 无样本最终验证/发布后停止 |
| Phase 5 | 零个或少量按需功能补齐 | Pending，候选未选 | Phase 4 验收后先复盘；逐项明确指定 |
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
| **4.8 In Progress** 阶段验收 | 安全/维护/恢复/线上/手机与阶段内修复，详见下节 | 手机通过；完成样本清理和最终发布证据 | 第 7–8 节完整检查；依赖 4.1–4.7 全 Done |

#### 4.8 最终收尾（In Progress）

**目标 / Scope**：验证已有私人功能、安全/维护与手机可用性；不改架构，不以内容缺失阻塞验收。涉及 tests、现有发布接点、必要阶段内修复、密文样本以及三份文档。每次具体执行仍遵守当次授权。

已获准并完成的反馈子项：

| 单元 / 状态 | 技术任务 / 文件 | Done Criteria | Verification |
| --- | --- | --- | --- |
| **V1 Done** 内室环境 | theme/glass、Vault 标记/生命周期；成功解密后固定深墨主题，锁定恢复系统 | 无预览/主题残留/私人快照，公开主题不退化 | 公共 + 明暗/错误/取消/跨页/锁定/截图 |
| **V2 Done** 模块组织 | 四模块模板/vault client/style 与 slot/cleanup | 私人在前且真实 DOM 顺序，公开完整，两区空态正常，补充不重复项目 | 公共 + 各模块/混合/仅私人/仅公开/全空、根/base 与清理 |
| **V3 Done** 搜索层级 | 会话投影身份 Set、Spotlight/详情标记 | 来源按实际命中，同 URL 混合准确，排序不变，公开四字段不变 | 公共 + 公开/私人/混合/空快捷入口、锁定与独立预期 |
| **V4 Done** 整体回归 | tests 与必要修复 | 内室一致、公开独立布局保留、空集合/手机/模糊降级可用，0 pageerror | 公共 + 根/base、WebKit、第五真实会话、扩展/设计/内容/移动/发布边界 |
| **V5 Done** 输入/触摸 | passphrase/crypto、Unlock、theme；原样口令校验、原始粘贴与继承 tap highlight | 符号兼容；不可见/超长在 KDF 前拒绝；支持引擎中高亮透明，键盘焦点保留 | 公共 + 原始字符/粘贴负例、实际旧包解锁、根/base、WebKit 能力探针/触摸与焦点；线上已发布，用户确认手机检查无问题 |

**最终收尾任务（本次明确授权）**：

1. 收到 OPPO 反馈，核对按钮蓝块、口令/软键盘、四模块/搜索/返回、主动锁定/后台/刷新；仅修必要问题并逐项复验。
2. 在明确收尾授权内移除临时非敏感 `public/vault/bundle.json`，以未配置真实 Vault 为最终状态；不自行填真实资料或生成默认密码包。
3. 对实际无样本候选重新执行公共/完整专项、产物/候选 Git/CI 边界、生产预览；用隔离 fixture 验证加密功能依然可用，生产缺包状态正确。
4. 按获准的现有发布流程核对新源、同一受验产物及线上公共路径/缺包行为，记录结果，再更新 4.8/Phase 4 并停止。

**Done Criteria**：

- [x] 4.1–4.7 功能与公共/专项验证完成；真实加解密、四模块、搜索/统计、锁定与刷新有效。
- [x] 公开产物/候选 Git/CI 与浏览器持久化/URL 边界已验证；非敏感维护增改删、换口令、恢复/失败保护可复现；不把扫描当安全证明。
- [x] V1–V5 已实现、验证、部署，最近线上检查通过。
- [x] 用户明确确认手机等已检查无问题；按此前 OPPO Find X7 Ultra 默认浏览器验收上下文记录，未提供系统/浏览器版本，iOS 真机未测。
- [ ] 临时样本清理，最终无样本候选检查与发布/线上验证齐全，记录最终源/run/artifact。
- [ ] 功能不依赖真实材料，最终无测试记录冒充作者内容，状态汇总一致，停止待用户验收。

**Verification**：第 7 节完整本地/隔离/浏览器/安全检查；第 8 节真实 Actions/产物/线上；OPPO 用户反馈。用户验收已通过，待实际无样本候选验证/发布完成后标 Done。**后续依赖**：Phase 4 Done 后停止，Phase 5/6 仍需另行明确选择和授权。

### 6.6 Phase 5 — 按需功能候选，均 Pending / 未选择

本阶段可选零项。不是“把清单全做完”，不因站内内容少强行增加功能；已实现的分类与项目记录不重复开发。

#### Milestone 5.1 — 复盘与选择

- **目标 / Scope**：只读核对实际使用缺口，区分缺功能与缺内容，选择零个或少量候选。
- **任务 / 方案 / 文件**：核对 Phase 4 验收、源码/测试/反馈；只改 PLAN 与必要 README，同步用户已批准需求。
- **Non-goals**：不实现候选、不新建模块或配置，不把“功能完善”当无限授权。
- **Done Criteria**：选定/未选集合、每项 Scope/文件/依赖/验收明确；零项时写本轮跳过，不将未选项标 Done。
- **Verification**：文档需求/范围/状态与实际代码核对，纯文档不创建工程；**依赖** Phase 4 完成 + 用户明确指定。

#### Milestone 5.2 — Think 阅读辅助（可选）

- **目标 / Scope**：文章顶部可折叠页内目录与代码复制，仅本模块；公开和已解锁私人阅读均适用。
- **任务 / 技术方案**：从实际标题生成唯一锚点，显式操作复制并反馈成功/失败；无标题/代码不放空控件。锁定清私人目录并取消尚未发起复制，不能撤回用户已复制到系统剪贴板的内容。
- **Files**：Think Article/私人阅读与模块内脚本、相关单元/e2e、PLAN；具体新增文件在选定后收敛。
- **Non-goals**：无固定 Sidebar/全局导航，不润色/新增文章，不做全文检索。
- **Done Criteria**：重复标题锚点正确，键盘/定位/返回与复制结果正确，短文无空框，私人标题不留静态产物/锁定 DOM。
- **Verification**：公共门槛 + 标题/代码边界、真实 Clipboard 成功/失败、根/base/移动阅读与 Private 锁定；不改权限伪造成功。**依赖** 5.1 明确选定及私人阅读基线。

#### Milestone 5.3 — Keep 局部检索与排序（可选）

- **目标 / Scope**：当前模块按名称/说明/域名检索和少量明确排序，叠加既有平面分类。
- **任务 / 技术方案**：本模块原生输入与稳定排序，复用当前可访问集合；公开分类沿用 URL，私人类别/查询仅内存，锁定清除并恢复公开状态。
- **Files**：Keep Index/私人列表及局部逻辑、相关单元/e2e、PLAN。
- **Non-goals**：无自动抓取、层级分类、全站标签/搜索改造、私人来源预览。
- **Done Criteria**：分类+查询+排序组合、清空、空结果和返回正确，私人状态无 URL/日志/持久化泄漏。
- **Verification**：公共门槛 + 隔离多收藏独立预期、根/base/手机键盘与历史、锁定清理；不要求先填真实收藏。**依赖** 5.1 明确选定、4.6/4.7 稳定。

#### Milestone 5.4 — Think 公开 RSS（可选）

- **目标 / Scope**：一个模块静态摘要 feed，局部订阅链接；文章/随记纳入规则在选定时明确。
- **任务 / 技术方案**：消费 Think 既有公开集合，稳定绝对 URL、正确 XML 转义；空集合合法，不复制全文或改 Home。
- **Files**：候选 `src/pages/think/feed.xml.ts`、Think 局部链接、相关单元/e2e、PLAN；该端点目前不存在。
- **Non-goals**：不做全站 Activity/聚合 feed、通知后台或私人订阅。
- **Done Criteria**：合法 RSS，日期/site/base/link 正确，公开增删同步，私人/未发布/样本绝不输出。
- **Verification**：公共门槛 + XML 解析/escaping、根/base 绝对 URL、非公开 canary 与产物检查、原有导航/Vault 回归。**依赖** 5.1 明确选定与需求确认。

停止标准：只验收用户选定项目后停止。编辑后台、账号、云同步、自动收藏、评论/点赞、AI 助手、全文搜索、统计 Dashboard、地图均不是默认候选。

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
| 公开导航 | 8 正常页面 + 真实 404，Home/模块/详情/返回/深层刷新，资源/索引/head/canonical/base |
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
5. 记录真实 run 链接、源 SHA、artifact/digest、manifest；核对实际下载产物、本地受验构建、线上文件哈希，检查 8 正常路由/404/索引/资产/导航/搜索及受影响私人链路，全程 pageerror 为 0。
6. 记录手机待验事项并停止；云端成功不替代用户真机，纯文档完成记录不需要重新发布网站。

回退优先最近适用的已验证源，在隔离目录干净安装/构建/smoke 后用新的 `git revert` 提交按同流程发布；不 reset --hard、不强推、不在正常线上无必要演练。单检出旧标签再发布 main 不会回退 main。整站回退可能撤销新功能，密文恢复还需相应备份口令，两者分别核对。

历史保留点：`v0`（初始本地基线）、`demo-before-phase3`、`phase3-first-release`（`d3ccc76`）及已验收公开源 `9e7d878`。首发与 `9e7d878` 都做过隔离复现；恢复 `9e7d878` 会撤回 Phase 4。新私人版虽已自动验证上线，不能把尚未完成的手机验收写成最终受验。

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
| 2026-10-15 / V5 发布 | `1f3ce49` 经 Actions 38731022976 全部 check/deploy 成功；本地/下载产物/线上 26 文件哈希一致；8 公开页/404/搜索/输入负例/真实解锁/四模块/来源/锁定均通过，0 pageerror | 发布与线上验证 Done；当时 4.8/Phase 4 为 In Progress，后续按用户指示 Closed，手机结果未补报 |
| 2026-10-15 / 文档归并 | 用户授权将 11 份项目文档归并为 AGENTS/PLAN/README；旧需求/风格/接口/安全/维护/发布有效内容迁入本文，源码结构核对，保留历史 milestone 编号/状态 | 仅文档，不实现/部署；工程检查未重跑。文档专项结果见下 |

最新发布 artifact `11970576759`，digest `sha256:02bd522cf3be9e28220632f3a8a685274fa237770b31da847e25fc0ee4366db5`。V5 修复前的失败证据与后续修复均保留在旧记录，未通过吞异常/删测试过关。同源重复 push 运行取消不替代手动运行中的完整验证。

最新本地证据索引：`.cache/v5-final-root.log`、`v5-final-base.log`、`v5-final-webkit.log`、`v5-boundaries.log`、`v5-existing-sample.json`；发布证据 `.cache/v5-release-manifest.json`、`v5-ci-manifest.json`、`v5-release-artifact.json`、`v5-release-jobs.json`、`v5-release-run.json`、`v5-release-live.log`、`v5-release-live.json`、`v5-release-live-home.png`。这些为**此前执行证据**，不是文档整理新运行的结果。

验收密文 SHA256 `fa84cfa3c72c1b183e4bfccdc438c5d8cf1ebc8ce0095e4f6f5cdaefe26e0856`，保持不变。真实明文/口令从未作为本次文档任务输入，不在本轮补录。

### 9.2 Open Questions / Risks

- **当前收尾**：用户已确认手机等检查无问题，本地样本清理/无样本验证完成，正在最终发布；完成后 Phase 4 标 Done 并停止。
- **保密边界**：公开密文可离线猜口令；旧副本不能远程撤回，浏览器/站点代码须可信。完整 Git 历史泄漏审计和独立密码学审计未做。
- **性能/支持**：KDF 不因手机慢自动降级；Web Crypto 不可用保持锁定。Windows WebKit 私有点击高亮颜色不可检测；OPPO 已由用户确认检查无问题，系统/浏览器版本仍未知。
- **候选需求**：Phase 5 可能选零项，RSS 纳入范围、旅行/摄影名称/id/计数等在相应启动前再确认；Phase 4 关闭不构成下一阶段授权。
- **内容维护**：真实私人材料以后由作者本地处理；内容缺失不制造假数据，未公开 Markdown/资源不能承担秘密。
- **文档一致性**：以后只在本文更新需求/设计/接口/详细状态，在 README 同步主线，AGENTS 仅管执行，避免重新长出重复专题文档。

### 9.3 本次文档 Verification

检查范围：三份项目文档数量；相对链接与锚点；旧文档引用迁移；历史 milestone 编号/Done Criteria/Verification 与当前状态；需求/设计/安全/维护覆盖；Git diff 空白；非文档文件 SHA256 与整理前基线一致。

**2026-10-15 验证完成**：`node .cache/verify-doc-consolidation.mjs` 与 `git diff --check` 均退出 0。仅保留三份项目文档，23 处相对链接/锚点有效；43 个已完成单元、当前 4.8 和 6 个未来单元的范围/状态及验收结构核对通过，旧专题引用已移除，需求/设计/安全/维护覆盖检查通过。150 个非文档跟踪文件 SHA256 与整理前完全一致，包括源码、配置、测试、真实文章与验收密文；Git 改动仅上述文档合并。证据为 `.cache/docs-consolidation-before.json`、`.cache/docs-consolidation-result.json`，辅助脚本也仅在忽略的 .cache 内。

未改工程输入，该次 lint/typecheck/test/build/页面 smoke 未运行；此前通过记录见 9.1，不能声称该次重跑。该次整理交付时未提交或部署；随后用户批准 Git 保存与 Phase 4 收尾，见下节。

### 9.4 文档保存与 Phase 4 关闭（2026-10-15）

用户明确认可三份文档，要求提交 Git、结束 Phase 4 并停止。本次仅同步 PLAN/README 的关闭状态并提交已整理的文档；不改源码、配置、测试、真实内容或密文，不推送远程、不部署。Phase 4 / 4.8 为 Closed，无正在执行的 milestone；手机复验与样本清理/最终发布保持未完成，不改写原 Done Criteria 或声称真机通过，Phase 5/6 仍未授权。

Verification：`node .cache/verify-phase4-closure-docs.mjs` 与 `git diff --check` 均退出 0；23 处相对链接/锚点、43 个历史完成单元/6 个未来单元、Phase 4/4.8 Closed 与未勾选遗留项核对通过。150 个非文档文件哈希与整理前一致，Git 差异仅 11 个文档的归并及状态更新；无既有暂存内容需要保护。证据为 `.cache/phase4-closure-doc-result.json`。工程输入未变，lint/typecheck/test/build/页面 smoke 未重跑；历史功能与线上结果见 9.1。Git 保存后核对提交范围与工作区，随后停止。

### 9.5 Phase 4 最终收尾（2026-10-15，进行中）

用户澄清“把 phase4 及以前的所有内容完成，我都检查过了，没有问题”，确认已部署 `1f3ce49` 的整体/手机复验通过，并授权完成样本清理和最终发布。沿用此前 OPPO Find X7 Ultra 默认浏览器的设备上下文，未提供版本、不声称 iOS 真机通过。前节 Closed 是历史误解停点，由本次完整收尾取代。

本次实际产品改动仅删除 `public/vault/bundle.json` 非敏感验收样本；应用代码、加密参数、作者真实内容不变。另修正 `tests/e2e/content-empty.spec.ts` 的旧空查询默认选择假设：明确验证无默认选中/Enter 不跳转，再按方向键选择并进入，保留全零/空态/404 断言。最终生产未配置真实 Vault，入口应显示“尚未配置私人内容”；私人能力用隔离非敏感 fixture 保持完整验证，不创建默认生产口令。

本地 lint/typecheck（126 文件零诊断）/test（42 项）/build（9 HTML 页、25 文件）均退出 0；根/base 完整浏览器各 75、WebKit 移动 16/私人 29、第五模块真实会话两引擎各 3、extension/content/design/mobile/session 隔离契约、第五模块浏览器 1/设计浏览器 5 通过。实际生产预览的 25 文件哈希、8 公开路由/404/搜索/Home/返回、Me 链接、手机标签与透明高亮及未拦截的缺包端点/Unlock 提示通过，0 pageerror。与 V5 受验产物相比仅少密文文件，其余 25 文件哈希一致；公开计数仍各 1，搜索 4 条。

初次沙箱单元测试因临时目录原子 rename 被 EPERM 阻止，保留 `.cache/phase4-final-test-sandbox-failure.log`；正常本机权限下原断言 42 项全通过，未改代码。临时发布探针最初误将本地预览地址当 canonical，已按实际配置修正为正式站地址并重跑通过，失败日志保留；不是修改产品 head 或放宽断言。

补跑旧空集合浏览器探针时确定性暴露与现有 Spotlight 契约冲突的默认选择假设，已按第 3.2 节及现有 spotlight.spec.ts 的同一行为修正测试，不修改运行逻辑。保留原失败日志/截图/trace；修正后 lint/typecheck/42 unit/build 再次退出 0，公开内容与全空浏览器探针各 1 通过。重新构建的 25 文件哈希与此前已做完整根/base/WebKit 验证的产物一致，不把相同产物的重复构建当作新功能验证。

证据前缀 `.cache/phase4-final-`：lint/typecheck/test/build、root/base、webkit-mobile/webkit-private、session-webkit/session-chromium、verify-extension/verify-content/verify-design/verify-mobile/verify-vault-session、extension-browser/design-browser、local-live.log/json 与 release-manifest.json。候选 Git 源、真实 Actions/artifact 与最终线上验证在完成后补记；必要项未完成前保持 4.8 In Progress，不进入 Phase 5/6。
