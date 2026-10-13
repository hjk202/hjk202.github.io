# 架构基线

本文记录 NEED.md 与 PLAN.md 已确认的架构边界。产品要求以 NEED.md 为准，实施范围和状态以 PLAN.md 为准，工作方式遵守 AGENTS.md。本文不能授权新功能或替代实施计划。

## 当前实现

Phase 1–2 实现按 PLAN.md 的 milestone 逐项完成与验收：

- Astro 静态输出，原生 Markdown 支持与 @astrojs/mdx 集成。
- TypeScript strict 检查；JavaScript、TypeScript 与 Astro lint。
- dev、lint、typecheck、build、preview 命令，以及精确版本和 npm 锁文件。
- Registry 自动发现四模块；通用路由桥生成模块及公开内容页。
- 构建期 count()/search() 生成数量和公开 JSON；浏览器只做轻量匹配。
- 首页为动态 Compass 与搜索入口；共享原生 dialog Spotlight 使用独立浏览器脚本。
- 主题跟随系统；玻璃效果限于 Compass 与 Spotlight，支持减少动态效果和模糊降级。
- tests 包含纯逻辑单元测试、独立浏览器回归和隔离第五模块扩展验收。

Phase 2 接入用户提供的四份真实内容。Think 的 content.server.ts 在构建期导入模块内 Markdown，metadata.ts 校验公开条件与元数据；pages.ts 将 Markdown Content 组件交给原有页面桥。Me、Build、Keep 分别通过模块内纯校验函数获得公开集合，再供页面、count/search 使用。没有改变 Core 契约或共享路由，也没有统一模块内容模型。

## 导航与职责

- 纵向浏览：Home → Module → Content。
- 横向查找：Spotlight → Module / Content。
- Home 只展示 Compass、Spotlight 入口和少量非交互身份信息。
- Module Shell 只提供 Home link、模块标识、搜索入口与内容插槽。
- Compass 表达模块组成和真实内容积累；Spotlight 仅搜索和跳转。

不增加第三套导航，不引入 Dock、Navbar、Sidebar、首页 Feed、Dashboard、Relations、Activity、聚合 Timeline 或知识图谱。

## 依赖方向与模块独立

共享 Shell 消费模块公共接口与 Registry 产生的公开数据。模块使用共享类型或必要的 Shell，不互相 import。

Home、Compass 和 Spotlight 不导入具体模块内部内容模型或数据加载器。普通 URL 链接用于跨模块引用，不建立框架级关系抽象。

Core 只承担 Registry、Search、Shared Types，以及后续获准的 Vault State。Think、Build、Keep 等内容模型由模块自行管理，不建立 UniversalContent。

## 模块接入约定

Milestone 1.2、1.3 建立以下约定：

- 模块位于 src/modules/<id>/，目录名与稳定 id 一致。
- module.ts 默认导出 id、name、route、icon、order、enabled、count() 和 search()。
- Registry 通过固定字面量文件匹配规则在构建期发现模块；不维护需随新模块改写的中心列表。
- pages.ts 提供模块内相对路径、页面组件及模块专属参数；空相对路径为模块首页。
- 3.5新增可选head.title/head.description，由模块为自己的公开页面声明；路由桥只转交，ModuleShell/Base统一输出并提供缺省。页面head不加入ModuleMetadata或SearchResult，不解析模块内部模型。中文文档语言、favicon与已知site/base下的canonical由Base处理；404为错误页面，不是模块或内容条目。
- 通用 src/pages 路由通过 getStaticPaths() 汇总启用模块的页面。模块目录不会自行成为 Astro 路由。
- 页面描述只适配静态路由，不统一内容类型；新增模块不要求修改 Home、Compass、Spotlight 或 Core 逻辑。

## 构建期与浏览器边界

Milestone 1.4 建立以下边界：

- count() 在构建期返回实际公开内容数量。
- search() 在构建期把模块内容转为公开 SearchResult 投影，不接收访客查询。
- SearchResult 仅 title、description、url、module；module 使用稳定 id。
- 浏览器只接收可序列化的模块元数据、数量和公开搜索投影，执行轻量匹配与弹层交互。
- 可选元数据 compassStatistic=peer-average 只控制 Compass 显示统计；Me 已声明该规则。Compass 用其他启用模块实际 count 的算术平均（含零、无同伴为0）生成几何与标注 Avg 的读数，不按模块 id 分支；公开 count 与 SearchResult 不变。
- 文件读取、Markdown/MDX 编译、构建 Registry、页面构建适配器及内部内容模型不进入浏览器。
- route 和结果 url 使用不含部署 base 的站内逻辑地址，统一地址处理负责添加部署前缀，后续验证根路径与项目子路径。

