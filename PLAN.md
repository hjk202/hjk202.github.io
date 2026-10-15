# Personal Space 实施计划

## 文档权责与执行状态

- `NEED.md` 是产品需求与目标架构的来源。
- `PLAN.md` 是实施路线、Phase 划分、milestone 范围、完成标准和状态的 source of truth。
- `AGENTS.md` 约束 Codex 的工作方式，不能作为新增产品需求或扩大实施范围的依据。
- 用户明确的新指令优先于旧约定；涉及需求或计划变更时，只同步获得授权的内容，不通过自行修改文档扩大实施权限。
- 本计划整理日期：2026-10-11。

### 当前执行状态

| 项目 | 状态 |
| --- | --- |
| 当前任务 | 用户明确授权发布V5修复；检查中断状态后继续既有Pages流程，线上验证后停止等手机验收 |
| 当前指定实施 milestone | 4.8 In Progress：V5发布与线上检查；V1–V5实现Done，Phase 5/6未授权 |
| 当前授权范围 | 提交并部署已验证的V5口令/原生触摸反馈修复与说明；保留原有非敏感验收密文和口令，不扩展功能 |
| 项目实施 | Phase 1、2、3与D1–D8完成；线上1520c2f；V5修复仅本地完成，最终无样本版本待4.8 |
| 下一候选 milestone | 本次发布及线上检查后停止，等OPPO复验；最终样本清理/无样本发布仍未完成，不自动执行 |

创建这两份文档不代表 milestone 1.1 已开始或已完成。所有实施 milestone 初始为 `Pending`。

### Milestone 执行规则

1. 一次只能执行用户当前明确指定的一个 milestone；路线中的顺序和依赖不构成执行授权。
2. 开始前阅读 NEED.md、PLAN.md、AGENTS.md，以及相关源码、配置和测试；核对 Scope、Non-goals、Done Criteria 和 Verification。
3. 优先最小改动。不得因“顺便优化”修改无关代码、增加功能或提前实现后续 milestone / Phase。
4. 发现当前范围无法满足验收，先说明问题、影响和最小调整建议；需要改变范围时等待用户决定，不自行重新设计整个项目。
5. 完成当前 milestone 的全部 Done Criteria 和 Verification 后，更新其状态及验证记录，并停止；不自动进入下一个 milestone。
6. 验证失败时先修复当前范围内的问题并重新验证。无法在当前范围内解决时标记 `Blocked` 并说明原因，不把失败当作完成。
7. 只更新当前 milestone 的状态与必要记录；除用户明确要求或有证据证明需纠正既有状态外，不改动其他 milestone 的范围或状态。

### 公共验证门槛

每个实施 milestone 完成后都必须执行以下检查，并记录实际命令、结果和必要的页面验证证据：

| 检查 | 要求 |
| --- | --- |
| lint | 必须执行；工程初始化 milestone 1.1 建立配置和命令 |
| typecheck | 项目具备时必须执行；本项目采用 TypeScript，1.1 建立后持续执行 |
| test | 项目具备可运行测试时必须执行；不能跳过已有测试或吞掉失败 |
| build | 必须执行生产构建；1.1 建立命令 |
| 页面 smoke test | 对受影响页面和入口执行必要检查；涉及浏览器行为时必须实际验证行为 |

默认命令使用 `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`。浏览器自动化用例接入后，同时运行当前 milestone 涉及的 `npm run test:e2e`；页面 smoke test 应覆盖必要的生产预览行为。

测试随真实被测功能接入，不添加空测试或只为过关的断言。项目尚无可运行测试时，明确记录“不适用”及原因，不能记为“通过”。缺少应该存在的 lint/build 命令、工具不可用、测试失败或页面无法验证时，不能伪称验收成功；应在已授权范围内解决，或报告阻塞。

规划与工作约束文档初次交付时，项目尚无 package.json、源码或构建环境，因此当时未执行工程验证。后续实际结果记录在对应 milestone 的 Completion Record 中。

### 状态约定

- `Pending`：未开始。
- `In Progress`：用户已指定，正在执行；同时最多一个 milestone 处于此状态。
- `Blocked`：当前问题阻止完成，需要说明阻塞原因和建议。
- `Done`：全部 Done Criteria 满足，Verification 已实际完成并记录。

状态记录至少包括完成日期、简要变更、验证命令与结果、页面 smoke test 结果，以及仍存在的限制。未运行的检查必须明确标注。

## Overall Architecture

### 项目目标

Personal Space 是极简的个人数字空间。首页只承担入口职责，通过两种方式访问独立模块：

- **Compass / Explore**：展示模块入口，并通过 Radar 表达各模块的内容积累。
- **Spotlight / Find**：搜索模块或内容，直接跳转到目标。

正常浏览保持 `Home → Module → Content`；快速查找通过 Spotlight 完成。模块拥有自己的内容模型、页面和内部扩展，框架只消费入口、数量和搜索投影。首页仅允许少量非交互身份文字。

### 已审阅的项目状态

本计划基于完整阅读的 NEED.md v0.2。规划时的工作区只有 NEED.md，没有 package.json、配置文件、源码、README、其他项目文档或 Git 仓库。因此没有已有实现可以复用或核对，工程从初始化开始。

```text
D:\hjk202\
└── NEED.md
```

以上是规划基线，不表示工程在后续实施中必须一直为空。

### 架构职责

| 部分 | 职责 | 边界 |
| --- | --- | --- |
| Home | Compass、Spotlight 入口及少量身份文字 | 不读取具体模块内容模型 |
| Shell | 布局、Home link、搜索入口、主题与玻璃样式 | 不决定模块内部如何展示 |
| ModuleRegistry | 发现模块、检查注册约定、提供稳定顺序 | 不管理内容关系 |
| Compass | 根据 Registry 和真实数量生成几何图形 | 不解析文章、项目或收藏 |
| Search | 消费公开搜索投影并执行轻量文本匹配 | 不建立统一内容模型 |
| Spotlight | 打开、查询、选择、关闭与跳转 | 不执行命令或提供 Terminal 功能 |
| Module | 管理本模块数据、页面、统计与搜索投影 | 不导入其他模块 |
| Vault | 后续提供访问状态 | Phase 1 不实现 |

框架与模块之间保留 `count()` 和 `search()` 两种内容能力。模块之间允许普通 URL 链接，不建立关系系统。

### Phase 1 接口与约定

| 接口或约定 | 定义 |
| --- | --- |
| Module 元数据 | id、name、route、icon、order，以及默认启用的 enabled |
| count() | 构建期异步返回非负整数，只统计实际公开内容 |
| search() | 构建期异步返回公开搜索投影，不接收访客查询 |
| SearchResult | 仅 title、description、url、module；module 为稳定模块 id |
| 页面构建约定 | 模块提供内部相对路径、页面组件和模块自己的页面参数 |
| 地址约定 | route 与结果 url 为不含部署 base 的站内逻辑地址，由统一地址处理添加部署前缀 |
| 模块内部模型 | 各自定义，不引入 UniversalContent |

NEED.md 未定义 search() 的参数和运行位置。Phase 1 将其解释为模块把公开内容转换为搜索候选；浏览器 Search 对候选执行查询。函数、Markdown/MDX 编译、文件读取和内部内容模型不进入浏览器。

```text
构建期：
ModuleRegistry
  ├── count()       → 首页真实数量
  ├── search()      → 公开搜索 JSON
  └── 模块页面约定  → 静态模块页与内容页

浏览器：
模块元数据 + 公开搜索 JSON
                ↓
          本地文本匹配
                ↓
          Spotlight 跳转
```

使用 Astro 静态端点生成公开 JSON，使用原生 TypeScript 脚本完成浏览器交互，不需要运行时后端。

### 新模块接入

采用约定式自动注册：

1. 模块位于 `src/modules/<id>/`。
2. module.ts 默认导出模块定义，目录名与 id 一致。
3. pages.ts 提供本模块的构建期页面描述，空相对路径代表模块首页。
4. Registry 用固定字面量文件匹配规则发现模块，按 enabled 过滤、按 order 排序。
5. 通用页面入口汇总页面描述，通过 getStaticPaths() 生成启用模块的静态页面。

新增模块只增加模块目录内的文件，不修改 Home、Compass、Spotlight、通用路由桥或 Core 逻辑。页面描述是路由适配约定，不是统一 Content 模型。

Astro 自动路由依赖 src/pages；模块目录本身不会自动产生页面，必须通过通用页面入口接入。

### 拟建目录

以下为实施目标，不表示这些工程文件已经创建。范围更小的 milestone 不得提前生成其他 milestone 的实现或无用占位文件。

```text
D:\hjk202\
├── NEED.md
├── PLAN.md
├── AGENTS.md
├── package.json / package-lock.json
├── astro.config.mjs / tsconfig.json / eslint.config.*
├── README.md
├── docs/
│   └── architecture.md
├── src/
│   ├── pages/
│   │   ├── index.astro
│   │   ├── [...path].astro
│   │   └── search-index.json.ts
│   ├── core/
│   │   ├── module/
│   │   └── search/
│   ├── shell/
│   │   ├── home/
│   │   ├── layout/
│   │   ├── glass/
│   │   └── theme/
│   └── modules/
│       ├── me/
│       ├── think/
│       ├── build/
│       └── keep/
└── tests/
    ├── unit/
    ├── e2e/
    └── fixtures/
```

## Phase Roadmap

| Phase | 目标 | 状态 | 依赖 |
| --- | --- | --- | --- |
| Phase 1 | 架构、首页、Spotlight 与扩展基础 | Done（用户继续 Phase 2，接受当前基线） | 无 |
| Phase 2 | 四个公开模块的最小实用版本 | Done（真实内容与 D1–D8 修订完成，用户认可当前基线） | Phase 1 |
| Phase 3 | 完整移动端与公开发布 | Done（公开发布与OPPO最终复查通过） | Phase 1、2、D1–D8 |
| Phase 4 | Private：加密、解锁、模块内使用、搜索与重新锁定 | In Progress（4.8 In Progress） | 已完成的Phase 1–3、D1–D8；不依赖新素材 |
| Phase 5 | 按需补齐有使用价值的可选功能 | Pending（候选，未选择或授权实施） | Phase 4；各候选须单独确认范围 |
| Phase 6 | 合并旅行/摄影模块与持续内容充实 | Pending（延后，不阻塞功能阶段） | Phase 4及实际选定的Phase 5功能；真实素材仅是正式录入的前提 |

后续 Phase 在启动前细化为用户可指定的 milestone；本路线不授权一次执行整个 Phase。NEED 中作为示例出现的内容类型或品牌功能，不自动成为必做交付。

**2026-10-14路线重排**：用户要求功能优先，旅行与摄影合为一个未来模块，真实内容以后逐步填充。此前未实施的“Phase 4 Photography/Travel、Phase 5 Private”编号及待查验草案由本轮替换：Private现为Phase 4，内容扩展移至Phase 6。下文Phase 1–3的完成记录中使用旧编号的文字保留为历史，不构成现行执行范围；当前路线以本表和新的Phase 4–6章节为准。不得按已撤回的4.1–4.5素材计划执行。

### Phase 1 — 架构、首页与 Spotlight

- **目标**：建立可扩展工程，完成首页与搜索核心交互，形成可本地验收的完整入口。
- **具体任务**：工程初始化；模块契约与自动注册；通用路由和 Shell；最小演示内容；动态 Compass；公开搜索投影；Spotlight；基础主题、动画与验证。
- **涉及文件**：根配置、src/core、src/shell、src/pages、四个模块目录、tests、README 和架构文档。
- **技术方案**：Astro 静态输出、TypeScript、模块内 Markdown/MDX 或本地数据、原生 SVG、CSS 与浏览器脚本。
- **完成标准**：四模块可访问，统计真实，搜索可跳转，第五模块自动接入，八个 milestone 均完成且没有越界功能。
- **验证方式**：各 milestone 的公共验证门槛与专项 Verification；最后进行生产构建预览和模拟部署子路径验证。
- **后续依赖**：为后续所有 Phase 提供基础。验收终点为本地生产预览；真实 Pages 发布属于 Phase 3。

### Phase 2 — 四个公开模块的最小实用版本

- **目标**：用真实公开内容替换演示内容，使 Me、Think、Build、Keep 可以实际使用。
- **具体任务**：Me 公开介绍；Think 简单列表与文章详情；Build 项目列表与详情；Keep 收藏列表和基本详情；记录统计口径，移除演示内容。
- **涉及文件**：四个模块目录及各自内容文件、页面适配器、统计与搜索适配器。
- **技术方案**：模块内管理 Markdown/MDX 与本地结构化数据。默认 Think 统计公开条目，Build 统计项目，Keep 统计收藏项，Me 统计一份公开资料。
- **完成标准**：真实内容可浏览、搜索和计数；模块之间无代码依赖；演示内容移除。
- **验证方式**：公共验证门槛；发布与非发布内容边界；列表到详情路径；搜索目标和真实数量检查。
- **后续依赖**：依赖 Phase 1，为 Phase 3 提供正式公开内容。不在此阶段开发项目日志、Milestone 或复杂分类。

原始执行范围见下文 **Phase 2 Detailed Plan**，实际完成状态见其总览与完成记录；追加设计修订见 D1–D8。这些完成项不构成 Phase 3 的实施授权。

### Phase 3 — 完整移动端与公开发布

- **目标**：完成真实设备体验，通过 GitHub Actions 发布公开站点。
- **具体任务**：Compass 等比缩放、标签和触摸目标；Spotlight 移动布局与虚拟键盘；浏览器兼容、可访问性和性能；GitHub 仓库与 Pages 配置；基本 404、favicon 和页面元信息。
- **涉及文件**：src/shell、Astro 配置、public、部署工作流与 README。
- **技术方案**：移动端保留 Compass；Spotlight 接近屏幕 90% 宽度；使用 Astro 静态构建与 Pages 工作流，统一处理 site 和 base。
- **完成标准**：真实手机可浏览和搜索；线上直达、刷新、资源请求和返回首页正常；内容更新可重复部署。
- **验证方式**：公共验证门槛；桌面与真实移动设备检查；线上路由巡检；至少一次内容更新与重新部署。
- **后续依赖**：依赖 Phase 1、2，不依赖 Private；为扩展模块提供发布基础。