## 实施边界

Phase 1 只完成架构约定、最小演示目标、首页、Compass、Spotlight 与可扩展基础。实际能力按用户指定的一个 milestone 逐项实现，不提前进入下一项。

Phase 2 完成最小内容维护、模块阅读排版与真实内容联动。Private、中心长按、模块复杂内部功能、完整移动端适配、真实 Pages 发布、Photography/Travel 正式模块和非必要数据系统仍属于后续范围。私人访问状态不等同于明文数据保密，保密方案留到 Phase 5 专项设计。

Glass 集中于 Compass、Spotlight 和必要的模块局部控制，保持极简、留白和少量动画。模块内容页保持干净；不增加主题设置入口或连续背景动画。

## 数据与验证约定

四模块当前各有一份真实公开内容，默认计数均为 1。Me 资料直接构成模块首页；Think、Build、Keep 各有一份详情。published 显式为 true 才进入公开集合；无公开内容时模块首页保留、计数为 0、内容搜索结果为空。Think 按日期降序、同日按 slug 排序；Build/Keep 保持数组顺序。Keep 的站内详情 URL 与外部 sourceUrl 分开。

Registry 对缺失导出、目录 id、重复 id/route/order 和错误函数报告失败。页面桥拒绝缺失首页、重复地址、无效组件及越界相对路径；禁用模块不产生公开页面。统计或搜索适配器失败使构建失败，不替换成虚假的零。

搜索匹配模块名、标题和描述，英文忽略大小写、中文子串匹配，排序为精确、前缀、其他标题、描述，再按模块顺序、标题和地址稳定排序；同一目标去重。投影只含 title、description、url、module。

Spotlight 的空查询元数据由构建 Registry 注入，首次打开请求公开索引，在当前页面缓存；失败时保留模块入口和重试。原生 showModal 提供背景隔离，combobox 保持输入焦点，通过 aria-activedescendant 指示选中结果；Tab 限制在输入、关闭及可见重试按钮中，关闭恢复触发焦点。

tests/serve.mjs 只用于在本机测试静态产物，不是产品后端。隔离扩展测试将 src 复制到 .cache，再只增加 fixture 模块目录，并检查原始 src 的哈希未变；正式模块保持四个。Markdown fixture 使用 .fixture 后缀，在隔离副本中恢复真实扩展名。verify-content.mjs 验证新增文章、取消公开、全零与删除；原始源码始终不变。纯 Node 测试只执行纯规则/fixtures，真实 Astro 注册和 Markdown 编译由构建与浏览器验证。

公开状态用于页面、计数和搜索的编辑控制，不能保护源文件或资源。Astro 导入 Markdown 时，未渲染文章所引用的原始资源仍可能输出；不要在此存放需保密文件。Phase 2 未实现 Private 或资源保密层。

## 验证与收尾

执行当前 milestone 的 Done Criteria 和 Verification；lint、已有 typecheck/test、build 与必要页面 smoke test 均须满足。失败先修复，不能跳到下一项。当前没有可运行测试时如实记录不适用。

每项通过后更新 PLAN.md 对应 milestone 和必要汇总状态；依照此次用户授权继续下一项，Phase 2 全部通过后停止等待检查。后续 Phase 不因目录或依赖已经存在而获得实施授权。

## 已批准的独立内容空间修订

2026-10-13 已批准 DESIGN.md 的 D1–D7 修订：Shell 只提供中性宽度与低优先级默认排版，模块自行拥有个人主页、收藏目录、写意阅读和项目档案布局。Keep 平面分类/URL 筛选、Think 可选 article/note、Build 可选本地阶段/更新/问题都留在模块内，Core 与 SearchResult 不扩展，计数仍对应公开资料/条目/项目。项目过程不形成全站 Timeline；缺少数据时不显示虚构状态或空控制。Compass 的指针强调、键盘焦点和页面恢复分别处理；页面恢复清理临时状态，保留键盘可访问性。