详细执行范围见 [Phase 3 Detailed Plan](#phase-3-detailed-plan)，拆为 3.1–3.8。用户已授权逐项实施并验证；3.6 的发布管线准备与 3.7 的实际公开发布是不同验收单元。

### Phase 4 — Private功能闭环

- **目标**：保持现有导航和玻璃风格，建立真正加密的私人访问能力，而不等待真实私人内容。
- **具体任务**：安全与接口设计；本地加密打包；浏览器内存会话与站内跳转；中心长按及解锁/锁定；模块内私人呈现；私有搜索和真实统计；备份/换口令/恢复；安全、移动与发布验收。
- **涉及文件**：后续docs/vault-design.md、docs/vault-guide.md、scripts/vault/、src/core/vault/、必要的Registry/Search/Shell接点、现有模块的独立私人适配器、tests及发布产物检查。路径是候选，不在本轮创建。
- **技术方案**：沿用Astro静态Pages。本地先加密，公开仓库/CI只处理密文；浏览器用Web Crypto解锁，明文与密钥只留当前标签页内存。静态公开管线不变，模块自己管理私人模型与投影。
- **完成标准**：锁定、解锁、跨模块使用、查询/打开、主动/自动锁定、刷新与维护恢复形成闭环；公开产物无私人明文；非敏感测试样本即可满足功能验收；4.1–4.8全部通过后停止。
- **验证方式**：逐milestone公共检查、根/base浏览器回归、加密错误与泄露扫描、锁定生命周期、隔离维护恢复、线上与OPPO基础操作验收。
- **后续依赖**：只依赖已完成基线；若4.1证实需要后端或改变产品边界，先说明并等用户决定，不自行切换架构。

详细范围见 [Phase 4 Detailed Plan](#phase-4-detailed-plan)，拆为4.1–4.8。规划基线为Pending；用户随后授权实施，当前状态见各项记录与总览。

### Phase 5 — 按需选择的功能补齐

- **目标**：根据Private验收和实际使用补齐少量功能，不把候选全部变成必做项。
- **具体任务**：先选择真实缺口；候选为Think页内目录/代码复制、Keep模块内检索/排序，以及只包含公开Think内容的RSS。现有分类、文章/随记、项目阶段/更新/问题和公开内容维护已实现，不重复列为开发任务。
- **涉及文件**：选定模块的页面/局部脚本、对应测试及维护文档；RSS候选只新增独立公开输出端点，不进入Core内容模型。
- **技术方案**：模块内原生交互、少量URL状态及静态端点；不增加数据库、编辑后台或全站内容关系。
- **完成标准**：选定项的Done Criteria/Verification满足，未选项明确记录“本轮未纳入”；可以决定本阶段无新增功能，不能把未实施项标Done。
- **验证方式**：公共检查、对应真实交互、公开/私人边界以及导航回归；具体停点见Phase 5候选计划。
- **后续依赖**：默认Private验收之后再选；本阶段可跳过，未选候选不阻塞Phase 6。

### Phase 6 — 合并模块与持续内容维护（延后）

- **目标**：功能基线稳定后，再接入一个旅行/摄影模块并逐步积累真实资料。
- **具体任务**：确认一个模块的名称、组织/计数与媒体交互；通过原有约定接入；随后按作者节奏补充旅行照片、收藏网站、项目进展和思考。正式素材不足时不生成占位经历或强行填满页面。
- **涉及文件**：未来一个src/modules/<合并模块id>/、模块内媒体和适配器、现有四模块的实际内容文件、对应测试与指南。
- **技术方案**：旅行记录与照片属于同一模块内部组织；Compass只增加一个方向。是否采用记录列表、相册/作品视图由本阶段真实素材确认，暂不创建两个独立模块或图库框架。
- **完成标准**：选定模块能正常进入、阅读、搜索、计数和更新；一次获准的真实录入可验证；“内容已填满”不作为项目完成条件。
- **验证方式**：公共门槛、自动注册/根/base/手机媒体、真实更新及必要发布检查；私人媒体启用时遵守Phase 4加密边界。
- **后续依赖**：依赖已验收的功能基线；详细素材和视觉决策延后，不阻塞Private。

## Phase 1 Detailed Plan

### Milestone 状态总览

| Milestone | 名称 | 状态 | 前置依赖 |
| --- | --- | --- | --- |
| 1.1 | 工程初始化与架构基线 | Done | 无 |
| 1.2 | 模块契约与自动 Registry | Done | 1.1 |
| 1.3 | 通用路由、Shell 与最小演示内容 | Done | 1.2 |
| 1.4 | 构建期统计与公开搜索投影 | Done | 1.2、1.3 |
| 1.5 | 首页与动态 Compass | Done | 1.2–1.4 |
| 1.6 | Spotlight 核心交互 | Done | 1.3、1.4、1.5 的首页入口 |
| 1.7 | Quiet Liquid Glass 与基础动画 | Done | 1.5、1.6 |
| 1.8 | 扩展验证与 Phase 1 验收 | Done | 1.1–1.7 |

执行时以用户指定的 milestone 为唯一当前范围，不自动按表连续执行。

### Milestone 1.1 — 工程初始化与架构基线

**Status**：Done  
**Dependencies**：无。

#### Goal / Scope

建立可启动、检查和构建的 Astro 静态工程，记录后续实施的架构边界。

#### Tasks / Technical Approach

- 使用实施时的 Astro 稳定版本及其支持的 Node LTS，采用 npm 并提交锁文件固定依赖。
- 配置 TypeScript 严格检查、Markdown/MDX 支持和适用于 Astro/TypeScript 的 lint。
- 建立 dev、lint、typecheck、build、preview 命令；测试命令在真实测试接入时建立，不添加空测试或吞掉失败。
- 仅提供用于验证工程的最小页面入口，不提前实现最终首页。
- README 记录启动与验证方式，docs/architecture.md 记录依赖方向、接口解释与范围约束。

#### Files

根目录 package、Astro、TypeScript 与 ESLint 配置；README.md；docs/architecture.md；初始化所需的最小 src/pages 入口。

#### Non-goals

不实现 Registry、模块页面、Compass、Spotlight、主题效果或后续 Phase 功能；不引入 UI 框架、图表库、后端或全局状态库。

#### Done Criteria

- [x] 干净安装后可以启动和生产构建。
- [x] lint 与 typecheck 配置有效，命令真实执行检查。
- [x] README 能独立指导启动、检查、构建和预览。
- [x] 架构文档明确模块独立、构建与浏览器边界及 Phase 1 范围。
- [x] 公共验证门槛满足，未接入的测试如实记录为不适用。

#### Verification

- 执行 npm ci、npm run lint、npm run typecheck、npm run build。
- 如果已经存在可运行测试，执行 npm run test；否则记录原因，不伪称通过。
- 启动开发服务与生产预览，对最小页面执行 smoke test，检查可加载及无阻塞性浏览器错误。
- 审阅配置与依赖，确认没有提前实现其他 milestone。

#### Completion Record

完成日期：2026-10-11。仅完成本 milestone，实施已停止。

实际变更：

- 建立 Astro 7.3.8 静态工程、@astrojs/mdx 8.0.3 集成、TypeScript 6.0.3 strict 配置，以及 JavaScript / TypeScript / Astro ESLint 配置。
- 建立 dev、lint、typecheck、build、preview 命令；通过 package-lock.json 固定依赖。运行环境为 Node 22.23.2、npm 10.9.8，并记录 .node-version 和 engines。
- 新增最小 src/pages/index.astro，只展示 Personal Space 与身份文字；新增 README.md、docs/architecture.md 和生成目录忽略规则。
- NEED.md、AGENTS.md 保持原样；没有创建 Registry、模块、Shell、Compass、Spotlight、测试占位或后续 Phase 实现。

验证记录：

| 检查 | 实际命令 / 方式 | 结果 |
| --- | --- | --- |
| 干净安装 | npm ci --cache .cache/npm --no-fund --fetch-retries=1 --fetch-timeout=60000 | 退出码 0；安装 364 个包，审计报告 0 个漏洞 |
| lint | npm run lint | 退出码 0；没有错误或警告 |
| typecheck | npm run typecheck | 退出码 0；0 errors、0 warnings、0 hints |
| test | 不适用 | 当前没有测试用例或 test/test:e2e 命令；按计划随真实被测功能接入，不记为通过 |
| build | npm run build | 退出码 0；静态输出，最终产物只有 dist/index.html |
| 配置有效性 | 内存 lint 反例，以及临时 .ts / .astro 类型错误文件 | lint 正确报告 debugger 和未使用变量；typecheck 正确报告两处 strict 空值类型错误。临时文件已清除，正常检查重新通过 |
| Markdown / MDX | 临时 .md / .mdx 页面构建，检查生成 HTML | Markdown 文本和 MDX 表达式均正确输出；临时页面已清除，并重新构建最小首页 |
| 开发 smoke test | npm run dev -- --host 127.0.0.1 --port 4321；真实浏览器访问和刷新 | http://127.0.0.1:4321/ 成功加载；标题、主标题和身份文字可见，刷新正常，浏览器 error 日志为空；服务记录 HTTP 200 |
| 生产 smoke test | npm run preview -- --host 127.0.0.1 --port 4322；真实浏览器访问、刷新及截图检查 | http://127.0.0.1:4322/ 成功加载；标题、主标题和身份文字可见，刷新正常，浏览器 error 日志为空 |
| 范围审阅 | 检查配置、依赖、文件清单及文档 | 未提前实现 Milestone 1.2 或之后的内容；README 可独立指导运行，架构文档标明后续约定尚未实现 |

环境记录：默认沙箱中 npm 联网安装和本机端口访问受限，开发服务曾报告 shiki 无法加载。确认该依赖已安装且可直接导入后，以正常本机权限重新运行安装、开发和预览；开发与生产浏览器验证均通过，未因此新增依赖或修改配置。Astro 验证命令使用进程级 ASTRO_TELEMETRY_DISABLED=1。

限制：当前页面仅用于工程验证；正式首页、模块契约、搜索等仍未实现。Milestone 1.2–1.8 和未来 Phase 保持 Pending，执行下一项需要用户明确指定。

### Milestone 1.2 — 模块契约与自动 Registry

**Status**：Done  
**Dependencies**：1.1。

#### Goal / Scope

建立框架与模块之间的最小契约及唯一模块来源。

#### Tasks / Technical Approach

- 定义 Module、SearchResult 及独立的构建期页面约定，不统一内部 Content 模型。
- 使用固定字面量 import.meta.glob 规则发现 modules/*/module.ts 的默认导出，仅在构建侧运行。
- 初始四模块为 Me、Think、Build、Keep；从顶部顺时针显示顺序为 Think、Build、Me、Keep，坐标留给后续按 N 计算。
- enabled 默认启用，决定公开导航、统计、搜索和路由是否参与；order 控制稳定顺序。
- 验证必要导出、目录名与 id 一致、唯一 id/route、非歧义顺序；错误明确报告，不静默忽略。
- 建立真实契约与注册逻辑测试，接入测试命令。浏览器消费公开快照，不导入带构建函数的 Registry。

#### Files

src/core/module；src/core/search/types.ts；四个模块的 module.ts；对应单元测试与必要测试配置。

#### Non-goals

不生成完整模块页面，不执行内容统计或搜索索引构建，不实现 Compass、Spotlight 或 Private。页面适配器的发现和缺失检查在 1.3 接通。

#### Done Criteria

- [x] Registry 自动发现四个模块，没有中心硬编码模块消费列表。
- [x] 启用状态和顺序可由模块定义改变。
- [x] 无效注册、重复地址和不一致 id 有明确错误。
- [x] 公共接口保持最小，模块无互相导入。
- [x] 公共验证门槛满足。

#### Verification

- 执行 lint、typecheck、已有 test 和 build。
- 验证四模块、排序、禁用、重复 route、错误导出和 id 不匹配的测试场景。
- 对工程页面执行 smoke test，检查 Registry 接入未破坏构建与浏览器加载。
- 审阅依赖，确认构建侧 Registry 不被浏览器脚本导入。

#### Completion Record

完成日期：2026-10-12。建立最小 Module / SearchResult / ModulePage 契约、固定 glob 自动发现、校验与公开元数据快照，注册四模块并接入 Node 单元测试。lint、typecheck、test（4 项）和 build 均退出 0；生产预览 4400 页面加载、刷新正常，浏览器 error 日志为空。类型检查发现并通过安装 @types/node 修复测试声明缺失。审阅确认浏览器没有构建 Registry。count/search 此项仅提供空实现，真实数据在 1.4 接通。代理使用缓存中的 npm 10.9.8 CLI 执行 npm scripts（当前代理运行时 Node 24.19.0）。

### Milestone 1.3 — 通用路由、Shell 与最小演示内容

**Status**：Done  
**Dependencies**：1.2。

#### Goal / Scope

建立真实可访问的模块与内容目标，供后续导航和搜索验证。

#### Tasks / Technical Approach

- 完成基础布局、Module Shell 和通用模块路由。
- 固定发现 modules/*/pages.ts，按目录 id 关联 Registry；汇总模块相对路径，通过 getStaticPaths() 构建页面。
- 启用模块缺少页面适配器、页面地址冲突或页面超出本模块路径时明确报告错误。
- 页面描述只包含路径、组件和模块自己的页面参数，不扩张为内容框架。
- 演示内容：Me 一份资料、Think 两篇文章、Build 一个项目、Keep 两个收藏；每份演示内容均明确标注 Demo，不冒充真实个人内容。
- Module Shell 顶部只含 Home link、模块标识和搜索入口。此时搜索入口仅提供后续接入点，不实现弹层；首页 HJK 为身份文字。
- 建立统一地址处理，逻辑地址不包含部署 base，根路径和项目子路径都能正确生成链接。

#### Files

src/pages 的通用路由；src/shell/layout；四模块的 pages.ts、页面组件和演示内容；必要路由测试。

#### Non-goals

不开发模块内部复杂功能；不实现首页 Compass、真实搜索、Spotlight 弹层、Private 或完整移动适配。

#### Done Criteria

- [x] 四个模块及演示目标实际生成，可直达、刷新和返回首页。
- [x] 所有演示内容明确标注，不存在虚构正式资料。
- [x] 模块 Shell 无额外全局导航。
- [x] 禁用模块不生成公开页面；路由错误不会被静默接受。
- [x] 根路径与模拟子路径下的链接正确。
- [x] 公共验证门槛满足。

#### Verification

- 执行 lint、typecheck、已有 test 和 build。
- 在生产预览中逐项访问四个模块与演示目标，检查刷新、Home link 和普通内容链接。
- 检查禁用模块、未知地址和无效页面适配器场景。
- 使用模拟 /personal-space/ 前缀检查页面和资源，避免重复添加或遗漏 base。

#### Completion Record

完成日期：2026-10-12。新增构建期页面适配器发现、路由校验、通用路由桥、最小 Shell、统一 base 地址处理和六份 Demo 内容（Me 资料直接为模块首页）。lint、typecheck、test（7 项）、根路径与 /personal-space/ 构建均通过。浏览器逐项访问四模块和五个详情页；子路径点击内容、刷新、Home 返回通过，error 日志为空，未知地址返回 404。禁用模块、缺失/无效适配器、重复及越界路径通过单元测试。当前搜索按钮为禁用接入点，1.6 接通。

### Milestone 1.4 — 构建期统计与公开搜索投影

**Status**：Done  
**Dependencies**：1.2、1.3。

#### Goal / Scope

建立真实公开数量、搜索投影与浏览器轻量匹配逻辑。

#### Tasks / Technical Approach

- 接通模块 count() 和 search()，生成公开搜索 JSON 与数量快照。
- count 来自真实演示内容；不使用 NEED 中 36、124 等示例数字充当当前统计。
- SearchResult 仅四个既定字段，url 在 Phase 1 指向实际生成的站内目标。
- 浏览器匹配模块名称与内容标题、描述：去除首尾空白、英文忽略大小写、中文直接子串匹配。
- 排序依次为名称/标题精确匹配、前缀匹配、其他标题匹配、描述匹配；同等级按 Registry 顺序、标题和地址稳定排序。
- 相同站内目标去重；模块适配器失败使构建失败，不伪装成零条数据。

#### Files

模块统计与搜索适配器；src/core/search；src/pages/search-index.json.ts；对应单元与产物检查测试。

#### Non-goals

不实现 Spotlight UI、模糊检索、正文全文索引、中文分词、外部索引服务、数据库或 Private 数据管线。

#### Done Criteria

- [x] 统计与实际演示内容一致。
- [x] 公开索引通过 Registry 自动汇总，不携带内部模型、构建函数或非公开内容。
- [x] 中英文、大小写和空白处理符合约定，排序与去重稳定。
- [x] 每个搜索目标对应已生成页面。
- [x] 修改公开演示内容并重新构建后，数量与索引同步更新。
- [x] 公共验证门槛满足。

#### Verification

- 执行 lint、typecheck、已有 test 和 build。
- 测试空查询、名称/标题/描述匹配、无结果、中英文、大小写、去重与稳定排序。
- 测试无效数量及适配器失败，确认报告错误。
- 在生产预览中请求公开索引并访问其中目标，检查根路径与部署前缀兼容。

#### Completion Record

完成日期：2026-10-12。接通实际 Demo 数量 [2,1,1,2]、严格公开搜索投影和轻量中英文匹配，生成 search-index.json。lint、typecheck、test（10 项）、build 通过。测试覆盖空查询、精确/前缀/标题/描述排序、中文、大小写、去重、失败适配器及无效数量。临时增加 Think 内容并重新构建，数量变为 3、索引和新页面同时更新，随后恢复。根路径 4400 和子路径 4401 的索引及全部六个内容目标 HTTP 200；真实浏览器内容页显示和日志正常。尚未接入 Spotlight UI。

### Milestone 1.5 — 首页与动态 Compass

**Status**：Done  
**Dependencies**：1.2–1.4。

#### Goal / Scope

完成极简首页的结构与可用 Compass，建立动态 N 边形和真实 Radar。

#### Tasks / Technical Approach

- 首页仅包含少量身份文字、右上搜索入口、中央 Compass 和底部简短说明。
- 使用原生 SVG、固定 viewBox，依据 Registry 顺序等角分布模块，禁止固定四个位置。
- Radar 归一化值为 log(1 + count) 除以当前模块最大 log(1 + count)，内层最大半径为外层的 75%。
- 全零时值归零，保留外框与中心标记，不生成虚假的面积；少于三个模块时保留真实入口但不绘制有效多边形。
- 模块入口使用语义化链接；Hover 和 Focus 都增强标签与顶点，并显示真实数量。
- 中心保持装饰用途。此 milestone 完成基本可读样式；完整 Quiet Liquid Glass 与动画属于 1.7。

#### Files

src/pages/index.astro；src/shell/home/Compass.astro；相关几何工具、基础样式和测试。

#### Non-goals

不实现 Private 中心长按、统计 Dashboard、坐标轴、刻度、图例、首页 Feed 或 Spotlight 弹层。

#### Done Criteria

- [x] 首页结构符合 Entrance 定位，没有新增栏目或导航层。
- [x] 外框和 Radar 均由 Registry 与真实 count 动态生成。
- [x] 4、5、6、7 模块计算正确；全零和退化数量不产生无效坐标。
- [x] 模块入口可点击和键盘访问，Focus 能获得与 Hover 对应的数量反馈。
- [x] 公共验证门槛满足。

#### Verification

- 执行 lint、typecheck、已有 test 和 build。
- 测试四至七模块、全零、相同数量、数量悬殊及少于三模块场景。
- 在生产预览中 smoke test 首页、所有 Compass 链接、Hover 和 Tab/Enter 操作。
- 检查常见桌面尺寸下无标签裁切或主要内容溢出。

#### Completion Record

完成日期：2026-10-12。首页接入动态 SVG Compass、对数归一化 Radar、语义化模块链接及 hover/focus 真实数量反馈。lint、typecheck、test（12 项）、build 通过；几何测试覆盖 4–7 模块、全零、相同及悬殊数量、0–2 模块。生产浏览器确认四链接、Tab/Enter、鼠标数量反馈，1280×720 无溢出、error 日志为空。修复验收发现的较矮窗口溢出及顶点与标签间点击空隙。搜索入口仍待 1.6 接通，视觉润色在 1.7。

### Milestone 1.6 — Spotlight 核心交互

**Status**：Done  
**Dependencies**：1.3、1.4，以及 1.5 的首页入口。

#### Goal / Scope

在首页、模块页和演示内容页共享 Spotlight，完成从入口到搜索和跳转的交互。

#### Tasks / Technical Approach

- 使用原生模态 dialog，配合搜索输入和标准 combobox/listbox 选择语义。
- 实现关闭、空查询快捷入口、加载、结果、无结果和加载失败状态。
- 空查询入口从 Registry 自动生成；首次打开加载公开索引，在当前页面内缓存，失败时保留模块入口并提供重试。
- 点击搜索图标或在非编辑状态按 Cmd/Ctrl + K 打开，打开后聚焦输入框。
- 上下键选择快捷入口或结果，边界不循环；查询变化后选择第一项，无结果时 Enter 不跳转。
- Enter 打开目标；输入法组合期间不触发跳转。
- Esc、关闭按钮、遮罩点击关闭；Tab 焦点限制在弹层内，关闭后恢复原触发焦点。
- 结果展示标题、模块和简短描述；长列表可滚动。
- 接入真实浏览器交互测试与 test:e2e 命令。此 milestone 保证可用样式，视觉过渡由 1.7 完成。

#### Files

src/shell/home/Spotlight.astro；浏览器控制脚本；共享布局接入点；对应 e2e 测试与配置。

#### Non-goals

不启用 / 快捷键，不加入命令、操作菜单、Terminal、Private 搜索或完整移动端虚拟键盘方案。

#### Done Criteria

- [x] 首页、模块页和内容页均可打开同一套 Spotlight。
- [x] 空查询显示真实模块，查询可找到模块或内容，并进入真实目标。
- [x] 鼠标与键盘操作均可完成完整流程。
- [x] 焦点、背景隔离、输入法、无结果、加载失败与重试符合约定。
- [x] Spotlight 不携带命令系统或模块专属业务逻辑。
- [x] 公共验证门槛及相关 e2e 测试满足。

#### Verification

- 执行 lint、typecheck、已有 test、build 和相关 test:e2e。
- 在生产预览验证点击、Ctrl/Cmd + K、上下键、Enter、Esc、Tab、遮罩关闭及焦点恢复。
- 验证清空查询、连续查询、无结果、索引请求失败/重试、输入法组合和长结果滚动。
- 从首页、模块页和内容页分别完成至少一次搜索与跳转。

#### Completion Record

完成日期：2026-10-13。首页、模块页与内容页接入共享原生 dialog Spotlight，完成模块快捷入口、查询/无结果、懒加载缓存、错误重试、键盘选择、输入法保护、背景隔离及关闭恢复焦点。接入 Playwright 1.64.0、6 项独立浏览器回归与 test:e2e 命令。lint、typecheck（0 errors/warnings/hints）、12 项单元测试、build 和 6 项 e2e 均通过；e2e 覆盖三种页面入口、Ctrl/Cmd K、Tab/Esc/遮罩、鼠标/Enter、IME、失败/重试和长列表。实际生产预览 4400 中文搜索并跳转 Keep Demo 内容通过，error 日志为空。测试仅使用本机生产产物与独立 Chromium；代理浏览器文件缓存在 .cache/ms-playwright。

### Milestone 1.7 — Quiet Liquid Glass 与基础动画

**Status**：Done  
**Dependencies**：1.5、1.6。

#### Goal / Scope

完成 Phase 1 的桌面视觉质量，使首页与 Spotlight 具有统一、克制的玻璃语言。

#### Tasks / Technical Approach

- 默认跟随系统明暗主题，不增加主题切换控件或持久化设置。
- Glass 集中于 Compass、Spotlight：细边线、低饱和高光、半透明层和适度模糊。
- Compass 首次展开控制在 500–800ms，Hover 控制在 150–250ms。
- Spotlight 根据搜索按钮和面板位置进行展开过渡，配合内容淡入；不引入复杂 SVG morph 或 WebGL。
- 支持 prefers-reduced-motion；模糊不可用时提供可读样式。
- 小屏仅完成基本缩放与防溢出，完整适配留到 Phase 3。

#### Files

src/shell/glass；src/shell/theme；Compass、Spotlight 的相关样式与动画；必要视觉验证用例。

#### Non-goals

不新增首页设置入口、连续背景动画、复杂渲染引擎、完整移动端适配或品牌资产系统。

#### Done Criteria

- [x] 常见桌面尺寸与明暗主题下内容可读、焦点清楚、面板不裁切。
- [x] Glass 与留白符合 NEED，未扩散为大量玻璃卡片。
- [x] 动画时长与减少动态效果行为符合约定。
- [x] 模糊不可用时仍可完成导航和搜索。
- [x] 公共验证门槛满足，已有 Spotlight 行为无回归。

#### Verification

- 执行 lint、typecheck、已有 test、build 和受影响的 test:e2e。
- 对明暗主题、常见桌面尺寸、减少动态效果和模糊降级状态进行截图审阅与实际操作。
- smoke test Compass 跳转、Spotlight 打开/关闭/搜索及焦点恢复，确认动画不阻挡交互。
- 检查基本窄屏防溢出，不把完整移动体验记为已完成。

#### Completion Record

完成日期：2026-10-13。完成系统明暗主题、Compass 玻璃渐变细边线、Spotlight 半透明/模糊与按钮位置展开、650–700ms 初次动画和 200ms hover；支持减少动态效果和实色模糊降级。lint、typecheck、12 项单元测试、build、13 项 e2e 通过。截图审阅覆盖明暗主题 1280×720、1440×900、375×667 和 dark 降级；均无溢出或裁切，搜索跳转与恢复焦点正常。修复展开动画触发静止鼠标悬停覆盖键盘选择的回归。窄屏仅验证基本缩放防溢出，不视为 Phase 3 完整移动适配。

**视觉返工记录（2026-10-13）**：用户认为初版过于空、简单，要求“简洁而非简陋”，并增强液态玻璃的层次与清晰度。本轮仅调整入口视觉，不扩展功能：

- 扩大 Compass 主体，增加透明玻璃面、双层边缘、轻微反射与投影；Radar 和模块位置继续使用原有真实数据与动态几何。
- 模块入口增加细玻璃标签、SVG 图标和玻璃节点，标签宽度随名称调整；窄屏提高标签可读性。
- 首页增加克制的冷暖环境光，调整身份文字和标题层级；Spotlight 同步降低遮罩强度、增加清透材质与细高光。
- 修改文件为 src/pages/index.astro、src/shell/home/Compass.astro、src/shell/theme/theme.css、src/shell/glass/glass.css 和本计划记录；未改动 Core、模块内容、搜索逻辑或依赖。

验证：npm run lint、npm run typecheck（0 errors / warnings / hints）、npm run test（14 项）、npm run build 全部通过；根路径和 /personal-space/ 子路径各 15 项 e2e 通过；npm run test:extension 及隔离第五模块的 1 项 e2e 通过。实际浏览器在独立本机静态预览 4420 验证 Compass 跳转、模块页中文搜索及内容跳转，error 日志为空。审阅明暗主题、1280×720、1440×900、375×667、减少动态效果与模糊降级截图。

修复：新版大桌面布局曾有 4px 纵向溢出，改为 block SVG 消除行内基线空隙后复验全部通过。工程验证完成后停止；Phase 1 维持待用户检查本轮视觉效果的状态，不自行宣布用户视觉验收通过。

**第二轮视觉返工记录（2026-10-13）**：用户指出中央反光痕迹突兀、搜索过透，要求对称、优雅、精致和数学秩序。本轮移除 Compass 的两条斜向反射曲线及其专用裁剪，玻璃渐变与背景环境光沿垂直中轴对称，缩减投影。正多边形模块骨架和真实数量 Radar 的计算保持不变，不为视觉对称修改数据。

Spotlight 底色提高至约 99% 不透明度，增强背景遮罩、模糊和辅助文字对比度，保留渐变、细边线与阴影的玻璃层次。修改范围为首页、Compass、theme/glass 样式、现有视觉测试的搜索结果截图及本记录；无功能、依赖或架构变更。

验证：使用本地 npm CLI 执行 `npm run lint`、`npm run typecheck`（54 files，0 errors / warnings / hints）、`npm run test`（14 项通过）、`npm run build`（10 页）以及 `npm run test:e2e`（15 项通过），最终代码全部退出 0。最初 typecheck/build 因 Astro 遥测尝试创建工作区外配置目录而失败；仅为验证进程设置 `ASTRO_TELEMETRY_DISABLED=1` 后重跑通过，未改变全局配置。浏览器测试使用 `.cache/ms-playwright` 中 Chromium 和独立本机服务器。

页面证据：审阅明暗主题 1280×720、1440×900、375×667，以及减少动态效果/实色降级截图；实际浏览器回归覆盖 Compass 跳转、搜索结果、键盘/鼠标、关闭恢复焦点、失败重试、IME 与长列表，无溢出和导航回归。补充搜索结果截图，确认文字区背景干扰已显著降低。保存 `.cache/phase1-symmetric-home.png` 与 `.cache/phase1-readable-search.png` 供视觉检查。此次没有路由、base 或注册契约变更，未重复 1.8 的子路径和隔离第五模块构建。完整移动适配仍属后续范围；工程验证通过后停止，Phase 1 等待用户确认本轮视觉效果。

**背景视觉修订记录（2026-10-13）**：用户认可上一轮主体和搜索效果，认为背景仍单调。本轮只修改 src/pages/index.astro、src/shell/theme/theme.css 和本计划：增加左右对称的低饱和冷光、底部暖光、柔和椭圆光晕，以及向中心消隐的 24px 细点阵。明暗主题分别调色；背景采用静态 CSS 渐变与 mask，装饰层不响应指针。保留主体几何、搜索高不透明度、全部既有行为和模块数据。

验证：通过本地 npm CLI 执行 `npm run lint`、`npm run typecheck`（54 files，0 errors / warnings / hints）、`npm run test`（14 项通过）、`npm run build`（10 页）和 `npm run test:e2e`（15 项通过），均退出 0；Astro 检查进程设置 `ASTRO_TELEMETRY_DISABLED=1`，浏览器使用 `.cache/ms-playwright`。生产浏览器回归验证导航、搜索、焦点、键盘、IME、重试、长列表与基本防溢出。截图检查覆盖明暗主题、1280×720、1440×900、375×667、减少动态效果及实色模糊降级，搜索内容清楚，背景未遮挡交互。保留 `.cache/phase1-layered-background.png` 与 `.cache/phase1-layered-background-dark.png` 供用户检查。未重复不受本轮纯背景改动影响的子路径和第五模块构建；完整移动适配仍属后续范围。技术验收完成后停止，等待用户视觉反馈。

### Milestone 1.8 — 扩展验证与 Phase 1 验收

**Status**：Done  
**Dependencies**：1.1–1.7。

#### Goal / Scope

证明模块扩展约定真实有效，并完成 Phase 1 的本地生产验收。

#### Tasks / Technical Approach

- 完成几何、数量映射、搜索匹配、导航与 Spotlight 的必要验收测试。
- 在隔离测试构建中只新增第五个测试模块目录，验证 Registry、五边形、统计、快捷入口、搜索及路由自动接入。
- 扩展验证不得修改 Home、Compass、Spotlight、通用路由桥或 Core 逻辑；正式模块继续保持四个。
- 分别以 / 和模拟 /personal-space/ 前缀生产构建并预览，检查页面、资源与索引请求。
- 审阅模块独立和构建/浏览器边界，完善 README 与验证记录。

#### Files

tests/unit、tests/e2e、tests/fixtures；必要验证配置；README.md、docs/architecture.md 与本 milestone 状态记录。

#### Non-goals

不增加正式第五模块，不发布 GitHub Pages，不新增产品功能，不把验收作为无关重构或未来 Phase 开发的机会。

#### Done Criteria

- [x] 1.1–1.7 已完成且有验证记录。
- [x] 新增测试模块只改隔离测试目录，全部框架入口自动接入。
- [x] 根路径与项目子路径的生产预览均通过。
- [x] 浏览器不携带构建加载器，模块无互相导入，共享层无模块专属逻辑。
- [x] Phase 1 无越界功能，正式 Registry 仅四模块。
- [x] 全部公共验证门槛与验收测试通过，记录完整。

#### Verification

- 执行 lint、typecheck、test、build 和 test:e2e。
- 执行隔离的第五模块扩展构建，检查页面、数量、搜索与几何结果。
- 分别在两种 base 下 smoke test 首页、四模块、演示内容、全部导航入口和搜索 JSON 请求。
- 对全部搜索目标检查可访问性；审阅依赖边界与发布产物。
- 核对范围清单，更新本 milestone 为 Done 后停止，不自动进入 Phase 2。

#### Completion Record

完成日期：2026-10-13。完成 Phase 1 最终验收：隔离第五模块自动接入、根路径和子路径生产构建/浏览器检查、源码与产物边界审阅、README 与架构文档更新。全部 Done Criteria 满足，实施已停止，等待用户检查。

| 验证 | 实际命令 / 方式 | 结果 |
| --- | --- | --- |
| lint | npm run lint | 退出 0，无错误或警告 |
| typecheck | npm run typecheck | 退出 0，54 个文件，0 errors / warnings / hints |
| 单元测试 | npm run test | 14 项通过；覆盖 Registry、路由、base、投影、搜索排序/去重、几何、模块独立与浏览器边界 |
| 正式构建 | npm run build | 退出 0，四模块、六份 Demo，10 个静态 HTML 页面及公开索引 |
| 根路径 e2e | npm run test:e2e | 15 项全部通过；全部模块和内容可访问，资源正常，无页面错误，未知地址 404 |
| 子路径构建 | npm run build -- --base /personal-space/ --outDir .cache/base-dist | 退出 0，正式四模块产物 |
| 子路径 e2e | E2E_DIST=.cache/base-dist、E2E_BASE_PATH=/personal-space/ 下执行 npm run test:e2e | 同样 15 项全部通过；导航、索引、脚本与资源前缀正确 |
| 隔离扩展 | npm run test:extension | 复制原工程后只增加 fixture 模块目录；隔离类型检查和构建通过，五边形、数量、索引和页面正确；原始 src 哈希不变 |
| 扩展 e2e | E2E_DIST 为 .cache/extension-output.txt 中的路径、E2E_EXTENSION=1 下执行 npm run test:e2e | 1 项通过：第五模块入口、快捷方式、搜索、数量和真实路由自动接入 |
| 实际 Astro 预览 | 根路径 4400 与子路径 4401 的浏览器 smoke test | 搜索、Enter 跳转、内容刷新、Home 返回正常；浏览器 error 日志为空 |
| 边界与范围 | 源码审阅、14 项单元测试中的边界检查、e2e 的脚本/JSON 产物检查 | 模块无互相导入；浏览器没有文件读取、构建 glob、Registry 或内容加载器；共享层无模块专属逻辑 |
| 文档 | README、docs/architecture、状态与文件清单核对 | 运行、测试、扩展及限制准确；NEED.md、AGENTS.md 原始哈希保持不变 |

验证环境：Node 24.19.0、npm 10.9.8；代理通过工作区缓存的 npm CLI 执行上述同名 scripts。独立 Chromium 由 Playwright 1.64.0 管理，代理设置 PLAYWRIGHT_BROWSERS_PATH=.cache/ms-playwright；测试服务仅绑定本机，测试不依赖用户已打开的浏览器。正式 dist/ 保持根路径构建，子路径与第五模块产物均位于忽略的 .cache/。

验收脚本修复：使用已安装 Astro 包声明的 CLI 入口；链接计数只统计 HTML 链接，排除内联脚本选择器文字。修复后隔离构建和扩展 e2e 均通过。

限制与收尾：当前内容全部为明确标注的 Demo，正式 Registry 仍只有 Think、Build、Me、Keep。完整移动端体验、真实内容、公开发布与 Private 仍属于后续 Phase，没有提前实现。Phase 1 已完成；不自动进入 Phase 2。

后续视觉返工说明：以上为初次技术验收记录。用户随后要求 1.7 视觉返工；其变更与新一轮根路径、子路径及第五模块回归结果见 1.7 的视觉返工记录。当前 Phase 1 的用户检查状态以顶部“当前执行状态”为准。

### Phase 1 排除项

Phase 1 不实现：Vault、中心长按与解锁、模块复杂内部功能、Photography/Travel 正式内容、完整移动端适配、数据库、CMS、编辑后台、复杂索引和品牌衍生系统。

以下是持续禁止项，不是留到未来的待办：Dock、Navbar、Sidebar、Relations、Activity、聚合 Timeline、知识图谱、统一 Content 图和首页 Feed / Dashboard。

## Phase 2 Detailed Plan

规划日期：2026-10-13。本节细化既有 Phase 2，不改变 NEED.md 的产品目标。规划交付后，用户已明确授权按本计划完成 Phase 2：2.1–2.6 逐项实施、逐项验证后推进，阶段完成暂停等待验收；各项素材依赖仍需满足。重点是把已完成的入口连接到可维护、可阅读的真实公开内容；首页视觉保持上一轮基线。

### 当前基线与启动条件

- Phase 1 的八个 milestone 技术工作已完成；首页最后一轮背景调整通过检查。用户随后授权继续完成 Phase 2，接受当前 Phase 1 基线。
- Phase 2 启动前，四模块使用模块内 data.ts 保存 Demo：Think 2、Build 1、Me 1、Keep 2；共六份样本。当时 Think 尚未通过正式 Markdown 内容目录供稿，Keep 尚无真实外部 URL。当前已迁移为用户提供的四份公开内容，具体维护方式见 docs/content-guide.md。
- Registry、ModulePage 路由桥、count()/search() 和公开 JSON 已可用。Phase 2 沿用这些契约，只在模块内部替换数据与页面。
- 部分单元测试直接通过 Node 导入 module.ts；搜索、浏览器测试写死 Demo 标题、数量和 `.demo-label`。迁移内容时同步迁移相应断言，不能把预期失败留到阶段末。
- 启动实施前需要用户确认 Phase 1 可作为基线，并明确指定一个 Phase 2 milestone。2.1 可先登记缺少的素材；2.2–2.5 分别依赖所属模块的真实公开素材，不要求一次准备齐所有模块。

### Phase 2 范围与默认决策

**目标**：让用户能够维护真实介绍、文章、项目和收藏；访客能从模块列表阅读详情，通过 Spotlight 找到相同内容，Compass 数量与实际公开内容一致。

**本阶段不做**：继续重做首页、搜索界面或背景；新增模块；Private/Vault；数据库、CMS、编辑后台、登录；全文搜索、语义搜索；标签/分类筛选系统、分页、RSS；项目日志与项目里程碑；完整移动端、线上发布、404/favicon/OG 等 Phase 3 工作。必要的模块内阅读排版与基本防溢出属于本阶段。

以下是可在 2.1 确认的默认方案，未确认的个人信息不得据此自动生成：

| 模块 | 最小内容来源与字段 | 默认排序 | count / search 口径 |
| --- | --- | --- | --- |
| Me | 保留模块内 data.ts；姓名、简短介绍、正文段落、可选公开链接；明确是否公开 | 单份资料 | 有已确认的公开资料为 1，否则 0；资料搜索目标仍为 /me/ |
| Think | 模块内 content/ 的 Markdown；slug、title、summary、published、作者提供的 date 与正文；默认不用交互 MDX | date 降序，同日按 slug 稳定排序 | 每篇 published 为 true 的文章计 1；投影标题和摘要，目标为站内详情 |
| Build | 保留模块内结构化数据；slug、title、summary、published、项目说明、可选真实仓库/演示链接 | 数组顺序即手工展示顺序 | 每个公开项目计 1；项目说明段落和链接不单独计数 |
| Keep | 保留模块内结构化数据；slug、title、description、published、sourceUrl、个人简短说明 | 数组顺序即手工展示顺序 | 每项公开收藏计 1；搜索先到站内收藏详情，详情再打开原始来源 |

- 各模块自行定义和校验字段，不建立统一 Content 基类或中心内容配置。只有公开集合能同时供列表、详情路由、count()、search() 使用，避免口径分叉。
- Think/Build/Keep 的 published 必须显式为 true 才公开；缺省不公开，字段类型错误应报告。Me 使用同样明确的公开确认。这里只是构建期编辑状态，不是私人模式或保密机制；不存放秘密材料。
- 模块首页始终存在。无公开内容时显示真实空状态、计数 0、无虚假详情和内容搜索结果；Spotlight 仍保留该模块入口。
- 非空字段、slug 格式、重复 slug、日期及 URL 按模块需求做最小校验；失败应指明模块与条目。沿用当前 slug 的小写字母/数字/连字符约定，中英文标题不受此限制。
- 本地 Markdown 由模块的构建期加载器导入和渲染，页面仍通过 pages.ts 接入。普通 Markdown 的站内链接和图片优先使用可随 base 工作的相对地址；有实际需要时才使用 MDX 与既有 withBase。不得为此重写通用路由或建立全局内容引擎。
- 本阶段只使用用户明确可公开的资料。缺失的简介、经历、文章、项目成果和收藏理由不编造，也不把 Demo 改掉标签冒充真实内容。
- Demo 按模块逐项替换；迁移中的其他模块继续明确标注 Demo。正式产物最终不含这六份样本；需要保留的测试数据放 tests/fixtures，并与真实站点内容隔离。
- 默认每模块至少接入一份真实内容作为验收样本，数量不要求维持 2/1/1/2。若用户希望某模块正式保持空状态，需要明确记录该例外；不能由执行者自行降低验收条件。

### Milestone 状态总览与执行顺序

| Milestone | 名称 | 状态 | 前置依赖 |
| --- | --- | --- | --- |
| 2.1 | 内容清单与模块约定 | Done | Phase 1 基线确认；用户指定本项 |
| 2.2 | Me 真实公开介绍 | Done | 2.1；Me 资料已确认 |
| 2.3 | Think 内容维护与阅读 | Done | 2.1；Think 文章已确认 |
| 2.4 | Build 项目展示 | Done | 2.1；Build 项目资料已确认 |
| 2.5 | Keep 收藏与来源访问 | Done | 2.1；Keep 来源与说明已确认 |
| 2.6 | 内容联动与 Phase 2 验收 | Done | 2.2–2.5 |
| 2.7 | 四模块内页背景视觉修订 | Done | 2.2–2.6；用户追加视觉指令 |

本次授权执行顺序为 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6。一次只执行一个 milestone；每项通过其全部验证后记录状态，再进入下一项。四个模块没有相互代码依赖，素材准备顺序不同可由用户明确指定另一已满足依赖的模块；不自动跳过依赖或并行开展。素材缺失时先记录问题，不编造内容；整个 Phase 2 完成后停止，不开始 Phase 3。

### Phase 2 公共验证与测试迁移约定

所有代码 milestone（2.2–2.6）均执行 `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`、`npm run test:e2e`，按该项补充生产页面 smoke test；任一失败必须先修复。纯文档 milestone 2.1 按 AGENTS.md 的文档任务规则验证，不为跑工程命令改代码。

- 每次内容替换同步调整相关测试，不继续要求固定的 Demo 名称、2/1/1/2 计数或页面数。对应变更必须保持原有搜索、键盘、焦点、失败重试、IME 和长列表覆盖。
- 确定性搜索排序/边界使用独立 fixtures；实际内容集成检查依据明确的输入样本和预期公开集合核对产物。不能只读生成的 JSON 再与自身比较，不能仅改成“结果非空”。
- Markdown 加载器若使用 import.meta.glob，不能从纯 Node 测试直接执行该加载器。相关纯规则用模块内可测试函数与 fixtures 验证；真实模块发现、编译和渲染在 Astro 隔离构建与浏览器中验证。仅调整受影响测试，不引入新的测试框架。
- 未发布条目的隔离探针使用非敏感唯一标记，同时检查页面、列表、数量、搜索 JSON 及浏览器产物不存在该标记；不得仅隐藏列表链接。公开发布标志不保护仓库源文件或手动放入 public/ 的资源。
- 空集合、有效内容、非法元数据、重复 slug 等必要边界在模块所在 milestone 完成。第五模块和完整子路径回归在 2.6 统一执行；若某项修改了链接/资源加载，须在该项先进行受影响的子路径 smoke test。

### Milestone 2.1 — 内容清单与模块约定

**Status**：Done  
**Dependencies**：Phase 1 基线确认与用户对本项的执行授权。

#### Goal / Scope

明确首批公开内容、每模块最小字段、发布状态、排序、计数与 URL 约定，形成后续四项可直接执行的输入。此项为文档任务，不实施加载器、页面或数据迁移。

#### Tasks / Technical Approach

- 在 docs/content-guide.md 记录上文默认决策与用户修正；按模块记录素材来源、可公开确认、待提供项及拟用 slug，不复制不必要的个人资料。
- 整理首批资料清单：Me 介绍与可选链接；Think 至少一篇带摘要、日期的文章；Build 至少一个真实项目说明；Keep 至少一个真实 URL 和收藏说明。
- 明确当前 Demo 路由如何移除；尚未公开部署，默认删除旧 Demo 详情，不为样本建立重定向。若实际已有外部使用者，先提出最小迁移建议。
- 记录逐模块内容迁移对应的测试更新位置。只记录范围，不修改测试。

#### Files

新建 docs/content-guide.md；更新 PLAN.md 本项状态和必要决策。其他文件只读。

#### Non-goals

不写个人传记或项目成果，不自动搜集用户资料，不新增代码、内容系统或示例页面。

#### Done Criteria

- [x] 四模块的字段、公开条件、排序、计数、逻辑 URL 和维护位置有明确记录。
- [x] 每份现有素材标记来源和公开确认；缺失素材明确标为待提供，未用假内容补齐。
- [x] 模块实施依赖可判定：资料未齐不妨碍本项文档完成，但相应内容 milestone 不能直接标为可验收。
- [x] 已记录 Demo 迁移与测试调整策略，保持原架构边界。

#### Verification

核对 NEED.md、当前源码与本计划；检查内容清单完整性、字段/计数/地址一致性、路径和章节引用；确认只修改文档。lint/typecheck/test/build/页面 smoke test 对本项不适用，记录为未运行而非通过。

#### 后续依赖 / Completion Record

完成日期：2026-10-13。新增 docs/content-guide.md，记录四模块字段、公开条件、排序、计数、地址、维护位置、逐项素材清单、Demo 迁移与测试调整策略。用户授权逐项完成 Phase 2，作为 Phase 1 基线确认；按照新授权在本项验收后检查下一项依赖。

验证：逐项核对 NEED.md、PLAN.md、现有数据、页面、Module 契约与受影响测试；文档结构/覆盖/现有路径校验脚本退出 0，缺失输入均明确登记为待提供。仅修改本计划与新增指南。lint、typecheck、test、build、页面 smoke test 不适用且未运行，未将工程验证记为通过。为 2.2–2.5 提供输入约定；真实内容尚未提供，不声称后续模块已可验收。

### Milestone 2.2 — Me 真实公开介绍

**Status**：Done  
**Dependencies**：2.1；用户已提供或确认可公开的 Me 资料。

#### Goal / Scope

把 /me/ 从 Demo 介绍替换为真实、简洁的公开资料，完成最小的一次内容到统计/搜索迁移。

#### Tasks / Technical Approach

- 在 me/data.ts 保存公开资料；Profile.astro 展示姓名、简介、正文及用户提供的可选链接。沿用模块内简单数据，不拆成履历/社交/技能系统。
- count() 只统计存在且公开的资料，search() 指向 /me/；无资料时保留模块首页与清楚的空状态。
- 页面延续干净的阅读排版和既有 Shell；只调整本模块所需样式。移除 Me Demo 文案，同步相关测试，不要求其他模块此时移除 Demo。

#### Files

src/modules/me/data.ts、Profile.astro、module.ts；pages.ts 仅必要时修改；tests/unit、tests/e2e 中受影响用例；docs/content-guide.md、PLAN.md。

#### Non-goals

不改首页身份信息、Compass/Spotlight 设计，不实现完整简历、社交接口、头像资源系统或新导航。

#### Done Criteria

- [x] Me 展示的是确认过的真实资料，本站正式资料目标仍为 /me/，不重复生成详情页。
- [x] 资料公开时 count 为 1，资料未公开时为 0；搜索投影与实际页面内容一致。
- [x] 未填写的可选信息不显示空标签或假链接；Me Demo 已移除，其他模块仍按实际状态标识。
- [x] 公共验证全部通过，明暗主题下阅读、链接和焦点清楚。

#### Verification

执行 Phase 2 公共代码验证；测试有/无公开资料的 count/search；生产预览从 Compass 进入 Me、从 Spotlight 搜索资料并打开、刷新和返回 Home；检查可选链接正确且不会被当作站内部署路径添加 base。

#### 后续依赖 / Completion Record

阻塞记录（2026-10-13）：2.1 已完成；仓库只有 Demo Profile，尚无用户确认的真实公开简介与正文。已向用户请求四模块的最小素材，亦提供“先完成维护能力与空状态，真实内容稍后补”的交付调整选项；未收到选择前不能自行采用该例外。未修改 Me 或后续源码，未运行本项工程验证，无完成记录。Phase 2 批量实施授权保留，输入到位后继续按项实施与验证。供 2.6 验收，不作为其他模块的代码依赖。

完成记录（2026-10-13）：资料由用户本轮提供并明确用于 Phase 2；完成真实 Me、显式公开集合、可选链接校验与空状态。lint、typecheck（0 诊断）、15 项单元测试、build（10 页）、16 项 e2e 均通过；实际浏览器验证 Compass/中文搜索/刷新/Home，明暗截图可读。没有提供外链，未显示空链接。

### Milestone 2.3 — Think 内容维护与阅读

**Status**：Done  
**Dependencies**：2.1；至少一篇真实公开文章及其标题、摘要、日期已确认。

#### Goal / Scope

建立模块内 Markdown 供稿流程，完成真实文章列表、详情与适度的阅读排版，验证新增内容不必修改共享框架。

#### Tasks / Technical Approach

- 新建 think/content/ 和所需的最小构建期加载器，校验 frontmatter、日期、slug 与公开状态；不新增依赖或中心内容集合系统。
- 先用一篇非敏感测试文章验证现有 ModulePage 组件/props 桥可渲染 Markdown，再接入真实文章；若桥确有冲突，说明问题与最小方案，不先改 Core 契约。
- Index.astro 显示标题、摘要、日期；Article.astro 渲染正文，处理标题层级、段落、列表、引用、代码块以及文章确实使用的图片/链接。长代码局部滚动，不撑开页面。
- pages.ts、module.ts 和列表使用同一公开文章集合；未发布文章不生成详情、不计数、不进入搜索。稳定 slug 不随标题修改。
- 移除 Think Demo，同步处理直接导入 Vite 加载器的 Node 测试兼容问题及 Demo 耦合断言，保留原有测试覆盖。

#### Files

src/modules/think/content/*.md、所需的 content.server.ts / 模块内校验文件、data.ts（替换或移除现有样本）、Index.astro、Article.astro、pages.ts、module.ts；受影响 tests/unit、tests/e2e、tests/fixtures；docs/content-guide.md、PLAN.md。文件名可按最小实现调整，但不得扩展为全局内容框架。

#### Non-goals

不做文章分类系统、全文搜索、评论、阅读进度、目录侧栏、编辑器或额外文章类型体系；MDX 仅在真实文章需要时采用。

#### Done Criteria

- [x] 至少一篇确认过的真实文章完成列表、详情、搜索与真实计数，Think Demo 移除。
- [x] 新增一篇文章仅添加模块内内容文件即可接入；标题改动不改变 slug 路由。
- [x] 未发布、空内容集、非法日期/slug 和重复 slug 的行为明确且有验证；无假计数或隐式跳过错误。
- [x] 正文在明暗主题下可读，长内容无页面横向溢出，实际使用的链接/图片在根路径和子路径有效。
- [x] 公共验证全部通过，构建期 Markdown 逻辑不进入浏览器 JS。

#### Verification

执行公共代码验证；使用隔离的非敏感 fixture 验证新增/隐藏文章对列表、路由、计数和搜索的同步影响，以及重复 slug、坏日期、空集合；检查未发布唯一标记未进入产物。以 /personal-space/ 构建到隔离目录并 smoke test 文章、链接、实际图片资源、搜索和 Home。通过浏览器检查长文、代码块、减少动态效果与搜索恢复焦点；测试不改真实资料。

#### 后续依赖 / Completion Record

供 2.6 验收，并为用户后续日常写作提供维护路径；不要求 Build/Keep 复用 Think 的模型或加载器。已完成，实际结果见下列完成记录。

完成记录（2026-10-13）：用户原文接入模块 Markdown；校验公开状态、slug、日期、摘要与正文，列表/页面/count/search 共用集合。公式仅清理转义与分式排版，无新增依赖。lint、typecheck（62 files 无诊断）、16 项单元测试、build（9 页）、17 项根路径 e2e 通过；node tests/verify-content.mjs 的新增/隐藏/空集合隔离构建通过且原始源码哈希未变。子路径的 1 项资源/链接/长代码 probe 和 2 项真实内容 smoke 通过；明暗长文截图、窄屏无溢出、焦点恢复通过。

### Milestone 2.4 — Build 项目展示

**Status**：Done  
**Dependencies**：2.1；至少一个真实项目的公开说明已确认。

#### Goal / Scope

让访客能够浏览真实项目及其说明、访问实际成果链接，保持最小项目模型。

#### Tasks / Technical Approach

- 继续使用 build/data.ts 的结构化项目数据，增加模块内明确类型与最小校验；说明使用必要的段落即可，不因 Think 使用 Markdown 就统一所有模块。
- 项目列表展示名称和摘要；详情展示问题/做法/结果等用户实际提供的说明，以及可选真实仓库或演示链接。不补造状态、日期、技术栈或成果。
- 按手工数组顺序稳定展示；同一公开项目集合驱动页面、count/search；无项目时显示空状态。
- 移除 Build Demo，同步计数、路由和搜索测试中的对应预期。

#### Files

src/modules/build/data.ts、Index.astro、Project.astro、pages.ts、module.ts；必要的模块内校验文件及相关 tests；docs/content-guide.md、PLAN.md。

#### Non-goals

不做 Project Log、项目 Milestone、任务管理、状态看板、自动 GitHub 数据同步或分类筛选。

#### Done Criteria

- [x] 至少一个真实公开项目有可阅读的列表和详情，Build Demo 已移除。
- [x] 每项目只计 1，详情说明和外链不重复计数；搜索目标为真实站内项目详情。
- [x] 外链缺省不展示，提供时正确；未公开项目不生成公开详情和搜索结果。
- [x] 空集合、非法/重复 slug、无效链接有明确处理；公共验证全部通过。

#### Verification

执行公共代码验证；测试公开过滤、稳定顺序、错误数据和空集合；从 Compass → Build → 项目以及 Spotlight → 项目完成访问、刷新、Home 返回。检查外链 href 和必要的 base 路径，核对实际内容与 count/search，不依赖第三方服务在线状态判定本地构建成功。

#### 后续依赖 / Completion Record

供 2.6 验收；复杂项目内部能力仍留在 Phase 4 的单独授权范围。已完成，实际结果见下列完成记录。

完成记录（2026-10-13）：用户 NEMU 原文以模块结构化数据接入：时间范围、10 项实现列表、分页路径、说明和关键词；未发明外链。公开过滤、slug/链接校验和空状态完成。lint、typecheck（64 files 无诊断）、17 项单元测试、build（9 页）、18 项 e2e 通过；真实 Compass/列表/详情/搜索/刷新/Home、明暗截图、窄屏无溢出通过。

### Milestone 2.5 — Keep 收藏与来源访问

**Status**：Done  
**Dependencies**：2.1；至少一条真实来源 URL 和个人说明已确认。

#### Goal / Scope

将当前没有外部来源的 Demo 收藏改为真正可访问、带个人说明的收藏。

#### Tasks / Technical Approach

- 在 keep/data.ts 保存收藏及 sourceUrl，明确模块内类型和最小 URL/slug 校验。来源默认仅允许 http/https，站内详情与外部来源使用不同字段。
- 列表进入本站详情；详情展示标题、简述、个人说明和“打开来源”链接；Spotlight 继续指向站内详情。
- 默认同标签页打开来源；如果用户要求新标签页，实施时使用相应安全链接属性。无抓取、自动摘要或站点图标请求。
- 同一公开集合驱动列表、详情、count/search，移除 Keep Demo 并同步中文搜索等相关测试。

#### Files

src/modules/keep/data.ts、Index.astro、Bookmark.astro、pages.ts、module.ts；必要的模块内校验文件及相关 tests；docs/content-guide.md、PLAN.md。

#### Non-goals

不做收藏导入、网页抓取、自动分类、缩略图系统、去重引擎、复杂标签或第三方同步。

#### Done Criteria

- [x] 至少一条真实收藏可从列表和搜索打开本站详情，详情具有有效来源链接；Keep Demo 移除。
- [x] 外部 URL 不添加站点 base，搜索 URL 仍指向站内真实页面。
- [x] 公开条目数与 Compass 一致；未公开、空集合、坏 URL 与重复 slug 有验证。
- [x] 无未经确认的推荐/个人体验文案；公共验证全部通过。

#### Verification

执行公共代码验证；检查中文与英文标题/描述搜索、列表到详情、源 URL、刷新与 Home 返回。用隔离测试目标验证点击来源的导航行为，不依赖外网；在子路径 smoke test 中确认本站路由加 base 一次、外链保持原值。

#### 后续依赖 / Completion Record

供 2.6 验收；未来收藏类型/分类只能另行授权。已完成，实际结果见下列完成记录。

完成记录（2026-10-13）：用户 Missing Semester 原文接入，站内详情与真实来源 URL 分离；公开过滤、链接/slug 校验与空状态完成。lint、typecheck（66 files 无诊断）、18 项单元测试、build（8 页）、19 项根路径 e2e 和 4 项子路径内容 smoke 全通过。中文/英文标题描述搜索、外链点击、刷新/Home、明暗截图和窄屏无溢出通过；外链测试本地拦截，无第三方在线依赖。

### Milestone 2.6 — 内容联动与 Phase 2 验收

**Status**：Done  
**Dependencies**：2.2–2.5 全部满足验收；真实内容或用户明确同意的空模块例外已记录。

#### Goal / Scope

验证四模块已形成可维护的真实公开站点内容，并把使用文档和测试切换到新的内容基线。验收终点仍为本地生产预览。

#### Tasks / Technical Approach

- 对照内容清单逐项核对公开列表、详情、count/search；检查六份 Demo 已从生产产物移除，没有仅删除 Demo 标签的假替换。
- 汇总各模块维护步骤：新增、编辑、公开/取消公开、删除，说明 slug 稳定性、重建方式和资源地址；README、架构文档不再把全部内容描述为 Demo。
- 运行根路径、模拟子路径与隔离第五模块验收，确保正式内容接入没有破坏自动注册、页面桥或浏览器边界。
- 内容增删验证在隔离副本使用 fixture 完成，核对原始 src 未被改动。不为凑一致而把真实计数写回旧值。
- 仅修复此阶段集成问题；超出已批准范围时先说明并提出最小建议，不借收尾重构共享框架。

#### Files

tests/unit、tests/e2e、tests/fixtures、tests/verify-extension.mjs（仅实际需要的适配）；README.md、docs/architecture.md、docs/content-guide.md、PLAN.md。源代码修复只限已完成的 Phase 2 模块范围，扩大范围需用户决定。

#### Non-goals

不部署、不新增仓库或 CI、不实现完整移动端与 Private，也不自动开始 Phase 3。

#### Done Criteria

- [x] 四模块满足各自真实内容验收；例外有用户明确确认，六份 Demo 不在正式页面/JSON/脚本中。
- [x] Home → Module → Content 与 Spotlight 两套路径可用，所有内容搜索目标可直接打开、刷新和返回首页。
- [x] 列表、详情、数量、搜索来自一致的公开集合；内容增删/取消公开后同步变化，未发布标记不进入产物。
- [x] 根路径、/personal-space/ 子路径以及隔离第五模块验收通过；模块独立和构建/浏览器边界保持。
- [x] 维护文档、测试与当前真实状态一致；公共验证全部通过，完成记录列明证据与限制。
- [x] 技术完成后交给用户检查，停止，不将本地验收等同于 Phase 3 线上发布完成。

#### Verification

- 执行全部公共代码验证，生产预览巡检四模块、全部公开详情和搜索结果；检查错误日志、资源 404、明暗主题、键盘焦点及基本窄屏防溢出。
- 执行 `npm run build -- --base /personal-space/ --outDir .cache/base-dist`；按 README 设置 E2E_DIST / E2E_BASE_PATH 后运行 `npm run test:e2e`，并验证正文链接和资源。
- 执行 `npm run test:extension`；按 README 设置 E2E_DIST / E2E_EXTENSION 后运行隔离第五模块的 `npm run test:e2e`。确保正式 src 仍为四模块，测试环境变量仅影响对应进程。
- 对照独立的 fixture 预期检查公开/取消公开/删除后的路由、列表、计数与搜索，并检查 Demo 与未发布标记未残留。验证结束时正式 dist 保持根路径生产构建。
- 核对 docs/content-guide.md 的操作步骤可实际复现，更新 Phase 2 状态时只依据真实验证，不补填未执行的通过记录。

#### 后续依赖 / Completion Record

为 Phase 3 的移动端完善与部署提供正式内容基线。已完成，实际结果见下列完成记录。

完成记录（2026-10-13）：完成四份真实内容联动、维护文档和独立集成验收。最终 npm run lint、npm run typecheck（67 files，0 errors/warnings/hints）、npm run test（18 项）、npm run build（8 页）全部退出 0；根路径和 /personal-space/ 子路径各 19 项 e2e 通过。npm run test:extension 的隔离类型检查/构建与 1 项浏览器扩展验收通过；node tests/verify-content.mjs 的新增/取消公开/全零/删除四轮构建通过，原始 src 哈希不变；子路径资源/链接/长代码探针 1 项、全零模块探针 1 项通过。实际浏览器检查四模块、中文搜索、外链、刷新/Home、明暗主题、焦点与窄屏防溢出；静态扫描确认六份 Demo 及未发布正文标记未残留。修正长标题的平衡换行并复验公共检查与根/子路径回归。首页、Core、Shell、通用页面桥、依赖与 NEED/AGENTS 均未改动；27 个基线受保护文件哈希一致。正式 dist 保留根路径构建，测试服务器已随 runner 关闭。公开状态不保护 Markdown 引用的原始资源，具体限制见内容指南；未实现 Private、完整移动端或线上发布。技术完成后停止，等待用户验收。

### Milestone 2.7 — 四模块内页背景视觉修订

**Status**：Done  
**Dependencies**：2.2–2.6 已完成；用户明确要求模块内页背景可以有不同风格。

#### Goal / Scope

Me 暖白柔光、Think 纸感阅读底色、Build 工程网格、Keep 灰绿柔和背景。模块自己的样式覆盖本模块列表与详情，细节集中在外围，保持内容页干净与文字清晰。

#### Tasks / Files / Technical Approach

ModuleShell.astro 仅增加通用 module-page 包裹层和来自元数据的 data-module 标记，不含模块专属分支。各模块新增 background.css，由本模块 Astro 页面导入；用静态 CSS 渐变、低对比纹理和系统明暗主题实现。更新受影响的截图验证及本计划记录。

#### Non-goals

不改首页、Compass、Spotlight 设计、真实内容或统计/搜索逻辑；不添加主题切换、连续动画、图像库、新导航或完整移动适配，不进入 Phase 3。

#### Done Criteria

- [x] 四模块有可辨别但克制的背景风格；本模块首页和详情保持一致。
- [x] 明暗主题下正文、代码、链接、焦点和 Spotlight 可读，背景不拦截操作。
- [x] 长文滚动无断层，基本窄屏无溢出；背景保持静态，减少动态效果正常。
- [x] lint、typecheck、test、build 与相关 e2e / 页面 smoke test 全通过。
- [x] 共享 Shell 不包含模块专属样式或分支，首页与真实内容保持原样；完成记录更新后停止。

#### Verification / Completion Record

执行 npm run lint、npm run typecheck、npm run test、npm run build、npm run test:e2e；审阅四模块列表与详情的明暗截图，检查窄屏、长文、Home 返回、搜索/关闭恢复焦点及来源链接。通用包裹层改动需在子路径重新构建并运行相关浏览器回归。

完成日期：2026-10-13。Me 暖白柔光、Think 纸感与外围细纹、Build 冷蓝工程网格、Keep 灰绿柔光与外围弧线均由模块内 background.css 提供，模块页面自行导入。ModuleShell 只增加通用 module-page / data-module 包裹层，无模块专属判断；背景是静态 CSS，装饰不响应指针。移除了第一轮 Me 穿过正文的弧线。首页、真实内容、Core、搜索行为与依赖未改动。

验证：本地 npm CLI 执行 npm run lint、npm run typecheck（67 files，0 errors / warnings / hints）、npm run test（18 项）、npm run build（8 页）和子路径构建，全部退出 0；根路径与 /personal-space/ 各 19 项 e2e 通过。截图增加七个内页的明暗、搜索、375px 窄屏与长文实际滚动页尾；为排除主题颜色过渡帧，等待搜索按钮与正文前景色一致并禁用截图动画后，根/子路径各复验 4 项内容用例，全部通过。导航、来源链接、搜索打开/关闭及焦点恢复无回归，错误与资源 404 检查通过。

页面证据保存于 .cache/module-background-me.png、module-background-think.png、module-background-build.png、module-background-keep.png；审阅明暗主题、代码与长文页尾、搜索面板、基本窄屏防溢出。未重复与纯背景无关的内容增删/第五模块隔离构建。Astro 验证进程继续使用 ASTRO_TELEMETRY_DISABLED=1，浏览器缓存位于 .cache/ms-playwright，未改全局设置。正式 dist 为根路径产物；NEED.md 与 AGENTS.md 哈希不变。技术检查完成后停止，等待用户视觉验收；完整移动适配仍属后续范围。

### 待输入与风险处理

| 事项 | 默认处理 | 何时需要确认 |
| --- | --- | --- |
| Phase 1 最终视觉 | 用户授权继续 Phase 2，当前基线已接受；本阶段没有重做首页 | 已满足 |
| Me 资料、文章、项目、收藏 | 用户已提供首批真实原文，四模块已接入；后续仍不代写事实 | 首批已满足；新增内容按指南维护 |
| 中英文与文风 | 沿用用户原文，界面维持既有语言，不新增 i18n | 用户有明确偏好时 |
| 文章日期、项目成果 | 使用用户提供的 2026-10-13 与 NEMU 说明/时间范围；不推测额外成果 | 首批已满足 |
| Markdown 导入与 Node 测试 | 构建加载与纯逻辑测试分离，真实编译用集成验证 | 2.3 接入时，发生契约冲突先报告 |
| 未发布内容的资源 | 仅过滤页面不足以证明资源不输出；用隔离探针审查产物，不把草稿当作保密空间 | 2.3 及实际引入资源的模块 |
| 无真实内容的模块 | 技术上支持空状态，但不能自行把内容交付改成空模块 | 缺少素材时由用户决定，Phase 2 完成前记录 |
| 域名、GitHub 仓库、部署 | 维持本地生产预览与 base 兼容 | Phase 3 再确定 |

**本次规划交付记录（2026-10-13）**：只完善 PLAN.md，未创建内容指南或任何实现文件。检查 2.1–2.6 的目标、Scope/Non-goals、文件范围、Done Criteria、Verification、依赖与状态一致性；本次为文档任务，不运行工程测试或构建，不将这些检查标为通过。Phase 2 及全部 milestone 均保持 Pending。

## Open Questions / Risks

### NEED.md 审查结果

没有发现需要推翻整体设计的硬冲突，主要存在措辞张力和未定义的实施边界。

| 依据 | 问题或表述差异 | 处理方式 |
| --- | --- | --- |
| §33、§34 | Search 被称为唯一横向接口，count 又是第二个统一能力 | Search 为横向检索，count 为框架统计能力；均不建立模块关系 |
| §20、§52 | 禁止 Navbar，但模块页保留 HJK、模块名、搜索 | 作为最小 Shell，不增加其他全局导航 |
| §4、§6、§42、§50 | 示意图模块数量和位置不同 | 初始四模块；位置根据 Registry 和 N 计算 |
| §25、§26、§49 | Registry 位于 Core，但新增模块要求不改 Core | 约定式自动发现，不维护中心注册列表 |
| §23、§33 | count/search 参数、返回值与运行位置未定义 | Phase 1 为构建期接口；浏览器查询公开投影 |
| §8 | 未定义全零或相同数量的归一化 | 对数值除以最大值，并明确全零行为 |
| §49 | 推荐结构未包含 Astro 页面入口和配置 | 补充必要工程文件与通用路由桥 |
| §36–§41、§47 | Private 缺少与静态部署配合的保密方案 | 延后专项设计；Phase 1 不实现或加载私有数据 |

规划时的目录与需求的差距是目标工程尚未建立，当时不存在可以判定违背需求的源码。NEED 描述完整目标，未明确 Phase 边界；本计划依照用户要求将 Private、完整移动端与复杂模块能力移出 Phase 1。实施后的实际状态以 milestone Completion Record 为准。

### 已确认与默认选择

- 用户已确认 Phase 1 允许少量明确标注的公开演示内容。
- 用户已确认 Phase 1 以本地生产预览验收，真实 Pages 发布后置。
- 默认文案沿用 NEED 的英文示意，内容支持中英文，不建立 i18n 系统。
- 默认搜索模块名称、标题和描述；正文全文搜索不属于 Phase 1。
- 默认使用系统主题、系统字体与 SVG 资源，不增加首页设置入口。
- lint 由 1.1 建立；测试随真实被测功能接入，后续 milestone 必须运行已有测试。

### 后续再决定的事项

1. **真实内容与统计口径**：Phase 2 需要真实公开资料；复杂内容类型加入后的计数方式由所属模块定义并记录。
2. **发布地址**：仓库、根站点或项目站点、自定义域名在 Phase 3 确认；Phase 1 提前验证子路径兼容。
3. **Private 保密要求**：隐藏入口和 isVaultUnlocked 无法保护已公开发布的明文；Private 源文件、载荷、搜索和资源保护必须先设计。
4. **Private 接口影响**：Phase 1 不预设访问状态参数；当前Private计划见新的Phase 4，需要最小浏览器契约与投影刷新扩展，不承诺只加布尔状态即可保密。
5. **更多模块标签布局**：Phase 1 重点验证四至七模块；大量模块的标签避让在真实需求出现后处理。
6. **Glass 视觉与性能**：简单背景下折射感可能较弱，通过渐变、边线和高光建立辨识度，避免持续动画或重型渲染。

以上后续问题不阻塞 Phase 1，也不授权提前实现对应功能。

### 技术参考

- [Astro 路由](https://docs.astro.build/en/guides/routing/)
- [Astro 批量导入](https://docs.astro.build/en/guides/imports/)
- [Astro 静态端点](https://docs.astro.build/en/guides/endpoints/)
- [Astro 客户端脚本](https://docs.astro.build/en/guides/client-side-scripts/)
- [Astro GitHub Pages 部署](https://docs.astro.build/en/guides/deploy/github/)
- [MDN 模态 dialog](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal)
- [GitHub Pages 发布说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Design Revision — 统一玻璃与独立内容空间

授权日期：2026-10-13。用户明确要求按 DESIGN.md 修改并测试，授权顺序执行 D1–D7；每项验证通过后进入下一项，整个修订完成后停止。此授权替代此前只换内页背景的范围。旧 Phase 2 排除项在本轮仅对 Keep 平面分类、Think 轻量形式和 Build 本地阶段/更新/问题作已批准例外；复杂分类、后台、聚合、Private、完整移动/部署保持后续范围。

设计方向以 DESIGN.md 为依据，路线/状态仍以本文件为准。样稿检查并入 D2，最终用户视觉验收保留在全部修改之后；不得声称截图自检即用户批准。

| 单元 | 名称 | 状态 | 依赖 |
| --- | --- | --- | --- |
| D1 | 返回状态 | Done | 既有 Phase 1/2 |
| D2 | 共享材质与 Home | Done | D1 |
| D3 | Me 个人主页 | Done | D2 |
| D4 | Keep 分类收藏夹 | Done | D3 |
| D5 | Think 思想空间 | Done | D4 |
| D6 | Build 项目档案 | Done | D5 |
| D7 | 整体回归 | Done | D6 |
| D8 | 收起动画与Me平均统计 | Done | D7；用户本轮两项指令 |

### D1 — 返回状态

**Status**：Done

- **Scope / 技术方案**：指针/焦点分开；恢复时清理临时状态。
- **Files**：Compass.astro、acceptance.spec.ts；PLAN.md 仅同步本项与汇总状态。
- **Non-goals**：不增加本项以外模块行为、不编造内容、不部署；保留 Core/Registry/search 契约和模块独立。
- [x] **Done Criteria**：鼠标返回无残留；键盘焦点及计数正确；lint/typecheck/test/build 与受影响浏览器 smoke 全通过。
- **Verification**：鼠标四模块/前进后退/键盘/Spotlight/触摸/缓存恢复；公共检查。
- **Completion Record**（2026-10-13）：分开指针/键盘/恢复状态，移除普通 focus 等同 Hover 的样式；lint/typecheck（67 files 0诊断）/18 unit/build 8页/10 e2e 全部退出0。独立完整 Chromium 启用 bfcache，pageshow.persisted=true，鼠标/Spotlight/触摸返回通过。修复 Enter 导航等待的测试时序；默认 Playwright 服务器 teardown 超时，保留配置与断言、改由独立本地服务连接后复跑通过。日志 .cache/D1-verification.log。未宣称原环境普通回退稳定复现。

### D2 — 共享材质与 Home

**Status**：Done

- **Scope / 技术方案**：中性环境、光学边缘、稳定阅读层；共享 Shell 不分支。
- **Files**：theme.css、glass.css、Base/ModuleShell、index.astro、Compass.astro；PLAN.md 仅同步本项与汇总状态。
- **Non-goals**：不增加本项以外模块行为、不编造内容、不部署；保留 Core/Registry/search 契约和模块独立。
- [x] **Done Criteria**：干净 Home 与可读 Spotlight；共享控制材质；动态 N/count 不变；lint/typecheck/test/build 与受影响浏览器 smoke 全通过。
- **Verification**：明暗1280/1440/375、减少动画/blur降级、五首屏构图样稿；公共检查。
- **Completion Record**（2026-10-13）：统一中性主题、共享玻璃控制、Home 环境与 Compass 标签，Shell 改为中性可扩展宽度；lint/typecheck/18 unit/build/17 e2e 全部退出0。审阅 Home/Spotlight 明暗、1440/1280/375、减少动态与 blur 降级；五空间明暗构图样稿保存 .cache/design-study-*.png 并自检，未记录为用户视觉批准。日志 .cache/D2-verification.log。

### D3 — Me 个人主页

**Status**：Done

- **Scope / 技术方案**：身份首屏、个人玻璃视觉对象、原文叙述。
- **Files**：me/Profile.astro、me/background.css；PLAN.md 仅同步本项与汇总状态。
- **Non-goals**：不增加本项以外模块行为、不编造内容、不部署；保留 Core/Registry/search 契约和模块独立。
- [x] **Done Criteria**：原文完整；个人身份明确；无伪造照片/履历；lint/typecheck/test/build 与受影响浏览器 smoke 全通过。
- **Verification**：真实内容、链接/焦点、明暗/窄屏；公共检查。
- **Completion Record**（2026-10-13）：Me 改为姓名/动机首屏、HJ 玻璃个人视觉、原文叙述及三个真实兴趣方向；保留全文与普通模块链接。lint/typecheck/18 unit/build/Me浏览器 smoke 全部退出0，明暗/窄屏/搜索/焦点截图自检通过，原文及南京大学身份核对无改写事实。日志 .cache/D3-verification.log。

### D4 — Keep 分类收藏夹

**Status**：Done

- **Scope / 技术方案**：本地平面分类、URL 筛选、站内详情/新标签来源分离。
- **Files**：keep 页面/数据/类型/样式、单元/e2e、内容指南；PLAN.md 仅同步本项与汇总状态。
- **Non-goals**：不增加本项以外模块行为、不编造内容、不部署；保留 Core/Registry/search 契约和模块独立。
- [x] **Done Criteria**：只显示真实分类；刷新/回退正确；来源动作清楚；lint/typecheck/test/build 与受影响浏览器 smoke 全通过。
- **Verification**：多分类 fixture、非法参数、刷新/回退、键盘、来源新标签、base/count/search；公共检查。
- **Completion Record**（2026-10-13）：Keep 改为分类目录、域名/类型资源卡，站内说明和外部来源独立，外链新标签；URL 筛选及详情返回保留类别。lint/typecheck（69 files）/19 unit/build/8 e2e 退出0；隔离副本两类三项收藏构建及1项子路径浏览器 probe 通过，覆盖过滤/刷新/回退/非法分类/键盘和来源新标签。无公开收藏时脚本跳过控件初始化，避免空集合报错。明暗/窄屏截图自检。真实集合仍1项；日志 .cache/D4-verification.log。

### D5 — Think 思想空间

**Status**：Done

- **Scope / 技术方案**：写意首屏、轻量文章/随记字段、安静正文。
- **Files**：think 页面/样式、metadata.ts、相关测试/指南；PLAN.md 仅同步本项与汇总状态。
- **Non-goals**：不增加本项以外模块行为、不编造内容、不部署；保留 Core/Registry/search 契约和模块独立。
- [x] **Done Criteria**：现有文章完整；没有假随记；艺术不干扰正文；lint/typecheck/test/build 与受影响浏览器 smoke 全通过。
- **Verification**：公式/长代码/图像、入口、明暗/窄屏、减少动态；公共检查。
- **Completion Record**（2026-10-13）：Think 改为写意标题、局部光学花瓣与分区阅读；正文维持窄列，增加返回入口，可选 article/note 且没有空随记区。降低共享默认标题优先级，修复模块字号被覆盖；复验 lint/typecheck/20 unit/build/15 e2e 全退出0。隔离 article+note 构建与2项子路径 probe 通过，随记列表全文及详情可读；明暗、公式、长文、375px及减少动态检查通过。正式文章原文未改；日志 .cache/D5-verification.log。

### D6 — Build 项目档案

**Status**：Done

- **Scope / 技术方案**：项目概览、可选真实阶段/更新/问题；模块本地维护。
- **Files**：build 页面/类型/数据/样式、单元/e2e、指南；PLAN.md 仅同步本项与汇总状态。
- **Non-goals**：不增加本项以外模块行为、不编造内容、不部署；保留 Core/Registry/search 契约和模块独立。
- [x] **Done Criteria**：现有成果有层级；不推算状态/百分比或补造历史；lint/typecheck/test/build 与受影响浏览器 smoke 全通过。
- **Verification**：数据契约与 fixture、局部跳转/展开、缺少记录、count/search/base；公共检查。
- **Completion Record**（2026-10-13）：Build 改为项目目录和概览/技术档案，增加可选本地阶段、更新与问题，项目内跳转和原生展开；正式 NEMU 不补造记录，原文保留。lint/typecheck/21 unit/build/8 e2e 全退出0；含真实测试阶段1/2、逆序日期更新、开放/解决问题的隔离构建及3项子路径 probe 通过，覆盖键盘展开与窄屏。count/search 仍每项目一次，实际数据1项。明暗截图自检；日志 .cache/D6-verification.log。

### D7 — 整体回归

**Status**：Done

- **Scope / 技术方案**：合并视觉/行为/架构验证，不扩大功能。
- **Files**：tests、PLAN.md、DESIGN.md、维护文档；PLAN.md 仅同步本项与汇总状态。
- **Non-goals**：不增加本项以外模块行为、不编造内容、不部署；保留 Core/Registry/search 契约和模块独立。
- [x] **Done Criteria**：全部受影响入口/详情可用，模块独立，状态一致；lint/typecheck/test/build 与受影响浏览器 smoke 全通过。
- **Verification**：根/子路径全套、第五模块、公开/隐藏/空/删除、明暗截图、前进后退；公共检查。
- **Completion Record**（2026-10-13）：全套 lint/typecheck（69 files，0 errors/warnings/hints）/21 unit/root build（8页）全部退出0；根路径与 /personal-space/ 各21项 e2e 退出0。隔离第五模块类型检查（48 files 0诊断）/构建/1 e2e、内容新增/隐藏/全零/删除构建及 Markdown资源1 e2e/空集合1 e2e（额外四页无脚本错误）、Keep/Think/Build设计样本3 e2e均通过。真实完整Chromium pageshow.persisted=true，鼠标无旧焦点高亮，触摸与Spotlight返回通过。审阅48张8页面×明暗×1440/1280/375截图及五首屏并排图，未溢出；基础背景正文/辅助对比度浅色11.75/4.92、深色13.75/8.47，未将此等同于所有玻璃像素的对比度。保护检查确认Core、依赖/构建配置、AGENTS、Me/Think/Build原始数据不变，Keep只增加分类/类型。default测试服务器teardown在受限Windows超时，增加可选E2E_EXTERNAL_SERVER以单独管理生命周期，全部断言与默认自动服务保留。测试服务收尾单独验证。截图在 .cache/design-final，公共日志 .cache/D7-verification.log，辅助日志 .cache/D7-aux-verification.log。完整移动、部署、Private未实现；NEMU未提供的日志/阶段/问题仍不编造。技术完成，停止等待用户视觉验收。

### D8 — Spotlight 关闭衔接与 Me 平均统计

**Status**：Done

**Dependencies**：D1–D7 Done；用户认可现有视觉，并明确提出本轮两个细节。

- **Scope / 技术方案**：Spotlight 遮罩/Esc/关闭按钮在模态仍打开时收起面板与遮罩，结束后关闭并还焦；减少动态立即关闭，快速重开取消旧关闭任务。Me 声明 compassStatistic=peer-average，Compass 通用投影将其他启用模块的真实 count（包括零）取算术平均，再 log1p 映射；Hover/可访问名称标注平均值，最多两位小数，几何保留完整精度。无其他模块为0。模块实际 count、search 和资料不变，不硬编码模块 id。
- **Files**：spotlight.ts、glass.css、geometry.ts、Compass.astro；最小 ModuleMetadata 字段和 Registry 校验/公开投影；me/module.ts；相关单元/e2e；NEED/PLAN/DESIGN/architecture/content-guide 的对应约定。
- **Non-goals**：不重做视觉或模块排版、不升级依赖、不改内容/搜索结果结构、不建聚合内容系统或进入后续 Phase。
- [x] **Done Criteria**：三种关闭路径有连续动画，完成后还焦/解锁正确；动画中重开无延迟误关；减少动态正常；Me 数值/几何/读数都用真实其他模块平均且可辨认，实际 count 不被伪造；公共验证通过。
- **Verification**：lint、typecheck、test、build、根/子路径 e2e；动画中实际尺寸/不透明度、模态/焦点、重开/减少动态；零/无同伴/小数/增删/排序单元测试；隔离不等数量与第五模块浏览器验证，保持实际统计/搜索数量；动画帧截图。
- **Completion Record**（2026-10-13）：Spotlight 增加220ms收起与遮罩淡出，从当前transform/opacity衔接；减少动态直接关闭，快速重开取消旧任务并续接遮罩，动画结束同步解除滚动锁/还焦，忽略旧close事件对新打开面板的影响。Me 通过compassStatistic=peer-average声明，通用Compass用其他启用模块原始整数count算术平均后log1p映射，读数/可访问名称标注平均，最多2位小数；无同伴0，资料真实count/search不变。npm run lint/typecheck（69 files 0诊断）/test（23项）/build（8页）全部退出0；E2E_EXTERNAL_SERVER=1下根/子路径各23 e2e退出0。隔离不等数量2/1/3验证Me显示2且资料count=1，4项设计probe；第五模块typecheck/build和1浏览器验证通过。新动画测试确认模态/滚动锁保持到收起结束、三种关闭方式、快速重开和减少动态；单独同帧重开smoke保持open/locked/expanded/inputfocus，真实bfcache/触摸/Spotlight返回通过。修复首次测试服务启动晚导致的8项连接失败；最终复验发现原生close事件异步清锁竞态，已同步清理并复跑所有公共门槛与相关路径。审阅closing-frame.png；日志 .cache/D8-verification.log，失败历史保留D8-initial-verification.log与D8-close-race-verification.log。原始四份素材、依赖、AGENTS及页面布局未改。当前其他三个模块各1，Me平均也为1。完成后停止，未执行后续Phase。

## Phase 3 Detailed Plan

**规划日期**：2026-10-13。  
**阶段状态**：Done；3.1–3.8全部完成，OPPO最终复查通过，已停止。

**本轮授权**：2026-10-13用户授权实施Phase 3，先用Git保存当前版本为v0，允许覆盖 https://hjk202.github.io/ 的已有demo。逐项执行和验证，不扩展未来Phase。  
**新增约定**：用户要求移动端保持简单、能看能用，并明确同意把OPPO Find X7 Ultra默认浏览器的真机验收集中在上线后3.8；3.3/3.4先完成自动化与模拟验收，未实测手机不得标为已通过。Git v0已保存于ad0e0af，本项前提前初始化Git是用户明确授权的例外。  
**需求依据**：NEED.md 第43节手机端、第44–46节材质与动画、第47节技术栈，以及第55–56节获准修订；视觉基线为 DESIGN.md 与 D1–D8 的已完成结果。用户已认可当前效果，本阶段不重新设计网站。

### Overall Architecture / 本阶段的目标与边界

Phase 3 把已经成立的个人空间变成手机上可用、可公开访问、可重复更新的静态网站。继续使用 Astro、TypeScript、模块自己的内容模型和构建期公开投影；不更换框架、不增加后端或第三套导航。

必须保持的体验：

- Home 仍只有 Compass、Spotlight 和少量身份信息；手机保留等角度 N 边形，不变成列表菜单。
- 全站保留同一套 Quiet Liquid Glass 控制材质，模块仍各有个人主页、分类收藏夹、写意阅读与项目档案的布局。
- Spotlight 的搜索、输入法、焦点、开合动画、滚动锁和回退行为保持 D8 语义；移动调整只解决布局和输入可用性。
- Me 的 Compass 平均值继续来自其他启用模块的真实 count；真实资料计数、搜索投影和动态注册不变。
- 新模块仍由约定自动接入。移动布局与页面元信息都不能靠在 Shell/Compass/Spotlight 中写模块 id 分支实现。

正常浏览保持 Home → Module → Content；查询仍由 Spotlight 完成。新增的 404 是错误页面，favicon 与元信息是发布基础，不形成内容模块或新的导航入口。

### 当前基线与实际缺口

以下是本轮源码和文件审阅结果；D8 的测试数字是此前完成记录，本轮没有重新运行工程检查。

| 已有能力 | 当前实际状态 | Phase 3 要补齐什么 |
| --- | --- | --- |
| 工程与静态输出 | Astro 7.3.8；精确依赖与锁文件；Node 版本文件为22.23.2，packageManager为npm10.9.8 | 干净环境、构建与发布使用一致且受支持的版本 |
| 公开内容 | 四模块各1份资料/条目；当前8个HTML页面；Me平均值也为1 | 保持真实素材，加入发布资产时不改变内容计数 |
| 布局 | 已有600/760/800px等局部断点与375px防溢出检查 | 更窄/横屏/平板、触摸目标、安全区域、缩放与长内容 |
| Spotlight | 原生dialog、懒加载索引、输入法、开合与还焦已实现 | 真机软键盘、可视区域变化、长结果列表与浏览器兼容 |
| 统计与扩展 | Registry、根/子路径、第五模块与平均值已有测试 | 在移动变化、元信息与部署配置之后持续回归 |
| 页面head | Base目前仅有charset、viewport与title，html为en；ModuleShell详情沿用模块级title | 中文为主的文档语言、内容页标题/摘要、正式地址下的canonical |
| 错误与品牌资产 | 当前无正式public资产目录、404.astro或发布工作流 | 简洁favicon、真实404及最小发布元信息 |
| 线上条件 | 当前没有.git；未确认GitHub目标、域名、Pages设置 | 先准备可审阅的本地产物，再按明确发布授权配置真实目标 |
| 验证 | D8记录23项单元测试、根/子路径各23项e2e；默认配置为Chromium | 移动专项、多引擎重点路径、真机证据、线上与更新闭环 |

375px截图、桌面WebKit测试与触摸模拟都有价值，但不能据此宣称真实手机键盘已经测试。Playwright提供设备参数和触摸等模拟能力；本项目仍另设真机验收。[Playwright设备模拟说明](https://playwright.dev/docs/emulation)

这不是需要推翻架构的冲突。最小补齐方向是继续使用现有Shell、静态路由桥和模块内样式，在对应milestone中修补实际缺口。此前Phase 2对分类/项目记录的排除条款描述当时范围；D4–D6已有明确授权并完成，此阶段不重复实现。

### Phase Roadmap / Milestone 状态与依赖

| Milestone | 目标 | 状态 | 前置依赖 |
| --- | --- | --- | --- |
| 3.1 | 发布基线、支持矩阵与验收清单 | Done | Phase 1、2、D1–D8；用户批量授权 |
| 3.2 | 移动Home与Compass | Done | 3.1 |
| 3.3 | 移动Spotlight与软键盘 | Done | 3.2 |
| 3.4 | 四模块移动阅读与局部操作 | Done | 3.2、3.3 |
| 3.5 | 页面元信息、favicon与404 | Done | 3.4 |
| 3.6 | 可重复静态构建与发布管线准备 | Done | 3.5 |
| 3.7 | 首次GitHub Pages公开发布 | Done | 3.6；真实Actions与线上验证通过 |
| 3.8 | 真机、线上与内容更新闭环验收 | Done | 3.7 |

默认按上表顺序执行，一次一个milestone。本轮用户已明确授权批量执行Phase 3；仍逐项验证和更新状态，失败先修复，不能越过门槛。

Phase 3全部必需项完成后停止，交用户验收。Phase 4的新增领域/深层模块能力和Phase 5的Private仍保持Pending，需要新的明确指令。

### 公共验证、设备矩阵与发布停点

每个实施milestone运行现有 npm run lint、npm run typecheck、npm run test、npm run build，以及受影响的 npm run test:e2e/生产页面smoke；记录命令、实际退出结果与证据。执行时读取实际package.json，不预先发明尚不存在的npm脚本。

3.1确定以下建议矩阵的具体设备与可运行环境，不扩大为所有尺寸与所有浏览器组合的笛卡尔积：

| 场景 | 最小覆盖 |
| --- | --- |
| 手机竖屏 | 320/360px边界；375/390px代表尺寸；430px大屏 |
| 手机横屏/短窗口 | 一个真实代表横屏与约667×375的短高度边界 |
| 平板与断点 | 768px平板；实际布局断点两侧 |
| 桌面保护 | 1280与1440px；现有布局不能被移动修复破坏 |
| 输入与偏好 | 触摸、键盘、中文输入法；明暗主题；减少动态效果；模糊降级 |
| 浏览器 | 保留Chromium完整回归；增加WebKit重点移动路径，其他引擎按实际问题做定向smoke |
| 真机 | 至少一台真实手机，目标为iOS Safari或Android Chrome；另一平台尽可能实测，否则明确记录未实测 |
| 地址 | 根路径、/personal-space/模拟子路径与最终真实发布base |

页面允许正常纵向滚动。代码/公式可在自己的内容块内横向滚动，不能让整个页面横向溢出。常用竖屏Home优先保持单屏；短横屏可以有限纵向滚动，不能为“绝不滚动”把标签和触摸目标缩得不可用。

既有受限Windows环境可能出现自动测试服务teardown超时，可使用已实现的E2E_EXTERNAL_SERVER并单独管理本地服务。必须先确认服务就绪、测试后关闭服务；未提供外部服务时不得打开此选项。CI优先使用默认自动服务，不吞掉退出错误。

3.6只准备本地配置、工作流与发布候选；3.7才操作远程目标和公开发布。之后明确指定3.7或明确授权包含发布的批次即构成对应授权；已有授权不重复请求。仅规划或仅移动适配不授权远程建仓、推送、改变仓库可见性或上线。

### Milestone 3.1 — 发布基线、支持矩阵与验收清单

**Status**：Done  
**Dependencies**：D1–D8已完成且用户认可当前效果；本轮已授权。

#### Goal / Scope

建立可以逐项验收的Phase 3基线，确认现有工程和真实资料状态。发布地址与设备信息可以先登记为待输入，不为取得这些信息修改页面或提前部署。

#### Tasks / Technical Approach

- 阅读并核对源码、测试、版本文件、公开集合、现有完成记录；复跑已有工程验证，登记8页/四份资料基线。
- 保存必要的桌面与375px参考截图，记录当前可用行为及移动问题，不把猜测记为已复现bug。
- 建立设备/浏览器/地址/主题矩阵和真机手工步骤；确认哪项可自动化，哪项必须由真实设备检查。
- 登记GitHub账户/仓库/可见性/发布分支/预期地址/可用测试手机；未提供的信息写明待输入，不填虚假账户或域名。
- 核对.node-version与packageManager；优先沿用已有版本约定，记录本机与未来CI差异，不升级依赖。
- 新增一份操作型发布清单，记录如何验证；Phase、范围与状态仍以本PLAN为准。

#### Files

PLAN.md；docs/release-checklist.md（获准执行本项时创建）；必要的README使用说明。源码、配置、依赖和测试逻辑保持不变。

#### Non-goals

不修移动布局、不写部署工作流、不初始化Git、不发布、不增加内容或改变视觉方向。发现基线失败先报告；不是借机修复其他milestone的授权。

#### Done Criteria

- [x] 真实页面、资料、统计与既有验证结果核对一致；基线失败没有被当作通过。
- [x] 支持矩阵、真机步骤、截图基线与可复现问题清单明确。
- [x] 发布目标的已知项与待输入项分开；没有假定用户账号、仓库、分支或域名。
- [x] 公共验证与基线smoke通过，完成记录列明环境和限制。

#### Verification

运行公共工程检查与现有浏览器回归；从Compass和Spotlight访问全部真实目标，检查刷新、Home返回、Me平均读数与开合还焦。核对清单和源码/文档字段及路由；登记实际手机型号、系统与浏览器版本，尚未实测标为未实测。

#### 后续依赖 / Completion Record

为3.2–3.8提供验收输入。**Completion Record（2026-10-13）**：新增docs/release-checklist.md，记录8页/四份真实内容、Node22.23.2/npm10.9.8、v0=ad0e0af、用户指定的旧demo地址与手机、支持矩阵与基础真机步骤。npm run lint、typecheck（69 files，0诊断）、test（23项）、build（8页）均退出0；本次根路径23 e2e退出0，覆盖全部真实目标、Me平均值、搜索/焦点/动画/返回。截图3.1-home-1440/375/320/667.png与测量3.1-mobile-baseline.json在.cache；已审阅桌面/375截图。实测375px节点目标约27px、横屏667×375节点约14px，列为3.2问题；没有提前修复。两次浏览器执行因沙箱本机网络隔离失败，保留失败证据；服务和浏览器同环境并先验证HTTP200后全部通过，日志.cache/3.1-e2e.log。源码未改。GitHub代理不可达/直连重置，目标分支与Pages配置仍待核验；真机按用户确认集中到3.8，不把模拟当实测。

### Milestone 3.2 — 移动Home与Compass

**Status**：Done  
**Dependencies**：3.1 Done。

#### Goal / Scope

让入口在手机上保持精确、清楚、能单次触摸进入模块；保留对称几何与玻璃材质，兼顾短窗口和平板，不增加移动菜单。

#### Tasks / Technical Approach

- 按实际可用宽高设置Compass与身份信息的布局，优先CSS流式尺寸、合理最小值和安全区域留白。
- 保持SVG的等比缩放、等角度N边形与原有统计映射；不能拉伸图形、为对称修改数量或删掉真实模块。
- 让模块标签、节点与实际触摸命中区一致；触摸目标以至少44 CSS px为本项目目标，邻近目标不重叠。
- 验证4–7模块与较长名称。只修改通用几何/排版，不识别具体模块id或改变Registry顺序。
- 鼠标强调、键盘焦点与触摸激活分别保持既有语义；触摸单击即进入，不用第一次点击只显示Hover、第二次才导航。
- 在安全区域、浏览器工具栏变化和横屏中保持入口可达；短高度必要时允许Home合理滚动。
- 保持Me的平均规则与Avg读数，并保护D1/D8回退恢复行为。

#### Files

src/pages/index.astro、src/shell/home/Compass.astro；必要时geometry.ts、Shell通用布局/主题；tests/e2e的移动入口用例与现有几何测试；发布清单和PLAN.md。

#### Non-goals

不重做背景和材质，不增加Dock/Navbar/Sidebar/长按Private，不固定为四模块或将Compass替换为列表。

#### Done Criteria

- [x] 建议手机尺寸与短横屏中，标签可读、命中可靠、页面无横向溢出。
- [x] 4–7模块通用布局成立，长标签没有错位/重叠，真实数量和Me平均语义不变。
- [x] 单次触摸、键盘、普通鼠标和返回恢复均可用；不存在残留选择状态。
- [x] 1280/1440px现有构图保持；明暗、减少动态与模糊降级可用。
- [x] 公共验证与专项smoke通过，已可取得的真机证据如实记录。

#### Verification

公共工程检查；Chromium重点尺寸、WebKit代表移动场景；隔离第五模块与4–7节点/长名称探针；至少检查节点与标签实际CSS命中尺寸及相邻区域。截图审阅竖屏、横屏、明暗、断点两侧，执行Home→Module→返回路径。不能仅用图形boundingBox代替点击可用性。

#### 后续依赖 / Completion Record

3.3依赖已稳定的移动入口和触发位置；3.4复用Shell基础。**Completion Record（2026-10-13）**：Home加入安全区域留白，Compass短窗口保留最小可用尺寸、允许纵向滚动；移动节点/换行标签目标最小约44.12 CSS px，普通标签更清楚，长名称保持原始大小写并换行。N边形/原始统计/Me平均值与桌面布局保持。npm run lint、typecheck（71 files，0诊断）、test（23项）、根/子路径build均退出0；根与子路径各32 e2e、WebKit移动9 e2e全部退出0。320/360/390/430、断点639/641、短横屏667×375、平板768×600/1024实际点击节点与标签、返回无残留均通过。tests/verify-mobile.mjs隔离4–7模块，在两引擎检查长名称、44px命中、不同模块区域不重叠、真实跳转和原始src哈希，8个组合通过；修复探针发现的长名称换行溢出，保留初始失败日志。审阅隔离4/7节点截图；测量/截图目录见.cache/mobile-probe-output.txt，日志.cache/3.2-*.log。真机按用户约定留在上线后3.8；真实内容、依赖与Core未改。

### Milestone 3.3 — 移动Spotlight与软键盘

**Status**：Done  
**Dependencies**：3.2 Done。

#### Goal / Scope

在真实手机键盘打开时仍能输入、看见结果并完成跳转，关闭后位置、焦点与滚动正确。保留D8收起/展开衔接。

#### Tasks / Technical Approach

- 面板约占屏幕90%宽度，输入/关闭区与结果区分开；结果区在可用高度内独立滚动。
- 优先CSS可用视口单位和安全区域处理键盘、工具栏与横竖屏；只有真机验证CSS不足时，才添加最小VisualViewport尺寸监听，并保留降级。
- 检查输入字号、系统缩放、中文候选、换行/搜索键；不禁用用户缩放，不用非标准键盘API锁定设备。
- 键盘展开、收起或旋转后重新确认面板范围与收起目标；不能让动画飞向过期坐标或让关闭按钮被遮挡。
- 保持无查询模块入口、加载/失败/重试、IME保护、长列表、选择、Enter跳转与焦点约束。
- 检查页面原有滚动位置、背景隔离、动画中关闭/重开、减少动态和系统返回；不得残留滚动锁。
- 补充移动专项回归，避免复制一套移动搜索实现或引入框架/路由器。

#### Files

src/shell/home/Spotlight.astro、spotlight.ts、src/shell/glass/glass.css；必要的通用布局；移动搜索e2e与现有spotlight/visual用例；发布清单和PLAN.md。

#### Non-goals

不改搜索算法/索引内容，不增加命令系统、全文/语义搜索、搜索历史或固定底部搜索栏。

#### Done Criteria

- [x] 正常与缩小可视高度模拟中，输入、关闭和至少一条结果均可达；长列表可滚动。真实软键盘检查按用户明确约定移至3.8。
- [x] 查询、重试、中文输入法事件保护、选择和跳转保持既有行为，不依赖桌面Hover。
- [x] 三种关闭路径及快速重开连贯，关闭后焦点/背景滚动恢复，没有旧任务误关。
- [x] 移动模拟完成输入、视口变化、旋转与跳转检查；OPPO真机验收按用户明确约定移至上线后3.8，模拟结果单独标注。
- [x] 桌面功能、明暗、减少动态和模糊降级无回归，公共验证通过。

#### Verification

公共工程检查；Chromium/WebKit重点移动搜索用例，覆盖长列表、网络失败、输入法与动画状态。按用户确认，真实OPPO Find X7 Ultra默认浏览器的系统键盘检查集中到上线后3.8，记录可视区域、面板/关闭按钮/结果是否被覆盖，以及旋转和关闭后的滚动状态。

按2026-10-13用户明确确认，3.3可在自动化与模拟门槛通过后完成，实际手机键盘验收移至上线后3.8。此处不能宣称真机已经通过；3.8对应标准保留。

#### 后续依赖 / Completion Record

3.4依赖可用的共享搜索；真机确认还作为3.8发布验收输入。**Completion Record（2026-10-13）**：Spotlight采用90vw、动态高度及flex独立结果滚动，手机关闭/重试44px目标，短高度隐藏辅助键盘提示并保留必要操作；inputmode/enterkeyhint为搜索。viewport声明resizes-content和safe-area，不禁用用户缩放、不添加VisualViewport监听；这是支持浏览器的最小选择，真实OPPO行为留3.8。[Chrome官方viewport行为说明](https://developer.chrome.com/blog/viewport-resize-behavior/)。收起时用当前布局重新计算目标，焦点恢复preventScroll避免短窗口页面跳到顶部；D8动画/重开语义保留。npm run lint/typecheck（71 files，0诊断）/test（23项）/build全部退出0；根/子路径各35e2e、WebKit12移动e2e通过。新增测试验证375×320可视高度、667×375旋转、中文composition事件、40结果独立滚动、失败重试、快速重开和原滚动恢复；正常视口/缩小高度分别检查，明确不是实机键盘。审阅WebKit短高度搜索截图，日志.cache/3.3-*.log。真实内容、搜索算法、Core、依赖未改。

### Milestone 3.4 — 四模块移动阅读与局部操作

**Status**：Done  
**Dependencies**：3.2、3.3 Done。

#### Goal / Scope

让四模块在手机上保留各自特点与清楚的信息顺序。只调整布局/可访问性和已有操作，不新增素材或内部能力。

#### Tasks / Technical Approach

| 模块 | 具体任务 |
| --- | --- |
| Me | 身份与动机优先；个人光学对象缩放/位置服从阅读；叙述、三个方向和公开链接有清楚顺序，不变成统一卡片流 |
| Keep | 分类控件可触摸、长类别可合理换行；资源标题/域名/用途易扫描；本站说明与外链分别可操作，刷新/回退保留分类 |
| Think | 温暖标题和艺术表达适当收敛，文章入口易找到；正文、随记、公式和代码在窄列清楚阅读，不把写意变成干扰 |
| Build | 项目目标/时间/状态/关键词有层次；技术档案可读；有真实数据的阶段、更新、问题与局部跳转/展开可用，没有空Tab |

- 优先使用各模块现有background.css和页面，按内容需要选断点，不把全部模块改回同一模板。
- 长标题、长URL、图片、公式与代码分别处理。代码/宽公式可在自身块内滚动，正文与整体页面不能横向溢出。
- 检查触摸目标、键盘焦点、200%文本/页面缩放、对比与阅读顺序；装饰不截获点击。
- 使用隔离多分类、文章/随记、项目阶段/更新/问题与空集合样本检查复杂状态，正式网站不填测试内容。
- 保持原文、slug、外链新标签提示、count/search及Me平均规则；不补造NEMU历史。

#### Files

src/modules/me、think、build、keep内的页面/样式；必要的Shell内容槽；tests/e2e、隔离fixtures/验证脚本；发布清单和PLAN.md。模型字段只在发现现有交互契约错误时最小修复，不顺便扩展。

#### Non-goals

不增加照片/文章/收藏/项目，不做分页、复杂分类、编辑后台、项目看板、自动同步、新模块或关系系统。

#### Done Criteria

- [x] 四模块首页和现有详情在手机/平板可读，仍能辨别各自用途与设计特点。
- [x] 长文本/标题/URL、公式、图片和代码不造成整页溢出；合理保留块内滚动。
- [x] 分类、外链、返回、项目局部操作、Home与Spotlight可用，键盘/触摸/放大字号均能访问；真机按用户约定留3.8。
- [x] 实际公开数量、搜索目标、原文与slug保持；空/单项/多项状态诚实。
- [x] 桌面截图与行为无回归，公共验证及模块smoke通过。

#### Verification

公共工程检查；手机代表尺寸与平板的真实四模块/详情巡检；复跑设计与内容隔离探针、根/子路径目标、分类回退、来源新标签、长代码/公式/图片和项目展开。按用户约定真实手机每模块一条浏览路径集中到3.8；截图覆盖明暗、窄屏、必要的长文中部与页尾。

#### 后续依赖 / Completion Record

提供3.5页面语义与3.6发布候选的稳定基础。**Completion Record（2026-10-13）**：修复Think在320px时6px横向溢出，保留光学花瓣；公式保持完整并允许自身横向滚动。Shell Home目标44px/安全区域、搜索按钮不收缩、移动文本链接44px；Me局部方向/入口可换行，Keep长分类和标题可换行且可触摸，Build局部导航/展开目标可用。没有统一四模块模板或增加内部能力。npm run lint/typecheck（71 files，0诊断）/test（23项）/根与子路径build全部退出0；根/子路径各38e2e、WebKit15移动e2e通过，覆盖7个真实模块/详情、320/375/768及200%字号压力探针（不等同于真机或完整无障碍认证）。隔离长分类/随记/长项目代码与阶段、更新、问题两引擎各5e2e通过；内容公开/隐藏/空/删除构建通过，图片/长代码/相对链接1e2e、全空模块1e2e通过。一次性探针命令的输出参数拼接导致No tests found，修正命令后实际执行通过，未删断言。审阅Me/Think真实320px及Keep隔离长分类截图；日志.cache/3.4-*.log。Git核对确认原始四份素材、slug、package/lock与Core不变；真机留3.8。

### Milestone 3.5 — 页面元信息、favicon与404

**Status**：Done  
**Dependencies**：3.4 Done。

#### Goal / Scope

补齐公开网页最小身份、内容页区分和错误返回能力。维持已认可的设计，不发展品牌资产或SEO系统。

#### Tasks / Technical Approach

- 中文为主的页面使用匹配的文档语言；保留现有英文模块名和混排，不建立i18n系统。
- 首页、模块页、内容页提供清楚且不同的title；description来自对应模块真实摘要/介绍，有缺省值但不编造作者事实。
- 内容页面的标题/摘要由模块页面适配器声明最小可选Web元信息，路由桥只转交，Shell/Base统一输出；不得在Shell解析四模块内部数据。
- canonical按真实site与base生成；Keep分类参数和项目锚点不制造重复canonical。未知生产origin时不输出假正式地址，用隔离测试origin验证模板。
- 新增一份简洁Compass视觉符号作为favicon，使用已有SVG/静态技术，不做实时统计logo生成。
- 创建404.astro，说明找不到页面，提供Home和既有Spotlight；未知路径返回HTTP404且界面资源正确，错误页标为不索引。
- 更新本机测试静态服务/路由检查，使未知路径能够检验实际404内容而不是只返回纯文字Not found。
- 默认不要求逐篇OG海报。若用户批准一张静态共用分享图，可在本项追加最小资产与标签；未准备图片时不能输出不存在的og:image，也不阻塞首次发布。

#### Files

src/shell/layout/Base.astro、ModuleShell.astro；src/pages/index.astro、404.astro、通用路由桥；四模块pages.ts；必要的ModulePage Web元信息可选字段/校验；public/favicon.svg；相关测试、tests/serve.mjs；README、发布清单与PLAN.md。

#### Non-goals

不改SearchResult、内容类型或Registry能力，不引入SEO库、每页图片渲染、品牌衍生系统、RSS/复杂sitemap、付费字体或全站语言切换。

#### Done Criteria

- [x] 正式页面title/description/lang与实际内容匹配；同模块的不同内容页可以区分。
- [x] 模块提供元信息，共享层没有模块专属分支；第五模块仍有合理缺省。
- [x] favicon资源在根/子路径可访问，404显示正确且返回真实404状态，Home/搜索可用。
- [x] canonical模板通过根/子路径测试；没有localhost或测试origin被当作生产地址。
- [x] 新资产不影响模块内容计数；元信息/404不包含测试素材或假事实。
- [x] 公共验证、页面head/错误路径与必要浏览器smoke通过。

#### Verification

公共工程检查；检查全部8个现有页面head及新增404（预期9个HTML，不新增公开内容条目）；测试深层未知URL、刷新、404内Home/搜索、favicon请求与子路径。缺正式地址时隔离测试site/base，实际生产值在3.6/3.7验证。审阅基本屏幕阅读顺序、焦点和装饰语义，不把有限检查声称为完整无障碍认证。

#### 后续依赖 / Completion Record

为3.6正式地址配置与3.7公开可访问性提供基础。**Completion Record（2026-10-13）**：ModulePage增加可选head.title/description与构建校验，各模块声明自己的公开摘要/标题，路由桥只转交，Base统一zh-CN/description/favicon和已知Astro.site下的无查询canonical；错误页noindex且不输出canonical。新增静态Compass favicon与404，测试服务加载实际404.html并返回404，错误页Home/搜索可用。隔离脚本同时复制public保证测试忠实。npm run lint/typecheck（73 files，0诊断）/test（24项）/build（9页）退出0；根/真实site子路径各40e2e、WebKit head/404 2e2e通过；第五模块typecheck/build/1e2e验证默认head与favicon。审阅320px错误页截图。未设site时不输出假canonical；另用CLI真实site=https://hjk202.github.io在独立root产物补验head/404 2e2e，根/子路径canonical模板均通过；3.6接入正式默认值。日志.cache/3.5-*.log。公开数量仍[1,1,1,1]，不增加OG图片/SEO库、不改原文或模块内部模型。

### Milestone 3.6 — 可重复静态构建与发布管线准备

**Status**：Done  
**Dependencies**：3.5 Done；正式地址可先登记待输入。

#### Goal / Scope

交付可以审阅、验证和复现的发布候选及工作流。此项只准备本地文件与产物，不操作远程仓库或上线。

#### Tasks / Technical Approach

- 沿用静态dist输出。核对Node/npm与锁文件，默认以.node-version和packageManager为准；CI若选择D8已验证的另一受支持Node版本，先记录原因并同步版本说明，不随意升级库。
- 用干净、隔离环境执行npm ci及完整检查，核对新构建没有旧路由/旧资源残留；不得清理用户无关文件。
- 定义site/base的单一构建输入，支持根站点与项目站点；复用withBase，避免脚本/索引/favicon/404/元信息的前缀重复或遗漏。
- 准备最小GitHub Actions检查与Pages发布工作流：检查通过才使用对应构建产物；发布任务明确依赖该产物，不在PR验证时发布。
- 首次发布默认提供手动入口；不在本轮规划中决定未经确认的自动推送部署策略。3.7执行前核对目标仓库/分支和Pages环境。
- 固定发布候选的源版本/产物记录，并写明回退到上一次已验收版本的步骤；不把重新构建的另一份产物冒充已经测试的候选。
- 记录首页与一份长内容的加载/滚动/搜索体验、脚本和资产体积；只修复测量显示的明显问题，不为追求评分重做玻璃或增加缓存框架。

使用Astro静态构建、GitHub Pages与官方Actions路径；site/base由真实站点拓扑确定。[Astro Pages部署说明](https://docs.astro.build/en/guides/deploy/github/)

Pages构建产物与部署任务需要正确关联，部署权限与目标环境按官方说明设置；3.6只做本地审查，真实Actions成功必须在3.7记录。[GitHub Pages工作流说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

#### Files

astro.config.mjs；.github/workflows/check.yml、deploy.yml（实施时按最小必要数量选择）；必要版本文件/测试配置与发布验证脚本；README、docs/release-checklist.md、PLAN.md。只有实际需要的site/base/元信息接线才改源码。

#### Non-goals

不执行Git init、远程建仓、推送、Pages设置或域名配置，不新增SSR/后端/Service Worker/PWA/监控平台，不把安装本地新工具变成任意升级依赖的机会。

#### Done Criteria

- [x] 干净安装与构建可复现，版本约定一致，全部检查与产物smoke通过。
- [x] 根/项目子路径下，所有入口/索引/内容/404/资产/元信息可用。
- [x] 工作流的检查→构建产物→发布依赖、触发范围和权限清楚，可供用户审阅。
- [x] 发布候选与版本可对应，回退步骤明确；没有向GitHub执行写入或发布。
- [x] 性能结果有环境与基线，必要最小修复已经复验；不宣称实验室结果等于真实用户指标。
- [x] 正式地址由用户提供且已确认最终URL为https://hjk202.github.io/，配置为该root site与/；模拟base不作为正式域名。

#### Verification

npm ci与公共工程检查；根路径和npm run build -- --base /personal-space/ --outDir .cache/base-dist对应浏览器回归；隔离第五模块、公开/隐藏/删除/空集合和不等平均值探针。审查工作流语法、产物目录、依赖和部署触发，使用执行环境实际可用的校验工具；没有云端执行时不写“CI通过”。输出构建版本、检查日志与发布清单。

#### 后续依赖 / Completion Record

3.7只发布本项通过验收的候选；正式目标补齐后需复验受影响地址，不重做无关功能。**Completion Record（2026-10-13）**：astro.config.mjs统一SITE_URL/BASE_PATH，默认真实用户root地址；单一deploy.yml在push/PR检查、仅main手动发布，部署依赖check，只上传已测试dist、不二次build。官方Actions版本/SHA实际核实并固定；Node22.23.2/npm10.9.8与锁文件保持。新增verify-release.mjs校验YAML触发/权限/依赖/上传边界及产物，生成私有.cache源SHA/文件哈希清单。候选6bfad26，最小换行策略修复后2991080；隔离clone/.cache/release-candidate执行npm ci（369包、0vulnerabilities）、lint、typecheck（74files0诊断）、24unit、root/base build9页均退出0；干净候选40Chromium/15WebKit移动通过，工作区根/base各40e2e通过。第五模块check/build+1e2e，公开/隐藏/空/删除与设计build，设计不等平均5e2e、图片/长代码1e2e、空1e2e，4–7两引擎8组合通过。发现favicon Windows旧检出CRLF差异，仅以.gitattributes固定该资产LF并在候选同步Git保存的LF内容，重新build后15产物哈希全部一致。v0在隔离目录复现；本机375px循环回环加载/搜索测量见.cache/3.6-performance.json：JS原始7327字节，CSS从23229到29362字节；暖加载约8–10ms，未宣称真机/公网指标，无性能重构。所有日志.cache/3.6-*.log，清单见release-manifest.json；README/发布清单记录维护和回退。还未推送、配置Pages或部署；真实云端结果留3.7。

### Milestone 3.7 — 首次GitHub Pages公开发布

**Status**：Done  
**Dependencies**：3.6 Done；目标账号/仓库/可见性/分支/地址与实际发布授权明确。

#### Goal / Scope

把经过验收的候选发布到用户指定的GitHub Pages目标，并证明线上访问成立。仓库权限与地址必须来自实际信息，不从姓名或目录名猜测。

#### Tasks / Technical Approach

- 优先使用用户明确指定的已有仓库；需要新仓库时先明确名称、可见性与目标。当前没有.git，必要的本地版本记录/初始化仅在本项获准后进行。
- 公开网站与公开源码分开确认。只提交必要项目文件，保持现有忽略规则；不提交node_modules、.cache、测试截图或本机环境文件。
- 从真实目标确定site/base、发布分支和Pages源；最终地址补齐后重新完成公共验证与对应路径检查。
- 依据本项已获得的发布授权执行必要推送/Pages配置/手动发布；不重复索要已有授权，也不把本轮只规划误解为上线许可。
- 核对实际Actions日志、发布版本、生成URL和部署产物对应关系；只上传dist，不把隔离fixtures或原始资源目录整体充作网站。
- 巡检真实线上Home、四模块、三详情、搜索索引、favicon与404，确认HTTPS、深层直达和刷新可用。
- 失败只修发布配置/路径及本次相关问题；保留可回退版本，不顺便修改内容与设计。

Pages可用性需按真实账户和仓库条件核验；不默认改变仓库可见性或要求购买服务。[GitHub Pages适用条件](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

#### Files

必要的astro.config.mjs/site/base与既有部署工作流修正；README/发布清单/PLAN.md的真实地址和记录；获准后的本地Git与目标仓库/Pages设置。核心模型与模块布局不在本项重构。

#### Non-goals

不擅自选择公开源码、购买域名/服务、切换托管平台、配置额外第三方统计或实现Private；自定义域名未确认时先采用指定Pages地址。

#### Done Criteria

- [x] 对应源版本的工作流在真实仓库成功完成，发布URL和产物明确。
- [x] 线上正常路径HTTP200，未知路径真实404；直达/刷新/Home/资源/索引可用。
- [x] 搜索、平均值显示、分类返回、外链与动画还焦在实际地址下正常。
- [x] 正式canonical/site/base一致，没有测试域名、重复前缀或旧资源。
- [x] 记录实际命令、部署日志、线上smoke与回退目标，公共检查通过；必要信息或授权缺失没有被伪称解决。

#### Verification

发布前执行公共门槛；发布后浏览器/HTTP巡检真实URL与资源，检查控制台错误、失败请求与404返回内容。核对工作流、版本和发布记录。工具或权限不可用时记录本项Blocked及所缺信息，不用本地预览代替线上成功。

#### 后续依赖 / Completion Record

为3.8提供真实访问地址；没有线上完成证据时Phase 3不能记Done。**Progress / Blocker（2026-10-13）**：发布前npm run lint/typecheck（74files0诊断）/test（24项）/build（9页）与40e2e全部退出0，verify-release通过，首发准备提交9c974dc保留origin/main为祖先，产品树与已验收候选一致。已添加准确origin并fetch旧demo（046d0ba，只有index.html），本地标签demo-before-phase3保留其原始提交；v0仍为ad0e0af。以ours合并保留双方历史，没有强制推送。GCM当前没有已认证账户，已通过现有代理启动GitHub设备登录并向用户提供登录入口；等待人工完成账号认证。这是缺少凭据，不是缺少发布授权。尚未推送、修改Pages、触发Actions或覆盖旧站；未将本地成功当作线上Done。认证后核实Pages源/权限，再按既有授权发布。3.8未开始，已批准的Me GitHub链接尚未提前添加。

**Completion Record（2026-10-13）**：上述认证阻塞已解除，实际账号hjk202具备admin/push权限，仓库public/main与原始域名保持；Pages从legacy切为workflow。正常atomic push保留046d0ba祖先并上传v0与demo-before-phase3，无强推。首发源d3ccc76a6b6e292aef5e24ed036d41ae6561545c；[真实发布运行38496826924](https://github.com/hjk202/hjk202.github.io/actions/runs/38496826924)的check/deploy均success，push检查38496811151也success。已测试github-pages产物11864278192，digest sha256:5078a7da8e8b02d956d202213513607cb326960f58bf25c2be9cc59afc6f8435。云端执行npm ci、lint/typecheck/24unit/root build、40Chromium/15WebKit移动、隔离extension/content/design、base build/40e2e和verify-release全部通过。发布前本地公共门槛与40e2e已通过，文档提交未改变产品树。真实https://hjk202.github.io/下15文件SHA256与本地受验产物逐一相等；8正常页面200、深层刷新/Home、四模块Compass返回无残留、四中文/英文搜索目标、Esc收起还焦、Keep来源链接、正式canonical/favicon/索引及嵌套未知路径真实404与搜索跳转均通过，无页面异常或非预期失败资源。375px巡检无整页横向溢出，审阅线上Home截图；证据.cache/3.7-live.json、3.7-live-home.png、3.7-cloud-jobs.json。首发源将以phase3-first-release标签保留供3.8隔离复现；OPPO真实键盘仍留3.8验收，不宣称已实测。

### Milestone 3.8 — 真机、线上与内容更新闭环验收

**Status**：Done

**Dependencies**：3.7 Done；一台可用真机与一项用户认可的真实内容编辑可获得。

#### Goal / Scope

从真实访客和作者更新流程验证整个阶段。只修当前集成与发布回归，完成后暂停等待用户检查。

#### Tasks / Technical Approach

- 真机走完Home→四模块→详情→返回与Spotlight搜索→内容路径，检查系统键盘、中文输入、横竖屏、工具栏、安全区域及浏览器返回。
- 复核各模块仍有各自特点，共享玻璃/焦点/控件一致；检查长文、公式/代码、分类/外链和项目局部操作。
- 用一项用户提供或认可的真实公开内容编辑，执行编辑→检查→构建→部署→刷新/搜索目标验证。可以是现有资料的真实更正，不必新增文章。
- 没有真实编辑素材时，前面各项可以完成；此更新验证保持未完成，不能拿测试文章上线或同提交重跑冒充内容更新。需要调整标准时先说明并让用户决定。
- 按3.6步骤验证回退：至少在隔离环境复现旧版本构建与smoke，并确认真实已发布的回退目标；不为演示无故回退正常线上站点。
- 汇总支持矩阵、未实测平台、操作记录与后续事项；修复本阶段发现的必要集成问题后重跑相关检查与公共门槛。
- 更新README/维护与发布清单，让用户能够独立更新网站；所有必需项完成才更新Phase 3 Done并停止。

#### Files

tests/e2e、必要隔离验证脚本；README、docs/content-guide.md、docs/release-checklist.md、PLAN.md；用户认可的实际内容文件。源码修正仅限本阶段验收实际发现的相关问题，不扩大设计与产品范围。

#### Non-goals

不自动开始Phase 4/5，不为了验收填虚构资源/日志，不引入后台编辑/自动同步/第三方监控，不把有限设备矩阵称为所有设备兼容。

#### Done Criteria

- [x] 必需真机路径已实际完成；型号/系统/浏览器与未实测项有记录，键盘与旋转可用。
- [x] 线上全部正式入口/内容/索引/资源/404正常，无未解决的必要验证失败。
- [x] 至少一次真实内容编辑与二次部署验证通过；列表/目标/count/search/Me平均值按实际修改同步。
- [x] 回退版本与步骤可复现；维护说明对应真实流程，用户可独立操作。
- [x] 全部公共门槛与相关专项回归通过，Phase 3汇总与各项状态一致。
- [x] 完成后停止交用户验收，未来Phase保持Pending。

#### Verification

执行公共工程检查、根/真实base回归和必要的第五模块/内容隔离验证；完成上述真机和线上检查。对真实编辑建立预期：文本编辑不改变计数，新增/删除条目才改变相应数量及平均值，slug保留或按已确认迁移处理。记录前后源版本、部署日志与实际URL结果。未实测/未执行如实登记，不能勾选对应Done Criteria。

#### 后续依赖 / Completion Record

Phase 4可在新的明确需求和真实素材出现后扩展；Private仍需Phase 5专项设计。**Progress（2026-10-13）**：用户批准的Me GitHub链接已加入原有链接区，新标签访问，不新增资料或搜索目标；OPPO反馈按钮短暂蓝色触摸闪块，其他基础操作正常。仅在全局a/button取消浏览器默认tap-highlight，保留现有玻璃按压和focus-visible，不禁用输入缩放/长按菜单/选择。npm ci（0vulnerabilities）、lint/typecheck（74files0诊断）/24unit/root与base build均退出0；根/base各40e2e、WebKit移动15、第五模块check/build与1浏览器、内容公开资源1/空集合1/设计分类与平均值5浏览器均通过；审阅Me手机截图。首发d3ccc76已在.cache/phase3-first-release独立clone、npm ci/build/verify-release，15文件哈希与首发受验候选相同，4项全页面/脚本/head/404搜索smoke通过，不回退正常线上。触摸专项最初错误假定桌面WebKit暴露移动专用属性，诊断后按CSS.supports记录不适用，既有测试断言未改；Chromium实际计算从rgba(0,0,0,.18)变为透明，两个引擎的触摸导航/搜索和键盘2px焦点通过，OPPO修复后结果仍需二次上线确认。默认浏览器与系统版本用户未提供，不猜测；iOS真机未实测。第二次真实部署及线上复验尚未完成，本项继续In Progress。日志.cache/3.8-*.log、3.8-tap.json，失败诊断保留3.8-tap-diagnostic.log。

**Milestone 3.8 Completion Record（2026-10-13）**：用户在OPPO Find X7 Ultra默认浏览器打开最终https://hjk202.github.io/?v=9e7d878后明确反馈“两处问题都已解决，操作正常”。此前已确认四模块进入/返回、中文搜索软键盘、关闭后操作和横竖屏阅读正常；至此触摸蓝色闪块与Build/Keep标签重合的修复均获真机确认，最后阻塞解除，3.8及Phase 3标Done。实际修改为获准的Me GitHub公开链接、保留键盘焦点的触摸高亮修复、对称移动标签框及有效视觉碰撞回归；真实更新与二次部署、第三次修复发布及独立首发回退复现均通过。最终产品源9e7d878、[发布38501761237](https://github.com/hjk202/hjk202.github.io/actions/runs/38501761237)check/deploy成功；本地与云端npm run lint/typecheck（74files0诊断）/test（24项）/build（9页）均退出0，根/base各40e2e、WebKit移动15、4–7两引擎8组合和必要第五模块/内容/设计隔离验证通过；线上15文件哈希一致、8正常页面/搜索/资源/实际404与标签分离通过，数量仍[1,1,1,1]/Me平均1。详细命令、产物及失败修复证据保留在下列历史记录与发布清单。本轮仅补齐四份维护文档，核对状态/完成项/交叉引用及git diff --check；不重跑已通过且代码未变的工程验证，不重新部署。系统/浏览器版本用户未提供，iOS真机未实测，不声称全设备兼容。NEED/AGENTS、源码与配置保持；Phase 4/5仍Pending，完成后停止。

### Open Questions / Risks 与默认假设

**最终线上记录与剩余验收（2026-10-13，历史停点）**：标签修复源9e7d8788cabff5df4e638e8df956eee6ffbf3e58；[第三次发布38501761237](https://github.com/hjk202/hjk202.github.io/actions/runs/38501761237)与push检查38501734407均success，github-pages产物11866203369，digest sha256:3fbc7ca06a557517a78147372f38d1c6a90adb50e3be25eba22b2da9082e8b66。云端npm ci/lint/typecheck/24unit/root build/40Chromium/15WebKit移动、extension/content/design/4–7两引擎碰撞、base build/40e2e、产物检查和deploy全部通过。最终真实URL的15文件SHA256与本地受验产物相同，8正常页面/深层刷新/Home/全部搜索目标/返回状态/实际404/元信息/资源通过，无页面异常或非预期失败资产；375px四标签文字与玻璃分离且不越界，Me GitHub链接与透明tap-highlight验证通过。搜索快照与首发逐字节相同，四模块各1、4目标、Me平均1。证据.cache/3.8-final-cloud-jobs.json、3.8-final-live.json、3.8-final-live-home.png及日志；所有本机测试服务已关闭。用户此前确认OPPO基础导航/键盘/旋转正常；随后两项反馈均已修复和上线，但最终手机确认尚未收到，故3.8 Blocked、Phase 3未标Done，不把自动化当真机通过。待用户确认https://hjk202.github.io/?v=9e7d878两处问题均解决后，仅补齐状态/完成记录并停止。以下Progress段落保留各轮历史，当前状态以3.8 Completion Record为准。

**3.8真机问题复验进度（2026-10-13）**：二次部署后用户报告手机Build/Keep标签与玻璃重合，本项仍In Progress，线上总体验验收保持未完成。375px实测文字向内侵入约5–10px，根因为200user-unit标签框被x方向clamp回中心。仅调整Compass移动foreignObject：保持248半径的对称中心，按距viewBox两侧的可用宽度收窄标签框；窄框较长名称复用既有紧凑样式。实际四模块字号/大小写、174外圈、雷达映射及统计不变；移动框最小约52px宽/44px高。新增文字与玻璃分离/不越界断言，旧390px产物明确失败；4–7探针增加基于字体矩形与实际凸多边形的碰撞检查，首次发现六模块Workshop两行碰撞后修正并复跑，未弱化断言。最终lint/typecheck（74files0诊断）/24unit/root/base build、根/base各40e2e、WebKit移动15、4–7两引擎8组合全部退出0；审阅375px及6/7模块截图，375px两侧约18–23px间距，320px约16–20px。verify-mobile加入发布门槛，触发/权限不变；日志.cache/3.8-spacing-*.log，测量/截图见mobile-probe-output.txt，初始失败保留。第三次发布和最终OPPO复查尚未完成。

**3.8线上验收补充（2026-10-13）**：真实更新源810fb2c9856aaa38602d8f0ce6fb28b894201a80，[二次发布38499117547](https://github.com/hjk202/hjk202.github.io/actions/runs/38499117547)check/deploy均success，push检查38499086480也success；github-pages产物11865227580，digest sha256:19aa6492e737c9c31b2606fe5001eb18bb33509493c1a1b59c054848be190b56。云端完整公共/根40/WebKit15/隔离契约/base40门槛通过；真实URL再次通过15文件哈希/8正常页面/404/全部搜索目标与返回/375px无横溢出，Me链接与透明tap-highlight已在真实页面计算验证。搜索快照与首发逐字节相同，四模块各1、4个内容目标、Me平均1。证据.cache/3.8-cloud-jobs.json、3.8-live.json及日志。此记录只证明线上与自动化通过，仍待用户确认OPPO修复后的点击反馈。

| 事项 | 当前事实/默认选择 | 影响与处理时点 |
| --- | --- | --- |
| 发布平台 | 沿用NEED规定的GitHub Pages + Actions | 不另选平台；3.6准备、3.7操作真实目标 |
| GitHub账号/仓库/分支 | hjk202身份/admin权限已核实；现有public仓库/main，Pages为workflow | 已正常推送并保留旧demo历史与v0；没有强制推送或改变可见性 |
| site/base | 正式https://hjk202.github.io/与/，根/模拟子路径/真实线上均已通过 | 实际canonical/site/base一致；未配置新域名 |
| 源码可见性 | 沿用用户授权覆盖的既有public仓库 | 没有新建仓库或改变可见性；没有提交依赖/缓存/凭据 |
| 自定义域名 | 没有已确认域名，不作为首次发布前提 | 先用指定Pages URL；DNS/CNAME仅在明确要求后配置 |
| 真机条件 | OPPO基础导航/软键盘/横竖屏及最终两项修复均经用户确认正常 | 系统/浏览器版本未提供，iOS未实测；不扩大为全设备兼容声明 |
| 字体与文风 | 现有系统字体和用户原文；中文为主、英文混排 | 只修语言标记与跨平台字号/换行，不买字体或做i18n |
| 页面元信息 | 3.5已接入独立标题/摘要/zh-CN/favicon/canonical及真实404 | 三轮线上逐页验证通过；没有扩展搜索/内容模型 |
| OG分享图 | 不把NEED的品牌示例自动变成必做功能 | 第一版不阻塞于OG；如用户批准静态默认图，再明确最小范围 |
| 内容更新验证 | Me已接入用户确认的GitHub公开链接，二次真实部署通过 | 链接/列表/搜索/数量已复核；没有以测试素材或同源重跑替代真实编辑 |
| Build过程材料 | 阶段/更新/问题能力已有，NEMU历史尚未提供 | 本阶段保留真实现状，不以“发布完善”为由补造内容 |
| Windows与CI差异 | 本机外部服务模式与Ubuntu真实Actions默认生命周期均已通过 | 三轮实际部署记录可查；不把本地语法验证当CI结果 |
| 草稿资源 | 既有验证发现未渲染Markdown可能输出引用的原始资源 | 发布只使用当前明确公开材料；不把published当Private，保密能力仍归Phase 5 |
| 设备性能 | 现有玻璃为CSS/SVG，没有持续动画或重型运行时 | 先测移动场景，只解决实际卡顿/布局问题，不用评分驱动无关重构 |

以上是发布计划的待输入和实际限制，不阻塞本轮文档交付，也不授权提前操作外部应用或扩大任何milestone。

### 本次规划的验证与交付记录

以下为先前规划交付时的历史记录；当前授权和实施状态以本文开头与milestone完成记录为准。

本轮只更新PLAN.md；NEED.md继续作为需求来源，DESIGN.md保留已认可的设计，AGENTS.md执行规则不变。新3.1–3.8全部Pending，没有实现项In Progress。

文档验收覆盖：既有需求/源码差异、八项Scope与Non-goals、Done Criteria/Verification、依赖/状态、必要文件、发布授权边界、默认假设与源链接；通过文件哈希核对只改动PLAN.md。

本轮不运行lint/typecheck/test/build或页面smoke，不把此前D8通过结果当作新阶段验证，不创建上述任何工程文件。规划交付后停止，下一步须由用户明确指定实施项。

## Phase 4 Detailed Plan

规划修订日期：2026-10-14。**Status：In Progress。** 用户随后明确要求按照要求完成Phase 4，授权4.1–4.8顺序执行；仍逐项检查并停在阶段终点。 本节替换此前未实施的Photography/Travel阶段草案。

需求依据：NEED.md第36–41节Private、第47–48节技术/Core、第55–56节设计与统计、第57节新优先级。已验收的DESIGN.md、Phase 1–3和D1–D8继续约束公共体验。

### Overall Architecture / 功能优先的目标

先建立“能安全使用”的私人空间，再慢慢放入真实内容。私人空间仍存在于Me、Think、Build、Keep内部，不增加Private模块、仪表盘或第三套导航。首页仍只有入口；Glass用于中心状态、Unlock和必要控制，内容保持清晰，沿用各模块已经批准的不同排版。

**本阶段做**：本地加密打包、浏览器解锁、同标签页跨模块会话、现有模块的私人呈现、私人搜索/统计、锁定清理、加密内容维护与验收。

**本阶段不做**：新内容批量录入、旅行/摄影模块、云端账号/后台编辑、多人权限/分享、云同步、离线PWA、全文/语义搜索、Relations/Activity/全站Timeline、统一Content图、重做主页背景或四模块视觉。非敏感fixtures用于测试，不能充当作者正式内容。

### 当前基线与需要明确的冲突

| 实际代码/需求 | 当前事实与影响 | 本阶段的最小建议 |
| --- | --- | --- |
| Module.count()/search()，src/core/search/build.ts | 两个无参函数在构建期读取公开数据；搜索结果必须对应已生成静态页 | 保留公开契约。新增可选的模块私人浏览器适配约定，解锁后由模块产生内存投影；不往公开JSON中塞私人结果 |
| registry.server.ts、pages.server.ts、Think content.server.ts | 包含构建加载器、文件/Markdown编译和Astro服务端组件 | 浏览器不得导入。私人打包适配器与浏览器适配器分开；不把现有module.ts直接打进客户端 |
| NEED第39节Core只提供isVaultUnlocked | 布尔值可以控制显示，无法完成密文校验、解密和密钥生命周期 | Vault只扩展必要的安全传输/会话边界，不解析文章/项目/收藏，也不创建统一私人内容模型 |
| 静态路由与Base.astro | 当前是普通文档导航；换页会丢失仅存在内存的解锁状态 | 推荐使用Astro自带ClientRouter保持同标签页内存会话；公开HTML仍静态生成。4.1先冻结方案，4.3实施并回归全部受影响脚本 |
| spotlight.ts的Enter使用window.location.assign | 即使链接支持客户端路由，键盘跳转也可能硬刷新、重新锁定 | 4.3统一站内导航接点，保留原生URL/新标签/硬刷新行为；不自制路由框架 |
| src/core/module/urls.ts的withBase | 当前明确拒绝query/fragment；私人目标不能直接把带fragment的地址交给此函数 | 保持公共逻辑路径校验，先对模块pathname应用base，再通过单独受控目标解析拼接不透明fragment；不放宽公开索引验证 |
| 公共未发布内容/资源 | published过滤不能保护Git源码、历史和原始媒体 | 私人明文置于作者指定的仓库外目录，先在本地加密；Git/CI只接收密文 |
| D4–D6及现有数据模型 | Keep平面分类、Think文章/随记、Build可选阶段/更新/问题已经具备 | 不重复开发这些功能；缺少实际记录是内容不足，不是架构缺口 |
| NEED旧Photography、Travel方向 | 用户已明确二者是一个模块，并要求延后 | 按第57节修订，移至Phase 6；当前继续保持四个正式模块 |

上述是已发现的技术差异与方案提议，不代表当前代码存在私人数据泄露；当前尚未实现Vault。不得为解决它们整体改写公共架构。

### 保密边界与默认技术方案

1. **发布前加密**：作者在仓库外维护明文，通过本地工具完成模块校验、打包与加密。公开仓库、GitHub Actions、生产HTML/JS/JSON/source map只能收到公共内容、通用界面代码和密文，不能收到私人源文件或口令。不能依赖.gitignore作为唯一保护。
2. **首版一个密文包**：内层按模块id分发不透明载荷，各模块拥有自己的schema；外层仅保留格式版本、必要KDF参数、随机salt/IV及密文。不暴露标题、摘要、条目数、真实文件名或私有搜索投影。包的存在、大小和更新时间仍可能被观察，不承诺隐藏这些元信息。
3. **采用标准密码实现**：推荐原生Web Crypto的PBKDF2-HMAC-SHA-256派生与AES-256-GCM认证加密，使用安全随机salt和每次加密的新96-bit IV、128-bit认证标签，并绑定格式版本等必要关联数据。加解密API和IV约束见[MDN deriveKey](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey)与[MDN AES-GCM参数](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams)；认证加密选择参考[OWASP加密存储](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)。不实现密码算法或把固定密码/hash当作前端门禁。
4. **KDF参数在4.1冻结**：原生方案减少依赖，Argon2id具有内存成本优势，但浏览器接入需要额外实现/依赖评估。参考[OWASP口令存储建议](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)比较选择；若采用PBKDF2-SHA-256，600,000次作为规划起点，实施时复核最新指导和实测耗时，不为手机方便任意降低成本。这是密钥派生方案选择，不能把账号密码存储指南直接当作整个Vault的安全证明。
5. **只保留内存会话**：口令提交后及时清空输入；CryptoKey不可导出，明文只在已解锁标签页内存/当前DOM/必要Blob URL存在。禁止把口令、密钥或明文写入URL、日志、cookie、local/sessionStorage、IndexedDB或Service Worker缓存。不通过浏览器持久化密钥解决跨页问题。
6. **刷新默认重新锁定**：ClientRouter只保持一次同标签页站内会话；硬刷新、新标签页、外部跳转及退出页面不继承解锁。浏览器历史仅记录模块地址和不含语义的私人目标标识。回退缓存恢复时必须重新确认锁定状态，不能展示旧私人DOM。
7. **私人内容运行时呈现**：私人条目不生成明文静态详情页。建议用已有模块地址加命名空间fragment与不透明id定位运行时详情；刷新先显示锁定状态，成功解锁后恢复待访问目标。片段不是保密手段，真正保密来自载荷加密。document.title、canonical、OG与浏览器历史使用中性/公开模块信息，不把私人标题写入这些位置；私人标题只在已解锁内容DOM显示。
8. **安全内容子集**：Think首版支持必要的Markdown正文、标题、列表、代码和受控链接，不执行私人MDX/JS/任意HTML。模块自有渲染器选择白名单、安全转义与URL校验。当前接受的少量本地图像若需私人引用，图像字节和描述必须随包加密，运行时通过受控Blob URL显示；不支持的媒体明确拒绝，不能转存到public来凑支持。
9. **默认锁定策略**：主动锁定、10分钟无操作、页面进入后台或真正pagehide时锁定；不是输入框blur，软键盘收起不触发锁定。后台立即锁定是简单的首版默认，可在4.1基于明确使用需求调整并记录，不预建策略设置系统。
10. **可信终点**：防止未解锁访客从公开产物读到明文，校验错误口令/篡改。无法抵御已解锁设备被查看、恶意浏览器插件、被替换的站点代码或同源XSS；JS也不能保证物理内存安全擦除。密文公开可被离线猜测，前端重试延迟不等于服务端限流。长且高熵的口令及可靠备份由作者本地管理，不在聊天中索取秘密。

以上默认方案供本轮查验。4.1应冻结可实现的协议与必要边界；若用户需要账号登录、多设备云同步、服务端撤权或多人分享，则是新的架构选择，须另行规划，不能在本阶段顺便实现。

### 模块契约与统计口径

公开Module、ModulePage和公开索引继续工作。拟新增模块内vault.server.ts（仅本地打包适配）和vault.client.ts（仅浏览器安全校验、呈现、count/search投影、目标解析与清理），文件名及精确签名在4.1确定。两者不能互相拖入构建/浏览器禁区。

Registry按约定发现可选私人适配器并限制到已启用模块；Shell只请求“挂载/清理”，Search只消费SearchResult投影，Compass只消费实际计数。Core不内置think/build/keep/me分支，不建立VaultPost/VaultProject等全站内容集合。未来模块可提供自己的适配器；本阶段不为旅行/摄影预建私人实现。

| 模块 | 私人内容如何组织 | 解锁后的统计规则（默认，4.1记录） |
| --- | --- | --- |
| Think | 原有温暖的文章/随记列表增加自己的私人条目，详情仍使用本模块阅读风格 | 可访问文章/随记的真实条目数；同一条目不重复计数 |
| Keep | 私人收藏在既有分类体系中展示，来源和本站说明区分；不暴露私人URL预览或自动抓取 | 可访问收藏项数；私有类别名与目标只在解锁后出现 |
| Build | 私人项目或公开项目的私人阶段/日志/问题；具体合并由Build处理 | 按真实项目数；为已有项目增加私人日志不会把项目计成两份，也不按日志数膨胀Radar |
| Me | 可选的私人补充资料，与既有个人主页协调；不要求提供第二份“私人简历” | 实际资料仍按本模块规则，私人补充不虚构第二个独立资料条目；Compass仍计算其他启用模块当前可访问数量的平均值 |

锁定时只有公共计数/搜索。解锁后默认显示模块的public + private可访问集合，实际去重/合并由所属模块完成；Me的peer-average仍包括零条同伴，不按模块id写特例。无私人适配或无私人条目的模块继续正常公开工作。

### Milestone状态、依赖与执行停点

| Milestone | 目标 | 状态 | 前置 |
| --- | --- | --- | --- |
| 4.1 | 安全边界、协议与最小接口冻结 | Done | 已完成Phase 1–3、D1–D8 |
| 4.2 | 本地加密打包、校验与维护工具 | Done | 4.1 |
| 4.3 | 浏览器内存会话与站内导航接点 | Done | 4.2 |
| 4.4 | 中心长按、Unlock与锁定控制 | Done | 4.3 |
| 4.5 | Think私人内容第一条完整链路 | Done | 4.4 |
| 4.6 | Keep / Build / Me模块内私人适配 | Done | 4.5 |
| 4.7 | Spotlight、Compass与锁定后的投影清理 | Done | 4.6 |
| 4.8 | 安全、维护恢复、手机与发布验收 | In Progress | 4.1–4.7全部Done |

每项都是独立执行与验证单元，公共和专项检查通过才能进入获准的下一项。当前4.8 In Progress，4.1–4.7 Done。用户日后若授权整个阶段，也必须逐项执行/记录/验证，不能把批量授权解释为扩展Scope；4.8完成后停止。

### 公共Verification与验收数据

每个milestone遵守本文公共门槛：npm run lint、npm run typecheck、npm run test、npm run build及受影响的npm run test:e2e。新增命令只能在相应工程范围建立，命令名在实现记录中核实。4.1是设计文档单元，核对既有工程基线，不借检查创建Vault实现。

浏览器改变涉及ClientRouter、dialog、清理或搜索时，必须使用实际生产预览验证。覆盖Chromium、现有WebKit移动模拟，根路径和/personal-space/；保留现有公开回归、扩展测试与4–7模块碰撞检查。OPPO仍集中在4.8进行“能看、能用”的简洁基础检查，不扩大手机机型矩阵，也不声称iOS真机通过。

验收只需非敏感fixtures：各模块少量合法条目、中文标题、边界内容、一份小媒体、已公开项目的私人补充与空Vault。fixture拥有独立不透明标识/已知测试口令和明文canary；只在测试代码及隔离产物中使用，不伪装作者内容。生成过程不能在正式源码目录留下明文副本或把测试解锁后门编入生产。

最终生产默认允许“功能齐全，尚未配置真实私人资料”：未配置密文时Unlock说明当前状态，公共浏览和搜索不受影响；不能使用一个公开的默认密码或空包密码来假装私人空间已经保护了真实资料。线上解密链路可在明确标识的临时非敏感验收环境检查，结束后验证测试载荷已清除。首批真实私人材料不是4.8的完成前提。

### Milestone 4.1 — 保密边界与接口设计

**Status：Done。**

#### Goal / Scope

把Private从入口概念变成可验证的最小技术合同，明确静态托管、私人源文件、会话、导航、模块和维护边界。本项只做设计/基线核对，不实现加密、ClientRouter或UI。

#### Tasks / Technical Approach

- 记录保护对象、可观察元信息、攻击/信任边界和明确不支持的能力；区分密码认证与本地解密。
- 冻结首版密文版本、KDF/参数范围、salt/IV/关联数据、输入大小上限、错误语义、支持媒体/Markdown子集与兼容策略。
- 确认打包/浏览器适配签名、自动发现方式、私人目标fragment和模块计数/去重规则；保留公开管线。
- 设计ClientRouter接入点、Spotlight键盘跳转、各脚本初始化/销毁、BFCache与锁定生命周期；记录对既有公开路径的回归清单。
- 明确仓库外作者目录、密文输出允许位置、本地口令输入与备份/换口令/恢复方式；测试使用非敏感样本，不等真实资料。
- 记录简单的长按/键盘等价操作、主动锁定位置和后台/闲置策略；涉及新的产品范围时先说明而不扩张。

#### Files

docs/vault-design.md、docs/vault-guide.md、必要的docs/architecture.md补充和PLAN.md当前项；源码/配置/依赖均不改。

#### Non-goals

不写Crypto代码、秘密文件、浏览器状态、路由改造或模块私人数据；不把设计文档完成当作Private已可用。

#### Done Criteria

- [x] 原文布尔状态与实际构建/静态导航的差异有明确处理，不存在明文发布或浏览器导入服务端加载器的方案。
- [x] 协议、适配签名、计数/导航/锁定/错误和作者操作可以直接指导4.2–4.7，关键技术选择已记录。
- [x] 已定义非敏感测试矩阵、公开产物保护和最终空Vault可验收口径，不要求首批真实内容。
- [x] 需要用户决定的真实范围冲突与默认假设区分；不能带着未解决的安全/架构冲突开始依赖实现。

#### Verification

对照NEED/AGENTS/实际源码逐条审阅；检查构建到浏览器依赖图与明文流向；核对密码与导航官方文档。运行既有公共命令、必要公开首页/模块/Spotlight基线smoke，记录版本与结果；没有私人功能测试结果可宣称。

#### 后续依赖 / Completion Record

4.2依据此协议实现；发生必须改变静态托管或产品边界的结论时，本项说明建议并停在争议处，不自动重写计划。**Completion Record（2026-10-14）**：冻结Vault v1合同、维护方式、模块适配/计数及ClientRouter会话边界；仅docs与当前状态。npm.cmd run lint/typecheck（74 files，0诊断）/test（24项）/build（9页）退出0；40项生产浏览器回归退出0。初次浏览器缓存路径启动失败，修正为项目.cache/ms-playwright后复验40项通过，未修改断言。证据.cache/4.1-fixed-checks.log及4.1-browser-checks.log，未运行私人功能或真机测试。

### Milestone 4.2 — 本地加密打包与维护闭环

**Status：Done。**

#### Goal / Scope

在不接UI的情况下，实现“仓库外明文 → 模块校验 → 密文产物”的本地工具及可与浏览器互通的解密协议。工具支持必要备份、恢复校验、更新与更换口令，不建设后台。

#### Tasks / Technical Approach

- 建立离线打包入口与模块自有vault.server.ts约定；只读取作者明确指定的外部目录，不自动扫描桌面或用户目录。
- 使用标准密码API按4.1协议加密；口令通过不回显的交互输入，不放在命令行参数/文件/日志中。
- 写出前校验所有模块payload、资源引用与大小；只允许预期密文文件及中性清单进入指定输出位置。失败保留上一份有效包，不输出半成品或回退明文。
- 实现浏览器解密/协议校验的纯逻辑边界，错误口令、篡改、错误版本/参数与无效payload均失败关闭。
- 支持现有包的本地验证、同内容重新加密/换口令、密文备份与恢复演练；明文备份与口令保管由作者自行选择的外部位置管理。
- 为生产构建建立最小密文输出/来源检查；CI不能读取私人源目录，不能以GitHub Secret上传私人明文/密钥代替本地加密。

#### Files

scripts/vault/、src/core/vault/中协议/密码边界、模块内必要vault.server.ts与安全的纯校验文件、tests/unit/vault*.test.ts、隔离fixture/验证脚本；package.json中的必要命令、.gitignore与密文输出路径约束；docs/vault-guide.md、PLAN.md。新增依赖仅按4.1冻结方案确有必要时加入。

#### Non-goals

不做Unlock、公共路由改版、真实私人内容录入、浏览器编辑器、云端密钥存储或通用文件同步。

#### Done Criteria

- [x] 外部样本可以加密、验证、恢复、更新与换口令，错误时上一有效包不损坏。
- [x] 相同输入重复打包使用新的salt/IV；可在Node与实际浏览器间正确解密。
- [x] 错口令、篡改tag/关联数据、截断、错误版本、超限KDF/文件和非法模块输入均不产生可展示数据。
- [x] 私人标题/正文/路径/图像/搜索canary不进入正式源码、输出日志或公共构建产物；没有内置解锁口令。
- [x] 作者从“尚无私人材料”的状态也能完成全部工具验证。

#### Verification

公共检查；独立标准向量/协议负例与跨Node/浏览器解密，不只测试自己encrypt后自己decrypt。比较重复密文随机字段，验证更新失败的产物哈希不变；在隔离副本做备份恢复和换口令，确认旧口令不解新包。检查Git候选文件、dist/JS/JSON/map/媒体与日志的canary及文件允许列表；公开页面smoke通过。

#### 后续依赖 / Completion Record

4.3复用已验证的协议和密文输入；4.8再在完整系统中复验维护恢复。**Completion Record（2026-10-14）**：标准Web Crypto协议及独立模块schema、本地pack/verify/rekey/backup/restore、原子写入与构建前密文允许列表完成；不接UI，不提供真实资料。lint/typecheck（92files，0诊断）/test（32项）/build及41个生产浏览器回归退出0；RFC7914向量、独立Node cipher、实际浏览器互通、wrong password/tamper/参数/格式/模块与维护恢复负例通过。类型检查发现测试编译依赖与不透明payload类型问题，改用已有TypeScript及模块校验后全套复验；实际Windows终端两次确认口令/verify退出0且不回显，受限ConPTY/临时路径问题改在真实终端非敏感临时目录复验。生产扫描无CANARY或测试包。证据.cache/4.2-final-checks.log及4.2-cli-paths.json；无新增依赖/生产密文。

### Milestone 4.3 — 内存会话与站内导航

**Status：Done。**

#### Goal / Scope

建立Vault会话和最小客户端注册/导航接点，使解锁状态在同标签页正常进入/返回模块时可靠保留，真正刷新与离开时锁定。此项不实现产品Unlock界面或私人列表。

#### Tasks / Technical Approach

- 定义locked/unlocking/unlocked、订阅/清理与会话代次；失败或取消不改变锁定，旧异步解密结果不得重新打开已锁定会话。
- 按4.1接入Astro ClientRouter，保留静态输出、真实URL、外链、新标签与无JS公开浏览；不引入React/自建SPA路由。
- 调整Base、Compass、Spotlight及Keep现有脚本的必要生命周期：每次进入正确初始化，每次离开解绑/清理；防止重复document监听、旧dialog/过滤状态与遗留计时器。
- 统一站内链接及Spotlight Enter导航；保留withBase的公共路径约束，单独校验/解析私人目标fragment；浏览器回退/前进、部署base、scroll/focus/head均保留正确语义。
- 建立主动/闲置/后台/pagehide/BFCache锁定；解密key、payload、订阅及Blob清理属于Vault生命周期，业务清理由模块适配器负责。
- 私人视图退出/锁定时不保留包含明文的转场快照；必要时禁用该段页面动画，不能为了平滑换页延后清理。

#### Files

src/core/vault/、可选私人适配Registry/共享类型、src/core/module/urls.ts或对应浏览器目标解析文件的必要新增接点、src/shell/layout/Base.astro、src/shell/home/Compass.astro与spotlight.ts、Keep现有局部脚本；tests/unit及tests/e2e的会话/导航回归；架构文档和PLAN.md。测试触发会话只在隔离测试入口中提供，不编入产品后门。

#### Non-goals

不增加中心解锁动画、私人内容展示/搜索，不迁移公共内容格式、不重做所有组件或引入持久化认证。

#### Done Criteria

- [x] 同标签页的Home/Module/公开Content/返回导航可保留测试会话；硬刷新、新标签和实际离开不继承会话。
- [x] Spotlight鼠标及Enter使用一致导航逻辑；URL、base、标题与滚动正常，键盘焦点不退化。
- [x] 反复导航不重复处理事件，Keep分类/来源访问、搜索开关动画、Compass返回无残留高亮。
- [x] 锁定后迟到的fetch/decrypt/渲染不再激活会话；BFCache恢复和异常导航不能显示旧私人状态。
- [x] 没有任何浏览器持久化明文/密钥的路径。

#### Verification

公共检查；根/base完整公开e2e与扩展回归，Chromium/WebKit分别验证同标签页、Enter、前进/后退、硬刷新、新标签/外链、错误导航、后台与BFCache。重复进出至少一轮多次循环检查事件/DOM/计时器，不用截图代替行为断言。核对浏览器存储、URL与console；验收ClientRouter失败/无JS时公共内容可读。

#### 后续依赖 / Completion Record

4.4提供真正UI；4.5–4.7在此基础上接模块，不能再通过sessionStorage口令补导航。**Completion Record（2026-10-14）**：浏览器会话、受控私人fragment、ClientRouter与可销毁脚本生命周期完成；DOM编排留Shell，公开静态接口不变。未解锁沿用原生导航，解锁通过同一受控接点换页，刷新/后台/pagehide/BFCache及10分钟闲置锁定。lint/typecheck（102files0诊断）/34unit/build/根与base各43e2e退出0；两引擎真会话隔离探针各2通过，WebKit移动15通过，第五模块check/build及1浏览器通过，生产无测试入口。修复全面软导航的公开时序回归、WebKit替换动画合成层崩溃及重复close抢焦点竞态；保留原断言并新增不抢焦点测试。证据.cache/4.3-release-check-checks.log、4.3-final-base-checks.log、4.3-final-session-webkit-checks.log、4.3-current-session-chromium-checks.log与4.3-focus-webkit-mobile-checks.log；旧失败/事件诊断保留。不接产品Unlock或私人数据，真实手机集中4.8。

### Milestone 4.4 — 中心长按与Unlock / Lock

**Status：Done。**

#### Goal / Scope

提供克制、清晰的私人入口与锁定控制，保持已验收Glass语言和对称首页，不增加导航栏。

#### Tasks / Technical Approach

- Compass中心指针按住约1.5秒开启Unlock；短按无动作，移动离开/松手/取消及时撤销。局部收缩/柔化可短暂提示进度，不改首页背景与总体几何。
- 中心有可访问名称与键盘等价操作；默认聚焦后Enter打开同一Unlock，普通指针短按仍无动作。不要求触屏用户重复复杂手势。
- 原生dialog、单口令输入与提交/取消；区分加载、校验失败、请求失败、未配置包和不支持安全上下文，失败保持锁定，不显示敏感诊断。
- Unlock与Spotlight互斥，遵守既有展开/关闭衔接、焦点/滚动、IME/软键盘和减少动态偏好。
- 成功后仅轻微中心状态标记；已解锁时在Shell提供低存在感的锁定控制，不跳转页面或增加导航系统。Spotlight只保留搜索/打开职责，不放锁定命令。
- 主动锁定立即移除私人状态/内容，安全清理不等动画完成；结束后恢复公共视图和合理焦点。

#### Files

src/shell/home/Compass.astro、必要中心脚本、候选src/shell/vault/Unlock.astro与局部脚本、Base/ModuleShell最小接点、共享玻璃token的必要复用；tests/e2e/vault*.spec.ts、PLAN.md。

#### Non-goals

不增加专属Private主题/Dashboard、永久登录按钮、Terminal命令、全站设置页或复杂手势；不重做Spotlight。

#### Done Criteria

- [x] 长按/取消/短按/键盘均符合约定，模块入口可正常点击，触摸不会再闪蓝方块或遮挡四侧标签。
- [x] 正确口令解锁，失败/取消/未配置有明确反馈；请求期间关闭或进入后台不会随后自动解锁。
- [x] 两个dialog不会同时打开，焦点恢复、滚动锁定、关闭动画及reduced-motion正常。
- [x] 明暗与320–430px模拟下文字可读、输入/提交/关闭可操作，不用装饰动画掩盖错误。
- [x] 私人锁定是实际会话清理，不仅更换图标或隐藏一层CSS。

#### Verification

公共检查；生产预览测试指针时长边界、移动取消、键盘/IME、外部点击/Esc/关闭、快速重入、错误/缺包/网络/不支持API、异步取消和主动锁定。审阅明暗桌面/手机截图；根/base、Chromium/WebKit基础交互通过。真机基础检查集中4.8。

#### 后续依赖 / Completion Record

4.5从真实入口接第一条私人内容链路；此时无真实内容仍可以用隔离密文fixture完整验证解锁。**Completion Record（2026-10-14）**：中心1500ms长按/移动取消/短按无动作/键盘入口、可读玻璃Unlock、缺包/失败/重试/安全API错误、真实解密和取消锁定、互斥dialog/焦点/滚动/关闭衔接、页头小锁定控制完成。lint/typecheck（106files0诊断）/34unit/build及根/base各50e2e退出0；WebKit7项UI和稳定视觉7项通过；已审阅明暗桌面/320短屏稳定截图，不把动画中间帧当最终可读性证据。无生产测试包/默认口令，私人内容尚未接入。证据.cache/4.4-ui-checks.log、4.4-base-checks.log、4.4-webkit-ui-checks.log、4.4-stable-visual-results、4.4-final-types.log。真实手机集中4.8。

### Milestone 4.5 — Think私人内容完整链路

**Status：Done。**

#### Goal / Scope

先用一个模块证明“密文 → 解锁 → 模块列表 → 详情 → 返回 → 锁定”可用，以非敏感文章/随记样本验收，不向作者索要私人笔记。

#### Tasks / Technical Approach

- 在Think内部实现浏览器payload校验、列表/详情渲染和目标解析，复用已批准阅读风格，保留公共文章原始路径。
- 实现4.1约定的安全Markdown子集；私有资源按加密协议解密，不加载未批准远程内容/脚本或执行MDX。
- 私人目标使用模块地址与不透明fragment；直接访问/刷新先锁定，解锁后定位；无效目标显示安全空状态，返回仍在Think内。
- 实现模块自己的count/search投影接口供4.7消费；本项不接全局搜索或Radar。
- 锁定清除正文、标题/标签/描述、DOM、模块缓存和Blob；公共文章继续正常阅读。

#### Files

src/modules/think/vault.client.ts、模块内私人列表/阅读组件与必要Index.astro接点、安全纯校验/打包适配；tests/unit/think*.test.ts、tests/e2e私人阅读测试与隔离fixtures；作者指南和PLAN.md。

#### Non-goals

不重写公开文章编译器、统一全站文章模型、加入在线编辑/评论/全文索引；不录入新的真实文章，也不接其他模块。

#### Done Criteria

- [x] 非敏感文章/随记样本可进入、阅读、返回，中文/代码/允许媒体正常，公开文章不受影响。
- [x] 私人详情无明文静态页，刷新/直达/无效目标行为正确，不透明标识不包含私人标题。
- [x] 脚本/HTML注入、危险URL和未加密私有资源被拒绝或安全处理，正文不通过任意innerHTML执行。
- [x] 解锁计数/投影准确；锁定后无正文/标题/资源/可点击私人入口残留。

#### Verification

公共检查；隔离生产浏览器完整链路与根/base刷新/回退/锁定，渲染安全负例、超限/损坏内容、图片Blob释放和late render测试。以已知canary检查静态产物与锁定DOM/索引，直接请求private样本地址不得得到明文。现有Think公开用例继续通过。

#### 后续依赖 / Completion Record

4.6参考已验证的安全接点，各模块仍使用自己的内容模型；不复制Think模型到Core。**Completion Record（2026-10-14）**：Think模块拥有私人schema/安全Markdown/列表详情与count/search投影，加密图片Blob显示；普通公开文章不附加私人列表。同页fragment显式切换视图，静态明文详情不生成；直达/刷新中性提示调用同一Unlock并恢复目标，主动锁定清除片段/正文/Blob。lint/typecheck（112files0诊断）/35unit/build/53浏览器退出0；根base与WebKit各3专项通过，安全HTML/危险链接不执行、不请求远程图片，缺失asset失败关闭，未知目标安全反馈；已审阅375明暗阅读图。旧fragment仅改URL的失败修复并复验，未降低断言。证据.cache/4.5-final-checks.log、4.5-verified-base-checks.log、4.5-verified-webkit-results及4.5-final-types.log；生产无测试明文/包，无真实材料要求，未接全局私人搜索统计。

### Milestone 4.6 — Keep / Build / Me私人适配

**Status：Done。**

#### Goal / Scope

将同一访问能力接入其他三个现有模块，各自保持布局和内容语义，不为了填充条目重做页面。

#### Tasks / Technical Approach

- Keep：私人收藏加入自己的分类/详情/来源操作，类别和私有来源仅解锁后可见，不自动抓取网站。
- Build：支持私人项目及已有公开项目的私人补充；阶段、更新、问题属于项目，模型负责合并和实际计数。
- Me：支持可选私人补充资料，保持个人主页，不另造资料统计或第二套个人站。
- 每个模块都有独立schema、目标/count/search和清理适配；没有私人内容的空态可正常使用，不出现测试占位卡片。
- 处理id冲突、被删除公共父项目、非法URL/字段与缺少私人适配，失败保持安全且不污染其他模块。

#### Files

src/modules/keep、build、me各自的vault.client.ts/vault.server.ts、必要模块内组件与入口接点；对应单元/浏览器fixture和维护文档、PLAN.md。共享接点只允许已有契约所需的通用修复，不增加模块id分支。

#### Non-goals

不增加网站自动抓取、项目任务管理系统、私人日历/通讯录、后台编辑，不导入另一模块数据或实现旅行/摄影。

#### Done Criteria

- [x] 三模块各自完成解锁浏览/详情或补充/返回/锁定，现有公共布局/分类/外链不退化。
- [x] Build同一项目补充不重复计数，Me资料补充不虚增，Keep计数/类别与实际可访问条目一致。
- [x] 全空、部分模块无私人条目、错误字段/父项/id冲突均按约定处理，不留下半渲染私人内容。
- [x] 私人明文只存在解锁运行时，模块无互相import，锁定后各自清理完整。

#### Verification

公共检查；三模块隔离样本、空集合与边界单元测试，生产浏览器模块链路、外链新标签/返回、Build公开项目私人补充、Me无补充情况；根/base/两引擎必要移动回归。扫描静态产物与锁定DOM，验证引用和资源没有绕过加密边界。

#### 后续依赖 / Completion Record

4.7消费四模块已有的私人投影和数量，不能在共享搜索中解释它们的内部模型。**Completion Record（2026-10-14）**：Keep模块私人分类/说明/来源、Build私人项目及公开项目补充阶段更新问题、Me私人资料补充完成；三模块各自schema/目标/count/search/安全DOM及dispose，无跨模块import。独立计数测试验证补充不增加项目数、Me不虚增；缺失公开父项失败回滚全部模块，全空不生成占位。lint/typecheck（116files0诊断）/36unit/build/56生产浏览器通过；根base及WebKit各3私人模块专项通过，375pxMe/Build截图已审阅，无全页横向溢出；来源保留新标签/noopener noreferrer，锁定清理所有私人正文。证据.cache/4.6-final-checks.log、4.6-base-checks.log、4.6-webkit-results；全局私人搜索/Compass留4.7，未填真实私人资料。

### Milestone 4.7 — 私人搜索、Compass与全量清理

**Status：Done。**

#### Goal / Scope

让解锁后的Spotlight和Compass表达当前可访问内容，锁定后立即恢复公开状态，不改变搜索产品职责。

#### Tasks / Technical Approach

- Search组合既有公共投影与模块生成的内存私人投影，按稳定目标去重；中文匹配、排序、模块捷径与失败重试保持一致。
- 私人搜索目标经过所属模块目标解析校验，不能放宽公共buildPublicData的静态页面检查来迁就运行时URL。
- 根据模块实际可访问计数更新Radar、读数、aria-label与Me同伴平均；零条模块与无私人适配模块参与规则一致。
- 锁定清除私人候选、查询/结果DOM、缓存、选中目标、已打开内容、Blob和异步回调；恢复公共几何与头部元信息。
- 验证约定自动接入：隔离第五模块提供自己的私人适配即可参与，不改Home/Compass/Spotlight/Core模块名单。

#### Files

src/core/search中的必要纯组合/验证接点、私人适配Registry、src/shell/home/spotlight.ts、Compass/geometry必要数据刷新；tests/unit/search/geometry与边界、tests/e2e、隔离扩展验证脚本；PLAN.md。

#### Non-goals

不增加锁定命令、全局私人内容图、正文全文搜索、模糊/语义服务、聚合Timeline或Dashboard。

#### Done Criteria

- [x] 锁定只搜索公共内容；解锁后私人中文/英文结果可点击及Enter打开正确目标，模块自动接入。
- [x] 空Vault、全零、混合公开/私人、重复目标和已有项目私人补充的实际计数正确，Me平均/aria与Radar一致。
- [x] 搜索打开期间锁定不残留标题/摘要/候选；旧请求完成不能重新加入私人结果。
- [x] 公共JSON和生产静态head仍只含公共数据；重新锁定后既有公共搜索可用。
- [x] 隔离第五模块证明共享层无模块专属分支；无效/禁用适配器按协议处理。

#### Verification

公共检查；独立预期计数/平均值/搜索目标断言，不从被测索引反向生成全部期望；根/base与两引擎锁定/解锁搜索、Enter、软键盘、快速锁定/重开、延迟请求和回退。扩展契约、4–7几何/标签碰撞、公开索引字节/字段及静态canary扫描通过。

#### 后续依赖 / Completion Record

4.8进行完整功能、安全与维护/发布验收；首批真实私人记录仍不是依赖。**Completion Record（2026-10-14）**：模块拥有的私人搜索投影经所属目标/计数/字段验证后与公开索引在内存组合；Spotlight和Compass/Radar/aria/Me平均同步刷新，锁定清空查询、候选、正文、Blob和延迟跳转。修复展开弹窗静止指针误选Build，减少动态偏好仍能悬停/键盘选择；取消完整模态动画子树，在原生转场创建后立即skipTransition，解决WebKit私人导航崩溃，不捕获私人快照。长按使用Pointer Capture，保留位移/松手/取消边界。lint/typecheck（120files0诊断）/38unit/build及根/base各60浏览器退出0；WebKit搜索3通过，第五模块真实会话/私人自动注册两引擎各3通过，无效/禁用目标拒绝；4–7两引擎8几何组合通过。公开JSON字节/字段不变，独立预期计数3/2/1/2与平均2.33、同URL私人描述、迟到请求/IME/锁定回退全部通过。证据.cache/4.7-complete-checks.log、4.7-complete-base-checks.log、4.7-complete-webkit-checks.log、4.7-extension(-webkit)-checks.log、4.7-geometry.log。旧失败/诊断保留，未弱化原断言；真机/最终发布留4.8。

### Milestone 4.8 — 安全、维护恢复与阶段验收

**Status：In Progress。**

#### Goal / Scope

验证整个私人功能链路和作者维护方式，完成获准的发布/手机验收后暂停。功能验收不与真实内容填充捆绑。

#### Tasks / Technical Approach

- 执行完整安全负例、产物/仓库边界、存储/日志/网络、锁定/历史/Blob清理和跨模块回归；修复必须限于本阶段功能。
- 用非敏感样本实际完成新建/修改/删除私人条目、本地重新加密、换口令、密文备份恢复及重新部署候选；不使用作者真实秘密作为测试数据。
- 发布前明确受验源SHA/产物、恢复目标和最终Vault是否配置；检查CI只接收密文，测试后门/样本/私人源未混入生产。
- 在本项获得实际发布授权时沿用现有Actions/Pages，执行线上静态资产与公共路径检查。临时非敏感验收载荷必须明确标识并在结束后清除；真实材料尚未提供时，最终生产可保持未配置Vault。
- OPPO集中检查中心长按、口令键盘、解锁后模块/返回/搜索、主动锁定/后台/刷新和基础阅读；不扩大机型范围或重做完整移动设计。
- 按2026-10-15验收反馈，取消长按时Radar收缩/节点淡化和Unlock开关动画，移除悬停提示，保留玻璃材质、键盘与取消边界；本条替代4.4原先的入口动画约定，不改变公开Spotlight。核对四模块各自的私人内容与现有全局解锁契约，记录密码学方案和安全限制。
- 补充作者指南、已知限制、实际测试证据和各项Completion Record；完成后停止，不启动Phase 5。

#### Files

tests中的必要完整回归/产物验证、docs/vault-guide.md、docs/release-checklist.md、README.md、PLAN.md；仅必要的阶段内修复文件和现有发布检查接点。私人源文件不进入这些文件范围。

#### Non-goals

不要求首次真实私人日记/收藏/项目，不批量补内容，不新增功能候选、云同步、后台服务或未来模块；不把测试口令当生产口令。

#### Done Criteria

- [x] 4.1–4.7完成，公共/专项验证全通过；真实加解密、跨模块、搜索/统计、主动/自动锁定和刷新均可用。
- [x] 静态产物、候选Git文件、CI输出、浏览器持久化/URL无私人明文或密钥；扫描与结构边界同时验证，不将一次canary扫描当安全证明。
- [x] 非敏感样本的更新、删除、换口令、备份/恢复和失败保护可复现；恢复当前发布包不泄露明文。
- [ ] 最终源SHA/产物/部署状态、测试载荷清理及线上公共行为有证据；缺发布授权/凭据时不操作，必要发布未完成不能标Done。
- [ ] OPPO基础功能反馈记录，问题已修复；未实测平台与明确限制如实说明。
- [ ] 不需要真实材料也能完成本阶段；最终无测试条目冒充作者内容，汇总状态一致，停止待验收。

#### Verification

发布前npm run lint/typecheck/test/build、根/base完整e2e、现有test:extension/content/design/mobile相关回归及新增Vault验证；核对每个实际命令和退出结果。执行生产预览与线上必要浏览器/HTTP/资产/404检查，核对Actions源与产物，隔离恢复smoke和最终OPPO反馈。失败先修复并复验，不移到后续Phase绕过；工具不可用或必要反馈缺失如实记录，不能冒充通过。

#### 后续依赖 / Completion Record

Phase 4全部必需项Done后停止。可选Phase 5仍须用户选择/指定；内容充实按Phase 6后续进行。**Progress（2026-10-14）**：本地公共门槛退出0（122files0诊断、38unit、9页build），实际临时密文候选根/base各61浏览器通过，WebKit私人20/移动15通过；既有extension/content/design/mobile隔离构建与各浏览器探针通过，第五私人模块/会话两引擎各3通过。安全用例验证持久化/URL/日志/请求/后台/Blob/新标签，产物/Git/CI结构边界通过；NTFS ADS路径拒绝，重复page-load不再关闭刚打开的Unlock，after-swap及时初始化，空查询无选中不Enter误跳。CLI交互pack/verify/backup/rekey/restore实际完成且不回显口令，单位测试复验更新/删除/失败保护；9e7d878在新隔离checkout干净ci/build和2页面head/404检查通过。证据.cache/4.8-verified-candidate-checks.log、4.8-verified-base-checks.log、4.8-verified-webkit-checks.log、4.8-webkit-mobile-checks.log、4.8-contract-*-checks.log、4.8-rollback-checks.log；失败/诊断保留，未弱化断言。当前public/vault/bundle.json只是明确标识的非敏感手机验收包，不是作者内容或生产默认口令。尚待既有Pages实际发布、OPPO反馈、删除样本并最终复验发布；4.8与Phase 4保持In Progress。

### Open Questions / Risks 与默认假设

| 事项 | 本轮默认决策 | 处理时点 |
| --- | --- | --- |
| 是否需要真实账号/远程撤权 | 个人口令解密、静态托管；不做账号后台 | 4.1冻结；若需求不同先提出单独方案 |
| 口令与材料缺失 | 不索要秘密，不等待真实内容；使用隔离非敏感fixtures | 4.2–4.8验证；作者正式录入后续自行维护 |
| 浏览器支持和KDF耗时 | 原生标准API优先，不为手机方便弱化算法；失败保持锁定 | 4.1确定参数，4.2/4.4实际桌面模拟，4.8 OPPO复核 |
| 站内导航变化 | 最小ClientRouter接入是维护内存会话所需，不是产品改版 | 4.3重点验证现有脚本、前进/后退、焦点/滚动与BFCache |
| 内容执行与媒体泄漏 | 不执行私有MDX/JS；私人字节随密文包，未支持类型拒绝 | 4.1定义子集，4.5/4.6注入与资源负例 |
| 锁定便利性 | 主动、10分钟闲置、后台/pagehide即锁；软键盘blur不锁 | 4.1记录默认，4.4/4.8验证，不建设全站设置 |
| 旧密文与密码丢失 | 换口令不撤销已下载的旧包；忘记口令没有服务端找回 | 4.2/4.8明确备份/恢复与Git历史限制，不承诺删除一切历史副本 |
| 公开发布的未来操作 | 旧Phase 3授权不是本轮的新发布授权 | 用户明确指定后实施；本轮不推送、不部署 |
| 需求/文档旧编号 | 未实施路线已重排；既有完成记录保留旧编号历史 | 当前以本次Phase Roadmap/4–6为准；docs/architecture.md在4.1必要同步 |

### 技术参考与方案性质

[Astro ClientRouter生命周期](https://docs.astro.build/en/guides/view-transitions/)说明客户端换页后脚本需按生命周期重新初始化，本计划据此提出最小导航接入。其必要性来自当前静态页面跳转与内存会话要求的组合，是项目方案判断，并不是Astro保证了Vault保密。

上述MDN/OWASP资料作为标准API、随机字段和参数选择的依据；安全目标还必须由源文件、构建、内容渲染、会话及维护边界共同验证。4.1实施时再次核实指导，不默认升级依赖或声称专项认证。

## Phase 5 Candidate Plan

**Status：Pending。** 本阶段是可选功能清单；用户尚未选择任何候选，不构成新增产品要求。Private完成后先复盘使用缺口，若已有能力足够，可跳过本阶段进入后续内容维护。

### Milestone 5.1 — 功能复盘与本轮范围选择

- **Goal / Scope**：区分真正缺功能与缺内容，选择零个或少量候选；只做文档/只读检查。
- **Tasks / Technical Approach**：核对Private验收、现有模块能力和实际反馈；给选定候选固定Scope/Non-goals/文件/测试，记录不选原因；不以“功能完善”为名把所有候选全部开发。
- **Files**：PLAN.md，以及确有用户批准新增需求时的NEED.md条目。
- **Done Criteria**：选定集合、每项依赖及独立验收明确；未选项标记“本轮未纳入”，已实现的分类/项目记录不重复开发；用户未选时不能自行从候选开始实现。
- **Verification**：需求覆盖、现有代码/测试/文档核对、范围/状态一致性检查；本项纯文档不创建实现或配置。
- **依赖 / 状态**：Phase 4验收后；Pending。

### Milestone 5.2 — Think阅读辅助（可选）

- **Goal / Scope**：长文更易定位和读取代码；只做文章顶部可折叠页内目录与代码块复制，不新增固定Sidebar或全站导航。
- **Tasks / Technical Approach**：由本模块实际标题生成目录/锚点；复制需明确用户操作并反馈成功/失败；公开和已解锁私人阅读均适用，锁定清除生成的私人目录并阻止尚未发起的复制。系统剪贴板是用户主动导出的结果，锁定不能承诺撤销已完成复制。无标题/代码则不显示空控制。
- **Files**：Think Article.astro、私人阅读组件/模块内局部脚本、对应tests与内容指南。
- **Done Criteria**：目录锚点/返回/键盘正常，重复标题唯一，代码复制结果正确/失败有反馈；短文无空框，私有标题不进入静态输出/锁定DOM。
- **Verification**：公共门槛、标题/代码边界及实际Clipboard行为、根/base移动阅读与Private锁定回归；不修改剪贴板权限设置来伪造通过。
- **依赖 / 状态**：5.1明确选定，Private阅读稳定；Pending（未选择）。不涉及文字润色或新增文章。

### Milestone 5.3 — Keep局部检索与排序（可选）

- **Goal / Scope**：收藏更多时便于在当前模块查找；在既有平面分类上加名称/说明/域名查询及少量明确排序，范围只在Keep。
- **Tasks / Technical Approach**：复用Keep自己的可访问集合，原生局部输入与稳定排序；公开分类仍由既有URL状态管理，私人查询/类别不能写到可持久化URL或日志；锁定恢复公共结果，不与全局Spotlight合并成复杂搜索系统。
- **Files**：Keep Index.astro/私人列表及模块局部逻辑、keep单元/浏览器测试与内容指南。
- **Done Criteria**：分类与查询组合、排序、清空、空结果和历史返回正确，私有条目/查询锁定后清除；无自动抓取、层级分类、全局标签或私人源预览泄漏。
- **Verification**：公共门槛；隔离多收藏样本的独立期望排序/结果、根/base与手机键盘/返回、Private清理；当前只有一条真实收藏也可验证功能，不要求先补网站。
- **依赖 / 状态**：5.1明确选定、4.6/4.7稳定；Pending（未选择）。

### Milestone 5.4 — 公开Think订阅输出（RSS，可选）

- **Goal / Scope**：让他人通过已有订阅器跟进公开文章；仅一个模块的静态feed，不创建全站Activity。
- **Tasks / Technical Approach**：独立端点消费Think已有公开集合，明确文章/随记是否纳入；使用稳定绝对URL和正确XML转义。默认摘要输出，不复制整个正文，不改变Home导航；订阅链接只放Think局部。
- **Files**：候选src/pages/think/feed.xml.ts、Think局部链接、tests/unit/e2e及内容指南。
- **Done Criteria**：合法RSS、链接/site/base/日期准确，私人/未公开/测试条目绝不输出；新增/删除公开条目后feed与实际集合一致，空集合合法。
- **Verification**：公共门槛，XML解析/字段/escaping/根和base绝对URL、发布产物和非公开canary负例；现有Private与公开导航回归。
- **依赖 / 状态**：5.1明确选定且需求来源获准；Pending（未选择）。RSS不是本轮必须实现的要求。

**Phase 5停止标准**：只完成用户实际选定的项目，逐项更新验证/状态后停止。未选候选保留未实施记录，不标Done；若选择零项，记录本轮跳过，而非宣称所有功能已实现。编辑后台、账号系统、云同步、自动收藏抓取、评论/点赞、AI助手、全文搜索、统计Dashboard和地图不纳入默认候选。

## Phase 6 Deferred Plan

**Status：Pending，延后。** 此阶段把“一个合并模块的功能接入”与“作者持续填内容”区分，后者不是一次开发任务，也没有填满整个站点的完成指标。

### Milestone 6.1 — 合并旅行/摄影模块功能（延后、按需）

- **Goal / Scope**：一个模块承载旅行记录与照片，保持一个Registry入口；正式名称/id、记录/作品层级和计数在本项开始前结合材料确认。
- **Tasks / Technical Approach**：先确认一种简单组织方式，再在模块内做列表/详情、响应式图片与基本打开/返回；沿用Registry/count/search/pages约定，Compass只多一个方向。用隔离图文样本验证，生产无正式材料时不放测试作品，也不强行启用空模块。私人媒体只有明确选择时接入已验收Vault适配。
- **Files**：一个未来src/modules/<合并id>/及对应tests/媒体指南；共享导航不增加模块专属逻辑。
- **Done Criteria**：列表到详情、图片/文字/返回、统计/搜索和自动接入正确；无两个独立Photography/Travel入口，无虚构经历/重复占位图片；支持范围和未公开媒体保护有记录。
- **Verification**：公共门槛、第五模块自动接入、真实根/base路由及媒体请求/尺寸/手机防溢出、独立计数与搜索目标、必要Vault媒体回归；启用正式入口前核对实际公开材料。
- **依赖 / 状态**：已验收功能基线及用户明确指定；Pending。不为本项预建相册框架、地图、EXIF/地理分析或素材管理后台。

### Milestone 6.2 — 首次正式录入与维护演练（延后、一次验收单元）

- **Goal / Scope**：作者材料就绪后，只录入本次明确提供/获准的一小批内容，验证维护流程；不要求四模块和旅行/摄影同时更新。
- **Tasks / Technical Approach**：按所属模块既有格式录入；私人材料只在作者本地外部目录处理，聊天/公开仓库不接收秘密。先核对公开范围，再检查count/search/链接/资源和必要发布更新；素材缺失时保持Pending，不生成假的记录。
- **Files**：本次选定模块的实际内容文件或本地密文产物、内容指南/PLAN.md；不改Core模型。
- **Done Criteria**：此次内容真实、公开/私人边界与作者选择一致；页面/搜索/计数和维护路径正常；作者能据指南继续添加/修改/删除，实际验证/发布记录齐全。
- **Verification**：实际项目公共命令、受影响页面/搜索/平均统计smoke和必要线上检查；私人录入复验密文与锁定边界，不把公开可见性过滤当保密。
- **依赖 / 状态**：材料就绪、对应模块已具备功能、用户明确指定；Pending。只验证这一批，不将“未来持续写作”列为代码milestone。

以后增加网站收藏、项目阶段/更新/问题、文章/随记和旅行照片属于持续维护；内容增长不自动授权新功能或跨milestone改动。完成选定验收单元后停止，后续需要功能变化再另行规划。

## 本轮后续阶段重排的交付记录

2026-10-14，仅修改NEED.md与PLAN.md：同步用户明确的功能优先/旅行摄影合并要求；撤回未实施的两模块素材优先草案；将Private细化为Phase 4 /4.1–4.8，列出Phase 5可选功能和Phase 6延后内容路线。没有指定实现milestone，所有新增项Pending，Phase 1–3与D1–D8完成状态保持。

只读核对AGENTS/NEED/PLAN、实际模块/Registry/静态页面桥、公开统计/搜索、Base/Compass/Spotlight脚本、Keep局部脚本、测试清单与发布配置；参考标准API和官方导航文档。检查文档章节/链接、各milestone的Goal/Scope、Files、Technical Approach、Done Criteria、Verification与依赖、旧编号迁移及状态一致性，执行git diff --check并确认文件范围。

实际文档检查通过：8个Phase 4 milestone及6个后续候选/延后单元均具备所列必需字段，新增项全部Pending；与HEAD逐段比较确认Phase 1/2、D1–D8及Phase 3详细计划/完成记录内容未变；Git修改范围仅NEED.md与PLAN.md，git diff --check退出0。一次性检查脚本在内存运行，没有新增测试或配置文件。

本轮没有运行lint/typecheck/test/build/e2e或页面smoke，因为只修改规划，不改变运行时；不得把Phase 3历史通过记录当Private通过。本轮未创建源码/测试/配置/模块/素材或秘密文件，未提交/推送/部署。交付后停止，等待用户查验。

### Phase 4 / 4.8 临时发布记录（2026-10-14）

源 d15b4aa7b3cabf3ecef3ba9ec54552ff9bd08555 已通过真实手动运行 [38603980776](https://github.com/hjk202/hjk202.github.io/actions/runs/38603980776) 的全部 check/deploy；同SHA重复push运行38603978599取消，由手动运行完整执行所有门槛。Pages产物11914909008，digest sha256:ec4c384dc51deb2c64f11564f6b90d536c23cd97428d5d3546c0c5a85483babf。

线上25文件与受验清单哈希相同，8公开路径、4公开结果、真实404/资产/Me GitHub/手机标签间距通过；实际网络密文解锁后私人文章搜索/进入、Keep分类、Me补充与主动锁定通过。证据.cache/4.8-temporary-live.json及4.8-temporary-live-verified.log。临时包不是正式作者材料，OPPO基础检查已发起，尚待反馈；最终清理发布未完成，Phase 4/4.8保持In Progress。

最后一次取消边界审阅补充：页面离开时也必须锁定进行中的Core解密，不能只销毁dialog。新增确定性延迟解密负例；根公共门槛与62浏览器已通过，最终随样本清理版本发布。未实施Phase 5/6。

4.8最新验证补充：离页取消解密修复已通过全部公共门槛（122files0诊断、38unit、build）、根62浏览器及WebKit私人21；不含bundle的隔离最终预览也通过62浏览器与产物边界扫描。证据.cache/4.8-cancel-verified-checks.log、4.8-cancel-webkit-checks.log、4.8-unconfigured-preview-checks.log。当前修复仅本地保存，线上仍为已核验d15b4aa临时验收版；不将本地新源码冒充线上版本。

当前等待的是PLAN.md 4.8明确要求的OPPO基础实际反馈，不是重新申请发布许可；已发出一次验收问题，未收到回应前不假定通过，不删除待验收包。手机结果、源样本删除与最终新源CI/线上验证仍是剩余必需工作，4.8/Phase 4不标Done，Phase 5/6不开始。

### Phase 4 / 4.8 验收反馈处理（2026-10-15）

用户反馈需要每个模块各自的私人内容，且入口动画过于显眼，并要求说明加密安全性。这是待处理反馈，不是OPPO已通过。已核对Think/Keep/Build/Me各自的私人适配器及样本；保持一次全局解锁、各模块呈现自身私人部分，不新增私人聚合页或分模块口令。

本轮修复移除长按视觉进度、中心悬停提示及Unlock/遮罩开关动画；保留玻璃样式、焦点、键盘、长按取消、进行中解密取消与Spotlight已验收动画。同步NEED第37节及Vault设计/维护说明；密码协议参数未变，复核标准认证加密/口令派生及离线猜口令、脚本可信、旧密文不可撤回和未独立审计限制。相关测试增加长按前后Radar/节点外观不变、口令框/遮罩无动画和关闭恢复焦点的行为检查。

本轮实际验证：npm run lint/typecheck（122files，0错误/警告/提示）/test（38项）/build退出0；根与/personal-space/完整浏览器各62项通过，WebKit相关21项通过，涵盖四模块私人呈现/目标/搜索/锁定、入口无动画/手势取消及Build误选回归。Vault发布边界扫描通过；审阅浅色桌面和深色320短屏截图，玻璃口令框可读，短屏可滚动。证据.cache/4.8-quiet-entry-checks.log、4.8-quiet-base-checks.log、4.8-quiet-webkit-checks.log及对应results。未改变密码学协议，也未将测试当独立安全审计。

源2ddc5c4be27e7f30845824486a1221cd0c63a864已通过[完整检查与Pages发布38686191719](https://github.com/hjk202/hjk202.github.io/actions/runs/38686191719)。同SHA的重复push运行38686189583取消，手动流程完整执行所有门槛；受验产物11950886756，digest sha256:bcb1e05eaf6e563299b1c00f04ff1862d467c16e39d17dd9f416d902e28071b1。此前165e488的离页取消解密修复也包含在本次发布。

线上25文件哈希与受验清单一致，8个公开路径、真实404/搜索/Me链接/手机标签间距及实际解锁交互通过。首次线上追加读取索引超时日志保留；重试后的最终审阅发现私人跳转有7次原生skipTransition产生的未处理AbortError。旧线上脚本只在私人流程之前断言异常列表，因此其passed字段不能作为私人流程无异常的证明；原始证据保留.cache/4.8-quiet-before-ready-live.json。已补私人流程末尾异常断言和真实跨模块回归，旧产物确定性复现失败（.cache/4.8-ready-before-checks.log）；当前最小修复只处理主动跳过转场的ready AbortError，其他异常仍抛出，复验/再发布待完成。

用户可通过https://hjk202.github.io/?v=2ddc5c4复验。当前停在手机/内容组织验收；临时非敏感样本继续用于验收，尚未清理。四模块共用一次全局解锁和加密包，不是分模块权限域；密码学标准组合的安全边界见docs/vault-design.md。README旧公开版描述已标明为Phase 3历史记录。4.8和Phase 4保持In Progress，不开始Phase 5/6；文档记录的后续提交不改变本次已部署产品源。

转场补修本地复验：lint/typecheck（122files0诊断）/38unit/build、根/base各62浏览器及WebKit相关21全部退出0；新增真实私人跨模块pageerror空列表断言通过，旧产物失败日志保留，不过滤浏览器异常。产物边界扫描通过。证据.cache/4.8-ready-fixed-checks.log、4.8-ready-base-checks.log、4.8-ready-webkit-checks.log和4.8-ready-before-checks.log。待新源CI/实际线上全程异常复核后再交用户验收，不将2ddc5c4的部署记录用作新修复的发布证明。

**本轮最终停点（2026-10-15）**：补修源3dc65c5b23d3db4a0368b7af8eae29be507b4641经[38687875057](https://github.com/hjk202/hjk202.github.io/actions/runs/38687875057)全部check/deploy成功；同SHA重复push运行38687871718取消，手动完整执行所有门槛。Pages产物11949964815，digest sha256:8a511b9794e5dc6950613cffb579090a4f05ef97ac793499a54451d6b81ed08b。

实际线上25文件哈希与受验清单一致，8公开路径、真实404/公开搜索/Me链接/触摸高亮/标签间距通过；安静长按、真实密文解锁、Think/Build/Keep/Me各自私人内容、私人搜索/返回/主动锁定通过，私人流程结束后也严格检查全部pageerror为空，实际0项。不是过滤掉取消错误，而是产品正确处理主动skip产生的ready AbortError；其他错误仍报告。证据.cache/4.8-ready-manifest.json、4.8-ready-live.json、4.8-ready-live-verified.log。旧失败/不完整线上证据已保留并注明局限。

最新验收链接https://hjk202.github.io/?v=3dc65c5，替代前面的临时旧源链接。等待用户对OPPO基础操作、低调入口与四模块私人组织的复验；临时非敏感样本未清理，无真实私人材料。4.8/Phase 4保持In Progress，未进行最终无样本发布，Phase 5/6未开始；随后仅文档完成记录不改变已受验产品源。当前停止等验收。

## Phase 4 / 4.8 内室视觉反馈实施（2026-10-15）

用户已批准 docs/vault-visual-design.md，并明确授权先同步 NEED/PLAN、逐项实施和测试，全部完成后停止等验收。V1–V4 是4.8内的独立执行单元，不是新增Phase；只允许当前单元 In Progress，通过后顺序进入下一单元。4.1–4.7与已上线记录不重写；4.8最终发布与手机验收仍未完成。本轮不部署或删除验收样本。

### V1 — 内室环境与生命周期

**Status：Done。**

**Completion Record（2026-10-15）**：固定内室变量、对称静态环境与稳定搜索玻璃已完成；浅/深系统主题解锁、取消和锁定恢复通过，实际审阅Home/搜索截图。lint/typecheck、38unit、build、11浏览器通过。初次单测受沙箱临时目录rename EPERM阻止，正常权限复跑通过；初次浏览器默认缓存缺失，改用已有.cache/ms-playwright后通过，未改断言。证据.cache/inner-v1-checks.log、inner-v1-verified.log、inner-v1-browser.log、inner-v1-results；不是用户审美验收。
- **依赖 / Scope**：已完成的Vault状态/安静入口；新增固定深墨材质、Home与共享模块环境、清晰搜索面板、锁定主题恢复。
- **文件 / 技术方案**：shell/theme、glass、vault/runtime及必要页面环境样式；由真实data-vault-unlocked覆盖变量，静态渐变，无私人转场快照。
- **Non-goals**：模块内容排序、搜索来源标签、加密或会话政策调整。
- [x] **Done Criteria**：系统明暗下解锁主题一致且区别公开主题；取消/失败不提前换肤；锁定即时恢复；Home仍仅入口、搜索可读。
- **Verification**：npm.cmd run lint/typecheck/test/build；主题状态浏览器测试与既有Vault入口/会话回归，截图审阅。
- **后续依赖**：V2、V3复用材质；V4整体回归。

### V2 — 四模块私人优先与公开完整

**Status：Done。**

**Completion Record（2026-10-15）**：模块声明挂载槽与销毁回调，四模块私人优先、公开完整且标识清楚；Build补充归属项目并即时清理，Keep分类范围明确。lint/typecheck/38unit/build与13浏览器退出0。新增公开完整性测试首次将响应式隐藏装饰文字与新增私人提示一起作innerText比较，误报两项；已改为移除精确私人装饰节点后逐字比较完整公开textContent，复验通过，未删除断言。桌面四模块及375/320截图已审阅。证据.cache/inner-v2-checks.log、inner-v2-verified.log、inner-v2-verified-results。
- **依赖 / Scope**：V1；模块自行声明挂载槽，真实DOM顺序优先私人；Me叙述、Think文章/随记、Keep分类双区、Build独立项目和对应公开项目内补充；公开详情标识。
- **文件 / 技术方案**：vault/runtime最小挂载与清理约定、模块模板/vault.client/vault.css/background.css及相关测试。私人明文只在解锁时生成，补充提示随锁定移除。
- **Non-goals**：新内容、数据模型、通用布局引擎、复杂筛选/排序、编辑器。
- [x] **Done Criteria**：四模块身份/标题之后首先可见私人区域，公开入口/正文完整；两类标记清楚、空数据无伪卡；Keep分类作用域准确；Build不重复计数；视觉/DOM/键盘顺序一致，锁定无残留。
- **Verification**：公共四命令；四模块/详情/分类/锁定浏览器回归、新DOM顺序与完整性测试，375/320窄屏和桌面截图。
- **后续依赖**：V3搜索打开这些目标，V4综合验证。

### V3 — 搜索来源与阅读层级

**Status：Done。**

**Completion Record（2026-10-15）**：来源身份仅在浏览器投影Set中存在，实际内容命中显示公开/私人/混合标记，模块快捷入口保持中性；未改排序与公开四字段契约。首次回归发现模块名命中误贴私人标签，已修正并补独立同URL内容匹配样本。lint/typecheck/39unit/build及21浏览器退出0，搜索截图已审阅。证据.cache/inner-v3-checks.log、inner-v3-verified.log、inner-v3-verified-results；原失败记录保留。
- **依赖 / Scope**：V2；搜索公开/私人/混合来源标记，保持相关性与四字段公开索引，快捷入口无默认选中。
- **文件 / 技术方案**：core/search与shell/home/spotlight相关消费方和测试；来源只存在于当前会话投影，按实际匹配处理同URL结果。
- **Non-goals**：排序重写、命令系统、全文搜索、持久化私人元信息。
- [x] **Done Criteria**：准确显示命中来源，同URL去重后标记不误导；空查询无私人摘录；锁定清除标记/查询；键盘/IME/开关动画保持可用。
- **Verification**：公共四命令；来源纯逻辑测试、私人搜索/锁定/IME与公开搜索浏览器回归，搜索截图可读性。
- **后续依赖**：V4全面交叉验证。

### V4 — 整体验收与交付

**Status：Done。**

**Completion Record（2026-10-15）**：根/部署子路径完整回归、WebKit、空内容/仅私人内容、第五模块兼容及产物安全边界全部通过。补上无公开资料时Me的私人挂载位置；修正Keep“全部”标签的继承字号，保持公开模式外观。实际审阅Home+四模块并排图、明暗对照、公开/私人长文、搜索来源与320px模糊降级截图。完成是技术验证与视觉自检，不等于用户验收。

| 验证 | 实际结果 / 证据 |
| --- | --- |
| npm.cmd run lint / typecheck / test / build | 全部退出0；124文件零错误/警告/提示，39单测通过，9页生产构建；.cache/inner-v4-root.log |
| npm.cmd run test:e2e（根路径） | 72通过；.cache/inner-v4-root.log、inner-v4-root-results |
| npm.cmd run build -- --base /personal-space/ --outDir .cache/inner-v4-base-dist；对应完整e2e | 构建退出0、72通过；.cache/inner-v4-base.log、inner-v4-base-results |
| E2E_BROWSER=webkit 受影响内室/Vault/搜索/安全用例 | 28通过；.cache/inner-v4-webkit.log、inner-v4-webkit-results |
| node tests/verify-content.mjs；E2E_INNER_EMPTY=1 隔离空公开内容e2e | 新增/隐藏/删除/全零构建通过；仅私人、完全空集合2项通过；.cache/inner-v4-content-build.log、inner-v4-empty.log |
| node tests/verify-vault-session.mjs；E2E_SESSION_PROBE=1 | 隔离第五模块、导航/闲置/刷新/后台清理两引擎各3通过；.cache/inner-v4-extension.log |
| node --experimental-strip-types tests/verify-vault-release.mjs（根与base产物） | 全部通过，无测试明文/口令/源文件泄漏；.cache/inner-v4-boundaries.log；不等同独立密码学审计 |
| 页面smoke / 视觉证据 | 1440/375/320、系统明暗、减少动态、模糊降级与两类详情已检查；并排图.cache/inner-contact.png；本地4322实际密文四模块与锁定无页面异常，.cache/inner-preview-smoke.json |

本轮未部署、未提交、未清理待验收密文样本，也未更改口令协议或作者内容。预览 http://127.0.0.1:4322/ 已启动；仅使用此前明确标识的非敏感验收包。OPPO真实软键盘/横竖屏复验与用户审美确认尚未进行；当前4.8/Phase4不标Done。V1–V4全部完成，停止等待用户检查。
- **依赖 / Scope**：V1–V3全部Done；根/base完整回归、WebKit受影响路径、视觉与空/混合数据边界；必要最小修复、文档完成记录。
- **文件 / 技术方案**：受影响测试、NEED/PLAN/设计文档，必要范围内修复；使用隔离非敏感fixtures，保留实际证据。
- **Non-goals**：上线、清理待用户验收样本、Phase5/6、以自检代替用户认可。
- [x] **Done Criteria**：工程门槛与浏览器回归通过；1440/375/320与明暗/减少动态/模糊降级可读；全部公开内容可达、私人清理正确；记录限制并停止。
- **Verification**：公共四命令；完整npm.cmd run test:e2e根与/personal-space/；WebKit私人相关回归；Home+四模块并排图、公开/隐藏对照、两类详情与Spotlight截图；数据边界/产物泄漏检查。
- **后续依赖**：交用户视觉验收；本轮不把4.8或Phase4标Done，最终发布与OPPO检查另行完成。

### 4.8 内室验收版发布（2026-10-15，进行中）

用户认可本地内室效果并明确要求部署后停止，随后自行手机验收。本次仅发布已完成的V1–V4及原有非敏感验收密文；不新增功能，不清理手机检查仍需的样本，不将桌面认可当作OPPO已通过。

已核实认证账号hjk202、目标hjk202/hjk202.github.io的main及Pages workflow来源，远程发布基线3dc65c5。本地V4公共门槛、39unit、根/base各72浏览器、WebKit28及隔离边界记录保留；本次云端仍对实际源提交重新运行既有全部门槛。部署只使用通过检查的同一dist。源SHA、run、产物及实际线上核验结果将在完成后补记；4.8保持In Progress。

### 4.8 内室验收版发布完成（2026-10-15）

用户认可本地效果后明确授权上线并要求停止等手机验收。产品源1520c2f2768c757e0b602927e159ddda3d4cdba6已通过[完整检查与Pages发布38697523163](https://github.com/hjk202/hjk202.github.io/actions/runs/38697523163)的全部check/deploy。同SHA重复push运行38697519430取消，手动运行完整执行所有门槛，没有跳过部署前验证。Pages产物11955173318，digest sha256:0c1bd2b77ee39817705bb4277fb3e99a17e8a5182a17e65abd2f707947a1efcb。

下载实际云端Pages归档后核对，26文件与本地已认可构建逐项哈希一致；线上26文件也全部匹配。8公开路径、深层刷新/Home/返回、真实404、公开搜索/Me GitHub链接、手机标签间距与触摸高亮通过；真实网络密文安静解锁后Think/Build/Keep/Me、深墨主题、私人内容前置、公开内容完整、搜索来源标记、私人详情/返回和主动锁定通过。整个流程末尾严格断言全部pageerror为空，实际0项。

证据：.cache/inner-release-manifest.json、inner-ci-manifest.json、inner-release-artifact.json、inner-release-jobs.json、inner-release-live.log、inner-release-live.json、inner-release-live-home.png。云端执行完整既有lint/typecheck/unit/build、根/base浏览器、WebKit移动/私人、第五模块会话及extension/content/design/mobile隔离契约；本地V4逐项记录仍保留。

最新手机验收链接：https://hjk202.github.io/?v=1520c2f 。保留原有明确标识的非敏感验收密文，口令沿用此前测试口令；未填充真实私人内容。当前线上取代3dc65c5，随后文档完成记录不改变该已受验产品源。OPPO实机结果尚未取得，4.8/Phase4保持In Progress；不删除样本、不最终收尾、不进入Phase5/6。发布任务已完成并停止，等待用户手机验收。

### V5 — 口令输入与手机原生反馈

**Status：Done（本地实现与验证；未部署，OPPO真实外观待复验）。**

用户手机验收反馈口令注入顾虑与无下划线控件蓝框，并明确选择“保留正常符号，拒绝控制字符和超长输入”。本项是4.8内的最小验收修复，不启动其他Phase，也不把前次上线授权扩展为本轮自动发布。

- **Scope / Files**：core/vault的共享口令校验与crypto调用边界；Unlock.astro/unlock.ts的提示和移动输入属性；theme.css的全站原生点击高亮与键盘焦点区分；相关单元/浏览器测试；NEED/PLAN与Vault安全/维护说明。
- **Technical Approach**：口令只作为UTF-8密码学数据；输入与核心均校验长度和可接受的可打印Unicode类别，正常字母/数字/符号/空格保留，不trim、规范化、删除或静默截断。保持既有UTF-8 1024字节上限、新口令16字符下限和KDF/AES参数。原生点击高亮在根元素继承覆盖到summary等交互及其子节点，指针焦点不画原生轮廓，键盘focus-visible保留。
- **Non-goals**：纯字母数字限制、换口令/重加密样本、CSP/账户/服务器改造、隐藏仓库、上线、未来功能。
- [x] **Done Criteria**：非法或超长输入在KDF前被拒绝，错误不回显口令、无代码执行/网络/存储；符号口令与既有验收包兼容；普通字符逐字保留。支持原生高亮属性的引擎中summary/分类/链接/按钮触摸高亮透明，键盘焦点与展开/搜索/解锁/锁定正常；不支持该属性的引擎记录限制并执行交互/焦点检查。
- **Verification**：lint/typecheck/test/build；新增边界纯逻辑与真实浏览器负例；根/base受影响入口/模块/搜索/移动回归；Chromium与WebKit触摸/键盘检查，截图与产物扫描。记录OPPO仍待复验，不以模拟器替代真机。
- **Dependency / Stop**：依赖已完成V1–V4。通过后更新状态并停止，线上仍为1520c2f，手机真实结果和后续发布留待明确任务。

**Completion Record（2026-10-15）**：新增共享可打印Unicode口令校验，界面与核心都在KDF前拒绝非法/超长数据；保留标点、空格和原始字节，不trim/规范化/截断。原始paste在浏览器自动剥离换行前检查，失败保留原输入并提示；移动关闭自动大写/纠错。触摸高亮从仅a/button改为根元素继承，补齐summary/内部文字等原生交互；指针焦点与键盘focus-visible区分，未移除键盘轮廓。更新NEED及Vault设计/维护文档，说明输入字符串不执行代码、真实注入脚本仍可窃取口令、公开样本可解密与真实口令/历史泄漏边界。

最终实际验证：npm.cmd run lint/typecheck（126文件0错误/警告/提示）/test（42项）/build全部退出0；完整浏览器根与/personal-space/各75通过，WebKit相关31通过。包含原样符号/带空格口令、脚本样字符串无执行、无KDF的非法输入、原始换行/零宽/超长粘贴拒绝、保留输入及既有解锁/会话/搜索/分类/返回回归。Chromium检查summary/time/span/a/button高亮为透明；Windows WebKit不支持该私有CSS属性，测试按CSS.supports记录颜色检查不适用，仍实际验证触摸展开、键盘焦点及其他完整交互，不将其计作手机高亮已验收。

此前失败保留：新增触摸用例第一次未等待详情挂载，已补等待；随后旧产物确定性暴露summary非透明（.cache/v5-before-ready.log）。首次根/base协议互通失败来自测试独立加载器未包含新passphrase文件，已补齐；WebKit最初断言空的私有属性失败，能力探针确认不支持，记录条件与限制而不跳过交互。全部修复后按最终源码重新构建/验证；不是删除测试或吞掉异常。

证据：.cache/v5-final-root.log、v5-final-base.log、v5-final-webkit.log及各自results；触摸/键盘两种截图已审阅。产物边界扫描通过（.cache/v5-boundaries.log）；原有public/vault/bundle.json实际解密兼容，SHA256仍fa84cfa3c72c1b183e4bfccdc438c5d8cf1ebc8ce0095e4f6f5cdaefe26e0856，见.cache/v5-existing-sample.json。未换测试口令、未改KDF/AES/会话政策、未部署或填真实内容。Phase4/4.8保持In Progress，停止；OPPO真实点击外观、软键盘仍待发布后复验，完整Git历史和独立密码学审计未冒充完成。

### 4.8 / V5 修复发布（2026-10-15，进行中）

用户明确授权部署此次修复，完成线上验证后停止等手机验收。中断恢复时已核实本地仍为ed233c3、V5尚未提交，远程main仍1520c2f，无本次修复的已启动发布；因此继续正常提交与手动发布，不重复旧运行。

发布范围仅已通过本地验证的V5及其需求/安全/维护记录。42unit、126文件零诊断、生产build、根/base各75浏览器与WebKit31记录保留；云端对本次实际源提交重新执行完整既有门槛。手机仍需要此前非敏感验收包，保持包与测试口令不变，不清理样本或引入新功能。实际源SHA/run/产物/线上结果完成后补记，4.8保持In Progress。
